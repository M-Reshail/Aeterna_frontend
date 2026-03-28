import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import {
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Newspaper,
  Zap,
  ArrowUpDown,
  Shield,
  CheckCircle,
  Clock,
  Trash2,
  ExternalLink,
  Tag,
  Radio,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
} from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '@utils/helpers';

const PRIORITY_CONFIG = {
  HIGH: {
    label: 'HIGH PRIORITY',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    headerBorder: 'border-t-red-500',
    dot: 'bg-red-500',
  },
  MEDIUM: {
    label: 'MEDIUM PRIORITY',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    headerBorder: 'border-t-amber-500',
    dot: 'bg-amber-500',
  },
  LOW: {
    label: 'LOW PRIORITY',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    headerBorder: 'border-t-emerald-500',
    dot: 'bg-emerald-500',
  },
};

const EVENT_ICONS = {
  LARGE_TRANSFER: ArrowUpDown,
  PRICE_ALERT: TrendingUp,
  PRICE_DROP: TrendingDown,
  NEWS: Newspaper,
  DEFI_ACTIVITY: Activity,
  LIQUIDATION: AlertTriangle,
  GOVERNANCE: Shield,
  WHALE_ACTIVITY: Zap,
  DEFAULT: Activity,
};

// Safe converter: objects → string, prevents React #31 when backend returns object payloads
const safeToString = (value, fallback = '—') => {
  if (typeof value === 'string') return value || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    return (value.summary || value.title || value.description || JSON.stringify(value).substring(0, 100)) || fallback;
  }
  return fallback;
};

const asArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value) => {
  const number = toNumber(value);
  if (number === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(number);
};

const formatCompactCurrency = (value) => {
  const number = toNumber(value);
  if (number === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(number);
};

const shortenAddress = (value) => {
  const text = safeToString(value, '');
  if (!text || text.length <= 12) return text || '—';
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
};

const resolveType = (alert) => {
  const rawType = String(
    alert?.type || alert?.rawContent?.type || alert?.event_type || ''
  ).toLowerCase();

  if (rawType.includes('price')) return 'price';
  if (rawType.includes('onchain')) return 'onchain';
  if (rawType.includes('news')) return 'news';
  return 'news';
};

const getChangeColor = (change) => {
  const value = toNumber(change);
  if (value === null) return 'text-slate-400';
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-slate-300';
};

const formatPercent = (value) => {
  const number = toNumber(value);
  if (number === null) return '—';
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
};

export const AlertDetailModal = ({
  alert,
  isOpen,
  onClose,
  onMarkAsRead,
  onDismiss,
  onApplyPriceFilter,
  isPriceRelated,
  onFeedback,
  feedbackState,
}) => {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Local feedback state — reset whenever the displayed alert changes
  const [localSentiment, setLocalSentiment] = useState(null);
  const [localComment, setLocalComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [showFullSummary, setShowFullSummary] = useState(false);

  useEffect(() => {
    setLocalSentiment(null);
    setLocalComment('');
    setShowComment(false);
    setShowFullSummary(false);
  }, [alert?.alert_id ?? alert?.id]);

  const handleSubmitFeedback = useCallback(() => {
    if (localSentiment && onFeedback) {
      onFeedback(alert.alert_id ?? alert.id, localSentiment, localComment.trim());
    }
  }, [alert?.alert_id, alert?.id, localSentiment, localComment, onFeedback]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
      setTimeout(() => closeButtonRef.current?.focus(), 0);
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !alert) return null;

  const priority = PRIORITY_CONFIG[alert.priority] || PRIORITY_CONFIG.LOW;
  const IconComponent = EVENT_ICONS[alert.event_type] || EVENT_ICONS.DEFAULT;
  const isUnread = alert.status === 'new';
  const detailType = resolveType(alert);
  const mergedContent = { ...(alert.rawContent || {}), ...(alert.metrics ? { metrics: alert.metrics } : {}) };
  const summaryText = safeToString(alert.summary || alert.content, '');
  const hasLongSummary = summaryText.length > 220;
  const publishedDate = alert.published_date || mergedContent.published_date || mergedContent.published_at || mergedContent.publication_date || mergedContent.date_published;
  const categoriesList = asArray(alert.categories || mergedContent.categories);
  const hashtagsList = asArray(alert.hashtags || mergedContent.hashtags);
  const mentionsList = asArray(alert.mentions || mergedContent.mentions);
  const authorText = safeToString(alert.author || mergedContent.author, '');
  const qualityValue = toNumber(mergedContent.quality_score ?? alert.metrics?.quality_score);
  const detailTime = detailType === 'news' && publishedDate ? publishedDate : alert.timestamp;
  const hasSummary = summaryText.length > 0;
  const visibleSummary = hasLongSummary && !showFullSummary
    ? `${summaryText.slice(0, 220)}...`
    : summaryText;
  const onchainAmountFormatted = safeToString(
    alert.amountFormatted,
    safeToString(alert.amount || mergedContent.amount, '—')
  );
  const onchainUsdFormatted = safeToString(
    alert.usdFormatted,
    formatCurrency(alert.usd_value ?? mergedContent.usd_value)
  );
  const onchainFromShort = safeToString(
    alert.fromShort || alert.from_short,
    shortenAddress(alert.from || mergedContent.from || mergedContent.from_address)
  );
  const onchainToShort = safeToString(
    alert.toShort || alert.to_short,
    shortenAddress(alert.to || mergedContent.to || mergedContent.to_address)
  );
  const onchainDirection = safeToString(alert.direction, `${onchainFromShort} → ${onchainToShort}`);
  const priorityReasonText = safeToString(
    alert.priorityReason || alert.alert_reason || mergedContent.alert_reason || mergedContent.alert_reasons,
    ''
  );

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={`
          relative w-full max-w-sm sm:max-w-lg rounded-2xl overflow-hidden
          bg-[#0A0A0A] border border-[#1F1F1F]
          border-t-2 ${priority.headerBorder}
          shadow-2xl animate-slideUp
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-detail-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '95vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 p-4 sm:p-6 pb-3 sm:pb-4 border-b border-[#1A1A1A]">
          <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
            <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center ${priority.bg} border ${priority.border}`}>
              <IconComponent className={`w-4 h-4 sm:w-5 sm:h-5 ${priority.text}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                <span
                  className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-xs font-bold tracking-widest border ${priority.bg} ${priority.text} ${priority.border} flex-shrink-0`}
                >
                  <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${priority.dot} animate-pulse`} />
                  {priority.label}
                </span>
                {isUnread && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-[10px] font-semibold text-white bg-emerald-500/20 border border-emerald-500/30 flex-shrink-0">
                    <Radio className="w-2 h-2" />
                    LIVE
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-xs text-slate-500 block">
                {(alert.event_type || 'ALERT').replace(/_/g, ' ')} · {alert.source}
              </span>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close alert details"
            className="flex-shrink-0 p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-3 sm:space-y-5">
          {/* Title */}
          <h2 id="alert-detail-title" className="text-base sm:text-lg font-bold text-white leading-snug">{safeToString(alert.title)}</h2>

          {/* Full content */}
          {hasSummary && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{visibleSummary}</p>
              {hasLongSummary && (
                <button
                  type="button"
                  onClick={() => setShowFullSummary((prev) => !prev)}
                  className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {showFullSummary ? 'Show Less' : 'Show More'}
                </button>
              )}
            </div>
          )}

          {/* Metadata row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {/* Timestamp */}
            <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-[9px] sm:text-[11px] text-slate-500 uppercase tracking-wider">
                  {detailType === 'news' ? 'Published At' : 'Time'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-300">{formatDateTime(detailTime)}</p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">{formatRelativeTime(detailTime)}</p>
            </div>

            {/* Source */}
            <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-[9px] sm:text-[11px] text-slate-500 uppercase tracking-wider">Source</span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-300 truncate">{alert.source}</p>
            </div>

            {/* Token */}
            {alert.entity && (
              <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                  <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="text-[9px] sm:text-[11px] text-slate-500 uppercase tracking-wider">Token</span>
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-emerald-400 truncate">{alert.entity}</p>
              </div>
            )}

            {/* Status */}
            <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-[9px] sm:text-[11px] text-slate-500 uppercase tracking-wider">Status</span>
              </div>
              <p className={`text-[11px] sm:text-xs font-bold ${isUnread ? 'text-amber-400' : 'text-slate-400'}`}>
                {isUnread ? 'Unread' : 'Read'}
              </p>
            </div>
          </div>

          {/* NEWS DETAILS SECTION */}
          {detailType === 'news' && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-blue-400">News Details</h3>
              
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                {authorText && (
                  <div>
                    <p className="text-slate-500">Author</p>
                    <p
                      className="text-slate-300 font-medium whitespace-normal break-words"
                      title={authorText}
                    >
                      {authorText}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500">Published Date</p>
                  <p className="text-slate-300 font-medium">{publishedDate ? formatDateTime(publishedDate) : 'Not provided'}</p>
                </div>
                {toNumber(mergedContent.word_count) !== null && (
                  <div>
                    <p className="text-slate-500">Word Count</p>
                    <p className="text-slate-300 font-medium">{toNumber(mergedContent.word_count)}</p>
                  </div>
                )}
                {toNumber(mergedContent.read_time_minutes) !== null && (
                  <div>
                    <p className="text-slate-500">Read Time</p>
                    <p className="text-slate-300 font-medium">{toNumber(mergedContent.read_time_minutes)} min</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500">Quality</p>
                  <p className="text-slate-300 font-medium">{qualityValue !== null ? `${qualityValue}%` : 'Not provided'}</p>
                </div>
                {alert.image && (
                  <div>
                    <p className="text-slate-500">Image</p>
                    <p className="text-emerald-400 font-medium">✓ Yes</p>
                  </div>
                )}
              </div>

              {alert.image && (
                <div className="overflow-hidden rounded-lg border border-blue-500/20">
                  <img src={alert.image} alt={safeToString(alert.title, 'News image')} className="w-full h-44 object-cover" />
                </div>
              )}

              {categoriesList.length > 0 && (
                <div>
                  <p className="text-slate-500 text-[10px] sm:text-xs mb-1">Categories</p>
                  <div className="flex flex-wrap gap-1">
                    {categoriesList.map((cat, idx) => (
                      <span key={idx} className="inline-flex px-1.5 sm:px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[9px] sm:text-xs font-medium">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-slate-500 text-[10px] sm:text-xs mb-1">Topics</p>
                <div className="flex flex-wrap gap-1">
                  {hashtagsList.length > 0 ? hashtagsList.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex px-1.5 sm:px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/35 text-blue-300 text-[9px] sm:text-xs font-medium"
                    >
                      {String(tag).startsWith('#') ? tag : `#${tag}`}
                    </span>
                  )) : (
                    <span className="inline-flex px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-500/20 text-slate-300 text-[9px] sm:text-xs font-medium">None</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-slate-500 text-[10px] sm:text-xs mb-1">Assets/Entities</p>
                <div className="flex flex-wrap gap-1">
                  {mentionsList.length > 0 ? mentionsList.map((mention, idx) => (
                    <span
                      key={idx}
                      className="inline-flex px-1.5 sm:px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[9px] sm:text-xs font-medium"
                    >
                      {mention}
                    </span>
                  )) : (
                    <span className="inline-flex px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-500/20 text-slate-300 text-[9px] sm:text-xs font-medium">None</span>
                  )}
                </div>
              </div>

              {(alert.link || mergedContent.link) && (
                <a
                  href={alert.link || mergedContent.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-all active:scale-95"
                >
                  <ExternalLink className="w-3 h-3" />
                  Read Article
                </a>
              )}
            </div>
          )}

          {/* PRICE DETAILS SECTION */}
          {detailType === 'price' && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-amber-400">Price Data</h3>

              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                <div>
                  <p className="text-slate-500">Asset</p>
                  <p className="text-slate-300 font-bold text-sm">
                    {safeToString(alert.name || mergedContent.name, 'Unknown')} {safeToString(alert.symbol || mergedContent.symbol, '').trim() ? `(${safeToString(alert.symbol || mergedContent.symbol, '').toUpperCase()})` : ''}
                  </p>
                </div>
                {toNumber(mergedContent.current_price) !== null && (
                  <div>
                    <p className="text-slate-500">Current Price</p>
                    <p className="text-slate-300 font-bold text-sm">{formatCurrency(mergedContent.current_price)}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[9px] sm:text-xs">
                {toNumber(mergedContent.price_change_1h_pct) !== null && (
                  <div className="p-1.5 sm:p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-slate-500 text-[8px] sm:text-[10px]">1H</p>
                    <p className={`font-bold ${getChangeColor(mergedContent.price_change_1h_pct)}`}>
                      {formatPercent(mergedContent.price_change_1h_pct)}
                    </p>
                  </div>
                )}
                {toNumber(mergedContent.price_change_24h_pct) !== null && (
                  <div className="p-1.5 sm:p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-slate-500 text-[8px] sm:text-[10px]">24H</p>
                    <p className={`font-bold ${getChangeColor(mergedContent.price_change_24h_pct)}`}>
                      {formatPercent(mergedContent.price_change_24h_pct)}
                    </p>
                  </div>
                )}
                {toNumber(mergedContent.price_change_7d_pct) !== null && (
                  <div className="p-1.5 sm:p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-slate-500 text-[8px] sm:text-[10px]">7D</p>
                    <p className={`font-bold ${getChangeColor(mergedContent.price_change_7d_pct)}`}>
                      {formatPercent(mergedContent.price_change_7d_pct)}
                    </p>
                  </div>
                )}
                {toNumber(mergedContent.price_change_30d_pct) !== null && (
                  <div className="p-1.5 sm:p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-slate-500 text-[8px] sm:text-[10px]">30D</p>
                    <p className={`font-bold ${getChangeColor(mergedContent.price_change_30d_pct)}`}>
                      {formatPercent(mergedContent.price_change_30d_pct)}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                {toNumber(mergedContent.ath) !== null && (
                  <div>
                    <p className="text-slate-500">ATH</p>
                    <p className="text-slate-300 font-medium">{formatCurrency(mergedContent.ath)}</p>
                  </div>
                )}
                {toNumber(mergedContent.atl) !== null && (
                  <div>
                    <p className="text-slate-500">All-Time Low</p>
                    <p className="text-slate-300 font-medium">{formatCurrency(mergedContent.atl)}</p>
                  </div>
                )}
                {toNumber(mergedContent.market_cap) !== null && (
                  <div>
                    <p className="text-slate-500">Market Cap</p>
                    <p className="text-slate-300 font-medium">{formatCompactCurrency(mergedContent.market_cap)}</p>
                  </div>
                )}
                {toNumber(mergedContent.trading_volume_24h ?? mergedContent.volume) !== null && (
                  <div>
                    <p className="text-slate-500">24H Volume</p>
                    <p className="text-slate-300 font-medium">{formatCompactCurrency(mergedContent.trading_volume_24h ?? mergedContent.volume)}</p>
                  </div>
                )}
                {toNumber(mergedContent.volatility) !== null && (
                  <div>
                    <p className="text-slate-500">Volatility</p>
                    <p className="text-slate-300 font-medium">{formatPercent(mergedContent.volatility)}</p>
                  </div>
                )}
              </div>

              {(alert.alert_reason || mergedContent.alert_reason || mergedContent.alert_reasons) && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-slate-500 text-xs mb-1">Alert Reason</p>
                  <p className="text-amber-300 text-xs font-medium">{safeToString(alert.alert_reason || mergedContent.alert_reason || mergedContent.alert_reasons)}</p>
                </div>
              )}

              {asArray(alert.significant_moves || mergedContent.significant_moves).length > 0 && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-slate-500 text-xs mb-1">Significant Moves</p>
                  {asArray(alert.significant_moves || mergedContent.significant_moves).map((move, idx) => (
                    <p key={idx} className="text-amber-300 text-xs font-medium">• {move}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ONCHAIN DETAILS SECTION */}
          {detailType === 'onchain' && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-emerald-400">On-chain Activity</h3>

              {safeToString(alert.priority, 'LOW') === 'HIGH' && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2">
                  <p className="text-red-300 text-xs font-semibold uppercase tracking-wide">High Priority Reason</p>
                  <p className="text-red-200 text-xs mt-1">
                    {priorityReasonText || 'Large value transfer detected and flagged for immediate review.'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                <div>
                  <p className="text-slate-500">Token</p>
                  <p className="text-slate-300 font-medium">{safeToString(alert.token || mergedContent.token || mergedContent.symbol || mergedContent.name, '—')}</p>
                </div>
                <div>
                  <p className="text-slate-500">Amount</p>
                  <p className="text-slate-300 font-medium">{onchainAmountFormatted}</p>
                </div>
                <div>
                  <p className="text-slate-500">USD Value</p>
                  <p className="text-slate-300 font-medium">{onchainUsdFormatted}</p>
                </div>
                <div>
                  <p className="text-slate-500">Blockchain</p>
                  <p className="text-slate-300 font-medium">{safeToString(alert.blockchain || mergedContent.blockchain, '—')}</p>
                </div>
                <div>
                  <p className="text-slate-500">Transaction Type</p>
                  <p className="text-slate-300 font-medium">{safeToString(alert.transaction_type || mergedContent.transaction_type || mergedContent.tx_type, '—')}</p>
                </div>
                <div>
                  <p className="text-slate-500">Priority</p>
                  <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                    {safeToString(alert.priority, 'LOW')}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                <p className="text-slate-500 text-xs mb-1">Transfer Path</p>
                <p className="text-emerald-300 text-xs font-medium break-all">
                  {onchainDirection}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                <div>
                  <p className="text-slate-500">From</p>
                  <p className="text-slate-300 font-medium break-all">{onchainFromShort}</p>
                </div>
                <div>
                  <p className="text-slate-500">To</p>
                  <p className="text-slate-300 font-medium break-all">{onchainToShort}</p>
                </div>
              </div>

              {priorityReasonText && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                  <p className="text-slate-500 text-xs mb-1">Alert Reason</p>
                  <p className="text-emerald-300 text-xs font-medium">{priorityReasonText}</p>
                </div>
              )}
            </div>
          )}

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Content Filter</p>
                <p className="text-xs text-slate-300 mt-1">
                  {isPriceRelated ? 'This item is price-related news.' : 'This item is general news.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onApplyPriceFilter) onApplyPriceFilter();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Price Filter
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">Was this alert useful?</span>
            </div>

            {feedbackState?.submitted ? (
              <p className="text-[11px] text-slate-500">Thanks for your feedback.</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLocalSentiment('up')}
                    aria-label="Mark as helpful"
                    aria-pressed={localSentiment === 'up'}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                      localSentiment === 'up'
                        ? 'border-slate-400 text-white bg-slate-700/30'
                        : 'border-[#2a2a2a] text-slate-300 hover:text-white'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Helpful
                  </button>
                  <button
                    onClick={() => setLocalSentiment('down')}
                    aria-label="Mark as not useful"
                    aria-pressed={localSentiment === 'down'}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                      localSentiment === 'down'
                        ? 'border-slate-400 text-white bg-slate-700/30'
                        : 'border-[#2a2a2a] text-slate-300 hover:text-white'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    Not useful
                  </button>
                </div>

                {localSentiment && (
                  <div className="space-y-2 animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => setShowComment((prev) => !prev)}
                      className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showComment ? '− Hide comment' : '+ Add comment (optional)'}
                    </button>

                    {showComment && (
                      <textarea
                        value={localComment}
                        onChange={(e) => setLocalComment(e.target.value)}
                        placeholder="Any additional context…"
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg text-xs bg-[#0d0d0d] border border-[#2a2a2a] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-[#3a3a3a] transition-colors"
                      />
                    )}

                    <button
                      type="button"
                      onClick={handleSubmitFeedback}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-[#2a2a2a] bg-[#111] text-slate-200 hover:border-[#3a3a3a] hover:text-white transition-all"
                    >
                      Submit feedback
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-[#1A1A1A] bg-[#080808]">
          {isUnread && (
            <button
              onClick={() => {
                onMarkAsRead && onMarkAsRead(alert.alert_id ?? alert.id);
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold
                bg-emerald-500/10 text-emerald-400 border border-emerald-500/30
                hover:bg-emerald-500/20 transition-all duration-200"
            >
              <CheckCircle className="w-4 h-4" />
              Mark as Read
            </button>
          )}
          <button
            onClick={() => {
              onDismiss && onDismiss(alert.alert_id ?? alert.id);
            }}
            className="flex-shrink-0 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold
              bg-red-500/10 text-red-400 border border-red-500/30
              hover:bg-red-500/20 transition-all duration-200"
          >
            <Trash2 className="w-4 h-4" />
            Dismiss
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold
              bg-white/5 text-slate-300 border border-white/10
              hover:bg-white/10 transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

AlertDetailModal.propTypes = {
  alert: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onMarkAsRead: PropTypes.func,
  onDismiss: PropTypes.func,
  onApplyPriceFilter: PropTypes.func,
  isPriceRelated: PropTypes.bool,
  onFeedback: PropTypes.func,
  feedbackState: PropTypes.shape({
    submitted: PropTypes.bool,
  }),
};

export default AlertDetailModal;
