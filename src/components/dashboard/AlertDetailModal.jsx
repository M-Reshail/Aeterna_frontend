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

  useEffect(() => {
    setLocalSentiment(null);
    setLocalComment('');
    setShowComment(false);
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
          <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{safeToString(alert.content)}</p>
          </div>

          {/* Metadata row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {/* Timestamp */}
            <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-[9px] sm:text-[11px] text-slate-500 uppercase tracking-wider">Time</span>
              </div>
              <p className="text-[11px] sm:text-xs font-medium text-slate-300">{formatDateTime(alert.timestamp)}</p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">{formatRelativeTime(alert.timestamp)}</p>
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
          {alert.rawContent?.type === 'news' && alert.rawContent && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-blue-400">📰 News Details</h3>
              
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                {alert.rawContent.author && (
                  <div>
                    <p className="text-slate-500">Author</p>
                    <p className="text-slate-300 font-medium truncate">{alert.rawContent.author}</p>
                  </div>
                )}
                {alert.rawContent.word_count && (
                  <div>
                    <p className="text-slate-500">Word Count</p>
                    <p className="text-slate-300 font-medium">{alert.rawContent.word_count}</p>
                  </div>
                )}
                {alert.rawContent.read_time_minutes && (
                  <div>
                    <p className="text-slate-500">Read Time</p>
                    <p className="text-slate-300 font-medium">{alert.rawContent.read_time_minutes} min</p>
                  </div>
                )}
                {typeof alert.rawContent.quality_score === 'number' && (
                  <div>
                    <p className="text-slate-500">Quality</p>
                    <p className="text-slate-300 font-medium">{alert.rawContent.quality_score}%</p>
                  </div>
                )}
                {alert.rawContent.has_image && (
                  <div>
                    <p className="text-slate-500">Image</p>
                    <p className="text-emerald-400 font-medium">✓ Yes</p>
                  </div>
                )}
              </div>

              {alert.rawContent.categories && alert.rawContent.categories.length > 0 && (
                <div>
                  <p className="text-slate-500 text-[10px] sm:text-xs mb-1">Categories</p>
                  <div className="flex flex-wrap gap-1">
                    {alert.rawContent.categories.map((cat, idx) => (
                      <span key={idx} className="inline-flex px-1.5 sm:px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[9px] sm:text-xs font-medium">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {alert.rawContent.hashtags && alert.rawContent.hashtags.length > 0 && (
                <div>
                  <p className="text-slate-500 text-[10px] sm:text-xs mb-1">Hashtags</p>
                  <div className="flex flex-wrap gap-1">
                    {alert.rawContent.hashtags.map((tag, idx) => (
                      <span key={idx} className="text-blue-300 text-[9px] sm:text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {alert.rawContent.mentions && alert.rawContent.mentions.length > 0 && (
                <div>
                  <p className="text-slate-500 text-[10px] sm:text-xs mb-1">Mentions</p>
                  <div className="flex flex-wrap gap-1">
                    {alert.rawContent.mentions.map((mention, idx) => (
                      <span key={idx} className="inline-flex px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-500/20 text-slate-300 text-[9px] sm:text-xs font-medium">
                        {mention}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {alert.rawContent.link && (
                <a
                  href={alert.rawContent.link}
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
          {alert.rawContent?.type === 'price' && alert.rawContent && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-amber-400">💰 Price Data</h3>

              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                {alert.rawContent.symbol && (
                  <div>
                    <p className="text-slate-500">Symbol</p>
                    <p className="text-slate-300 font-bold text-sm">{alert.rawContent.symbol}</p>
                  </div>
                )}
                {alert.rawContent.current_price && (
                  <div>
                    <p className="text-slate-500">Current Price</p>
                    <p className="text-slate-300 font-bold text-sm">${alert.rawContent.current_price.toLocaleString()}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1 text-[9px] sm:text-xs">
                {typeof alert.rawContent.price_change_1h_pct === 'number' && (
                  <div className="p-1.5 sm:p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-slate-500 text-[8px] sm:text-[10px]">1H</p>
                    <p className={`font-bold ${alert.rawContent.price_change_1h_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {alert.rawContent.price_change_1h_pct >= 0 ? '+' : ''}{alert.rawContent.price_change_1h_pct.toFixed(2)}%
                    </p>
                  </div>
                )}
                {typeof alert.rawContent.price_change_24h_pct === 'number' && (
                  <div className="p-1.5 sm:p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-slate-500 text-[8px] sm:text-[10px]">24H</p>
                    <p className={`font-bold ${alert.rawContent.price_change_24h_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {alert.rawContent.price_change_24h_pct >= 0 ? '+' : ''}{alert.rawContent.price_change_24h_pct.toFixed(2)}%
                    </p>
                  </div>
                )}
                {typeof alert.rawContent.price_change_7d_pct === 'number' && (
                  <div className="p-1.5 sm:p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-slate-500 text-[8px] sm:text-[10px]">7D</p>
                    <p className={`font-bold ${alert.rawContent.price_change_7d_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {alert.rawContent.price_change_7d_pct >= 0 ? '+' : ''}{alert.rawContent.price_change_7d_pct.toFixed(2)}%
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                {alert.rawContent.ath && (
                  <div>
                    <p className="text-slate-500">ATH</p>
                    <p className="text-slate-300 font-medium">${alert.rawContent.ath.toLocaleString()}</p>
                  </div>
                )}
                {alert.rawContent.atl && (
                  <div>
                    <p className="text-slate-500">All-Time Low</p>
                    <p className="text-slate-300 font-medium">${alert.rawContent.atl.toLocaleString()}</p>
                  </div>
                )}
                {alert.rawContent.market_cap && (
                  <div>
                    <p className="text-slate-500">Market Cap</p>
                    <p className="text-slate-300 font-medium">${(alert.rawContent.market_cap / 1e9).toFixed(2)}B</p>
                  </div>
                )}
                {alert.rawContent.trading_volume_24h && (
                  <div>
                    <p className="text-slate-500">24H Volume</p>
                    <p className="text-slate-300 font-medium">${(alert.rawContent.trading_volume_24h / 1e9).toFixed(2)}B</p>
                  </div>
                )}
              </div>

              {alert.rawContent.alert_reasons && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-slate-500 text-xs mb-1">Alert Reason</p>
                  <p className="text-amber-300 text-xs font-medium">{alert.rawContent.alert_reasons}</p>
                </div>
              )}

              {alert.rawContent.significant_moves && alert.rawContent.significant_moves.length > 0 && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-slate-500 text-xs mb-1">Significant Moves</p>
                  {alert.rawContent.significant_moves.map((move, idx) => (
                    <p key={idx} className="text-amber-300 text-xs font-medium">• {move}</p>
                  ))}
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
