import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useQueryClient } from '@tanstack/react-query';
import Tooltip from '@components/common/Tooltip';
import {
  Bell,
  BellRing,
  AlertTriangle,
  Activity,
  RefreshCw,
  Download,
  SlidersHorizontal,
  ChevronDown,
  Inbox,
  Loader2,
  X,
} from 'lucide-react';
import AlertCard from '@components/dashboard/AlertCard';
import { OnchainCard } from '@components/dashboard/OnchainCard';
import { AlertDetailModal } from '@components/dashboard/AlertDetailModal';
import { FilterSidebar } from '@components/dashboard/FilterSidebar';
import { useSocket } from '@hooks/useSocket';
import { WS_EVENTS } from '@utils/constants';
import { enrichOnchainWalletPatterns, formatOnchainEvent } from '@utils/onchainFormatter';
import { mapAlertSignal } from '@utils/alertFormatter';
import { mapNewsFeedItem } from '@utils/newsFormatter';
import { normalizeFeedItem } from '@utils/feedAdapter';
import { normalizeEvent as normalizeUnifiedEvent } from '@utils/normalizeEvent';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import feedbackService from '@services/feedbackService';
import alertsService from '@services/alertsService';
import eventsService from '@services/eventsService';

// 
// NORMALIZERS
// 
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

const logIngestionResponse = (response, context = '') => {
  const debugEnabled = import.meta.env.DEV && typeof window !== 'undefined' && window.__DEBUG_NEWS_FEED === true;
  if (!debugEnabled) return;
  const items = Array.isArray(response) ? response : [];
  const first = items[0] || {};
  const firstContent = first?.content || {};

  console.groupCollapsed(`[News] /ingestion/events response ${context}`.trim());
  console.log('Full response:', response);
  console.table(
    items.slice(0, 5).map((item) => ({
      id: item?.id,
      source: item?.source,
      type: item?.type,
      title: item?.content?.title,
      author: item?.content?.author,
      hasLink: Boolean(item?.content?.link),
      categories: Array.isArray(item?.content?.categories) ? item.content.categories.length : 0,
    }))
  );
  console.log('First item extracted fields:', {
    title: firstContent?.title,
    summary: firstContent?.summary,
    link: firstContent?.link,
    author: firstContent?.author,
    categories: firstContent?.categories,
  });
  console.groupEnd();
};

const logMappingDebug = (rawItems, mappedItems, context = '') => {
  const debugEnabled = import.meta.env.DEV && typeof window !== 'undefined' && window.__DEBUG_NEWS_FEED === true;
  if (!debugEnabled) return;

  const raw = Array.isArray(rawItems) ? rawItems : [];
  const mapped = Array.isArray(mappedItems) ? mappedItems : [];

  console.groupCollapsed(`[News] mapping debug ${context}`.trim());
  console.log('Raw API response sample:', raw.slice(0, 3));
  console.table(
    raw.slice(0, 5).map((item, idx) => ({
      idx,
      id: item?.alert_id ?? item?.id,
      type: item?.type ?? item?.event_type ?? item?.content?.type,
      hasContent: Boolean(item?.content),
      hasDetails: Boolean(item?.content?.details || item?.details),
      txHash: item?.content?.transaction_hash || item?.content?.tx_hash || item?.details?.transaction_hash,
      from: item?.content?.from || item?.content?.from_address || item?.details?.from,
      to: item?.content?.to || item?.content?.to_address || item?.details?.to,
      token: item?.content?.token || item?.content?.symbol || item?.token,
    }))
  );
  console.log('Mapped output sample:', mapped.slice(0, 3));
  console.table(
    mapped.slice(0, 5).map((item, idx) => ({
      idx,
      id: item?.id,
      type: item?.type,
      title: item?.title,
      subtitle: item?.subtitle,
      source: item?.source,
      txHash: item?.txHash,
      fromAddress: item?.fromAddress,
      toAddress: item?.toAddress,
      token: item?.token,
      severity: item?.severity,
      confidence: item?.confidence ?? item?.confidenceScore,
    }))
  );
  console.groupEnd();
};

const inferEventType = (title = '') => {
  const lower = toDisplayText(title, '').toLowerCase();
  if (lower.includes('price')) return 'PRICE_ALERT';
  return 'NEWS';
};

const normalizeEventType = (value) => {
  const lower = String(value || '').trim().toLowerCase();
  if (lower.includes('price')) return 'price';
  if (lower.includes('onchain')) return 'onchain';
  return 'news';
};

const hasOnchainShape = (event = {}, content = {}) => {
  const onchainHints = [
    event?.txType,
    event?.token,
    content?.tx_hash,
    content?.transaction_hash,
    content?.from_address,
    content?.to_address,
    content?.wallet_from,
    content?.wallet_to,
    content?.blockchain,
    content?.chain,
  ];
  return onchainHints.some((value) => String(value || '').trim());
};

