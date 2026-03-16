import React from 'react';
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
  Ethereum: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  Binance: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  Solana: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
  CoinDesk: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  CoinTelegraph: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  Decrypt: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
  CoinGecko: 'text-green-400 bg-green-500/10 border-green-500/30',
  CoinMarketCap: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  Twitter: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  Uniswap: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
  Aave: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  DEFAULT: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

export const AlertCard = ({ alert, onViewDetails, onMarkAsRead }) => {
  const priority = PRIORITY_CONFIG[alert.priority] || PRIORITY_CONFIG.LOW;
  const IconComponent = EVENT_ICONS[alert.event_type] || EVENT_ICONS.DEFAULT;
  const sourceColor = SOURCE_COLORS[alert.source] || SOURCE_COLORS.DEFAULT;
  const isUnread = alert.status === 'new';

  return (
    <div
      className={`
        group relative flex gap-4 p-4 rounded-xl
        bg-[#0D0D0D] border border-[#1F1F1F]
        border-l-2 ${priority.cardBorder}
        transition-all duration-300 cursor-pointer
        hover:bg-[#141414] hover:border-[#2A2A2A] hover:shadow-xl ${priority.glow}
        ${isUnread ? 'ring-1 ring-inset ring-white/5' : 'opacity-80 hover:opacity-100'}
      `}
      onClick={() => onViewDetails && onViewDetails(alert)}
    >
      {/* Unread indicator pulse */}
      {isUnread && (
        <span
          className={`absolute top-3 right-3 w-2 h-2 rounded-full ${priority.dot} animate-pulse`}
        />
      )}

      {/* Icon */}
      <div
        className={`
          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
          ${priority.bg} border ${priority.border}
        `}
      >
        <IconComponent className={`w-5 h-5 ${priority.text}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: badges + timestamp */}
        <div className="flex items-center flex-wrap gap-2 mb-1.5">
          {/* Priority badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider border ${priority.bg} ${priority.text} ${priority.border}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
            {priority.label}
          </span>

          {/* Source badge */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${sourceColor}`}
          >
            {alert.source}
          </span>

          {/* Event type tag */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-400 bg-slate-500/10 border border-slate-500/20">
            {(alert.event_type || 'ALERT').replace(/_/g, ' ')}
          </span>

          {/* Timestamp */}
          <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap flex-shrink-0">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(alert.timestamp)}
          </span>
        </div>

        {/* Title */}
        <h4
          className={`text-sm font-semibold mb-1 truncate ${
            isUnread ? 'text-white' : 'text-slate-300'
          }`}
        >
          {safeToString(alert.title)}
        </h4>

        {/* Content preview */}
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
          {safeToString(alert.content)}
        </p>

        {/* Token/entity */}
        {alert.entity && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider">Token:</span>
            <span className="text-[10px] font-bold text-emerald-400">{alert.entity}</span>
          </div>
        )}
      </div>

      {/* Action buttons - appear on hover */}
      <div
        className="
          flex-shrink-0 flex flex-col gap-1.5 justify-center
          opacity-0 group-hover:opacity-100 transition-opacity duration-200
        "
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onViewDetails && onViewDetails(alert)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-emerald-500/10 text-emerald-400 border border-emerald-500/30
            hover:bg-emerald-500/20 transition-colors duration-200 whitespace-nowrap"
        >
          <Eye className="w-3 h-3" />
          Details
        </button>
        {isUnread && (
          <button
            onClick={() => onMarkAsRead && onMarkAsRead(alert.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-slate-500/10 text-slate-400 border border-slate-500/20
              hover:bg-slate-500/20 transition-colors duration-200 whitespace-nowrap"
          >
            <CheckCircle className="w-3 h-3" />
            Read
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
    priority: PropTypes.oneOf(['HIGH', 'MEDIUM', 'LOW']),
    status: PropTypes.string,
    timestamp: PropTypes.string,
    entity: PropTypes.string,
  }).isRequired,
  onViewDetails: PropTypes.func,
  onMarkAsRead: PropTypes.func,
};

export default AlertCard;
