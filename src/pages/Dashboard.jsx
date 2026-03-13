import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import { AlertCard } from '@components/dashboard/AlertCard';
import { AlertDetailModal } from '@components/dashboard/AlertDetailModal';
import { FilterSidebar } from '@components/dashboard/FilterSidebar';
import { useSocket } from '@hooks/useSocket';
import { WS_EVENTS } from '@utils/constants';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import feedbackService from '@services/feedbackService';
import alertsService from '@services/alertsService';
import eventsService from '@services/eventsService';

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZERS
// ─────────────────────────────────────────────────────────────────────────────
const normalizeStatus = (status) => {
  if (status === 'pending') return 'new';
  return status || 'new';
};

const inferEventType = (title = '') => {
  const lower = title.toLowerCase();
  if (lower.includes('price')) return 'PRICE_ALERT';
  return 'NEWS';
};

const normalizeAlert = (alert) => ({
  id: alert.alert_id ?? alert.id,
  alert_id: alert.alert_id ?? alert.id,
  event_type: alert.event_type || inferEventType(alert.title),
  source: alert.source || alert.entity || 'system',
  title: alert.title || 'Untitled Alert',
  content: alert.content || alert.description || alert.title || 'No details provided',
  priority: alert.priority || 'LOW',
  status: normalizeStatus(alert.status),
  timestamp: alert.created_at || alert.timestamp || alert.createdAt || new Date().toISOString(),
  entity: alert.entity || '',
});

const DEFAULT_FILTERS = {
  priority: ['HIGH', 'MEDIUM', 'LOW'],
  entity: '',
  dateFrom: '',
  dateTo: '',
  sources: [],
};

