import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useQueryClient } from '@tanstack/react-query';
import Tooltip from '@components/common/Tooltip';
import {
  TrendingUp,
  Calendar,
  RefreshCw,
  Download,
  SlidersHorizontal,
  ChevronDown,
  Inbox,
  Loader2,
  X,
} from 'lucide-react';
import { AlertCard } from '@components/dashboard/AlertCard';
import { AlertDetailModal } from '@components/dashboard/AlertDetailModal';
import { FilterSidebar } from '@components/dashboard/FilterSidebar';
import { DynamicFilterToggles } from '@components/dashboard/DynamicFilterToggles';
import { useSocket } from '@hooks/useSocket';
import { WS_EVENTS } from '@utils/constants';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import feedbackService from '@services/feedbackService';
import alertsService from '@services/alertsService';
import eventsService from '@services/eventsService';
import { normalizeFeedItem, normalizeFeedItems, debugLogNormalizedEvents } from '@utils/eventNormalizer';
import { applyDynamicFilters } from '@utils/eventFilters';

const DEFAULT_FILTERS = {
  priority: ['HIGH', 'MEDIUM', 'LOW'],
  eventType: 'all',
  entity: '',
  dateFrom: '',
  dateTo: '',
  sources: [],
  contentFilter: 'all',
  dynamicFilters: [],
};

const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest First' },
  { value: 'oldest',   label: 'Oldest First' },
  { value: 'priority', label: 'Priority (High → Low)' },
  { value: 'unread',   label: 'Unread First' },
];

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const isEventItemId = (id) => String(id).startsWith('event-');
const FALLBACK_SOURCE_OPTIONS = ['CoinDesk', 'CoinTelegraph', 'Decrypt', 'CoinGecko'];
const SOURCE_QUERY_BY_LABEL = {
  CoinDesk: 'coindesk',
  CoinTelegraph: 'cointelegraph.com',
  Decrypt: 'decrypt.co',
  CoinGecko: 'coingecko',
};

const normalizeSourceName = (source) => {
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

  // Keep Data Sources clean: only show known upstream providers.
  return '';
};

const toApiSourceParam = (sourceLabel) => {
  const mapped = SOURCE_QUERY_BY_LABEL[sourceLabel];
  if (mapped) return mapped;
  const raw = String(sourceLabel || '').trim().toLowerCase();
  return raw || '';
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
  if (String(item?.type || '').toLowerCase() === 'price') return true;

  const eventType = String(item?.event_type || '').toLowerCase();
  if (eventType.includes('price')) return true;

  const text = `${item?.title || ''} ${item?.content || ''}`.toLowerCase();
  return PRICE_KEYWORDS.some((keyword) => text.includes(keyword));
};

