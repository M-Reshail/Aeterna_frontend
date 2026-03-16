import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  SlidersHorizontal,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';

const PRIORITY_OPTIONS = [
  {
    value: 'HIGH',
    label: 'High',
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    border: 'border-red-500/40',
    dot: 'bg-red-500',
    checkAccent: 'accent-red-500',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    dot: 'bg-amber-500',
    checkAccent: 'accent-amber-500',
  },
  {
    value: 'LOW',
    label: 'Low',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    dot: 'bg-emerald-500',
    checkAccent: 'accent-emerald-500',
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
  const [openSections, setOpenSections] = useState({
    priority: true,
    eventType: true,
    dateRange: true,
    entity: true,
    sources: false,
  });

  const toggleSection = (section) =>
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));

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
    (filters.priority?.length !== 3 ? 1 : 0) +
    (filters.eventType && filters.eventType !== 'all' ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.entity ? 1 : 0) +
    (filters.sources?.length > 0 ? 1 : 0);

  return (
    <aside className="flex flex-col h-full bg-[#080808] rounded-2xl border border-[#1A1A1A] overflow-hidden">
      {/* Header */}
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

      <div className="flex-1 overflow-y-auto space-y-1 p-3">
        {/* Priority Filter */}
        <div className="rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('priority')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:bg-white/5 rounded-xl transition-colors"
          >
            <span className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" />
              Priority Level
            </span>
            {openSections.priority ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {openSections.priority && (
            <div className="px-3 pb-3 space-y-2">
              {PRIORITY_OPTIONS.map((opt) => {
                const isChecked = (filters.priority || []).includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
                      border transition-all duration-200
                      ${isChecked
                        ? `${opt.bg} ${opt.border}`
                        : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04]'
                      }
                    `}
                  >
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handlePriorityToggle(opt.value)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-all
                          ${isChecked ? `${opt.bg} ${opt.border}` : 'border-white/20 bg-white/5'}`}
                      >
                        {isChecked && (
                          <svg className={`w-2.5 h-2.5 ${opt.color}`} fill="currentColor" viewBox="0 0 12 12">
                            <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />
                    <span className={`text-sm font-medium flex-1 ${isChecked ? opt.color : 'text-slate-400'}`}>
                      {opt.label}
                    </span>
                    <span className={`text-[11px] font-bold tracking-wider ${opt.color} opacity-70`}>
                      {opt.value}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Event Type Filter (News / Price) */}
        <div className="rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('eventType')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:bg-white/5 rounded-xl transition-colors"
          >
            <span className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" />
              Alert Type
            </span>
            {openSections.eventType ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {openSections.eventType && (
            <div className="px-3 pb-3 space-y-2">
              {[
                { value: 'all', label: 'All Types', icon: '📊' },
                { value: 'NEWS', label: 'News', icon: '📰' },
                { value: 'PRICE_ALERT', label: 'Price updates', icon: '💰' },
              ].map((opt) => {
                const isActive = (filters.eventType || 'all') === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
                      border transition-all duration-200
                      ${isActive
                        ? 'bg-emerald-500/15 border-emerald-500/40'
                        : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04]'
                      }
                    `}
                  >
                    <div className="relative flex items-center">
                      <input
                        type="radio"
                        name="eventType"
                        checked={isActive}
                        onChange={() => handleEventTypeToggle(opt.value)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all
                          ${isActive ? 'bg-emerald-500 border-emerald-400' : 'border-white/20 bg-white/5'}`}
                      >
                        {isActive && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                            <circle cx="6" cy="6" r="2" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <span className="text-[13px] flex-shrink-0">{opt.icon}</span>
                    <span className={`text-sm font-medium flex-1 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Entity / Token Filter */}
        <div className="rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('entity')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:bg-white/5 rounded-xl transition-colors"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              Token / Entity
            </span>
            {openSections.entity ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {openSections.entity && (
            <div className="px-3 pb-3">
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
            </div>
          )}
        </div>

        {/* Date Range Filter */}
        <div className="rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('dateRange')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:bg-white/5 rounded-xl transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="text-[13px]">📅</span>
              Date Range
            </span>
            {openSections.dateRange ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {openSections.dateRange && (
            <div className="px-3 pb-3 space-y-2">
              <div>
                <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 px-1">
                  From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                  className="
                    w-full px-3 py-2 rounded-xl text-sm
                    bg-white/[0.04] border border-white/[0.08]
                    text-white
                    focus:outline-none focus:border-emerald-500/50
                    transition-all duration-200
                    [color-scheme:dark]
                  "
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 px-1">
                  To
                </label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                  className="
                    w-full px-3 py-2 rounded-xl text-sm
                    bg-white/[0.04] border border-white/[0.08]
                    text-white
                    focus:outline-none focus:border-emerald-500/50
                    transition-all duration-200
                    [color-scheme:dark]
                  "
                />
              </div>
            </div>
          )}
        </div>

        {/* Sources Filter */}
        <div className="rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('sources')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:bg-white/5 rounded-xl transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="text-[13px]">🌐</span>
              Data Sources
            </span>
            {openSections.sources ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {openSections.sources && (
            <div className="px-3 pb-3 space-y-1.5">
              {sourceOptions.length > 0 && (
                <label
                  className={`
                    flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer
                    transition-all duration-200 text-sm font-semibold
                    ${(filters.sources || []).length === sourceOptions.length && sourceOptions.length > 0
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.06]'
                    }
                  `}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded flex-shrink-0 border transition-all
                      ${(filters.sources || []).length === sourceOptions.length && sourceOptions.length > 0 
                        ? 'bg-emerald-500 border-emerald-400' 
                        : 'border-white/30'}`}
                  >
                    <input
                      type="checkbox"
                      checked={(filters.sources || []).length === sourceOptions.length && sourceOptions.length > 0}
                      onChange={handleSelectAllSources}
                      className="sr-only"
                    />
                  </div>
                  <span>Select All</span>
                </label>
              )}
              {sourceOptions.map((source) => {
                const isChecked = (filters.sources || []).includes(source);
                return (
                  <label
                    key={source}
                    className={`
                      flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer
                      transition-all duration-200 text-sm
                      ${isChecked
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'
                      }
                    `}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded flex-shrink-0 border transition-all
                        ${isChecked ? 'bg-emerald-500 border-emerald-400' : 'border-white/20'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleSourceToggle(source)}
                        className="sr-only"
                      />
                    </div>
                    <span className="font-medium">{source}</span>
                  </label>
                );
              })}
              {sourceOptions.length === 0 && (
                <div className="px-3 py-2 rounded-lg bg-white/[0.02] text-xs text-slate-500 border border-white/[0.06]">
                  No sources available yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer buttons */}
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