const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest First' },
  { value: 'oldest',   label: 'Oldest First' },
  { value: 'priority', label: 'Priority (High → Low)' },
  { value: 'unread',   label: 'Unread First' },
];

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState = ({ hasFilters, onClear }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center px-8">
    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
      <Inbox className="w-8 h-8 text-slate-500" />
    </div>
    <h3 className="text-base font-bold text-white mb-2">No alerts found</h3>
    <p className="text-sm text-slate-500 max-w-xs mb-6">
      {hasFilters
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
  const sortMenuRef = useRef(null);
  const feedRef     = useRef(null);
  const toastRef = useRef(toast);
  const hasShownLoadErrorRef = useRef(false);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [alerts, apiSources] = await Promise.all([
        alertsService.getAlerts({ skip: 0, limit: 50 }),
        eventsService.getAvailableSources({ limit: 200 }),
      ]);

      const normalizedAlerts = Array.isArray(alerts) ? alerts.map(normalizeAlert) : [];
      setAllAlerts(normalizedAlerts);

      const sourcesFromAlerts = normalizedAlerts
        .map((item) => item.source)
        .filter(Boolean);

      const mergedSources = Array.from(new Set([...(apiSources || []), ...sourcesFromAlerts]))
        .sort((a, b) => a.localeCompare(b));
      setSourceOptions(mergedSources);
      hasShownLoadErrorRef.current = false;
    } catch (error) {
      if (!hasShownLoadErrorRef.current) {
        toastRef.current.error(error?.message || 'Failed to load dashboard alerts');
        hasShownLoadErrorRef.current = true;
      }
      setAllAlerts([]);
      setSourceOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const handleIncomingAlert = (incoming) => {
      const normalized = normalizeAlert(incoming || {});
      if (!normalized?.id) return;

      setSourceOptions((prev) => {
        if (!normalized.source || prev.includes(normalized.source)) return prev;
        return [...prev, normalized.source].sort((a, b) => a.localeCompare(b));
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
      result = result.filter((a) => selectedSources.includes(String(a.source).toLowerCase()));
    }

    const sorted = [...result];
    if (sortBy === 'oldest') {
      sorted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (sortBy === 'priority') {
      sorted.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
    } else if (sortBy === 'unread') {
      sorted.sort((a, b) => {
        if (a.status === 'new' && b.status !== 'new') return -1;
        if (a.status !== 'new' && b.status === 'new') return 1;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    } else {
      sorted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
    setAllAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'read' } : a)));
    setSelectedAlert((prev) => (prev?.id === id ? { ...prev, status: 'read' } : prev));
    try {
      await alertsService.markAsRead(id);
    } catch (error) {
      toast.error(error?.message || 'Failed to mark alert as read');
    }
  }, [toast]);

  const handleOpenAlert = useCallback((alert) => {
    // Auto-mark as read on open (Gmail-style)
    const readAlert = { ...alert, status: 'read' };
    setSelectedAlert(readAlert);
    setAllAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, status: 'read' } : a)));
    alertsService.markAsRead(alert.id).catch(() => {
      // Keep UI optimistic; errors are non-blocking for detail view.
    });
  }, []);

  const handleDismiss = useCallback(async (id) => {
    const previous = allAlerts;
    setAllAlerts((prev) => prev.filter((a) => a.id !== id));
    setSelectedAlert(null);

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
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const hasActiveFilters =
    appliedFilters.priority.length < 3 ||
    !!appliedFilters.entity ||
    !!appliedFilters.dateFrom ||
    !!appliedFilters.dateTo ||
    (appliedFilters.sources?.length ?? 0) > 0;

  const currentSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || 'Newest First';

  return (
    <div className="min-h-screen w-full pt-28 pb-12 px-4 lg:px-6" style={{ position: 'relative', zIndex: 1 }}>
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* PAGE HEADER */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Alert Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">
              Real-time market signals aggregated from 50+ sources
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tooltip content="Reload latest alerts" placement="bottom">
              <button
                onClick={handleRefresh}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#0D0D0D] border border-[#1F1F1F] text-slate-400 hover:border-emerald-500/40 hover:text-emerald-400 transition-all duration-200 ${isRefreshing ? 'text-emerald-400 border-emerald-500/40' : ''}`}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </Tooltip>
            <Tooltip content="Export visible alerts to CSV" placement="bottom">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#0D0D0D] border border-[#1F1F1F] text-slate-400 hover:border-white/20 hover:text-white transition-all duration-200">
                <Download className="w-4 h-4" />
                Export
              </button>
            </Tooltip>
            {/* Mobile filter toggle */}
            <Tooltip content="Filter alerts by priority, source, and date" placement="bottom">
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className={`lg:hidden flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${filterOpen ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#0D0D0D] border-[#1F1F1F] text-slate-400'}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {hasActiveFilters && (
                  <span className="w-4 h-4 rounded-full bg-emerald-500 text-black text-[10px] font-bold flex items-center justify-center">!</span>
                )}
              </button>
            </Tooltip>
          </div>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Bell}          label="Total Alerts"    value={isLoading ? '…' : allAlerts.length}    subValue="all time"           accentColor="blue"    />
          <StatCard icon={BellRing}      label="Unread"          value={isLoading ? '…' : unreadCount}         subValue="requires action"    accentColor="amber"   />
          <StatCard icon={AlertTriangle} label="High Priority"   value={isLoading ? '…' : highPriorityCount}   subValue={`${highUnread} unread`}  accentColor="red"   />
          <StatCard icon={Activity}      label="Sources Active"  value={isLoading ? '…' : sourceOptions.length} subValue="live feeds"          accentColor="emerald" />
        </div>

        {/* MAIN CONTENT: SIDEBAR + FEED */}
        <div className="flex gap-4 items-start">

          {/* FILTER SIDEBAR — Desktop */}
          <div className="hidden lg:block w-64 xl:w-72 flex-shrink-0 sticky top-28">
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

          {/* FILTER SIDEBAR — Mobile overlay */}
          {filterOpen && (
            <div className="lg:hidden fixed inset-0 z-40" onClick={() => setFilterOpen(false)}>
              <div className="absolute inset-0 bg-black/70" />
              <div className="absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
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
          <div className="flex-1 min-w-0 flex flex-col gap-3">

            {/* Feed toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap px-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {isLoading ? '…' : filtered.length} alerts
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
              <div ref={sortMenuRef} className="relative">
                <button
                  onClick={() => setShowSortMenu((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#0D0D0D] border border-[#1F1F1F] text-slate-400 hover:border-white/20 hover:text-white transition-all duration-200"
                >
                  {currentSortLabel}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-2 z-30 w-48 rounded-xl overflow-hidden bg-[#0D0D0D] border border-[#1F1F1F] shadow-2xl">
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
              <div className="flex flex-wrap gap-2 px-1">
                {appliedFilters.priority.length < 3 && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
              className="space-y-2 overflow-y-auto pr-1"
              style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '400px' }}
            >
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <AlertSkeleton key={i} />)
              ) : visibleAlerts.length === 0 ? (
                <EmptyState hasFilters={hasActiveFilters} onClear={handleClearFilters} />
              ) : (
                <>
                  {visibleAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`transition-all duration-500 ${recentAlertIds.has(alert.id) ? 'opacity-100 scale-[1.01]' : 'opacity-100 scale-100'}`}
                    >
                      <AlertCard
                        alert={alert}
                        onViewDetails={handleOpenAlert}
                        onMarkAsRead={handleMarkAsRead}
                      />
                    </div>
                  ))}

                  {isLoadingMore && (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                      <span className="ml-2 text-sm text-slate-500">Loading more alerts…</span>
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
        onFeedback={handleFeedback}
        feedbackState={selectedAlert ? feedbackMap[selectedAlert.id] : null}
      />
    </div>
  );
};

export default Dashboard;
