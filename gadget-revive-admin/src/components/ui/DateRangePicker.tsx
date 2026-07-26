'use client';

import React from 'react';
import { Input } from '@/components/ui';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  className?: string;
}

const PRESETS = [
  { label: 'Today', getDates: () => { const d = new Date().toISOString().split('T')[0]; return [d, d]; } },
  { label: '7 days', getDates: () => { const e = new Date(); const s = new Date(e); s.setDate(s.getDate() - 7); return [s.toISOString().split('T')[0], e.toISOString().split('T')[0]]; } },
  { label: '30 days', getDates: () => { const e = new Date(); const s = new Date(e); s.setDate(s.getDate() - 30); return [s.toISOString().split('T')[0], e.toISOString().split('T')[0]]; } },
  { label: 'This Month', getDates: () => { const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth(), 1); return [s.toISOString().split('T')[0], e.toISOString().split('T')[0]]; } },
  { label: 'This Year', getDates: () => { const e = new Date(); const s = new Date(e.getFullYear(), 0, 1); return [s.toISOString().split('T')[0], e.toISOString().split('T')[0]]; } },
];

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className = '',
}) => {
  const handlePreset = (getDates: () => string[]) => {
    const [s, e] = getDates();
    onStartDateChange(s);
    onEndDateChange(e);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePreset(preset.getDates)}
            className="px-3 py-1 text-xs font-medium rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          max={endDate || undefined}
        />
        <span className="text-gray-400 text-sm">to</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          min={startDate || undefined}
        />
      </div>
    </div>
  );
};

export default DateRangePicker;