const detectNormalizedEventType = (event = {}, content = {}) => {
  const rawTypeCandidates = [
    event?.event_type,
    event?.type,
    content?.type,
    content?.event_type,
    content?.alert_type,
    inferEventType(event?.title),
  ];

  for (const candidate of rawTypeCandidates) {
    const normalized = normalizeEventType(candidate);
    if (normalized !== 'news') return normalized;
  }

  if (hasOnchainShape(event, content)) return 'onchain';
  return 'news';
};

const extractEventHash = (event = {}, content = {}) => toDisplayText(
  event?.event_hash,
  toDisplayText(content?.event_hash, toDisplayText(content?.hash, toDisplayText(event?.hash, '')))
);

const extractEventId = (event = {}, content = {}) => toDisplayText(
  event?.event_id,
  toDisplayText(content?.event_id, toDisplayText(event?.id, ''))
);

const getMergeKey = (item = {}) => {
  const hashKey = toDisplayText(item?.event_hash, toDisplayText(item?.rawContent?.event_hash, ''));
  if (hashKey) return `hash:${hashKey}`;

  const eventIdKey = toDisplayText(item?.event_id, toDisplayText(item?.rawContent?.event_id, ''));
  if (eventIdKey) return `event:${eventIdKey}`;

  return `id:${toDisplayText(item?.id, '')}`;
};

const mergeAlertEventPair = (first = {}, second = {}) => {
  const firstIsAlert = first?.payloadKind === 'alert';
  const secondIsAlert = second?.payloadKind === 'alert';
  const alertItem = firstIsAlert ? first : (secondIsAlert ? second : null);
  const eventItem = firstIsAlert ? second : secondIsAlert ? first : second;

  if (alertItem && eventItem) {
    return {
      ...eventItem,
      priority: alertItem.priority || eventItem.priority,
      status: alertItem.status || eventItem.status,
      alert_id: alertItem.alert_id || eventItem.alert_id,
      id: alertItem.id || eventItem.id,
      payloadKind: 'merged',
      rawContent: {
        ...(eventItem.rawContent || {}),
        ...(alertItem.rawContent || {}),
      },
    };
  }

  return {
    ...first,
    ...second,
    rawContent: {
      ...(first.rawContent || {}),
      ...(second.rawContent || {}),
    },
  };
};

const VALID_EVENT_TYPES = new Set(['news', 'price', 'onchain']);

const validateNormalizedEvent = (event = {}) => {
  const hasTitle = Boolean(toDisplayText(event?.title, ''));
  const typeValue = toDisplayText(event?.type, '').toLowerCase();
  const hasValidType = VALID_EVENT_TYPES.has(typeValue);
  const hasTimestamp = Boolean(toDisplayText(event?.timestamp, ''));

  const detailTitle = toDisplayText(event?.rawContent?.title, '');
  const detailSummary = toDisplayText(event?.rawContent?.summary, '');
  const feedSummary = toDisplayText(event?.summary, '');
  const titleMismatch = Boolean(detailTitle) && Boolean(toDisplayText(event?.title, '')) && detailTitle !== toDisplayText(event?.title, '');
  const summaryMismatch = Boolean(detailSummary) && Boolean(feedSummary) && detailSummary !== feedSummary;

  if (event?.rawContent?.has_image === true && !toDisplayText(event?.rawContent?.image_url, '')) {
    console.warn('Invalid event', event);
    console.warn('[News] missing image_url while has_image=true', {
      id: event?.id,
      event_hash: event?.event_hash,
      title: event?.title,
    });
  }

  if (titleMismatch || summaryMismatch) {
    console.warn('Invalid event', event);
    console.warn('[News] feed/detail mismatch', {
      id: event?.id,
      titleMismatch,
      summaryMismatch,
      feedTitle: event?.title,
      detailTitle,
      feedSummary,
      detailSummary,
    });
  }

  const isValid = hasTitle && hasValidType && hasTimestamp && !titleMismatch && !summaryMismatch;
  if (!isValid) {
    console.warn('Invalid event', event);
  }

  return isValid;
};

const validateNormalizedEvents = (events = []) => {
  const hashSeen = new Map();

  events.forEach((event) => {
    validateNormalizedEvent(event);

    const hash = toDisplayText(event?.event_hash, toDisplayText(event?.rawContent?.event_hash, ''));
    if (!hash) return;

    const existing = hashSeen.get(hash);
    if (existing) {
      console.warn('[News] duplicate event_hash detected', {
        event_hash: hash,
        firstId: existing?.id,
        duplicateId: event?.id,
      });
      return;
    }

    hashSeen.set(hash, event);
  });
};