const resolveAlertType = (item) => {
  const rawType = String(item?.type || item?.rawContent?.type || item?.event_type || '').toLowerCase();
  if (rawType.includes('price')) return 'PRICE_ALERT';
  if (rawType.includes('onchain')) return 'ONCHAIN';
  if (rawType.includes('news')) return 'NEWS';
  return isPriceRelatedAlert(item) ? 'PRICE_ALERT' : 'NEWS';
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export const Dashboard = () => {
  const queryClient = useQueryClient();
  const { on } = useSocket({ autoConnect: false });
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
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
  const [highImpactNews, setHighImpactNews] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(true);
  const sortMenuRef = useRef(null);
  const feedRef     = useRef(null);
  const toastRef = useRef(toast);
  const hasShownLoadErrorRef = useRef(false);
  const readAlertIdsRef = useRef(new Set());

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const loadDashboardData = useCallback(async (selectedSources = [], eventType = 'all', { silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    setLoadError('');
    try {
      const sourceList = Array.isArray(selectedSources)
        ? selectedSources.filter(Boolean)
        : [];
      const sourceApiParams = Array.from(
        new Set(sourceList.map(toApiSourceParam).filter(Boolean))
      );

      // Load sources and feed in parallel so alerts render as soon as feed resolves.
      const availableSourcesPromise = eventsService.getAvailableSources({ limit: 120 }).catch((error) => {
        console.warn('Could not load available sources:', error.message);
        return [];
      });

      // Determine which API endpoint to call for alerts
      let feedResult = [];
      let feedError = null;

      try {
        if (sourceApiParams.length > 0) {
          // If sources selected: fetch from those sources with optional type filter
          const type = eventType === 'PRICE_ALERT'
            ? 'price'
            : eventType === 'NEWS'
            ? 'news'
            : eventType === 'ONCHAIN'
            ? 'onchain'
            : undefined;
          const settled = await Promise.allSettled(
            sourceApiParams.map((source) =>
              eventsService.getEvents({ skip: 0, limit: 60, source, type })
            )
          );
          feedResult = settled
            .filter((result) => result.status === 'fulfilled')
            .flatMap((result) => (Array.isArray(result.value) ? result.value : []))
            .filter(Boolean);
          if (feedResult.length === 0 && settled.some((result) => result.status === 'rejected')) {
            feedError = settled.find((result) => result.status === 'rejected')?.reason || null;
          }
        } else if (eventType === 'NEWS') {
          // If only news filter selected (no sources): fetch all news
          feedResult = await eventsService.getEventsByType('news', { skip: 0, limit: 60 });
          if (!Array.isArray(feedResult)) feedResult = [];
        } else if (eventType === 'PRICE_ALERT') {
          // If only price filter selected (no sources): fetch all price events
          feedResult = await eventsService.getEventsByType('price', { skip: 0, limit: 60 });
          if (!Array.isArray(feedResult)) feedResult = [];
        } else if (eventType === 'ONCHAIN') {
          // If only onchain filter selected (no sources): fetch all onchain events
          feedResult = await eventsService.getEventsByType('onchain', { skip: 0, limit: 60 });
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
      const normalizedAlerts = normalizeFeedItems((Array.isArray(feedResult) ? feedResult : []).flat().filter(Boolean));
      const apiSources = await availableSourcesPromise;

      if (sourceApiParams.length > 0 || eventType !== 'all') {
        debugLogNormalizedEvents(
          feedResult,
          normalizedAlerts,
          `/dashboard feed items=${Array.isArray(feedResult) ? feedResult.length : 0}`
        );
      }

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

        setSourceOptions((prevSources) =>
          Array.from(new Set([...(prevSources || []), ...mergedSources])).sort((a, b) => a.localeCompare(b))
        );
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
      if (!silent) setIsLoading(false);
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
            .map(normalizeFeedItem)
            .filter(Boolean)
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
      const normalized = normalizeFeedItem(incoming || {});
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
      result = result.filter((a) => resolveAlertType(a) === appliedFilters.eventType);
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
    // Source filtering is applied at fetch time via API query params.
    if (appliedFilters.contentFilter === 'price') {
      result = result.filter(isPriceRelatedAlert);
    }
    if ((appliedFilters.dynamicFilters?.length ?? 0) > 0) {
      result = applyDynamicFilters(result, appliedFilters.dynamicFilters);
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

  const handleToggleDynamicFilter = useCallback((filterKey) => {
    const current = appliedFilters.dynamicFilters || [];
    const next = current.includes(filterKey)
      ? current.filter((key) => key !== filterKey)
      : [...current, filterKey];

    const nextFilters = { ...appliedFilters, dynamicFilters: next };
    setAppliedFilters(nextFilters);
    setFilters((prev) => ({ ...prev, dynamicFilters: next }));
    setVisibleCount(8);
  }, [appliedFilters]);

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setVisibleCount(8);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData(appliedFilters.sources || [], appliedFilters.eventType || 'all', { silent: true });
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
    appliedFilters.contentFilter === 'price' ||
    (appliedFilters.dynamicFilters?.length ?? 0) > 0;

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
                View All Alerts
              </button>
            </div>
            {isLoadingHighlights ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : highImpactNews.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No high-impact news today</p>
            ) : (
              <div className="space-y-2">
                {highImpactNews.map((news) => (
                  <div
                    key={news.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 hover:border-emerald-500/20 transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-300 flex-shrink-0 mt-0.5">
                        HIGH
                      </span>
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
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : todayEvents.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No economic events today</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 hover:border-amber-500/20 transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold flex-shrink-0 mt-0.5 ${
                        event.impact === 'HIGH' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {event.impact}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-white line-clamp-1">{event.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {event.country} • {event.time} • {event.category}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#080808] border border-[#1A1A1A] rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm sm:text-base font-semibold text-white">Smart Filters</h3>
            <span className="text-xs text-slate-500">Matching alerts: {filtered.length}</span>
          </div>
          <DynamicFilterToggles
            selectedKeys={appliedFilters.dynamicFilters || []}
            onToggle={handleToggleDynamicFilter}
          />
          {(appliedFilters.dynamicFilters?.length ?? 0) > 0 && (
            <div className="mt-3 text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2 inline-flex items-center gap-2">
              Smart: {appliedFilters.dynamicFilters.join(', ')}
              <button
                onClick={() => {
                  const nextFilters = { ...appliedFilters, dynamicFilters: [] };
                  setAppliedFilters(nextFilters);
                  setFilters((prev) => ({ ...prev, dynamicFilters: [] }));
                }}
                className="text-cyan-200 hover:text-cyan-100 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
