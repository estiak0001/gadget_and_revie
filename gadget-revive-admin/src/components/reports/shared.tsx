'use client';

import React from 'react';

export type PresetKey = 'today' | '7d' | '30d' | '90d' | 'month' | 'last_month' | 'year' | 'custom';

export interface DateRange {
  preset: PresetKey;
  start: string;
  end: string;
}

export const PRESET_OPTIONS: { value: PresetKey; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
];

/** Local calendar date as YYYY-MM-DD. toISOString() is UTC and shifts the day in UTC+ zones. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function presetRange(preset: PresetKey): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'today':
      return { preset, start: ymd(now), end: ymd(now) };
    case '7d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { preset, start: ymd(s), end: ymd(now) };
    }
    case '30d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      return { preset, start: ymd(s), end: ymd(now) };
    }
    case '90d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 89);
      return { preset, start: ymd(s), end: ymd(now) };
    }
    case 'month':
      return { preset, start: ymd(new Date(y, m, 1)), end: ymd(now) };
    case 'last_month':
      return { preset, start: ymd(new Date(y, m - 1, 1)), end: ymd(new Date(y, m, 0)) };
    case 'year':
      return { preset, start: ymd(new Date(y, 0, 1)), end: ymd(now) };
    default:
      return { preset: 'custom', start: ymd(new Date(y, m, 1)), end: ymd(now) };
  }
}

export function chipClass(on: boolean) {
  return `rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
    on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
  }`;
}

const FIELD = 'h-8 rounded-lg border border-gray-300 bg-white px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500';

export function DateRangeBar({
  range,
  onChange,
  right,
  presets,
}: {
  range: DateRange;
  onChange: (next: DateRange) => void;
  right?: React.ReactNode;
  presets?: PresetKey[];
}) {
  const options = presets
    ? PRESET_OPTIONS.filter((p) => presets.includes(p.value))
    : PRESET_OPTIONS;
  const choose = (preset: PresetKey) => {
    if (preset === 'custom') onChange({ ...range, preset });
    else onChange(presetRange(preset));
  };
  const setDate = (key: 'start' | 'end', value: string) => onChange({ ...range, [key]: value, preset: 'custom' });

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {options.map((p) => (
            <button key={p.value} type="button" onClick={() => choose(p.value)} className={chipClass(range.preset === p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          From
          <input type="date" value={range.start} onChange={(e) => setDate('start', e.target.value)} className={`${FIELD} w-36`} />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          To
          <input type="date" value={range.end} onChange={(e) => setDate('end', e.target.value)} className={`${FIELD} w-36`} />
        </label>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone: 'rose' | 'indigo' | 'amber' | 'orange' | 'emerald' | 'sky';
  icon?: React.ReactNode;
}) {
  // Mini one-line card: icon + label on the left, value on the right. The subtext isn't drawn
  // (it would break the single line); plain-text subtext shows as a hover tooltip instead.
  // One colour family per tone: the accent bar, icon chip and value all share it, so the colour
  // carries the meaning (rose = money out / problems, emerald = money in / healthy, etc.).
  const tones: Record<typeof tone, { bar: string; chip: string; value: string }> = {
    rose: { bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-600', value: 'text-rose-700' },
    indigo: { bar: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-600', value: 'text-indigo-700' },
    amber: { bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-600', value: 'text-amber-700' },
    orange: { bar: 'bg-orange-500', chip: 'bg-orange-50 text-orange-600', value: 'text-orange-700' },
    emerald: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700' },
    sky: { bar: 'bg-sky-500', chip: 'bg-sky-50 text-sky-600', value: 'text-sky-700' },
  };
  const t = tones[tone];
  const tip = typeof sub === 'string' ? `${label}: ${value} — ${sub}` : `${label}: ${value}`;
  return (
    <div
      title={tip}
      className="relative flex h-10 items-center gap-2 overflow-hidden rounded-lg border border-gray-200 bg-white pl-3 pr-2.5 shadow-sm"
    >
      <span className={`absolute inset-y-0 left-0 w-0.5 ${t.bar}`} aria-hidden="true" />
      {icon && <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${t.chip}`}>{icon}</span>}
      <p className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`shrink-0 text-sm font-bold tabular-nums ${t.value}`}>{value}</p>
    </div>
  );
}

export function Panel({
  title,
  hint,
  right,
  children,
  className = '',
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-gray-200 bg-white ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {hint && <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export const CHART_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#14B8A6', '#F97316', '#EC4899', '#84CC16'];