const normalizeDashboardEvent = (event, sourceKind = 'events') => {
  const isAlertPayload = sourceKind === 'alerts';
  const content = event?.content || {};
  const eventHash = extractEventHash(event, content);
  const eventId = extractEventId(event, content);
  const unified = normalizeUnifiedEvent(event, isAlertPayload ? event : null);
  const normalizedFeed = normalizeFeedItem(event);
  const eventType = isAlertPayload
    ? detectNormalizedEventType(event, content)
    : normalizeEventType(event?.type);
  const sourceDisplay = unified.source || toDisplayText(normalizedFeed?.source, toDisplayText(event?.source, isAlertPayload ? 'Unknown' : 'unknown'));
  const sourceKey = String(sourceDisplay).trim().toLowerCase();

  if (isAlertPayload) {
    if (eventType === 'onchain') {
      const onchainFormatted = formatOnchainEvent({
        ...event,
        type: 'onchain',
        content: typeof event?.content === 'object' && event?.content ? event.content : {},
      });

      return {
        id: event.alert_id ?? event.id,
        alert_id: event.alert_id ?? event.id,
        event_id: eventId || null,
        event_hash: eventHash || null,
        payloadKind: 'alert',
        event_type: 'ONCHAIN',
        type: 'onchain',
        txType: onchainFormatted.txType,
        token: onchainFormatted.token,
        transferType: onchainFormatted.transferType,
        entityType: onchainFormatted.entityType,
        sizeCategory: onchainFormatted.sizeCategory,
        riskSignal: onchainFormatted.riskSignal,
        confidenceScore: onchainFormatted.confidenceScore,
        confidence: onchainFormatted.confidenceScore,
        whaleEvent: onchainFormatted.whaleEvent,
        whaleTier: onchainFormatted.whaleTier,
        whaleLabel: onchainFormatted.whaleLabel,
        blockchain: onchainFormatted.blockchain,
        network: onchainFormatted.network,
        txHash: onchainFormatted.txHash,
        fromAddress: onchainFormatted.fromAddress,
        toAddress: onchainFormatted.toAddress,
        fromShort: onchainFormatted.fromShort,
        toShort: onchainFormatted.toShort,
        directionText: onchainFormatted.direction,
        direction: onchainFormatted.txType,
        riskLevel: onchainFormatted.severity,
        amountUsd: onchainFormatted.amountUsd,
        amountDisplay: onchainFormatted.amountDisplay,
        amountFormatted: onchainFormatted.amountFormatted,
        usdFormatted: onchainFormatted.usdFormatted,
        metadata: normalizedFeed.metadata,
        score: onchainFormatted.score,
        source: unified.source,
        sourceKey: String(unified.source || '').trim().toLowerCase(),
        title: unified.title,
        subtitle: normalizedFeed.subtitle || onchainFormatted.subtitle,
        content: unified.summary || '',
        summary: unified.summary,
        description: unified.summary,
        reason: onchainFormatted.reason,
        severity: onchainFormatted.severity,
        priority: unified.priority,
        status: normalizeStatus(event.status),
        timestamp: unified.timestamp,
        detailTimestamp: unified.detailTimestamp,
        entity: onchainFormatted.token,
        rawContent: {
          ...(typeof event?.content === 'object' && event?.content ? event.content : {}),
          normalizedFeed,
          title: unified.title,
          summary: unified.summary,
          author: unified.author,
          image_url: unified.image_url,
          hashtags: unified.hashtags,
          mentions: unified.mentions,
          categories: unified.categories,
          published: unified.detailTimestamp,
          type: 'onchain',
          onchainFormatted,
        },
      };
    }

    const mappedSignal = mapAlertSignal(event);

    return {
      id: event.alert_id ?? event.id,
      alert_id: event.alert_id ?? event.id,
      event_id: eventId || null,
      event_hash: eventHash || null,
      payloadKind: 'alert',
      event_type: String(eventType || 'news').toUpperCase(),
      type: eventType,
      source: unified.source,
      sourceKey,
      score: 0,
      signalType: mappedSignal.signalType,
      title: unified.title,
      subtitle: normalizedFeed.subtitle || mappedSignal.subtitle,
      content: unified.summary || '',
      summary: unified.summary,
      description: unified.summary,
      reason: mappedSignal.reason,
      severity: mappedSignal.severity,
      confidenceScore: mappedSignal.confidenceScore,
      amountUsd: mappedSignal.amountUsd,
      amountDisplay: mappedSignal.amountDisplay,
      metadata: normalizedFeed.metadata,
      fromAddress: mappedSignal.fromAddress,
      toAddress: mappedSignal.toAddress,
      priority: unified.priority,
      status: normalizeStatus(event.status),
      timestamp: unified.timestamp,
      detailTimestamp: unified.detailTimestamp,
      entity: mappedSignal.token || toDisplayText(event.entity, ''),
      token: mappedSignal.token || toDisplayText(event.token, toDisplayText(event.entity, '')),
      txType: toDisplayText(event.txType, '').toLowerCase(),
      rawContent: {
        ...(typeof event?.content === 'object' && event?.content ? event.content : {}),
        normalizedFeed,
        title: unified.title,
        summary: unified.summary,
        author: unified.author,
        image_url: unified.image_url,
        hashtags: unified.hashtags,
        mentions: unified.mentions,
        categories: unified.categories,
        published: unified.detailTimestamp,
        signal: mappedSignal,
        type: eventType,
      },
    };
  }

  if (eventType === 'onchain') {
    const onchainFormatted = formatOnchainEvent(event);

    return {
      id: `event-${event?.id}`,
      event_id: eventId || event?.id,
      event_hash: eventHash || null,
      payloadKind: 'event',
      event_type: 'ONCHAIN',
      type: 'onchain',
      txType: onchainFormatted.txType,
      token: onchainFormatted.token,
      transferType: onchainFormatted.transferType,
      entityType: onchainFormatted.entityType,
      sizeCategory: onchainFormatted.sizeCategory,
      riskSignal: onchainFormatted.riskSignal,
      confidenceScore: onchainFormatted.confidenceScore,
      confidence: onchainFormatted.confidenceScore,
      whaleEvent: onchainFormatted.whaleEvent,
      whaleTier: onchainFormatted.whaleTier,
      whaleLabel: onchainFormatted.whaleLabel,
      blockchain: onchainFormatted.blockchain,
      network: onchainFormatted.network,
      txHash: onchainFormatted.txHash,
      fromAddress: onchainFormatted.fromAddress,
      toAddress: onchainFormatted.toAddress,
      fromShort: onchainFormatted.fromShort,
      toShort: onchainFormatted.toShort,
      directionText: onchainFormatted.direction,
      direction: onchainFormatted.txType,
      riskLevel: onchainFormatted.severity,
      subtitle: normalizedFeed.subtitle || onchainFormatted.subtitle,
      amountUsd: onchainFormatted.amountUsd,
      amountDisplay: onchainFormatted.amountDisplay,
      amountFormatted: onchainFormatted.amountFormatted,
      usdFormatted: onchainFormatted.usdFormatted,
      metadata: normalizedFeed.metadata,
      score: onchainFormatted.score,
      source: unified.source,
      sourceKey: String(unified.source || '').trim().toLowerCase(),
      title: unified.title,
      content: unified.summary || '',
      summary: unified.summary,
      description: unified.summary,
      reason: onchainFormatted.reason,
      severity: onchainFormatted.severity,
      priority: unified.priority,
      status: 'new',
      timestamp: unified.timestamp,
      detailTimestamp: unified.detailTimestamp,
      entity: onchainFormatted.token,
      rawContent: {
        ...content,
        normalizedFeed,
        title: unified.title,
        summary: unified.summary,
        author: unified.author,
        image_url: unified.image_url,
        hashtags: unified.hashtags,
        mentions: unified.mentions,
        categories: unified.categories,
        published: unified.detailTimestamp,
        type: 'onchain',
        onchainFormatted,
      },
    };
  }

  const mappedNews = mapNewsFeedItem(event);
  const link = toDisplayText(content.link, toDisplayText(event?.link, ''));

  return {
    id: `event-${event?.id}`,
    event_id: eventId || event?.id,
    event_hash: eventHash || null,
    payloadKind: 'event',
    event_type: String(eventType || 'news').toUpperCase(),
    type: eventType,
    source: unified.source,
    sourceKey: String(unified.source || '').trim().toLowerCase(),
    score: 0,
    title: unified.title,
    subtitle: normalizedFeed.subtitle || '',
    content: unified.summary || '',
    summary: unified.summary,
    description: unified.summary,
    link: mappedNews.link || link,
    author: unified.author,
    sentiment: mappedNews.sentiment,
    metadata: normalizedFeed.metadata,
    severity: normalizedFeed.severity || '',
    confidence: normalizedFeed.confidence,
    categories: unified.categories,
    hashtags: unified.hashtags,
    mentions: unified.mentions,
    image_url: unified.image_url,
    priority: unified.priority,
    status: 'new',
    timestamp: unified.timestamp,
    detailTimestamp: unified.detailTimestamp,
    entity: toDisplayText(content.id, toDisplayText(content.symbol, toDisplayText(content.name, ''))),
    token: toDisplayText(content.symbol, ''),
    txType: toDisplayText(content.txType, toDisplayText(content.tx_type, '')).toLowerCase(),
    // Preserve raw content for detailed view
    rawContent: {
      ...content,
      normalizedFeed,
      title: unified.title,
      summary: unified.summary,
      link: mappedNews.link || link,
      author: unified.author,
      sentiment: mappedNews.sentiment,
      image_url: unified.image_url,
      categories: unified.categories,
      hashtags: unified.hashtags,
      mentions: unified.mentions,
      published: unified.detailTimestamp,
      type: event?.type,
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
};

const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest First' },
  { value: 'oldest',   label: 'Oldest First' },
  { value: 'priority', label: 'Priority (High -> Low)' },
  { value: 'unread',   label: 'Unread First' },
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
  const raw = original.toLowerCase();
  if (!raw) return '';

  // Match patterns: www.coindesk.com, coindesk.com, coindesk
  if (raw.includes('coindesk')) return 'CoinDesk';
  // Match patterns: cointelegraph.com, cointelegraph
  if (raw.includes('cointelegraph')) return 'CoinTelegraph';
  // Match patterns: decrypt.co, decrypt
  if (raw.includes('decrypt')) return 'Decrypt';
  // Match patterns: coingecko.com, coingecko
  if (raw.includes('coingecko')) return 'CoinGecko';

  // Keep any valid upstream source visible, including onchain sources.
  return original;
};

const toApiSourceParam = (sourceLabel) => {
  const mapped = SOURCE_QUERY_BY_LABEL[sourceLabel];
  if (mapped) return mapped;

  return String(sourceLabel || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
};

// 
// STAT CARD
// 
const ACCENT_COLORS = {
  emerald: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', val: 'text-emerald-400' },
  red:     { icon: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     val: 'text-red-400'     },
  amber:   { icon: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   val: 'text-amber-400'   },
  blue:    { icon: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    val: 'text-blue-400'    },
};

const StatCard = ({ icon: Icon, label, value, subValue, accentColor = 'emerald' }) => {
  const c = ACCENT_COLORS[accentColor] || ACCENT_COLORS.emerald;
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#080808] border border-[#1A1A1A] hover:border-[#252525] transition-all duration-300">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg} border ${c.border}`}>
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${c.val}`}>{value}</span>
          {subValue && <span className="text-xs text-slate-500">{subValue}</span>}
        </div>
      </div>
    </div>
  );
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
  if (item?.type) return item.type === 'price';
  const eventType = String(item?.event_type || '').toLowerCase();
  if (eventType.includes('price')) return true;

  const text = `${item?.title || ''} ${item?.content || ''}`.toLowerCase();
  return PRICE_KEYWORDS.some((keyword) => text.includes(keyword));
};

const mergeAlertsPreservingReadState = (previousAlerts, incomingAlerts, readIdsSet) => {
  const prevByKey = new Map((previousAlerts || []).map((item) => [getMergeKey(item), item]));
  const incomingByKey = new Map();

  (incomingAlerts || []).forEach((item) => {
    const key = getMergeKey(item);
    const existing = incomingByKey.get(key);
    incomingByKey.set(key, existing ? mergeAlertEventPair(existing, item) : item);
  });

  return Array.from(incomingByKey.values()).map((item) => {
    const mergeKey = getMergeKey(item);
    const previous = prevByKey.get(mergeKey);
    const mergedWithPrevious = previous ? mergeAlertEventPair(previous, item) : item;
    const shouldKeepRead =
      readIdsSet.has(mergeKey) ||
      readIdsSet.has(String(mergedWithPrevious.id)) ||
      previous?.status === 'read';

    return {
      ...mergedWithPrevious,
      mergeKey,
      status: shouldKeepRead ? 'read' : mergedWithPrevious.status,
    };
  });
};

// 
// EMPTY STATE
// 
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

// 
// LOADING SKELETON
// 
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

// 
// MAIN DASHBOARD
// 
export const News = () => {
  const queryClient = useQueryClient();
  const { on } = useSocket({ autoConnect: true });
  const { user } = useAuth();
  const toast = useToast();
  const [allAlerts, setAllAlerts]         = useState([]);
  const [filters, setFilters]             = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [sortBy, setSortBy]               = useState('newest');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isLoading, setIsLoading]         = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [visibleCount, setVisibleCount]   = useState(8);
  const [filterOpen, setFilterOpen]       = useState(false);
  const [isRefreshing, setIsRefreshing]   = useState(false);
  const [showSortMenu, setShowSortMenu]   = useState(false);
  const [recentAlertIds, setRecentAlertIds] = useState(new Set());
  const [feedbackMap, setFeedbackMap] = useState({});
  const [sourceOptions, setSourceOptions] = useState([]);
  const [loadError, setLoadError] = useState('');
  const sortMenuRef = useRef(null);
  const feedRef     = useRef(null);
  const toastRef = useRef(toast);
  const hasShownLoadErrorRef = useRef(false);
  const readAlertIdsRef = useRef(new Set());
  const sourceOptionsRef = useRef(null);

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

      // Load and cache available sources once to avoid repeated expensive calls per filter update.
      let apiSources = sourceOptionsRef.current;
      if (!Array.isArray(apiSources) || apiSources.length === 0) {
        try {
          apiSources = await eventsService.getAvailableSources({ limit: 100 });
          sourceOptionsRef.current = apiSources;
        } catch (error) {
          console.warn('Could not load available sources:', error.message);
          apiSources = [];
        }
      }

      // Determine which API endpoint to call for alerts
      let feedResult = [];
      let feedError = null;

      try {
        if (sourceApiParams.length > 0) {
          const type = eventType === 'PRICE_ALERT'
            ? 'price'
            : (eventType === 'NEWS'
              ? 'news'
              : (eventType === 'ONCHAIN' ? 'onchain' : undefined));

          const results = await Promise.all(
            sourceApiParams.map((source) =>
              eventsService.getEvents({ skip: 0, limit: 50, source, type })
            )
          );
          feedResult = results.flat().filter(Boolean);
        } else if (eventType === 'NEWS') {
          // If only news filter selected (no sources): fetch all news
          feedResult = await eventsService.getEventsByType('news', { skip: 0, limit: 50 });
          if (!Array.isArray(feedResult)) feedResult = [];
        } else if (eventType === 'PRICE_ALERT') {
          // If only price filter selected (no sources): fetch all price events
          feedResult = await eventsService.getEventsByType('price', { skip: 0, limit: 50 });
          if (!Array.isArray(feedResult)) feedResult = [];
        } else if (eventType === 'ONCHAIN') {
          // If only onchain filter selected (no sources): fetch all onchain events
          feedResult = await eventsService.getEventsByType('onchain', { skip: 0, limit: 50 });
          if (!Array.isArray(feedResult)) feedResult = [];
        } else {
          // Default view should include mixed event types for "all" filters.
          feedResult = await eventsService.getEvents({ skip: 0, limit: 120 });
          if (!Array.isArray(feedResult)) feedResult = [];
        }
      } catch (error) {
        feedError = error;
        console.warn('Could not load alerts:', error.message);
        // Don't throw - we want to show empty state but keep sources visible
        feedResult = [];
      }

      // raw API -> normalizeEvent -> filter -> render
      const isEventsFeed = true;
      logIngestionResponse(
        feedResult,
        `(items: ${Array.isArray(feedResult) ? feedResult.length : 0}, sourceKind: ${isEventsFeed ? 'events' : 'alerts'})`
      );

      const normalizedAlerts = (feedResult || [])
        .flat()
        .filter(Boolean)
        .map((item) => normalizeDashboardEvent(item, isEventsFeed ? 'events' : 'alerts'));

      validateNormalizedEvents(normalizedAlerts);

      logMappingDebug(feedResult, normalizedAlerts, `(sourceKind: ${isEventsFeed ? 'events' : 'alerts'})`);

      const intelligenceReadyAlerts = enrichOnchainWalletPatterns(normalizedAlerts);

      setAllAlerts((prev) => {
        const merged = mergeAlertsPreservingReadState(prev, intelligenceReadyAlerts, readAlertIdsRef.current);

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
              ...sourceList,
              ...FALLBACK_SOURCE_OPTIONS,
            ].map(normalizeSourceName).filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));

        setSourceOptions(mergedSources);
        return merged;
      });

      // Handle errors after state updates so source options are preserved
      if (feedError && intelligenceReadyAlerts.length === 0) {
        const errorMessage = String(feedError?.message || '').toLowerCase();
        const errorMsg = feedError?.status === 401 || errorMessage.includes('authentication required') || errorMessage.includes('no refresh token')
          ? 'Session expired. Please sign in again.'
          : (errorMessage.includes('resource not found')
            ? 'No alerts found for this filter. Try adjusting your filters.'
            : (feedError?.message || 'Failed to load alerts'));
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

  useEffect(() => {
    loadDashboardData(appliedFilters.sources || [], appliedFilters.eventType || 'all');
  }, [loadDashboardData, selectedSourcesKey, eventTypeKey]);

  useEffect(() => {
    const handleIncomingAlert = (incoming) => {
      const normalized = normalizeDashboardEvent(incoming || {}, 'alerts');
      if (!normalized?.id) return;
      validateNormalizedEvent(normalized);

      setSourceOptions((prev) => {
        const nextSource = normalizeSourceName(normalized.source);
        if (!nextSource || prev.includes(nextSource)) return prev;
        return [...prev, nextSource].sort((a, b) => a.localeCompare(b));
      });

      setAllAlerts((prev) => {
        const mergeKey = getMergeKey(normalized);
        if (prev.some((item) => getMergeKey(item) === mergeKey)) {
          const merged = prev.map((item) => (
            getMergeKey(item) === mergeKey ? mergeAlertEventPair(item, normalized) : item
          ));
          return enrichOnchainWalletPatterns(merged);
        }
        return enrichOnchainWalletPatterns([normalized, ...prev]);
      });

      setRecentAlertIds((prev) => {
        const next = new Set(prev);
        next.add(getMergeKey(normalized));
        return next;
      });

      setTimeout(() => {
        setRecentAlertIds((prev) => {
          const next = new Set(prev);
          next.delete(getMergeKey(normalized));
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
        result = result.filter((a) => a.type === 'price');
      } else if (appliedFilters.eventType === 'NEWS') {
        result = result.filter((a) => a.type === 'news');
      } else if (appliedFilters.eventType === 'ONCHAIN') {
        result = result.filter((a) => a.type === 'onchain');
      }
    }
    if (appliedFilters.entity) {
      const term = appliedFilters.entity.toLowerCase();
      result = result.filter(
        (a) =>
          a.token?.toLowerCase().includes(term) ||
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

    const sorted = [...result];
    if (sortBy === 'oldest') {
      sorted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (sortBy === 'priority') {
      // Sort by priority first, then by recency (newest first)
      sorted.sort((a, b) => {
        const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    } else if (sortBy === 'unread') {
      sorted.sort((a, b) => {
        if (a.status === 'new' && b.status !== 'new') return -1;
        if (a.status !== 'new' && b.status === 'new') return 1;
        const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        // Then by priority, then by recency
        const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    } else {
      // Default 'newest': sort by priority first (HIGH first), then by recency
      sorted.sort((a, b) => {
        const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
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
  const unreadCount = allAlerts.filter((a) => a.status === 'new').length;
  const highPriorityCount = allAlerts.filter((a) => a.priority === 'HIGH').length;
  const highUnread = allAlerts.filter((a) => a.priority === 'HIGH' && a.status === 'new').length;

  const handleMarkAsRead = useCallback(async (id) => {
    setAllAlerts((prev) => {
      const target = prev.find((a) => a.id === id);
      const mergeKey = target ? getMergeKey(target) : '';
      readAlertIdsRef.current.add(String(id));
      if (mergeKey) readAlertIdsRef.current.add(mergeKey);
      return prev.map((a) => {
        const sameCard = a.id === id || (mergeKey && getMergeKey(a) === mergeKey);
        return sameCard ? { ...a, status: 'read' } : a;
      });
    });
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
    const mergeKey = getMergeKey(alert);
    readAlertIdsRef.current.add(String(alert.id));
    if (mergeKey) readAlertIdsRef.current.add(mergeKey);
    const readAlert = { ...alert, status: 'read' };
    setSelectedAlert(readAlert);
    setAllAlerts((prev) => prev.map((a) => {
      const sameCard = a.id === alert.id || (mergeKey && getMergeKey(a) === mergeKey);
      return sameCard ? { ...a, status: 'read' } : a;
    }));
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
    const nextFilters = { ...filters, eventType: 'PRICE_ALERT' };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setVisibleCount(8);
  }, [filters]);

  const hasActiveFilters =
    appliedFilters.priority.length < 3 ||
    appliedFilters.eventType !== 'all' ||
    !!appliedFilters.entity ||
    !!appliedFilters.dateFrom ||
    !!appliedFilters.dateTo ||
    (appliedFilters.sources?.length ?? 0) > 0;

  const currentSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || 'Newest First';

  return (
    <div className="min-h-screen w-full pt-24 sm:pt-28 pb-12 px-3 sm:px-4 lg:px-6" style={{ position: 'relative', zIndex: 1 }}>
      <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">News Alerts</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Alerts feed with advanced filters
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
            <Tooltip content="Reload latest alerts" placement="bottom">
              <button
                onClick={handleRefresh}
                className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium bg-[#0D0D0D] border border-[#1F1F1F] text-slate-400 hover:border-emerald-500/40 hover:text-emerald-400 transition-all duration-200 ${isRefreshing ? 'text-emerald-400 border-emerald-500/40' : ''}`}
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </Tooltip>
            <Tooltip content="Export visible alerts to CSV" placement="bottom">
              <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#0D0D0D] border border-[#1F1F1F] text-slate-400 hover:border-white/20 hover:text-white transition-all duration-200">
                <Download className="w-4 h-4" />
                Export
              </button>
            </Tooltip>
            {/* Mobile filter toggle */}
            <Tooltip content="Filter alerts" placement="bottom">
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className={`lg:hidden flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all duration-200 ${filterOpen ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#0D0D0D] border-[#1F1F1F] text-slate-400'}`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {hasActiveFilters && (
                  <span className="w-3 h-3 rounded-full bg-emerald-500 text-black text-[8px] font-bold flex items-center justify-center">!</span>
                )}
              </button>
            </Tooltip>
          </div>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <StatCard icon={Bell}          label="Total Alerts"    value={isLoading ? '...' : allAlerts.length}    subValue="all time"           accentColor="blue"    />
          <StatCard icon={BellRing}      label="Unread"          value={isLoading ? '...' : unreadCount}         subValue="requires action"    accentColor="amber"   />
          <StatCard icon={AlertTriangle} label="High Priority"   value={isLoading ? '...' : highPriorityCount}   subValue={`${highUnread} unread`}  accentColor="red"   />
          <StatCard icon={Activity}      label="Sources Active"  value={isLoading ? '...' : sourceOptions.length} subValue="live feeds"          accentColor="emerald" />
        </div>

        {/* MAIN CONTENT: SIDEBAR + FEED */}
        <div className="flex gap-2 items-start">

          {/* FILTER SIDEBAR  Desktop */}
          <div className="hidden lg:block w-72 xl:w-80 flex-shrink-0 sticky top-28">
            <FilterSidebar
              filters={filters}
              onFiltersChange={setFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              totalCount={allAlerts.length}
              filteredCount={filtered.length}
              sourceOptions={sourceOptions}
            />
          </div>

          {/* FILTER SIDEBAR  Mobile overlay */}
          {filterOpen && (
            <div className="lg:hidden fixed inset-0 z-40" onClick={() => setFilterOpen(false)}>
              <div className="absolute inset-0 bg-black/70" />
              <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] sm:max-h-[82vh] overflow-y-auto rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
                <FilterSidebar
                  filters={filters}
                  onFiltersChange={setFilters}
                  onApply={handleApplyFilters}
                  onClear={handleClearFilters}
                  totalCount={allAlerts.length}
                  filteredCount={filtered.length}
                  sourceOptions={sourceOptions}
                />
              </div>
            </div>
          )}

          {/* ALERT FEED */}
          <div className="flex-1 min-w-0 flex flex-col gap-2 sm:gap-3">

            {/* Feed toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 flex-wrap px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-white truncate">
                  {isLoading ? '' : filtered.length} alerts
                </span>
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Clear filters
                  </button>
                )}
              </div>

              {/* Sort dropdown */}
              <div ref={sortMenuRef} className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowSortMenu((v) => !v)}
                  className="w-full sm:w-auto flex items-center justify-between sm:justify-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-medium bg-[#0D0D0D] border border-[#1F1F1F] text-slate-400 hover:border-white/20 hover:text-white transition-all duration-200"
                >
                  <span className="truncate">{currentSortLabel}</span>
                  <ChevronDown className="w-3 h-3 flex-shrink-0" />
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 sm:right-0 top-full mt-2 z-30 w-full sm:w-48 rounded-lg sm:rounded-xl overflow-hidden bg-[#0D0D0D] border border-[#1F1F1F] shadow-2xl">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${sortBy === opt.value ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2 px-1 text-xs sm:text-sm">
                {appliedFilters.priority.length < 3 && (
                  <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Priority: {appliedFilters.priority.join(', ')}
                    <button onClick={() => {
                      const nf = { ...appliedFilters, priority: ['HIGH', 'MEDIUM', 'LOW'] };
                      setAppliedFilters(nf); setFilters(nf);
                    }}><X className="w-3 h-3" /></button>
                  </div>
                )}
                {appliedFilters.entity && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Token: {appliedFilters.entity}
                    <button onClick={() => {
                      const nf = { ...appliedFilters, entity: '' };
                      setAppliedFilters(nf); setFilters(nf);
                    }}><X className="w-3 h-3" /></button>
                  </div>
                )}
                {(appliedFilters.dateFrom || appliedFilters.dateTo) && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Date range active
                    <button onClick={() => {
                      const nf = { ...appliedFilters, dateFrom: '', dateTo: '' };
                      setAppliedFilters(nf); setFilters(nf);
                    }}><X className="w-3 h-3" /></button>
                  </div>
                )}
                {(appliedFilters.sources?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Sources: {appliedFilters.sources.join(', ')}
                    <button onClick={() => {
                      const nf = { ...appliedFilters, sources: [] };
                      setAppliedFilters(nf); setFilters(nf);
                    }}><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            )}

            {/* Feed list */}
            <div
              ref={feedRef}
                className="space-y-1 overflow-y-auto pr-1"
              style={{ maxHeight: 'calc(100vh - 130px)', minHeight: '520px' }}
            >
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <AlertSkeleton key={i} />)
              ) : visibleAlerts.length === 0 ? (
                <EmptyState hasFilters={hasActiveFilters} onClear={handleClearFilters} loadError={loadError} />
              ) : (
                <>
                  {visibleAlerts.map((alert) => (
                    <div
                      key={getMergeKey(alert)}
                      className={`transition-all duration-500 ${recentAlertIds.has(getMergeKey(alert)) ? 'opacity-100 scale-[1.01]' : 'opacity-100 scale-100'}`}
                    >
                      {alert.type === 'onchain' ? (
                        <OnchainCard
                          alert={alert}
                          selectedAlertId={selectedAlert?.id}
                          onViewDetails={handleOpenAlert}
                          onMarkAsRead={handleMarkAsRead}
                        />
                      ) : (
                        <AlertCard
                          alert={alert}
                          onViewDetails={handleOpenAlert}
                          onMarkAsRead={handleMarkAsRead}
                        />
                      )}
                    </div>
                  ))}

                  {isLoadingMore && (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                      <span className="ml-2 text-sm text-slate-500">Loading more alerts</span>
                    </div>
                  )}

                  {!isLoadingMore && visibleCount >= filtered.length && filtered.length > 0 && (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-600">All {filtered.length} alerts loaded</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ALERT DETAIL MODAL */}
      <AlertDetailModal
        alert={selectedAlert}
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onMarkAsRead={handleMarkAsRead}
        onDismiss={handleDismiss}
        onApplyPriceFilter={handleApplyPriceFilter}
        isPriceRelated={selectedAlert ? isPriceRelatedAlert(selectedAlert) : false}
        onFeedback={handleFeedback}
        feedbackState={selectedAlert ? feedbackMap[selectedAlert.id] : null}
      />
    </div>
  );
};

export default News;

