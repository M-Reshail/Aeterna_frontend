import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Search,
  Filter as FilterIcon,
  Loader2,
  AlertTriangle,
  TrendingUp,
  ExternalLink,
  Calendar,
  Globe,
  Zap,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { AlertCard } from '@components/dashboard/AlertCard';
import eventsService from '@services/eventsService';
import { useToast } from '@hooks/useToast';

const News = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [allNews, setAllNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [sourceOptions, setSourceOptions] = useState([]);
  const feedRef = useRef(null);

  // Normalize news event
  const normalizeNewsEvent = (event) => {
    const content = event?.content || {};
    const title = content.title || content.name || `News from ${event?.source || 'source'}`;
    const body = content.summary || content.alert_reasons || content.link || 'No details provided';

    return {
      id: `event-${event?.id}`,
      event_id: event?.id,
      event_type: 'NEWS',
      source: event?.source || 'unknown',
      title,
      content: body,
      priority: content.quality_score >= 70 ? 'HIGH' : content.quality_score >= 50 ? 'MEDIUM' : 'LOW',
      status: 'new',
      timestamp: event?.timestamp || new Date().toISOString(),
      entity: content.id || content.symbol || content.name || '',
      rawContent: {
        ...content,
        type: event?.type,
      },
    };
  };

  // Load news from API
  useEffect(() => {
    const loadNews = async () => {
      try {
        setIsLoading(true);
        const news = await eventsService.getEventsByType('news', { skip: 0, limit: 200 });
        
        if (Array.isArray(news)) {
          const normalized = news.map(normalizeNewsEvent);
          setAllNews(normalized);
          
          // Extract unique sources
          const sources = Array.from(
            new Set(normalized.map(n => n.source).filter(Boolean))
          ).sort();
          setSourceOptions(sources);
        }
      } catch (error) {
        toast.error('Failed to load news');
        console.error('Error loading news:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNews();
  }, [toast]);

  // Filter and sort news
  const filtered = allNews.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.entity.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    const matchesSource = sourceFilter === 'all' || item.source === sourceFilter;
    
    return matchesSearch && matchesPriority && matchesSource;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch(sortBy) {
      case 'oldest':
        return new Date(a.timestamp) - new Date(b.timestamp);
      case 'priority':
        const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      case 'newest':
      default:
        return new Date(b.timestamp) - new Date(a.timestamp);
    }
  });

  const getPriorityStats = () => {
    return {
      high: allNews.filter(n => n.priority === 'HIGH').length,
      medium: allNews.filter(n => n.priority === 'MEDIUM').length,
      low: allNews.filter(n => n.priority === 'LOW').length,
    };
  };

  const stats = getPriorityStats();

  return (
    <div className="min-h-screen w-full pt-24 sm:pt-28 pb-12 bg-gradient-to-br from-[#0f172a] via-slate-900 to-[#1a1f2e]">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 space-y-8">
        {/* Header Section */}
        <div className="space-y-6">
          {/* Back Button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </button>

          {/* Title */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">Market News</h1>
                <p className="text-sm text-slate-400 mt-1">High-impact financial news & updates</p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 md:grid-cols-3 gap-3 lg:gap-4">
            <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/30 rounded-xl p-4 hover:border-red-500/50 transition-all">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">High Impact</p>
                <p className="text-3xl font-bold text-red-300">{stats.high}</p>
                <p className="text-xs text-red-400/70">breaking news</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-xl p-4 hover:border-amber-500/50 transition-all">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Medium Impact</p>
                <p className="text-3xl font-bold text-amber-300">{stats.medium}</p>
                <p className="text-xs text-amber-400/70">important updates</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-4 hover:border-blue-500/50 transition-all">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Low Impact</p>
                <p className="text-3xl font-bold text-blue-300">{stats.low}</p>
                <p className="text-xs text-blue-400/70">minor updates</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-gradient-to-br from-white/5 via-white/3 to-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search news by title, content, or token..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-white/15 transition-all text-sm"
              />
            </div>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Priority Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-3 uppercase tracking-wide">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-white/15 transition-all"
              >
                <option value="all">All Priorities</option>
                <option value="HIGH">🔴 High Impact</option>
                <option value="MEDIUM">🟠 Medium Impact</option>
                <option value="LOW">🔵 Low Impact</option>
              </select>
            </div>

            {/* Source Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-3 uppercase tracking-wide">Source</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-white/15 transition-all"
              >
                <option value="all">All Sources</option>
                {sourceOptions.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-3 uppercase tracking-wide">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-white/15 transition-all"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="priority">Priority (High → Low)</option>
              </select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Results: <span className="text-emerald-400 font-bold">{sorted.length}</span>
              {(searchTerm || priorityFilter !== 'all' || sourceFilter !== 'all') && (
                <span className="text-slate-500"> (filtered)</span>
              )}
            </p>
          </div>
        </div>

        {/* News List */}
        <div ref={feedRef} className="space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
              <span className="text-slate-400">Loading news...</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-white/5 to-white/3 border border-white/10 rounded-2xl">
              <Zap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-300 mb-2 font-semibold">No news found</p>
              <p className="text-xs text-slate-500">Try adjusting your filters or search terms</p>
            </div>
          ) : (
            sorted.map(news => (
              <div key={news.id} className="group">
                <AlertCard
                  alert={news}
                  onViewDetails={() => {}}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default News;
