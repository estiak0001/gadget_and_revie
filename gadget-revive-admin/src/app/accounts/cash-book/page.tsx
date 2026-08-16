'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Printer, ArrowUpCircle, ArrowDownCircle, Wallet, PiggyBank } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Card, CardContent, Button, DateRangePicker, LoadingSpinner, ErrorState, InfoButton, StepFlow } from '@/components/ui';
import { CashBook, IncomeStatement } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const today = () => new Date().toISOString().split('T')[0];

export default function CashBookPage() {
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [data, setData] = useState<CashBook | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const [cashBookRes, incomeRes] = await Promise.all([
        adminService.getCashBook(fromDate, toDate),
        adminService.getIncomeStatement(fromDate, toDate),
      ]);
      setData(cashBookRes.data?.data ?? null);
      setIncomeStatement(incomeRes.data?.data ?? null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const asOfLabel = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;

  return (
    <AdminLayout>
      <div className="space-y-6 print:space-y-3">
        <div className="print:hidden">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Cash Book</h1>
            <InfoButton title="How the Cash Book Works">
              <p>
                A day-book style record of every cash receipt and payment through the <strong>Cash</strong> account
                for the selected period, plus the opening and closing balance either side of it — the classic
                &quot;receipts on one side, payments on the other&quot; ledger format.
              </p>
              <div>
                <p className="font-semibold text-gray-900 mb-2">How to use this page</p>
                <StepFlow steps={[
                  'Pick a From/To date range — a single day for a daily cash book, or a wider range for a summary.',
                  'Cash Receipts lists every amount that came into the Cash account (payments received, investments, opening adjustments).',
                  'Cash Payments lists every amount that went out, split into Salary vs general Cash Payment.',
                  'Use Print to produce a printable copy, or export the numbers into Excel from the totals shown.',
                ]} />
              </div>
            </InfoButton>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Daily cash receipts, payments, and closing balance — suitable for printing.
          </p>
        </div>

        <Card className="print:hidden">
          <CardContent className="pt-4 flex flex-wrap items-end gap-3">
            <DateRangePicker startDate={fromDate} endDate={toDate} onStartDateChange={setFromDate} onEndDateChange={setToDate} />
            <Button variant="ghost" size="sm" onClick={fetchData} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()} leftIcon={<Printer className="w-4 h-4" />}>
              Print
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : error || !data ? (
          <ErrorState message="Failed to load cash book." onRetry={fetchData} />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 print:border-0 print:shadow-none print:p-0">
            <div className="text-center mb-5">
              <h2 className="text-lg font-bold text-gray-900">Cash Book</h2>
              <p className="text-sm text-gray-500">As of End of Day: {asOfLabel}</p>
            </div>

            {/* Receipt (left) / Payment (right), side by side — both totals below are the same
                number (Opening + Receipts = Payments + Closing), same "does it balance" check
                as a traditional receipts-and-payments statement. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
              {/* Receipt */}
              <div className="rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm flex flex-col">
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-b-2 border-emerald-100 px-4 py-2.5 text-center flex-shrink-0">
                  <h3 className="text-sm font-bold text-emerald-800 tracking-wide">RECEIPT</h3>
                </div>
                {/* Scrollable transaction list — caps the card's height instead of the whole
                    page growing unbounded when there are lots of transactions. */}
                <div className="overflow-auto max-h-[420px] print:max-h-none print:overflow-visible">
                  <table className="min-w-full text-sm">
                    <colgroup>
                      <col className="w-[92px]" /><col className="w-[108px]" /><col /><col className="w-[128px]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 shadow-[0_1px_0_0_theme(colors.gray.200)]">
                        <th className="px-3.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">Date</th>
                        <th className="px-3.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">Voucher</th>
                        <th className="px-3.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Particulars</th>
                        <th className="px-3.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Amount (Tk)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr className="bg-primary-50/40">
                        <td className="px-3.5 py-2.5 text-gray-600 whitespace-nowrap">{fromDate}</td>
                        <td className="px-3.5 py-2.5 text-gray-400">-</td>
                        <td className="px-3.5 py-2.5 font-medium text-gray-800">Opening Balance</td>
                        <td className="px-3.5 py-2.5 text-right font-medium text-gray-800 tabular-nums">{formatCurrency(data.opening_balance)}</td>
                      </tr>
                      {data.receipts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3.5 py-4 text-center text-gray-400">No cash receipts in this period.</td>
                        </tr>
                      ) : data.receipts.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-3.5 py-2 text-gray-500 whitespace-nowrap">{r.date}</td>
                          <td className="px-3.5 py-2 text-gray-400 whitespace-nowrap">{r.voucher}</td>
                          <td className="px-3.5 py-2 text-gray-700">{r.particulars}</td>
                          <td className="px-3.5 py-2 text-right text-gray-800 tabular-nums">{formatCurrency(r.cash_received)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Totals — outside the scroll area so they always stay in view at the
                    bottom of the card, same column widths as the table above. */}
                <table className="min-w-full text-sm border-t-2 border-gray-200 flex-shrink-0">
                  <colgroup>
                    <col className="w-[92px]" /><col className="w-[108px]" /><col /><col className="w-[128px]" />
                  </colgroup>
                  <tfoot>
                    <tr className="bg-gray-50/80 font-semibold">
                      <td className="px-3.5 py-2.5" colSpan={3}>Total Receipt</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums">{formatCurrency(data.total_received)}</td>
                    </tr>
                    <tr className="bg-emerald-50 font-bold border-t border-emerald-100">
                      <td className="px-3.5 py-2.5 text-emerald-800" colSpan={3}>Total (Opening + Receipts)</td>
                      <td className="px-3.5 py-2.5 text-right text-emerald-800 tabular-nums">{formatCurrency(data.opening_balance + data.total_received)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Payment */}
              <div className="rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm flex flex-col">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-100 px-4 py-2.5 text-center flex-shrink-0">
                  <h3 className="text-sm font-bold text-amber-800 tracking-wide">PAYMENT</h3>
                </div>
                <div className="overflow-auto max-h-[420px] print:max-h-none print:overflow-visible">
                  <table className="min-w-full text-sm">
                    <colgroup>
                      <col className="w-[92px]" /><col className="w-[108px]" /><col /><col className="w-[128px]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 shadow-[0_1px_0_0_theme(colors.gray.200)]">
                        <th className="px-3.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">Date</th>
                        <th className="px-3.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">Voucher</th>
                        <th className="px-3.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Particulars</th>
                        <th className="px-3.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Amount (Tk)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.payments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3.5 py-4 text-center text-gray-400">No cash payments in this period.</td>
                        </tr>
                      ) : data.payments.map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-3.5 py-2 text-gray-500 whitespace-nowrap">{p.date}</td>
                          <td className="px-3.5 py-2 text-gray-400 whitespace-nowrap">{p.voucher}</td>
                          <td className="px-3.5 py-2 text-gray-700">
                            {p.particulars}
                            {p.salary > 0 && (
                              <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">Salary</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2 text-right text-gray-800 tabular-nums">{formatCurrency(p.salary || p.cash_payment)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Totals — outside the scroll area, same column widths as the table above. */}
                <table className="min-w-full text-sm border-t-2 border-gray-200 flex-shrink-0">
                  <colgroup>
                    <col className="w-[92px]" /><col className="w-[108px]" /><col /><col className="w-[128px]" />
                  </colgroup>
                  <tfoot>
                    <tr className="bg-gray-50/80 font-semibold">
                      <td className="px-3.5 py-2.5" colSpan={3}>Total Payment</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums">{formatCurrency(data.total_paid)}</td>
                    </tr>
                    <tr className="bg-primary-50/40 border-t border-gray-200">
                      <td className="px-3.5 py-2.5 font-medium text-gray-800" colSpan={3}>Closing Balance</td>
                      <td className="px-3.5 py-2.5 text-right font-medium text-gray-800 tabular-nums">{formatCurrency(data.closing_balance)}</td>
                    </tr>
                    <tr className="bg-amber-50 font-bold border-t border-amber-100">
                      <td className="px-3.5 py-2.5 text-amber-800" colSpan={3}>Total (Payments + Closing)</td>
                      <td className="px-3.5 py-2.5 text-right text-amber-800 tabular-nums">{formatCurrency(data.total_paid + data.closing_balance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Summary strip — the same four headline figures from the tables above, at a glance */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <PiggyBank className="w-3.5 h-3.5" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide">Opening Balance</p>
                </div>
                <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{formatCurrency(data.opening_balance)}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide">Total Receipts</p>
                </div>
                <p className="text-lg font-bold text-emerald-800 mt-1 tabular-nums">{formatCurrency(data.total_received)}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                <div className="flex items-center gap-1.5 text-amber-700">
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide">Total Payments</p>
                </div>
                <p className="text-lg font-bold text-amber-800 mt-1 tabular-nums">{formatCurrency(data.total_paid)}</p>
              </div>
              <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-3.5">
                <div className="flex items-center gap-1.5 text-primary-700">
                  <Wallet className="w-3.5 h-3.5" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide">Closing Balance</p>
                </div>
                <p className="text-lg font-bold text-primary-800 mt-1 tabular-nums">{formatCurrency(data.closing_balance)}</p>
              </div>
            </div>

            {/* Income Statement Summary — same period, from the existing Income Statement report */}
            {incomeStatement && (
              <div className="mt-5 rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50/80 px-4 py-2.5 text-center border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800 tracking-wide">INCOME STATEMENT SUMMARY</h3>
                </div>
                <table className="min-w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-2.5 text-gray-600">Total Income</td>
                      <td className="px-4 py-2.5 text-right text-gray-800 tabular-nums">{formatCurrency(incomeStatement.total_revenue)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-gray-600">Total Expense</td>
                      <td className="px-4 py-2.5 text-right text-gray-800 tabular-nums">{formatCurrency(incomeStatement.total_expenses)}</td>
                    </tr>
                    <tr className={incomeStatement.net_income >= 0 ? 'bg-emerald-50 font-bold' : 'bg-red-50 font-bold'}>
                      <td className={`px-4 py-2.5 ${incomeStatement.net_income >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                        Surplus / Deficit
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${incomeStatement.net_income >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                        {incomeStatement.net_income >= 0 ? '(+) ' : '(-) '}{formatCurrency(Math.abs(incomeStatement.net_income))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
