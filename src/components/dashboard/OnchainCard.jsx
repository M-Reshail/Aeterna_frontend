import React from 'react';
import PropTypes from 'prop-types';
import { CheckCircle, Eye } from 'lucide-react';
import { formatRelativeTime } from '@utils/helpers';

const safeText = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const shortAddress = (value) => {
  const text = safeText(value, 'N/A');
  if (text === 'N/A') return text;
  if (text.length <= 14) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
};

const formatUsd = (value) => {
  const number = toNumber(value);
  if (number === null) return 'Not provided';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(number);
};

const priorityClass = {
  HIGH: {
    badge: 'border-red-500/50 bg-red-500/20 text-red-200 shadow-[0_0_18px_rgba(239,68,68,0.25)]',
    card: 'border-red-500/35 hover:border-red-400/55 bg-red-500/[0.03]',
  },
  MEDIUM: {
    badge: 'border-amber-500/45 bg-amber-500/15 text-amber-200',
    card: 'border-amber-500/25 hover:border-amber-400/45 bg-amber-500/[0.02]',
  },
  LOW: {
    badge: 'border-slate-600 bg-slate-800/80 text-slate-300',
    card: 'border-slate-700/80 hover:border-slate-500/70 bg-slate-900/60',
  },
};

export const OnchainCard = ({ alert, onViewDetails, onMarkAsRead }) => {
  const raw = alert.rawContent || {};
  const token = safeText(alert.token || raw.token || raw.symbol || raw.name, 'Unknown token');
  const amount = safeText(alert.amountFormatted, safeText(alert.amount ?? raw.amount ?? raw.value, 'Not provided'));
  const usdValue = alert.usdFormatted || formatUsd(alert.usd_value ?? raw.usd_value ?? raw.value_usd);
  const fromAddress = alert.from || raw.from || raw.from_address;
  const toAddress = alert.to || raw.to || raw.to_address;
  const fromShort = safeText(alert.fromShort || alert.from_short, shortAddress(fromAddress));
  const toShort = safeText(alert.toShort || alert.to_short, shortAddress(toAddress));
  const direction = safeText(alert.direction, `${fromShort} → ${toShort}`);
  const blockchain = safeText(alert.blockchain || raw.blockchain, 'Unknown chain');
  const txType = safeText(alert.transaction_type || raw.transaction_type || raw.tx_type, 'Unknown');
  const title = safeText(alert.title, usdValue && usdValue !== 'Not provided' ? `Transfer of ${usdValue} ${token}` : `Transfer of ${token}`);
  const highPriorityReason = safeText(alert.priorityReason || alert.alert_reason || raw.alert_reason || raw.alert_reasons, '');
  const alertReason = safeText(alert.priorityReason || alert.alert_reason || raw.alert_reason || raw.alert_reasons, 'No reason provided');
  const isUnread = alert.status === 'new';
  const priority = priorityClass[alert.priority] || priorityClass.LOW;

  return (
    <article
      className={`rounded-xl border p-3 cursor-pointer transition-all duration-200 ${priority.card}`}
      onClick={() => onViewDetails && onViewDetails(alert)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white truncate">{title}</h3>
          <p className="text-[10px] text-slate-500 truncate mt-0.5">
            {safeText(blockchain, 'Unknown chain')} • {safeText(txType, 'Transfer')}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`px-2 py-0.5 rounded-md text-[10px] border font-semibold ${priority.badge}`}>
            {alert.priority || 'LOW'}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] border border-slate-600 bg-slate-900 text-slate-300">ONCHAIN</span>
        </div>
      </div>

      {alert.priority === 'HIGH' && (
        <div className="mt-2 rounded-lg border border-red-500/35 bg-red-500/10 p-2">
          <p className="text-[10px] uppercase tracking-wide text-red-300 font-bold">High Priority</p>
          <p className="text-[11px] text-red-200 mt-1 truncate">
            {highPriorityReason || 'Large on-chain transfer detected and prioritized for immediate review.'}
          </p>
        </div>
      )}

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-white/10 bg-black/40 p-2 min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Amount</p>
          <p className="text-slate-100 font-semibold truncate">{amount}</p>
          <p className="text-emerald-300 font-semibold truncate">{usdValue}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/40 p-2 min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Direction</p>
          <p className="text-slate-100 font-medium truncate">{direction}</p>
          <p className="text-[11px] text-slate-400 truncate">{token}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 min-w-0">
        <p className="text-[11px] text-slate-400 truncate">Reason: {alertReason}</p>
        <span className="text-[11px] text-slate-500 flex-shrink-0">{formatRelativeTime(alert.timestamp)}</span>
      </div>

      <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onViewDetails && onViewDetails(alert)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-[11px] font-medium hover:bg-emerald-500/20"
        >
          <Eye className="w-3 h-3" /> Details
        </button>
        {isUnread && (
          <button
            onClick={() => onMarkAsRead && onMarkAsRead(alert.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 text-[11px] font-medium hover:bg-slate-700"
          >
            <CheckCircle className="w-3 h-3" /> Mark Read
          </button>
        )}
      </div>

      <div className="sr-only">
        {fromShort}
        {toShort}
      </div>
    </article>
  );
};

OnchainCard.propTypes = {
  alert: PropTypes.object.isRequired,
  onViewDetails: PropTypes.func,
  onMarkAsRead: PropTypes.func,
};

export default OnchainCard;
