import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { SlidersHorizontal, Search, X, Filter, ChevronDown, ChevronUp } from 'lucide-react';

const PRIORITY_OPTIONS = [
  {
    value: 'HIGH',
    label: 'High',
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    border: 'border-red-500/40',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
  },
  {
    value: 'LOW',
    label: 'Low',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
  },
];

export const FilterSidebar = ({
  filters,
  onFiltersChange,
  onApply,
  onClear,
  totalCount,
  filteredCount,
  sourceOptions = [],
}) => {
  const [isEntityOpen, setIsEntityOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  const handlePriorityToggle = (value) => {
    const current = filters.priority || [];
    const updated = current.includes(value)
      ? current.filter((p) => p !== value)
      : [...current, value];
    onFiltersChange({ ...filters, priority: updated });
  };

  const handleEventTypeToggle = (value) => {
    const current = filters.eventType || 'all';
    const updated = current === value ? 'all' : value;
    onFiltersChange({ ...filters, eventType: updated });
  };

  const handleSourceToggle = (source) => {
    const current = filters.sources || [];
    const updated = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source];
    onFiltersChange({ ...filters, sources: updated });
  };

  const handleSelectAllSources = () => {
    const current = filters.sources || [];
    const allSelected = current.length === sourceOptions.length && sourceOptions.length > 0;
    const updated = allSelected ? [] : [...sourceOptions];
    onFiltersChange({ ...filters, sources: updated });
  };

  const activeFilterCount =
    ((filters.priority?.length ?? 0) > 0 && (filters.priority?.length ?? 0) !== 3 ? 1 : 0) +
    (filters.eventType && filters.eventType !== 'all' ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.entity ? 1 : 0) +
    (filters.sources?.length > 0 ? 1 : 0);

  return (
    <aside className="flex flex-col h-full bg-[#080808] rounded-2xl border border-[#1A1A1A] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white">Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-emerald-500 text-black">
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-500">
          {filteredCount ?? totalCount}/{totalCount}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="px-1">
          <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            All Filters
          </p>
        </div>

        <div className="px-1">
          <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">Priority</p>
          <div className="flex flex-wrap gap-2">
            {PRIORITY_OPTIONS.map((opt) => {
              const isChecked = (filters.priority || []).includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePriorityToggle(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isChecked
                    ? `${opt.bg} ${opt.color} ${opt.border}`
                    : 'bg-white/[0.03] text-slate-300 border-white/10 hover:bg-white/[0.06]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-1">
          <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">Alert Type</p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'All', icon: '📊' },
              { value: 'NEWS', label: 'News', icon: '📰' },
              { value: 'PRICE_ALERT', label: 'Price', icon: '💰' },
              { value: 'ONCHAIN', label: 'Onchain', icon: '⛓️' },
            ].map((opt) => {
              const isActive = (filters.eventType || 'all') === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleEventTypeToggle(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                    : 'bg-white/[0.03] text-slate-300 border-white/10 hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="mr-1">{opt.icon}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-1">
          <button
            type="button"
            onClick={() => setIsEntityOpen((v) => !v)}
            className="w-full flex items-center justify-between mb-2"
          >
            <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Token / Entity</p>
            {isEntityOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {isEntityOpen && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. BTC, ETH, SOL..."
                value={filters.entity || ''}
                onChange={(e) => onFiltersChange({ ...filters, entity: e.target.value })}
                className="w-full pl-8 pr-8 py-2 rounded-xl text-sm bg-[#111111] border border-[#2a2a2a] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40 focus:bg-[#141414] transition-all duration-200"
              />
              {filters.entity && (
                <button
                  onClick={() => onFiltersChange({ ...filters, entity: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-1">
          <button
            type="button"
            onClick={() => setIsDateOpen((v) => !v)}
            className="w-full flex items-center justify-between mb-2"
          >
            <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Date Range</p>
            {isDateOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {isDateOpen && (
            <div className="grid grid-cols-1 gap-2">
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-emerald-500/50 transition-all duration-200 [color-scheme:dark]"
              />
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-emerald-500/50 transition-all duration-200 [color-scheme:dark]"
              />
            </div>
          )}
        </div>

        <div className="px-1">
          <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">Data Sources</p>
          <div className="flex flex-wrap gap-2">
            {sourceOptions.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllSources}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${(filters.sources || []).length === sourceOptions.length && sourceOptions.length > 0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  : 'bg-white/[0.03] text-slate-300 border-white/10 hover:bg-white/[0.06]'
                }`}
              >
                Select All
              </button>
            )}

            {sourceOptions.map((source) => {
              const isChecked = (filters.sources || []).includes(source);
              return (
                <button
                  key={source}
                  type="button"
                  onClick={() => handleSourceToggle(source)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isChecked
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-400/30'
                    : 'bg-white/[0.03] text-slate-300 border-white/10 hover:bg-white/[0.06]'
                  }`}
                >
                  {source}
                </button>
              );
            })}

            {sourceOptions.length === 0 && (
              <div className="px-3 py-2 rounded-full bg-white/[0.02] text-xs text-slate-500 border border-white/[0.06]">
                No sources available yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-[#1A1A1A] flex gap-2">
        <button
          onClick={onApply}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold
            bg-emerald-500 text-black
            hover:bg-emerald-400 transition-all duration-200
            shadow-lg shadow-emerald-500/20"
        >
          Apply Filters
        </button>
        <button
          onClick={onClear}
          className="flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium
            bg-white/5 text-slate-400 border border-white/10
            hover:bg-white/10 hover:text-white transition-all duration-200"
        >
          Clear
        </button>
      </div>
    </aside>
  );
};

FilterSidebar.propTypes = {
  filters: PropTypes.shape({
    priority: PropTypes.arrayOf(PropTypes.string),
    eventType: PropTypes.string,
    dateFrom: PropTypes.string,
    dateTo: PropTypes.string,
    entity: PropTypes.string,
    sources: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onFiltersChange: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  totalCount: PropTypes.number,
  filteredCount: PropTypes.number,
  sourceOptions: PropTypes.arrayOf(PropTypes.string),
};

export default FilterSidebar;
