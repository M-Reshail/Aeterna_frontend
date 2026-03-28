import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Newspaper,
  Zap,
  ArrowUpDown,
  Shield,
  Eye,
  CheckCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { formatRelativeTime } from '@utils/helpers';

// Safe converter: safely handle objects/strings in render
const safeToString = (value, fallback = '') => {
  if (typeof value === 'string') return value || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    return (value.summary || value.title || value.description || JSON.stringify(value).substring(0, 50)) || fallback;
  }
  return fallback;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const toHashtag = (value) => {
  const raw = safeToString(value, '').replace(/[^a-zA-Z0-9\s_-]/g, '').trim();
  return raw ? `#${raw.replace(/\s+/g, '_')}` : '';
};

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveType = (alert) => {
  const rawType = String(alert?.type || alert?.rawContent?.type || alert?.event_type || '').toLowerCase();
  if (rawType.includes('price')) return 'price';
  if (rawType.includes('onchain')) return 'onchain';
  if (rawType.includes('news')) return 'news';
  return 'news';
};

// Event type icon mapping
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

// Priority configuration
const PRIORITY_CONFIG = {
  HIGH: {
    label: 'HIGH',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/40',
    dot: 'bg-red-500',
    cardBorder: 'border-l-red-500',
    glow: 'hover:shadow-red-500/10',
  },
  MEDIUM: {
    label: 'MED',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/40',
    dot: 'bg-amber-500',
    cardBorder: 'border-l-amber-500',
    glow: 'hover:shadow-amber-500/10',
  },
  LOW: {
    label: 'LOW',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/40',
    dot: 'bg-emerald-500',
    cardBorder: 'border-l-emerald-500',
    glow: 'hover:shadow-emerald-500/10',
  },
};

const SOURCE_COLORS = {
  CoinDesk: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  CoinTelegraph: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  Decrypt: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
  CoinGecko: 'text-green-400 bg-green-500/10 border-green-500/30',
};

