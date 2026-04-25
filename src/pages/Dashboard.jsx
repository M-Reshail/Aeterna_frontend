import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useQueryClient } from '@tanstack/react-query';
import Tooltip from '@components/common/Tooltip';
import {
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { AlertDetailModal } from '@components/dashboard/AlertDetailModal';
import { useSocket } from '@hooks/useSocket';
import { WS_EVENTS } from '@utils/constants';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import feedbackService from '@services/feedbackService';
import eventsService from '@services/eventsService';

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZERS
// ─────────────────────────────────────────────────────────────────────────────
const normalizeStatus = (status) => {
  if (status === 'pending') return 'new';
  return status || 'new';
};

const toDisplayText = (value, fallback = '') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '')))
      .filter(Boolean)
      .join(', ');
    return joined || fallback;
  }

  if (value && typeof value === 'object') {
    const candidate = value.summary || value.title || value.name || value.link || value.description;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return fallback;
};

const normalizeCategories = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toDisplayText(item, '').trim())
    .filter(Boolean);
};

const toHashtag = (value) => {
  const cleaned = toDisplayText(value, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim();
  return cleaned ? `#${cleaned.replace(/\s+/g, '_')}` : '';
};

const toObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // Non-JSON string content is valid; just treat as text-only payload.
    }
  }
  return {};
};

const inferEventType = (title = '') => {
  const lower = toDisplayText(title, '').toLowerCase();
  if (lower.includes('price')) return 'PRICE_ALERT';
  return 'NEWS';
};

// ─── Price alert title / summary generators ───────────────────────────────────

/**
 * Pick the single most relevant alert reason from the array or string.
 * Prioritises: Near ATL > Near ATH > first entry > raw string.
 */
const pickAlertReason = (reasonsField) => {
  const reasons = Array.isArray(reasonsField)
    ? reasonsField
    : typeof reasonsField === 'string' && reasonsField.trim()
      ? [reasonsField.trim()]
      : [];

  if (!reasons.length) return '';

  // Prefer ATL warnings - they are more urgent
  const atl = reasons.find((r) => /atl/i.test(r));
  if (atl) return atl;
  const ath = reasons.find((r) => /ath/i.test(r));
  if (ath) return ath;
  return reasons[0];
};

/** Format a raw price number to a human-readable dollar string. */
const formatPrice = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  if (n < 1)      return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Format a raw market-cap number to a human-readable string (e.g. 126.49M). */
const formatMarketCap = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
};

/** Format a percentage change with sign and 2 dp, e.g. "+1.23%" or "-0.45%". */
const formatPct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
};

/**
 * Generate a smart title for price alerts when the backend doesn't provide one.
 * Format: "{SYMBOL} — {primary alert reason}" or just "{Name}" as fallback.
 */
const generatePriceTitle = (content = {}) => {
  const symbol = (content.symbol || content.name || '').toUpperCase().trim();
  if (!symbol) return '';

  const reason = pickAlertReason(content.significant_moves || content.alert_reasons);
  return reason ? `${symbol} — ${reason}` : symbol;
};

/**
 * Generate a descriptive summary for price alerts when the backend omits one.
 * Format: "{Name} ({SYMBOL}) is trading at $X.XXXX, with +Y.YY% change in 24h. Market cap: $ZMB."
 */
const generatePriceSummary = (content = {}) => {
  const symbol  = (content.symbol || '').toUpperCase().trim();
  const name    = (content.name   || symbol).trim();
  const price   = formatPrice(content.current_price);
  const pct24h  = formatPct(content.change_24h_pct);
  const mcap    = formatMarketCap(content.market_cap);

  if (!symbol && !price) return '';

  const parts = [];
  const label = name && name !== symbol ? `${name} (${symbol})` : (symbol || name);
  if (label)  parts.push(label);
  if (price)  parts.push(`is trading at ${price}`);
  if (pct24h) parts.push(`with ${pct24h} change in 24h`);

  let sentence = parts.join(' ');
  if (sentence) sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';

  if (mcap) sentence += ` Market cap: ${mcap}.`;
  return sentence;
};

