'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';

interface TLine {
  label: string;
  amount: number;
}

interface TAccountExampleProps {
  caption?: string;
  debits: TLine[];
  credits: TLine[];
}

/** A visual debit/credit "T-account" style example, used in the Accounts module's help modals. */
const TAccountExample: React.FC<TAccountExampleProps> = ({ caption, debits, credits }) => {
  const debitTotal = debits.reduce((s, l) => s + l.amount, 0);
  const creditTotal = credits.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {caption && (
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
          {caption}
        </div>
      )}
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        <div className="p-3 bg-blue-50/60">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Debit</p>
          <div className="space-y-1">
            {debits.map((line, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-gray-700">{line.label}</span>
                <span className="font-mono font-medium text-gray-900 whitespace-nowrap">{formatCurrency(line.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-3 bg-green-50/60">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Credit</p>
          <div className="space-y-1">
            {credits.map((line, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-gray-700">{line.label}</span>
                <span className="font-mono font-medium text-gray-900 whitespace-nowrap">{formatCurrency(line.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={`px-3 py-1.5 text-xs font-medium border-t border-gray-200 ${debitTotal === creditTotal ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
        {formatCurrency(debitTotal)} = {formatCurrency(creditTotal)} {debitTotal === creditTotal ? '✓ balanced' : ''}
      </div>
    </div>
  );
};

export default TAccountExample;
