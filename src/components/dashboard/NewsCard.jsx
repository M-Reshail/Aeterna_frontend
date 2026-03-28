import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Clock, Newspaper } from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '@utils/helpers';

const safeToString = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    return (value.summary || value.title || value.description || '').toString().trim() || fallback;
  }
  return fallback;
};

const resolvePublishedDate = (alert) =>
  alert.published_date ||
  alert?.rawContent?.published_date ||
  alert?.rawContent?.published_at ||
  alert?.rawContent?.publication_date ||
  alert?.rawContent?.date_published;

const priorityStyles = {
  HIGH: {
    badge: 'border-red-500/40 bg-red-500/10 text-red-300',
    card: 'border-red-500/30 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]',
  },
  MEDIUM: {
    badge: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    card: 'border-amber-500/25 shadow-[0_0_0_1px_rgba(245,158,11,0.12)]',
  },
  LOW: {
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    card: 'border-slate-700/80',
  },
};

export const NewsCard = ({ alert, onViewDetails }) => {
  const [showFullSummary, setShowFullSummary] = useState(false);
  const summary = safeToString(alert.summary || alert.content, '');
  const publishedDate = resolvePublishedDate(alert);
  const source = safeToString(alert.source, 'unknown');
  const compactSummary = summary
    ? summary.replace(/\s+/g, ' ')
    : '';
  const hasSummary = compactSummary.length > 0;
  const isLongSummary = compactSummary.length > 120;
  const priority = safeToString(alert.priority, 'LOW');
  const styles = priorityStyles[priority] || priorityStyles.LOW;
  const displayTime = publishedDate || alert.timestamp;
  const relativeTime = formatRelativeTime(displayTime);
  const exactTime = formatDateTime(displayTime);

  return (
    <article
      className={`rounded-xl border bg-gradient-to-r from-slate-950 to-blue-950/20 p-2.5 sm:p-3 cursor-pointer transition-all duration-200 hover:bg-[#141b26] hover:border-slate-600/80 hover:shadow-[0_6px_18px_rgba(15,23,42,0.45)] ${styles.card}`}
      onClick={() => onViewDetails && onViewDetails(alert)}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${styles.badge}`}>
            {priority}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] text-slate-300 border border-slate-700 bg-slate-900/70">
            {source}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400" title={exactTime}>
          <Clock className="w-3 h-3" />
          {relativeTime}
        </span>
      </div>

      <div className="flex items-start gap-2 min-w-0">
        <Newspaper className="w-4 h-4 text-blue-300 mt-0.5 flex-shrink-0" />
        <h3 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2">{safeToString(alert.title, 'Untitled')}</h3>
      </div>

      {hasSummary && (
        <div className="mt-1">
          <p className={`text-xs text-slate-400 leading-relaxed ${isLongSummary && !showFullSummary ? 'line-clamp-2' : ''}`}>
            {compactSummary}
          </p>
          {isLongSummary && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullSummary((prev) => !prev);
              }}
              className="mt-1 text-[11px] text-blue-300 hover:text-blue-200 transition-colors"
            >
              {showFullSummary ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
    </article>
  );
};

NewsCard.propTypes = {
  alert: PropTypes.object.isRequired,
  onViewDetails: PropTypes.func,
};

export default NewsCard;