const normalizePriorityValue = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  if (upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') return upper;

  // Map common severity words into dashboard priority buckets.
  if (['CRITICAL', 'SEVERE', 'URGENT'].includes(upper)) return 'HIGH';
  if (['WARNING', 'MODERATE'].includes(upper)) return 'MEDIUM';
  if (['INFO', 'INFORMATIONAL'].includes(upper)) return 'LOW';

  return '';
};

const toNumericScore = (value) => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();
  if (!text) return null;

  // Accept forms like "82", "82.5", "82%", "score: 82".
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTimestamp = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === '') continue;

    if (typeof candidate === 'number') {
      const millis = candidate < 1e12 ? candidate * 1000 : candidate;
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
      continue;
    }

    const text = String(candidate).trim();
    if (!text) continue;

    const numericValue = Number(text);
    if (Number.isFinite(numericValue)) {
      const millis = numericValue < 1e12 ? numericValue * 1000 : numericValue;
      const numericDate = new Date(millis);
      if (!Number.isNaN(numericDate.getTime())) return numericDate.toISOString();
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return null;
};

const resolveEventPriority = (event = {}, content = {}) => {
  const details = (content && typeof content.details === 'object' && content.details)
    ? content.details
    : {};

  const explicitPriority = normalizePriorityValue(
    event?.priority ||
    content?.priority ||
    details?.priority ||
    content?.priority_marker ||
    details?.priority_marker ||
    content?.severity ||
    details?.severity ||
    event?.severity ||
    content?.impact ||
    details?.impact ||
    event?.impact
  );

  if (explicitPriority) return explicitPriority;

  const scored = [
    toNumericScore(content?.quality_score),
    toNumericScore(details?.quality_score),
    toNumericScore(content?.importance_score),
    toNumericScore(details?.importance_score),
    toNumericScore(content?.impact_score),
    toNumericScore(details?.impact_score),
    toNumericScore(content?.confidence_score),
    toNumericScore(details?.confidence_score),
    toNumericScore(content?.confidence),
    toNumericScore(details?.confidence),
    toNumericScore(event?.quality_score),
    toNumericScore(event?.importance_score),
    toNumericScore(event?.impact_score),
    toNumericScore(event?.confidence_score),
    toNumericScore(event?.confidence),
  ].find((value) => value !== null);

  if (scored !== undefined) {
    const normalizedScore = scored >= 0 && scored <= 1 ? scored * 100 : scored;
    if (normalizedScore >= 70) return 'HIGH';
    if (normalizedScore >= 50) return 'MEDIUM';
  }

  return 'LOW';
};

const normalizeAlert = (alert) => {
  const contentObject = toObject(alert?.content);
  const detailsObject = toObject(contentObject?.details);

  // Resolve canonical type early so title/summary generators know if this is a price event
  const rawBaseType = (alert?.type || contentObject?.type || '').toLowerCase();
  const isPriceEvent = rawBaseType === 'price';

  // ── Title ─────────────────────────────────────────────────────────────────
  // For price events the backend never sends content.title; generate from symbol + alert_reasons.
  const contentTitle = contentObject?.title
    || contentObject?.name
    || detailsObject?.title
    || detailsObject?.name
    || '';

  const generatedTitle = isPriceEvent ? generatePriceTitle(contentObject) : '';
  const resolvedTitle = alert?.title || contentTitle || generatedTitle;
  const title = resolvedTitle || generatedTitle || '';

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = toDisplayText(contentObject?.summary, '');

  const categories = normalizeCategories(
    Array.isArray(contentObject?.categories)
      ? contentObject.categories
      : detailsObject?.categories
  );

  const hashtags = categories.map(toHashtag).filter(Boolean);
  const baseType = toDisplayText(
    alert?.type,
    toDisplayText(contentObject?.type, inferEventType(title))
  ).toLowerCase();

  let normalizedType = toDisplayText(alert?.event_type, '').toUpperCase();
  if (!normalizedType) {
    if (baseType === 'price') normalizedType = 'PRICE_ALERT';
    else if (baseType === 'onchain') normalizedType = 'LARGE_TRANSFER';
    else normalizedType = baseType.toUpperCase();
  }

  return {
    id: alert.alert_id ?? alert.id,
    alert_id: alert.alert_id ?? alert.id,
    type: baseType || 'news',
    event_type: normalizedType,
    source: toDisplayText(alert.source, toDisplayText(contentObject?.source, 'Unknown')),
    title,
    content: summary || toDisplayText(alert.content, toDisplayText(alert.description, title)),
    summary,
    priority: resolveEventPriority(alert, contentObject),
    status: normalizeStatus(alert.status),
    timestamp: alert.created_at || alert.timestamp || alert.createdAt || new Date().toISOString(),
    entity: toDisplayText(alert.entity, toDisplayText(contentObject?.symbol, toDisplayText(contentObject?.name, toDisplayText(contentObject?.id, '')))),
    rawContent: {
      ...contentObject,
      details: detailsObject,
      title,
      summary,
      link: toDisplayText(contentObject?.link, toDisplayText(detailsObject?.link, '')),
      author: toDisplayText(contentObject?.author, toDisplayText(detailsObject?.author, '')),
      categories,
      hashtags,
      type: baseType || 'news',
    },
  };
};

