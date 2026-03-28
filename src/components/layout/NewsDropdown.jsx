import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Zap, Loader2, ChevronRight } from 'lucide-react';
import eventsService from '@services/eventsService';
import { normalizeEvent } from '@utils/eventNormalizer';

export const NewsDropdown = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [news, setNews] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState('HIGH');

  useEffect(() => {
    if (!isOpen) return;

    const loadNews = async () => {
      try {
        setIsLoading(true);
        const newsData = await eventsService.getEventsByType('news', { skip: 0, limit: 30 });
        if (Array.isArray(newsData)) {
          const normalized = newsData.map((item) => normalizeEvent(item));
          setNews(normalized);
        }
      } catch (error) {
        console.error('Failed to load news:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNews();
  }, [isOpen]);

  const filtered = news.filter(n => 
    priorityFilter === 'ALL' ? true : n.priority === priorityFilter
  );

  const handleViewAll = () => {
    navigate('/news');
    onClose();
  };

  const handleOutsideClick = (e) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Dropdown Panel */}
      <div
        ref={dropdownRef}
        className="absolute left-0 mt-0 z-50 w-96 max-h-[600px] flex flex-col bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-950 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden"
        style={{ top: '100%', marginTop: '8px' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950/50 to-emerald-900/20 border-b border-emerald-500/20 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Market News
            </h3>
            <button
              onClick={handleViewAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-medium transition-all"
            >
              View All
            </button>
          </div>

          {/* Priority Filter */}
          <div className="flex gap-2">
            {['HIGH', 'MEDIUM', 'LOW', 'ALL'].map(priority => (
              <button
                key={priority}
                onClick={() => setPriorityFilter(priority)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  priorityFilter === priority
                    ? priority === 'HIGH'
                      ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                      : priority === 'MEDIUM'
                      ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                      : priority === 'LOW'
                      ? 'bg-slate-500/30 text-slate-300 border border-slate-500/50'
                      : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:border-white/20'
                }`}
              >
                {priority}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mr-2" />
              <span className="text-sm text-slate-400">Loading news...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No {priorityFilter !== 'ALL' ? priorityFilter.toLowerCase() + ' ' : ''}news available</p>
            </div>
          ) : (
            filtered.slice(0, 6).map(item => (
              <div
                key={item.id}
                className={`group p-3 rounded-xl border transition-all hover:shadow-lg cursor-pointer ${
                  item.priority === 'HIGH'
                    ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40'
                    : item.priority === 'MEDIUM'
                    ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/40'
                    : 'bg-slate-500/5 border-slate-500/20 hover:bg-slate-500/10 hover:border-slate-500/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`px-2 py-1 rounded-md text-xs font-bold flex-shrink-0 mt-0.5 ${
                    item.priority === 'HIGH'
                      ? 'bg-red-500/20 text-red-300'
                      : item.priority === 'MEDIUM'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-500/20 text-slate-300'
                  }`}>
                    {item.priority}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.source} • {new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors flex-shrink-0 mt-0.5" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {filtered.length > 6 && (
          <div className="border-t border-slate-700/50 px-4 py-3 bg-slate-950/50">
            <button
              onClick={handleViewAll}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
            >
              View All News <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default NewsDropdown;