export const AlertCard = ({ alert, onViewDetails, onMarkAsRead }) => {
  const [showFullSummary, setShowFullSummary] = useState(false);
  const priority = PRIORITY_CONFIG[alert.priority] || PRIORITY_CONFIG.LOW;
  const IconComponent = EVENT_ICONS[alert.event_type] || EVENT_ICONS.DEFAULT;
  const sourceColor = SOURCE_COLORS[alert.source] || SOURCE_COLORS.DEFAULT;
  const isUnread = alert.status === 'new';
  const typeKey = resolveType(alert);
  const author = safeToString(alert.author || alert?.rawContent?.author, 'Unknown author');
  const articleLink = safeToString(alert.link || alert?.rawContent?.link, '');
  const summaryText = safeToString(alert.summary || alert.content, 'No summary available');
  const isLongSummary = summaryText.length > 140;
  const visibleSummary = isLongSummary && !showFullSummary
    ? `${summaryText.slice(0, 140)}...`
    : summaryText;
  const alertReason = safeToString(alert.alert_reason || alert?.rawContent?.alert_reason || alert?.rawContent?.alert_reasons, '');
  const price24h = toNumber(alert?.metrics?.price_change_24h_pct ?? alert?.rawContent?.price_change_24h_pct);
  const categories = asArray(alert.categories?.length ? alert.categories : alert?.rawContent?.categories)
    .map((item) => safeToString(item, '').trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div
      className={`
        group relative flex flex-col sm:flex-row gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl
        bg-[#0D0D0D] border border-[#1F1F1F]
        border-l-2 ${priority.cardBorder}
        transition-all duration-300 cursor-pointer
        hover:bg-[#141414] hover:border-[#2A2A2A] hover:shadow-xl ${priority.glow}
        active:scale-95 sm:active:scale-100
        ${isUnread ? 'ring-1 ring-inset ring-white/5' : 'opacity-80 hover:opacity-100'}
      `}
      onClick={() => onViewDetails && onViewDetails(alert)}
    >
      {/* Unread indicator pulse */}
      {isUnread && (
        <span
          className={`absolute top-2 right-2 sm:top-3 sm:right-3 w-2 h-2 rounded-full ${priority.dot} animate-pulse`}
        />
      )}

      {/* Icon */}
      <div
        className={`
          flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center
          ${priority.bg} border ${priority.border}
        `}
      >
        <IconComponent className={`w-4 h-4 sm:w-5 sm:h-5 ${priority.text}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: badges + timestamp */}
        <div className="flex items-center flex-wrap gap-1 sm:gap-2 mb-1 text-[10px] sm:text-xs">
          {/* Priority badge */}
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[11px] font-bold tracking-wider border ${priority.bg} ${priority.text} ${priority.border} flex-shrink-0`}
          >
            <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${priority.dot}`} />
            {priority.label}
          </span>

          {/* Source badge */}
          <span
            className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[11px] font-medium border ${sourceColor} truncate`}
          >
            {alert.source}
          </span>

          {/* Event type tag */}
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-400 bg-slate-500/10 border border-slate-500/20">
            {(alert.event_type || 'ALERT').replace(/_/g, ' ')}
          </span>

          {/* Timestamp */}
          <span className="ml-auto flex items-center gap-1 text-[9px] sm:text-[11px] text-slate-500 whitespace-nowrap flex-shrink-0">
            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            {formatRelativeTime(alert.timestamp)}
          </span>
        </div>

        {/* Title */}
        <h4
          className={`text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1 line-clamp-2 ${
            isUnread ? 'text-white' : 'text-slate-300'
          }`}
        >
          {safeToString(alert.title)}
        </h4>

        {/* Content preview */}
        <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
          {visibleSummary}
        </p>
        {isLongSummary && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFullSummary((prev) => !prev);
            }}
            className="mt-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {showFullSummary ? 'Show less' : 'Show more'}
          </button>
        )}

        {/* Author + article link */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px] text-slate-500">
          <span className="truncate">By {author}</span>
          {typeKey === 'price' && price24h !== null && (
            <span className={`px-1.5 py-0.5 rounded-md border text-[10px] ${price24h >= 0 ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-red-300 border-red-500/30 bg-red-500/10'}`}>
              24H: {price24h >= 0 ? '+' : ''}{price24h.toFixed(2)}%
            </span>
          )}
          {alertReason && (
            <span className="px-1.5 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px]">
              Alert: {alertReason}
            </span>
          )}
          {articleLink && (
            <a
              href={articleLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Read more
            </a>
          )}
        </div>

        {/* Categories as hashtags */}
        {categories.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {categories.map((category) => (
              <span
                key={`${alert.id}-${category}`}
                className="text-[10px] sm:text-[11px] text-blue-300/90 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md"
              >
                {toHashtag(category)}
              </span>
            ))}
          </div>
        )}

        {/* Token/entity */}
        {alert.entity && (
          <div className="flex items-center gap-1 mt-1.5 sm:mt-2">
            <span className="text-[9px] sm:text-[10px] text-slate-600 uppercase tracking-wider">Token:</span>
            <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400">{alert.entity}</span>
          </div>
        )}
      </div>

      {/* Action buttons - appear on hover (desktop) or below on mobile */}
      <div
        className="
          flex flex-row sm:flex-col gap-1.5 justify-end sm:justify-center flex-shrink-0
          opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200
        "
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onViewDetails && onViewDetails(alert)}
          className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-medium
            bg-emerald-500/10 text-emerald-400 border border-emerald-500/30
            hover:bg-emerald-500/20 active:scale-95 transition-all duration-200 whitespace-nowrap"
        >
          <Eye className="w-3 h-3" />
          <span className="hidden sm:inline">Details</span>
        </button>
        {isUnread && (
          <button
            onClick={() => onMarkAsRead && onMarkAsRead(alert.id)}
            className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-medium
              bg-slate-500/10 text-slate-400 border border-slate-500/20
              hover:bg-slate-500/20 active:scale-95 transition-all duration-200 whitespace-nowrap"
          >
            <CheckCircle className="w-3 h-3" />
            <span className="hidden sm:inline">Read</span>
          </button>
        )}
      </div>
    </div>
  );
};

AlertCard.propTypes = {
  alert: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    event_type: PropTypes.string,
    source: PropTypes.string,
    title: PropTypes.string,
    content: PropTypes.string,
    summary: PropTypes.string,
    author: PropTypes.string,
    link: PropTypes.string,
    categories: PropTypes.arrayOf(PropTypes.string),
    priority: PropTypes.oneOf(['HIGH', 'MEDIUM', 'LOW']),
    status: PropTypes.string,
    timestamp: PropTypes.string,
    entity: PropTypes.string,
    rawContent: PropTypes.shape({
      author: PropTypes.string,
      link: PropTypes.string,
      categories: PropTypes.arrayOf(PropTypes.string),
    }),
  }).isRequired,
  onViewDetails: PropTypes.func,
  onMarkAsRead: PropTypes.func,
};

export default AlertCard;