const normalizeNewsEvent = (event) => {
  const content = toObject(event?.content);
  const details = toObject(content?.details);

  const isPriceEvent = String(event?.type || '').toLowerCase() === 'price';

  // ── Title ─────────────────────────────────────────────────────────────────
  const contentTitle = content?.title
    || content?.name
    || content?.symbol
    || details?.title
    || details?.name
    || event?.title
    || '';

  const generatedTitle = isPriceEvent ? generatePriceTitle(content) : '';
  const title = contentTitle || generatedTitle || '';
  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = toDisplayText(content?.summary, '');
  const link = toDisplayText(content.link, toDisplayText(details?.link, toDisplayText(event?.link, '')));
  const author = toDisplayText(content.author, toDisplayText(details?.author, toDisplayText(event?.author, '')));
  const categories = normalizeCategories(content.categories?.length ? content.categories : (details?.categories?.length ? details.categories : event?.categories));
  const hashtags = categories.map(toHashtag).filter(Boolean);
  const normalizedTimestamp = normalizeTimestamp(
    content?.published,
    content?.published_at,
    details?.published,
    details?.published_at,
    content?.timestamp,
    details?.timestamp,
    event?.timestamp,
    event?.created_at,
    event?.createdAt
  ) || new Date().toISOString();

  const baseType = String(event?.type || 'news').toLowerCase();
  let normalizedType = String(event?.event_type || '').toUpperCase();
  if (!normalizedType) {
    if (baseType === 'price') normalizedType = 'PRICE_ALERT';
    else if (baseType === 'onchain') normalizedType = 'LARGE_TRANSFER';
    else normalizedType = baseType.toUpperCase();
  }

  return {
    id: `event-${event?.id}`,
    event_id: event?.id,
    type: baseType,
    event_type: normalizedType || baseType.toUpperCase(),
    source: toDisplayText(event?.source, 'unknown'),
    title,
    content: summary,
    summary,
    link,
    author,
    categories,
    hashtags,
    priority: resolveEventPriority(event, content),
    status: 'new',
    timestamp: normalizedTimestamp,
    entity: toDisplayText(content.symbol, toDisplayText(content.name, toDisplayText(content.id, ''))),
    // Preserve raw content for detailed view
    rawContent: {
      ...content,
      title,
      summary,
      link,
      author,
      categories,
      hashtags,
      type: baseType,
    },
  };
};

const DEFAULT_FILTERS = {
  priority: ['HIGH', 'MEDIUM', 'LOW'],
  eventType: 'all',
  entity: '',
  dateFrom: '',
  dateTo: '',
  sources: [],
  contentFilter: 'all',
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'priority', label: 'Priority (High → Low)' },
  { value: 'unread', label: 'Unread First' },
];

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const isEventItemId = (id) => String(id).startsWith('event-');
const FALLBACK_SOURCE_OPTIONS = ['CoinDesk', 'CoinTelegraph', 'Decrypt', 'CoinGecko'];
const SOURCE_QUERY_BY_LABEL = {
  CoinDesk: 'coindesk',
  CoinTelegraph: 'cointelegraph',
  Decrypt: 'decrypt.co',
  CoinGecko: 'coingecko',
};

