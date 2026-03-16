import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Search,
  Filter as FilterIcon,
  Loader2,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  Zap,
  Globe,
} from 'lucide-react';
import { useToast } from '@hooks/useToast';

const EconomicEvents = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [impactFilter, setImpactFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [countryOptions, setCountryOptions] = useState([]);

  // Mock economic events data - in production, this would come from an API
  const mockEconomicEvents = [
    {
      id: 'event-1',
      title: 'US Federal Funds Rate Decision',
      country: 'USA',
      impact: 'HIGH',
      date: new Date().toISOString(),
      time: '18:00',
      forecast: '5.25%-5.50%',
      previous: '5.25%-5.50%',
      actual: null,
      description: 'The Federal Reserve\'s decision on interest rates. This is one of the most important economic announcements affecting global markets, particularly the USD and equity markets.',
      category: 'Rates Decision',
    },
    {
      id: 'event-2',
      title: 'Eurozone Inflation Rate (YoY)',
      country: 'Eurozone',
      impact: 'HIGH',
      date: new Date().toISOString(),
      time: '10:00',
      forecast: '3.1%',
      previous: '3.0%',
      actual: null,
      description: 'Eurozone inflation on a yearly basis. A key indicator for ECB policy decisions and EUR movements.',
      category: 'Inflation',
    },
    {
      id: 'event-3',
      title: 'UK Unemployment Rate',
      country: 'United Kingdom',
      impact: 'MEDIUM',
      date: new Date().toISOString(),
      time: '09:30',
      forecast: '4.0%',
      previous: '4.0%',
      actual: null,
      description: 'The British unemployment rate. Important for Bank of England policy and GBP movements.',
      category: 'Employment',
    },
    {
      id: 'event-4',
      title: 'Japan Industrial Production',
      country: 'Japan',
      impact: 'MEDIUM',
      date: new Date().toISOString(),
      time: '08:30',
      forecast: '2.3%',
      previous: '1.5%',
      actual: null,
      description: 'Industrial production data for Japan, indicating economic activity and manufacturing strength.',
      category: 'Production',
    },
    {
      id: 'event-5',
      title: 'China GDP (YoY)',
      country: 'China',
      impact: 'HIGH',
      date: new Date(Date.now() + 86400000).toISOString(),
      time: '09:00',
      forecast: '5.2%',
      previous: '4.9%',
      actual: null,
      description: 'China\'s quarterly GDP growth rate. Highly significant for global markets and cryptocurrency sentiment.',
      category: 'GDP',
    },
    {
      id: 'event-6',
      title: 'US Non-Farm Payrolls',
      country: 'USA',
      impact: 'HIGH',
      date: new Date(Date.now() + 172800000).toISOString(),
      time: '13:30',
      forecast: '200K',
      previous: '275K',
      actual: null,
      description: 'Number of jobs added in the US non-farm sector. One of the most important indicators for USD and equity markets.',
      category: 'Employment',
    },
    {
      id: 'event-7',
      title: 'Australia Employment Change',
      country: 'Australia',
      impact: 'MEDIUM',
      date: new Date().toISOString(),
      time: '01:30',
      forecast: '25K',
      previous: '15.4K',
      actual: null,
      description: 'Monthly employment change in Australia. Important for ASX and AUD movements.',
      category: 'Employment',
    },
    {
      id: 'event-8',
      title: 'Canada Retail Sales',
      country: 'Canada',
      impact: 'MEDIUM',
      date: new Date().toISOString(),
      time: '13:30',
      forecast: '-0.3%',
      previous: '0.1%',
      actual: null,
      description: 'Retail sales data for Canada, indicating consumer spending and economic health.',
      category: 'Retail',
    },
  ];

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setIsLoading(true);
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setEvents(mockEconomicEvents);
        
        // Extract unique countries
        const countries = Array.from(
          new Set(mockEconomicEvents.map(e => e.country))
        ).sort();
        setCountryOptions(countries);
      } catch (error) {
        toast.error('Failed to load economic events');
        console.error('Error loading events:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();
  }, [toast]);

  // Filter events
  const filtered = events.filter(event => {
    const matchesSearch = 
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesImpact = impactFilter === 'all' || event.impact === impactFilter;
    const matchesCountry = countryFilter === 'all' || event.country === countryFilter;
    
    const eventDate = new Date(event.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let matchesDate = true;
    if (dateFilter === 'today') {
      eventDate.setHours(0, 0, 0, 0);
      matchesDate = eventDate.getTime() === today.getTime();
    } else if (dateFilter === 'upcoming') {
      matchesDate = new Date(event.date) >= today;
    }
    
    return matchesSearch && matchesImpact && matchesCountry && matchesDate;
  });

  const getImpactColor = (impact) => {
    switch(impact) {
      case 'HIGH': return 'from-red-500/10 to-red-600/5 border-red-500/30';
      case 'MEDIUM': return 'from-amber-500/10 to-amber-600/5 border-amber-500/30';
      case 'LOW': return 'from-blue-500/10 to-blue-600/5 border-blue-500/30';
      default: return 'from-slate-500/10 to-slate-600/5 border-slate-500/30';
    }
  };

  const formatTime = (timeStr) => {
    try {
      return new Date(`2024-01-01 ${timeStr}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return timeStr;
    }
  };

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
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">Economic Calendar</h1>
                <p className="text-sm text-slate-400 mt-1">Market-moving economic events & data releases</p>
              </div>
            </div>
          </div>

          {/* Impact Stats */}
          <div className="grid grid-cols-3 md:grid-cols-3 gap-3 lg:gap-4">
            <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/30 rounded-xl p-4 hover:border-red-500/50 transition-all">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">High Impact</p>
                <p className="text-3xl font-bold text-red-300">{events.filter(e => e.impact === 'HIGH').length}</p>
                <p className="text-xs text-red-400/70">major events</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-xl p-4 hover:border-amber-500/50 transition-all">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Medium Impact</p>
                <p className="text-3xl font-bold text-amber-300">{events.filter(e => e.impact === 'MEDIUM').length}</p>
                <p className="text-xs text-amber-400/70">important events</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-4 hover:border-blue-500/50 transition-all">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Low Impact</p>
                <p className="text-3xl font-bold text-blue-300">{events.filter(e => e.impact === 'LOW').length}</p>
                <p className="text-xs text-blue-400/70">minor events</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-gradient-to-br from-white/5 via-white/3 to-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search events by title or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/15 transition-all text-sm"
              />
            </div>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Date Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-3 uppercase tracking-wide">Date</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-medium focus:outline-none focus:border-amber-500/50 focus:bg-white/15 transition-all"
              >
                <option value="today">Today</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>

            {/* Impact Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-3 uppercase tracking-wide">Impact</label>
              <select
                value={impactFilter}
                onChange={(e) => setImpactFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-medium focus:outline-none focus:border-amber-500/50 focus:bg-white/15 transition-all"
              >
                <option value="all">All Impact Levels</option>
                <option value="HIGH">🔴 High Impact</option>
                <option value="MEDIUM">🟠 Medium Impact</option>
                <option value="LOW">🔵 Low Impact</option>
              </select>
            </div>

            {/* Country Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-3 uppercase tracking-wide">Country</label>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-medium focus:outline-none focus:border-amber-500/50 focus:bg-white/15 transition-all"
              >
                <option value="all">All Countries</option>
                {countryOptions.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Results: <span className="text-amber-400 font-bold">{filtered.length}</span> events
              {(searchTerm || impactFilter !== 'all' || countryFilter !== 'all') && (
                <span className="text-slate-500"> (filtered)</span>
              )}
            </p>
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
              <span className="text-slate-400">Loading events...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-white/5 to-white/3 border border-white/10 rounded-2xl">
              <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-300 mb-2 font-semibold">No events found</p>
              <p className="text-xs text-slate-500">Try adjusting your filters</p>
            </div>
          ) : (
            filtered.map(event => (
              <div
                key={event.id}
                className={`bg-gradient-to-br ${getImpactColor(event.impact)} border rounded-2xl p-5 hover:shadow-xl hover:shadow-amber-500/10 transition-all hover:border-amber-500/50 group`}
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          event.impact === 'HIGH' ? 'bg-red-500/20 text-red-300' :
                          event.impact === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {event.impact} IMPACT
                        </span>
                        <span className="text-xs font-semibold text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg">
                          {event.category}
                        </span>
                      </div>
                      <h3 className="text-white font-bold text-lg group-hover:text-amber-300 transition-colors">
                        {event.title}
                      </h3>
                      <p className="text-sm text-slate-400 mt-2">{event.description}</p>
                    </div>
                  </div>

                  {/* Data Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wide">Country</p>
                      <p className="text-white font-semibold">{event.country}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wide">Time</p>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <p className="text-white font-semibold">{formatTime(event.time)}</p>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wide">Forecast</p>
                      <p className="text-emerald-300 font-semibold">{event.forecast}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wide">Previous</p>
                      <p className="text-slate-300 font-semibold">{event.previous}</p>
                    </div>
                  </div>

                  {/* Actual Value (if available) */}
                  {event.actual && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                      <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wide">Actual Result</p>
                      <p className="text-emerald-300 font-bold">{event.actual}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EconomicEvents;
