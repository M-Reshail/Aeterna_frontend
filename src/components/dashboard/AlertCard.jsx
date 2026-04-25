import React, { useMemo } from 'react';
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
import { getAuthorDisplay, getSummaryOrFallback } from '@utils/contentText';

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

const compactAddress = (value) => {
  const text = safeToString(value, '').trim();
  if (!text) return '';
  if (!text.startsWith('0x') || text.length <= 14) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
};

const formatUsdValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  const dollars = `$${numeric.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `${dollars} USD`;
};

const isNonNull = (value) => value !== null && value !== undefined && String(value).trim() !== '';

const summarizeForFeed = (summary) => {
  const resolved = getSummaryOrFallback(typeof summary === 'string' ? summary : '');
  if (!resolved) return { text: '', show: false, truncated: false };

  if (resolved.length <= 120) {
    return { text: resolved, show: true, truncated: false };
  }

  return {
    text: `${resolved.slice(0, 120).trimEnd()}...`,
    show: true,
    truncated: true,
  };
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
  const priority = PRIORITY_CONFIG[alert.priority] || PRIORITY_CONFIG.LOW;
  const IconComponent = EVENT_ICONS[alert.event_type] || EVENT_ICONS.DEFAULT;
  const sourceColor = SOURCE_COLORS[alert.source] || SOURCE_COLORS.DEFAULT;
  const isUnread = alert.status === 'new';

  const author = getAuthorDisplay(alert.author || alert?.rawContent?.author, { mode: 'unknown' });
  const articleLink = safeToString(alert.link || alert?.rawContent?.link, '');
  const categories = asArray(alert.categories?.length ? alert.categories : alert?.rawContent?.categories)
    .map((item) => safeToString(item, '').trim())
    .filter(Boolean)
    .slice(0, 4);
  const hashtags = asArray(alert.hashtags?.length ? alert.hashtags : alert?.rawContent?.hashtags)
    .map((item) => safeToString(item, '').trim())
    .filter(Boolean)
    .slice(0, 4);
  const mentions = asArray(alert.mentions?.length ? alert.mentions : alert?.rawContent?.mentions)
    .map((item) => safeToString(item, '').trim())
    .filter(Boolean)
    .slice(0, 4);
  const onchainRaw = (alert?.rawContent && typeof alert.rawContent === 'object') ? alert.rawContent : {};
  const fromAddress = alert.fromAddress || onchainRaw?.from_address || onchainRaw?.from || '';
  const toAddress = alert.toAddress || onchainRaw?.to_address || onchainRaw?.to || '';
  const exchangeFrom = onchainRaw?.exchange_from;
  const exchangeTo = onchainRaw?.exchange_to;
  const exchangeDetected = safeToString(onchainRaw?.exchange_detected, '');
  const amount = safeToString(alert.amountDisplay || alert?.metadata?.amount, '');
  const cardType = safeToString(alert.type, 'news').toLowerCase();
  const isNews = cardType === 'news';
  const isPrice = cardType === 'price';
  const isOnchain = cardType === 'onchain';
  const token = safeToString(
    alert.token ||
    alert.entity ||
    (isOnchain ? (onchainRaw?.token || onchainRaw?.symbol) : '') ||
    alert?.metadata?.token,
    ''
  );

  const onchainParties = useMemo(() => {
    const hasAddresses = Boolean(safeToString(fromAddress, '').trim()) && Boolean(safeToString(toAddress, '').trim());
    if (!hasAddresses) return null;

    const fromIsExchange = isNonNull(exchangeFrom);
    const toIsExchange = isNonNull(exchangeTo);
    const fromLabel = fromIsExchange ? safeToString(exchangeFrom, 'Exchange') : compactAddress(fromAddress);
    const toLabel = toIsExchange ? safeToString(exchangeTo, 'Exchange') : compactAddress(toAddress);

    return {
      from: {
        isExchange: fromIsExchange,
        label: fromLabel,
        fullAddress: fromIsExchange ? '' : safeToString(fromAddress, ''),
        shortAddress: fromIsExchange ? '' : compactAddress(fromAddress),
      },
      to: {
        isExchange: toIsExchange,
        label: toLabel,
        fullAddress: toIsExchange ? '' : safeToString(toAddress, ''),
        shortAddress: toIsExchange ? '' : compactAddress(toAddress),
      },
    };
  }, [exchangeFrom, exchangeTo, fromAddress, toAddress]);

  const structuredSubtitle = (isOnchain ? '' : safeToString(alert.subtitle, '')) || (
    onchainParties ? `${onchainParties.from.label} → ${onchainParties.to.label}` : ''
  );

  const summaryPreview = summarizeForFeed(alert?.rawContent?.summary);
  const displayTitle = (() => {
    const title = safeToString(alert.title, '').trim();
    if (title) return title;
    if (isPrice) {
      const name = safeToString(alert?.rawContent?.name, '').trim();
      const symbol = safeToString(alert?.rawContent?.symbol, '').trim();
      return name || symbol || 'Unknown Asset';
    }
    return 'Feed update';
  })();
  // Format current_price as a readable dollar string
  const rawPrice = alert?.rawContent?.current_price ?? alert?.rawContent?.price ?? alert?.rawContent?.price_usd;
  const priceValue = (rawPrice != null && Number.isFinite(Number(rawPrice)))
    ? `$${Number(rawPrice) < 1 ? Number(rawPrice).toFixed(4) : Number(rawPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '';

  // Format % change: prefer 24h, fallback to 1h
  const rawChange =
    alert?.rawContent?.price_change_24h_pct ??
    alert?.rawContent?.change_24h_pct ??
    alert?.rawContent?.price_change_1h_pct ??
    alert?.rawContent?.change_1h_pct;
  const priceChange = (rawChange != null && Number.isFinite(Number(rawChange)))
    ? `${Number(rawChange) >= 0 ? '+' : ''}${Number(rawChange).toFixed(2)}%`
    : '';
  const onchainUsdValue = formatUsdValue(
    onchainRaw?.usd_value ??
    onchainRaw?.value_usd ??
    onchainRaw?.amount_usd ??
    onchainRaw?.usd_amount ??
    alert?.amountUsd ??
    alert?.rawContent?.signal?.amountUsd
  );
  const onchainRisk = safeToString(alert.riskSignal || alert?.rawContent?.onchainFormatted?.riskSignal || '', 'neutral');

  return (
    <div
      className={`
        group relative ${isPrice ? 'flex items-center gap-2 px-4 py-2.5 min-h-[52px] max-h-14' : 'flex flex-col sm:flex-row gap-2 sm:gap-3 p-2.5 sm:p-3'} rounded-lg sm:rounded-xl
        bg-[#0D0D0D] border border-[#1F1F1F]
        border-l-2 ${priority.cardBorder}
        transition-all duration-300 cursor-pointer
        hover:bg-[#151515] hover:border-[#2A2A2A] hover:shadow-xl ${priority.glow}
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
      <div className={`flex-1 min-w-0 ${isPrice ? 'flex items-center gap-2 overflow-hidden' : ''}`}>
        {isPrice ? (
          <>
            <div className="min-w-0 flex items-center gap-2">
              <h4 className={`min-w-0 truncate text-sm font-semibold ${isUnread ? 'text-white' : 'text-slate-200'}`}>
                {displayTitle}
              </h4>
              {token && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 shrink-0">
                  {token}
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2 shrink-0">
              {(priceValue || amount) && (
                <span className="text-sm font-medium text-slate-100">
                  {priceValue || amount}
                </span>
              )}
              {priceChange && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${priceChange.startsWith('+') ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-red-500/10 text-red-300 border-red-500/20'}`}>
                  {priceChange}
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] text-slate-500/80 whitespace-nowrap">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(alert.timestamp)}
              </span>
            </div>
          </>
        ) : (
          <>
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
            {(alert.type || alert.event_type || 'ALERT').toUpperCase().replace(/_ALERT$/, '').replace(/_/g, ' ')}
          </span>

          {/* Timestamp */}
          <span className="ml-auto flex items-center gap-1 text-[9px] sm:text-[11px] text-slate-500 whitespace-nowrap flex-shrink-0">
            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            {formatRelativeTime(alert.timestamp)}
          </span>
        </div>

        {/* Title + onchain details in a single row */}
        {isOnchain ? (
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] sm:text-xs mb-0.5">
            <h4 className={`min-w-0 truncate font-medium ${isUnread ? 'text-slate-100' : 'text-slate-300'}`}>
              {displayTitle}
            </h4>
            {structuredSubtitle && (
              <span className="min-w-0 truncate text-cyan-300/90">
                {structuredSubtitle}
              </span>
            )}
            {token && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 shrink-0">
                {token}
              </span>
            )}
            {(onchainUsdValue || amount) && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                {onchainUsdValue || amount}
              </span>
            )}
          </div>
        ) : isPrice ? (
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] sm:text-xs mb-0.5 whitespace-nowrap overflow-hidden">
            <h4 className={`min-w-0 truncate font-medium ${isUnread ? 'text-slate-100' : 'text-slate-300'}`}>
              {displayTitle}
            </h4>
            {token && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 shrink-0">
                {token}
              </span>
            )}
            {priceValue && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-white/5 text-slate-200 border border-white/10 shrink-0">
                {priceValue}
              </span>
            )}
            {priceChange && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${priceChange.startsWith('+') ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-red-500/10 text-red-300 border-red-500/20'}`}>
                {priceChange}
              </span>
            )}
            {!priceValue && amount && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-white/5 text-slate-200 border border-white/10 shrink-0">
                {amount}
              </span>
            )}
          </div>
        ) : (
          <h4
            className={`text-xs sm:text-sm font-semibold mb-0.5 line-clamp-2 ${isUnread ? 'text-white' : 'text-slate-300'
              }`}
          >
            {displayTitle}
          </h4>
        )}

        {/* News layout */}
        {isNews && summaryPreview.show && (
          <p className="text-[11px] sm:text-xs text-slate-400 line-clamp-3 leading-relaxed">
            {summaryPreview.text}
            {summaryPreview.truncated && (
              <span className="text-blue-300"> Read more</span>
            )}
          </p>
        )}

        {/* Onchain layout */}
        {isOnchain && (
          <div className="mt-1.5 space-y-1 text-[11px]">
            {onchainRisk && (
              <div className="inline-flex items-center">
                <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 uppercase text-[10px]">
                  {onchainRisk}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Author + article link */}
        {isNews && (
          <div className="hidden xl:flex mt-1.5 flex-wrap items-center gap-2 text-[10px] sm:text-[11px] text-slate-500">
            <span
              title={author}
              className="max-w-[220px] whitespace-nowrap overflow-hidden text-ellipsis"
            >
              By {author}
            </span>
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
        )}

        {/* Hashtags: topics */}
        {isNews && hashtags.length > 0 && (
          <div className="hidden xl:flex mt-1.5 flex-wrap gap-1">
            {hashtags.map((tag, idx) => (
              <span
                key={`${alert.id}-hashtag-${tag}-${idx}`}
                className="text-[10px] sm:text-[11px] text-blue-300/90 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md"
              >
                {toHashtag(tag)}
              </span>
            ))}
          </div>
        )}

        {/* Mentions: entities/tokens */}
        {isNews && mentions.length > 0 && (
          <div className="hidden xl:flex mt-1 flex-wrap gap-1">
            {mentions.map((mention, idx) => (
              <span
                key={`${alert.id}-mention-${mention}-${idx}`}
                className="text-[10px] sm:text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-md font-medium"
              >
                [{mention}]
              </span>
            ))}
          </div>
        )}

        {/* Categories fallback if hashtags are unavailable */}
        {isNews && hashtags.length === 0 && categories.length > 0 && (
          <div className="hidden xl:flex mt-1.5 flex-wrap gap-1">
            {categories.map((category, idx) => (
              <span
                key={`${alert.id}-category-${category}-${idx}`}
                className="text-[10px] sm:text-[11px] text-blue-300/90 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md"
              >
                {toHashtag(category)}
              </span>
            ))}
          </div>
        )}

        {/* Token/entity */}
        {isNews && alert.entity && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[9px] sm:text-[10px] text-slate-600 uppercase tracking-wider">Token:</span>
            <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400">{alert.entity}</span>
          </div>
        )}
          </>
        )}
      </div>

      {/* Action buttons - appear on hover (desktop) or below on mobile */}
      {!isPrice && (
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
      )}
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
    hashtags: PropTypes.arrayOf(PropTypes.string),
    mentions: PropTypes.arrayOf(PropTypes.string),
    priority: PropTypes.oneOf(['HIGH', 'MEDIUM', 'LOW']),
    status: PropTypes.string,
    timestamp: PropTypes.string,
    entity: PropTypes.string,
    rawContent: PropTypes.shape({
      author: PropTypes.string,
      link: PropTypes.string,
      categories: PropTypes.arrayOf(PropTypes.string),
      hashtags: PropTypes.arrayOf(PropTypes.string),
      mentions: PropTypes.arrayOf(PropTypes.string),
    }),
  }).isRequired,
  onViewDetails: PropTypes.func,
  onMarkAsRead: PropTypes.func,
};

export default AlertCard;