const normalizeSourceName = (source) => {
  const original = String(source || '').trim();
  const raw = String(source || '').trim().toLowerCase();
  if (!raw) return '';

  // Match patterns: www.coindesk.com, coindesk.com, coindesk
  if (raw.includes('coindesk')) return 'CoinDesk';
  // Match patterns: cointelegraph.com, cointelegraph
  if (raw.includes('cointelegraph')) return 'CoinTelegraph';
  // Match patterns: decrypt.co, decrypt
  if (raw.includes('decrypt')) return 'Decrypt';
  // Match patterns: coingecko.com, coingecko
  if (raw.includes('coingecko')) return 'CoinGecko';

  // Keep any valid upstream source visible, including custom/onchain sources.
  return original;
};

const toApiSourceParam = (sourceLabel) => {
  const mapped = SOURCE_QUERY_BY_LABEL[sourceLabel];
  if (mapped) return mapped;

  // Preserve unknown sources for filtering instead of dropping them.
  return String(sourceLabel || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
};

const PRICE_KEYWORDS = [
  'price',
  'surge',
  'drop',
  'rally',
  'crash',
  'ath',
  'atl',
  'market movement',
  'volatility',
  'breakout',
  'breakdown',
];

const isPriceRelatedAlert = (item) => {
  const eventType = String(item?.event_type || '').toLowerCase();
  if (eventType.includes('price')) return true;

  const text = `${item?.title || ''} ${item?.content || ''}`.toLowerCase();
  return PRICE_KEYWORDS.some((keyword) => text.includes(keyword));
};

const mergeAlertsPreservingReadState = (previousAlerts, incomingAlerts, readIdsSet) => {
  const prevById = new Map((previousAlerts || []).map((item) => [String(item.id), item]));

  return (incomingAlerts || []).map((item) => {
    const key = String(item.id);
    const previous = prevById.get(key);
    const shouldKeepRead = readIdsSet.has(key) || previous?.status === 'read';

    return {
      ...item,
      status: shouldKeepRead ? 'read' : item.status,
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = ({ hasFilters, onClear, loadError }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center px-8">
    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
      <Inbox className="w-8 h-8 text-slate-500" />
    </div>
    <h3 className="text-base font-bold text-white mb-2">No alerts found</h3>
    <p className="text-sm text-slate-500 max-w-xs mb-6">
      {loadError
        ? loadError
        : hasFilters
          ? 'No alerts match your current filters. Try adjusting or clearing them.'
          : 'Your alert feed is clear. New alerts will appear here in real-time.'}
    </p>
    {hasFilters && (
      <button
        onClick={onClear}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all duration-200"
      >
        Clear Filters
      </button>
    )}
  </div>
);

EmptyState.propTypes = {
  hasFilters: PropTypes.bool,
  onClear: PropTypes.func,
  loadError: PropTypes.string,
};

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const AlertSkeleton = () => (
  <div className="flex gap-4 p-4 rounded-xl bg-[#0D0D0D] border border-[#1F1F1F] animate-pulse">
    <div className="w-10 h-10 rounded-lg bg-white/5 flex-shrink-0" />
    <div className="flex-1 space-y-2.5">
      <div className="flex gap-2">
        <div className="h-4 w-14 rounded-md bg-white/5" />
        <div className="h-4 w-20 rounded-md bg-white/5" />
        <div className="ml-auto h-4 w-20 rounded-md bg-white/5" />
      </div>
      <div className="h-4 w-3/4 rounded-md bg-white/5" />
      <div className="h-3 w-full rounded-md bg-white/5" />
      <div className="h-3 w-2/3 rounded-md bg-white/5" />
    </div>
  </div>
);

const HighlightNewsSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={`news-skeleton-${i}`} className="bg-white/5 border border-white/10 rounded-lg p-3 animate-pulse">
        <div className="flex items-start gap-2">
          <div className="h-6 w-12 rounded bg-red-500/15 border border-red-500/20 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-11/12 rounded bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-white/10" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const HighlightEventsSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={`events-skeleton-${i}`} className="bg-white/5 border border-white/10 rounded-lg p-3 animate-pulse">
        <div className="flex items-start gap-2">
          <div className="h-6 w-16 rounded bg-amber-500/15 border border-amber-500/20 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-10/12 rounded bg-white/10" />
            <div className="h-3 w-2/3 rounded bg-white/10" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export const Dashboard = () => {
  const queryClient = useQueryClient();
  const { on } = useSocket({ autoConnect: true });
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [highImpactNews, setHighImpactNews] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(true);
  const toastRef = useRef(toast);
  const hasShownLoadErrorRef = useRef(false);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const loadDashboardData = useCallback(async (selectedSources = [], eventType = 'all') => {
    setIsLoading(true);
    setLoadError('');
    try {
      const sourceList = Array.isArray(selectedSources)
        ? selectedSources.filter(Boolean)
        : [];
      const sourceApiParams = Array.from(
        new Set(sourceList.map(toApiSourceParam).filter(Boolean))
      );

      // ALWAYS load available sources first - independently from alerts
      let apiSources = [];
      try {
        apiSources = await eventsService.getAvailableSources({ limit: 200 });
      } catch (error) {
        console.warn('Could not load available sources:', error.message);
        // Continue even if sources fail - use fallback
      }

      // Determine which API endpoint to call for alerts
      let feedResult = [];
      let feedError = null;

      try {
        if (sourceApiParams.length > 0) {
          // If sources selected: fetch from those sources with optional type filter
          const type = eventType === 'PRICE_ALERT'
            ? 'price'
            : (eventType === 'NEWS' ? 'news' : (eventType === 'ONCHAIN' ? 'onchain' : undefined));
          const results = await Promise.all(
            sourceApiParams.map((source) =>
              eventsService.getEvents({ skip: 0, limit: 100, source, type })
            )
          );
          feedResult = results.flat().filter(Boolean);
        } else if (eventType === 'NEWS') {
          // If only news filter selected (no sources): fetch all news
          feedResult = await eventsService.getEventsByType('news', { skip: 0, limit: 100 });
          if (!Array.isArray(feedResult)) feedResult = [];
        } else if (eventType === 'PRICE_ALERT') {
          // If only price filter selected (no sources): fetch all price events
          feedResult = await eventsService.getEventsByType('price', { skip: 0, limit: 100 });
          if (!Array.isArray(feedResult)) feedResult = [];
        } else if (eventType === 'ONCHAIN') {
          // If only onchain filter selected (no sources): fetch all onchain events
          feedResult = await eventsService.getEventsByType('onchain', { skip: 0, limit: 100 });
          if (!Array.isArray(feedResult)) feedResult = [];
        } else {
          // If no filter selected: fetch alerts
          feedResult = await alertsService.getAlerts({ skip: 0, limit: 50 });
          if (!Array.isArray(feedResult)) feedResult = [];
        }
      } catch (error) {
        feedError = error;
        console.warn('Could not load alerts:', error.message);
        // Don't throw - we want to show empty state but keep sources visible
        feedResult = [];
      }

      // Normalize based on event type
      const normalizedAlerts = (sourceApiParams.length > 0 || (eventType !== 'all' && !sourceApiParams.length))
        ? feedResult.flat().filter(Boolean).map(normalizeNewsEvent)
        : feedResult.map(normalizeAlert);

      setAllAlerts((prev) => {
        const merged = mergeAlertsPreservingReadState(prev, normalizedAlerts, readAlertIdsRef.current);

        // Extract sources from loaded alerts
        const sourcesFromAlerts = merged
          .map((item) => normalizeSourceName(item.source))
          .filter(Boolean);

        // ALWAYS include API sources and fallback options to keep data sources visible
        const mergedSources = Array.from(
          new Set(
            [
              ...(apiSources || []),
              ...sourcesFromAlerts,
              ...FALLBACK_SOURCE_OPTIONS,
            ].map(normalizeSourceName).filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));

        setSourceOptions(mergedSources);
        return merged;
      });

      // Handle errors after state updates so source options are preserved
      if (feedError && normalizedAlerts.length === 0) {
        const errorMsg = String(feedError?.message || '').toLowerCase().includes('resource not found')
          ? 'No alerts found for this filter. Try adjusting your filters.'
          : (feedError?.message || 'Failed to load alerts');
        setLoadError(errorMsg);
      }

      hasShownLoadErrorRef.current = false;
    } catch (error) {
      const isCorsIssue = String(error?.message || '').toLowerCase().includes('cors');
      const message = isCorsIssue
        ? 'Cannot load alerts: backend CORS is blocking this frontend origin.'
        : (error?.message || 'Failed to load dashboard alerts');

      setLoadError(message);
      if (!hasShownLoadErrorRef.current) {
        toastRef.current.error(message);
        hasShownLoadErrorRef.current = true;
      }
      // Clear alerts on error but PRESERVE source options
      setAllAlerts([]);
      // DON'T clear sources - they should remain visible
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectedSourcesKey = (appliedFilters.sources || []).join('|');
  const eventTypeKey = appliedFilters.eventType || 'all';

  const loadDashboardHighlights = useCallback(async () => {
    try {
      setIsLoadingHighlights(true);

      let news = [];
      try {
        const newsData = await eventsService.getEventsByType('news', { skip: 0, limit: 50 });
        if (Array.isArray(newsData)) {
          news = newsData
            .map(normalizeNewsEvent)
            .filter((n) => n.priority === 'HIGH')
            .slice(0, 3);
        }
      } catch (error) {
        console.warn('Could not load high-impact news:', error.message);
      }

      setHighImpactNews(news);

      const mockEvents = [
        {
          id: 'event-1',
          title: 'US Federal Funds Rate Decision',
          country: 'USA',
          impact: 'HIGH',
          time: '18:00',
          category: 'Rates',
        },
        {
          id: 'event-2',
          title: 'Eurozone Inflation Rate',
          country: 'Eurozone',
          impact: 'HIGH',
          time: '10:00',
          category: 'Inflation',
        },
        {
          id: 'event-3',
          title: 'UK Unemployment Rate',
          country: 'United Kingdom',
          impact: 'MEDIUM',
          time: '09:30',
          category: 'Employment',
        },
      ];

      setTodayEvents(mockEvents);
    } catch (error) {
      console.error('Error loading dashboard highlights:', error);
    } finally {
      setIsLoadingHighlights(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData(appliedFilters.sources || [], appliedFilters.eventType || 'all');
  }, [loadDashboardData, selectedSourcesKey, eventTypeKey]);

  useEffect(() => {
    loadDashboardHighlights();
  }, [loadDashboardHighlights]);

  useEffect(() => {
    const handleIncomingAlert = (incoming) => {
      const normalized = normalizeAlert(incoming || {});
      if (!normalized?.id) return;

      setSourceOptions((prev) => {
        const nextSource = normalizeSourceName(normalized.source);
        if (!nextSource || prev.includes(nextSource)) return prev;
        return [...prev, nextSource].sort((a, b) => a.localeCompare(b));
      });

      setAllAlerts((prev) => {
        if (prev.some((item) => item.id === normalized.id)) return prev;
        return [normalized, ...prev];
      });

      setRecentAlertIds((prev) => {
        const next = new Set(prev);
        next.add(normalized.id);
        return next;
      });

      setTimeout(() => {
        setRecentAlertIds((prev) => {
          const next = new Set(prev);
          next.delete(normalized.id);
          return next;
        });
      }, 1800);

      if (normalized.priority === 'HIGH' && typeof window !== 'undefined' && 'Notification' in window) {
        const permission = Notification.permission;
        if (permission === 'granted') {
          new Notification(normalized.title || 'New high priority alert', {
            body: normalized.content || normalized.source || 'Tap to view details',
          });
        } else if (permission === 'default' && !localStorage.getItem('alerts_notification_prompted')) {
          localStorage.setItem('alerts_notification_prompted', '1');
          Notification.requestPermission();
        }
      }

      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    };

    const unsubNewAlert = on(WS_EVENTS.NEW_ALERT, handleIncomingAlert);
    const unsubAlert = on('alert', handleIncomingAlert);

    return () => {
      if (typeof unsubNewAlert === 'function') unsubNewAlert();
      if (typeof unsubAlert === 'function') unsubAlert();
    };
  }, [on, queryClient]);

  // Close sort menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Apply filters + sort (memo)
  const filtered = useMemo(() => {
    let result = allAlerts;

    if (appliedFilters.priority.length < 3) {
      result = result.filter((a) => appliedFilters.priority.includes(a.priority));
    }
    if (appliedFilters.eventType && appliedFilters.eventType !== 'all') {
      if (appliedFilters.eventType === 'PRICE_ALERT') {
        result = result.filter(isPriceRelatedAlert);
      } else if (appliedFilters.eventType === 'NEWS') {
        result = result.filter((a) => !isPriceRelatedAlert(a));
      }
    }
    if (appliedFilters.entity) {
      const term = appliedFilters.entity.toLowerCase();
      result = result.filter(
        (a) =>
          a.entity?.toLowerCase().includes(term) ||
          a.title?.toLowerCase().includes(term) ||
          a.source?.toLowerCase().includes(term)
      );
    }
    if (appliedFilters.dateFrom) {
      const from = new Date(appliedFilters.dateFrom);
      result = result.filter((a) => new Date(a.timestamp) >= from);
    }
    if (appliedFilters.dateTo) {
      const to = new Date(appliedFilters.dateTo + 'T23:59:59');
      result = result.filter((a) => new Date(a.timestamp) <= to);
    }
    if (appliedFilters.sources?.length > 0) {
      const selectedSources = appliedFilters.sources.map((source) => String(source).toLowerCase());
      result = result.filter((a) => selectedSources.includes(normalizeSourceName(a.source).toLowerCase()));
    }
    if (appliedFilters.contentFilter === 'price') {
      result = result.filter(isPriceRelatedAlert);
    }

    const sorted = [...result];
    if (sortBy === 'oldest') {
      sorted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (sortBy === 'priority') {
      // Sort by priority first, then by recency (newest first)
      sorted.sort((a, b) => {
        const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    } else if (sortBy === 'unread') {
      sorted.sort((a, b) => {
        if (a.status === 'new' && b.status !== 'new') return -1;
        if (a.status !== 'new' && b.status === 'new') return 1;
        // Then by priority, then by recency
        const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    } else {
      // Default 'newest': sort by priority first (HIGH first), then by recency
      sorted.sort((a, b) => {
        const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    }
    return sorted;
  }, [allAlerts, appliedFilters, sortBy]);

  // Infinite scroll
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120 && !isLoadingMore) {
        if (visibleCount < filtered.length) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount((prev) => Math.min(prev + 4, filtered.length));
            setIsLoadingMore(false);
          }, 600);
        }
      }
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [filtered.length, isLoadingMore, visibleCount]);

  const visibleAlerts = filtered.slice(0, visibleCount);

  const handleMarkAsRead = useCallback(async (id) => {
    readAlertIdsRef.current.add(String(id));
    setAllAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'read' } : a)));
    setSelectedAlert((prev) => (prev?.id === id ? { ...prev, status: 'read' } : prev));
    if (isEventItemId(id)) return;
    try {
      await alertsService.markAsRead(id);
    } catch (error) {
      toast.error(error?.message || 'Failed to mark alert as read');
    }
  }, [toast]);

  const handleOpenAlert = useCallback((alert) => {
    // Auto-mark as read on open (Gmail-style)
    readAlertIdsRef.current.add(String(alert.id));
    const readAlert = { ...alert, status: 'read' };
    setSelectedAlert(readAlert);
    setAllAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, status: 'read' } : a)));
    if (isEventItemId(alert.id)) return;
    alertsService.markAsRead(alert.id).catch(() => {
      // Keep UI optimistic; errors are non-blocking for detail view.
    });
  }, []);

  const handleDismiss = useCallback(async (id) => {
    const previous = allAlerts;
    setAllAlerts((prev) => prev.filter((a) => a.id !== id));
    setSelectedAlert(null);

    if (isEventItemId(id)) return;

    try {
      await alertsService.dismissAlert(id);
    } catch (error) {
      setAllAlerts(previous);
      toast.error(error?.message || 'Failed to dismiss alert');
    }
  }, [allAlerts, toast]);

  const handleFeedback = useCallback(async (alertId, sentiment, comment = '') => {
    if (!user?.id) return;
    if (feedbackMap[alertId]?.submitted) return;

    try {
      await feedbackService.submitFeedback({
        alertId,
        userId: user.id,
        sentiment,
        comment,
      });
      setFeedbackMap((prev) => ({ ...prev, [alertId]: { submitted: true } }));
      toast.success('Feedback submitted');
    } catch (error) {
      toast.error(error?.message || 'Feedback submission failed');
    }
  }, [feedbackMap, toast, user?.id]);

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setVisibleCount(8);
    setFilterOpen(false);
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setVisibleCount(8);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData(appliedFilters.sources || [], appliedFilters.eventType || 'all');
    setIsRefreshing(false);
  };

  const handleApplyPriceFilter = useCallback(() => {
    const nextFilters = { ...filters, contentFilter: 'price' };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setVisibleCount(8);
  }, [filters]);

  const hasActiveFilters =
    appliedFilters.priority.length < 3 ||
    !!appliedFilters.entity ||
    !!appliedFilters.dateFrom ||
    !!appliedFilters.dateTo ||
    (appliedFilters.sources?.length ?? 0) > 0 ||
    appliedFilters.contentFilter === 'price';

  const currentSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || 'Newest First';

  return (
    <div className="min-h-screen w-full pt-24 sm:pt-28 pb-12 px-3 sm:px-4 lg:px-6" style={{ position: 'relative', zIndex: 1 }}>
      <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6">

        {/* TODAY'S HIGHLIGHTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-4 sm:p-5 hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                High-Impact News
              </h2>
              <button
                onClick={() => navigate('/news')}
                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all"
              >
                View All News
              </button>
            </div>
            {isLoadingHighlights ? (
              <HighlightNewsSkeleton />
            ) : highImpactNews.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No high-impact news today</p>
            ) : (
              <div className="space-y-2">
                {highImpactNews.map((news) => (
                  <div
                    key={news.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 hover:border-emerald-500/20 transition-all cursor-pointer"
                    onClick={() => handleOpenAlert(news)}
                  >
                    <div className="flex items-start gap-2">
                      <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-300 flex-shrink-0 mt-0.5">HIGH</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-white line-clamp-1">{news.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {news.source} • {new Date(news.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-amber-500/5 to-amber-600/5 border border-amber-500/20 rounded-xl p-4 sm:p-5 hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                Economic Events Today
              </h2>
              <button
                onClick={() => navigate('/economic-events')}
                className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all"
              >
                View Events
              </button>
            </div>
            {isLoadingHighlights ? (
              <HighlightEventsSkeleton />
            ) : todayEvents.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No economic events today</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.slice(0, 3).map((event) => (
                  <div key={event.id} className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 hover:border-amber-500/20 transition-all">
                    <div className="flex items-start gap-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold flex-shrink-0 mt-0.5 ${event.impact === 'HIGH' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {event.impact}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-white line-clamp-1">{event.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{event.country} • {event.time} • {event.category}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


      </div>

      {/* Detail modal — always uses the exact clicked alert's rawContent */}
      <AlertDetailModal
        alert={selectedAlert}
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onMarkAsRead={handleMarkAsRead}
        onDismiss={handleDismiss}
        onApplyPriceFilter={handleApplyPriceFilter}
        isPriceRelated={selectedAlert ? isPriceRelatedAlert(selectedAlert) : false}
        onFeedback={handleFeedback}
        feedbackState={selectedAlert ? feedbackMap[selectedAlert.alert_id ?? selectedAlert.id] : null}
      />
    </div>
  );
};

export default Dashboard;
