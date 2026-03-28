import React from 'react';
import PropTypes from 'prop-types';
import { Calendar, Clock, Newspaper, Sparkles, User } from 'lucide-react';
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
    card: 'border-red-500/30 shadow-[0_0_0_1px_rgba(239,68,68,0.15)] hover:shadow-[0_0_22px_rgba(239,68,68,0.22)]',
  },
  MEDIUM: {
    badge: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    card: 'border-amber-500/25 shadow-[0_0_0_1px_rgba(245,158,11,0.12)] hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]',
  },
  LOW: {
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    card: 'border-slate-700/80 hover:border-slate-600/80 hover:shadow-[0_0_14px_rgba(148,163,184,0.16)]',
  },
};

const asArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

export const NewsCard = ({ alert, onViewDetails, onMarkAsRead, isExpanded, onToggleExpand }) => {
  const summary = safeToString(alert.summary || alert.content, '');
  const publishedDate = resolvePublishedDate(alert);
  const source = safeToString(alert.source, 'unknown');
  const compactSummary = summary
    ? summary.replace(/\s+/g, ' ')
    : '';
  const priority = safeToString(alert.priority, 'LOW');
  const styles = priorityStyles[priority] || priorityStyles.LOW;
  const author = safeToString(alert.author || alert?.rawContent?.author, 'Unknown');
  const qualityScore = alert?.metrics?.quality_score ?? alert?.rawContent?.quality_score;
  const categories = asArray(alert.categories || alert?.rawContent?.categories);
  const hashtags = asArray(alert.hashtags || alert?.rawContent?.hashtags);
  const mentions = asArray(alert.mentions || alert?.rawContent?.mentions);

  return (
    <article
      className={`rounded-xl border bg-gradient-to-r from-slate-950 to-blue-950/20 p-2.5 sm:p-3 cursor-pointer transition-all duration-300 transform-gpu hover:scale-[1.01] ${styles.card}`}
      onClick={() => onToggleExpand && onToggleExpand(alert.id)}
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
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <Clock className="w-3 h-3" />
          {publishedDate ? formatRelativeTime(publishedDate) : formatRelativeTime(alert.timestamp)}
        </span>
      </div>

      <div className="flex items-start gap-2 min-w-0">
        <Newspaper className="w-4 h-4 text-blue-300 mt-0.5 flex-shrink-0" />
        <h3 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2">{safeToString(alert.title, 'Untitled')}</h3>
      </div>

      {compactSummary && (
        <p className="mt-1 text-xs text-slate-400 leading-relaxed line-clamp-1">
          {compactSummary}
        </p>
      )}

      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${isExpanded ? 'max-h-[600px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}
      >
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg border border-slate-700 bg-[#0f131a] p-2">
              <div className="text-slate-500 mb-0.5">Author</div>
              <div className="text-slate-200 font-medium inline-flex items-center gap-1"><User className="w-3 h-3 text-slate-400" />{author}</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-[#0f131a] p-2">
              <div className="text-slate-500 mb-0.5">Quality Score</div>
              <div className="text-slate-200 font-medium inline-flex items-center gap-1"><Sparkles className="w-3 h-3 text-blue-300" />{qualityScore ?? 'Not provided'}</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-[#0f131a] p-2">
              <div className="text-slate-500 mb-0.5">Published Date</div>
              <div className="text-slate-200 font-medium inline-flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" />{publishedDate ? formatDateTime(publishedDate) : 'Not provided'}</div>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-slate-500 mb-1">Categories</p>
            <div className="flex flex-wrap gap-1">
              {categories.length > 0 ? categories.map((item) => (
                <span key={`${alert.id}-cat-${item}`} className="px-1.5 py-0.5 rounded-full text-[10px] border border-indigo-500/35 bg-indigo-500/10 text-indigo-200">{item}</span>
              )) : <span className="text-[10px] text-slate-500">None</span>}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-slate-500 mb-1">Hashtags</p>
            <div className="flex flex-wrap gap-1">
              {hashtags.length > 0 ? hashtags.map((item) => (
                <span key={`${alert.id}-tag-${item}`} className="px-1.5 py-0.5 rounded-full text-[10px] border border-blue-500/35 bg-blue-500/10 text-blue-200">{String(item).startsWith('#') ? item : `#${item}`}</span>
              )) : <span className="text-[10px] text-slate-500">None</span>}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-slate-500 mb-1">Mentions</p>
            <div className="flex flex-wrap gap-1">
              {mentions.length > 0 ? mentions.map((item) => (
                <span key={`${alert.id}-mention-${item}`} className="px-1.5 py-0.5 rounded-full text-[10px] border border-slate-600 bg-slate-800 text-slate-200">{item}</span>
              )) : <span className="text-[10px] text-slate-500">None</span>}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={() => onViewDetails && onViewDetails(alert)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-blue-500/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 transition-colors"
            >
              Open Full Details
            </button>
            <button
              onClick={() => onMarkAsRead && onMarkAsRead(alert.id)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Mark Read
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

NewsCard.propTypes = {
  alert: PropTypes.object.isRequired,
  onViewDetails: PropTypes.func,
  onMarkAsRead: PropTypes.func,
  isExpanded: PropTypes.bool,
  onToggleExpand: PropTypes.func,
};

export default NewsCard;
