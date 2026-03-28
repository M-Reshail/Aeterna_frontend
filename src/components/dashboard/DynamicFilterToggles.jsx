import React from 'react';
import PropTypes from 'prop-types';
import { DYNAMIC_FILTER_OPTIONS } from '@utils/eventFilters';

export const DynamicFilterToggles = ({ selectedKeys = [], onToggle }) => {
  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2 px-1">
      {DYNAMIC_FILTER_OPTIONS.map((option) => {
        const isActive = selectedKeys.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onToggle(option.key)}
            className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium border transition-all duration-200 ${
              isActive
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

DynamicFilterToggles.propTypes = {
  selectedKeys: PropTypes.arrayOf(PropTypes.string),
  onToggle: PropTypes.func.isRequired,
};

export default DynamicFilterToggles;
