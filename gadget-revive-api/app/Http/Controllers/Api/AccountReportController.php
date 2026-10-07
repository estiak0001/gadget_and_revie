<?php

namespace App\Http\Controllers\Api;

use App\Models\ChartOfAccount;
use App\Models\JournalEntryLine;
use App\Models\PurchaseOrder;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AccountReportController extends BaseController
{
    private const BUCKET_KEYS = ['current', 'd31_60', 'd61_90', 'd90p'];

    private const FILTER_RULES = [
        'from' => 'nullable|date',
        'to' => 'nullable|date|after_or_equal:from',
        'search' => 'nullable|string|max:120',
        'bucket' => 'nullable|in:current,d31_60,d61_90,d90p',
        'min_outstanding' => 'nullable|numeric|min:0',
        'type' => 'nullable|in:asset,liability,equity,revenue,expense',
        'hide_zero' => 'nullable|boolean',
        'format' => 'nullable|in:json,csv',
    ];

    public function customers(Request $request): Response|JsonResponse
    {
        $request->validate(self::FILTER_RULES);
        [$from, $to] = $this->range($request);
        $today = now()->startOfDay();

        $rows = [];
        $row = function (string $key, ?string $name, ?string $phone, ?int $customerId) use (&$rows) {
            $rows[$key] ??= [
                'key' => $key,
                'customer_id' => $customerId,
                'name' => $name ?: 'Walk-in customer',
                'phone' => $phone,
                'billed' => 0.0,
                'collected' => 0.0,
                'outstanding' => 0.0,
                'current' => 0.0,
                'd31_60' => 0.0,
                'd61_90' => 0.0,
                'd90p' => 0.0,
                'open_orders' => 0,
                'oldest_open' => null,
            ];
            return $key;
        };

        $open = DB::table('orders')
            ->leftJoin('users', 'users.id', '=', 'orders.customer_id')
            ->whereNull('orders.deleted_at')
            ->whereNotIn('orders.order_status', ['cancelled', 'refunded'])
            ->whereColumn('orders.total', '>', 'orders.paid_amount')
            ->select('orders.customer_id', 'orders.customer_name', 'orders.customer_phone', 'orders.total', 'orders.paid_amount', 'orders.created_at', 'users.name as user_name', 'users.phone as user_phone')
            ->get();

        foreach ($open as $o) {
            $key = $this->partyKey($o->customer_id, $o->user_name ?? $o->customer_name);
            $k = $row($key, $o->user_name ?? $o->customer_name, $o->user_phone ?? $o->customer_phone, $o->customer_id);
            $amount = round((float) $o->total - (float) $o->paid_amount, 2);
            $bucket = $this->bucketFor(Carbon::parse($o->created_at)->startOfDay()->diffInDays($today));
            $rows[$k]['outstanding'] += $amount;
            $rows[$k][$bucket] += $amount;
            $rows[$k]['open_orders']++;
            $rows[$k]['oldest_open'] = min($rows[$k]['oldest_open'] ?? $o->created_at, $o->created_at);
        }

        $billed = DB::table('orders')
            ->leftJoin('users', 'users.id', '=', 'orders.customer_id')
            ->whereNull('orders.deleted_at')
            ->whereNotIn('orders.order_status', ['cancelled', 'refunded'])
            ->whereBetween('orders.created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->select('orders.customer_id', 'orders.customer_name', 'orders.customer_phone', 'orders.total', 'users.name as user_name', 'users.phone as user_phone')
            ->get();

        foreach ($billed as $o) {
            $key = $this->partyKey($o->customer_id, $o->user_name ?? $o->customer_name);
            $k = $row($key, $o->user_name ?? $o->customer_name, $o->user_phone ?? $o->customer_phone, $o->customer_id);
            $rows[$k]['billed'] += (float) $o->total;
        }

        $collected = DB::table('journal_entry_lines as jl')
            ->join('journal_entries as je', 'je.id', '=', 'jl.journal_entry_id')
            ->join('chart_of_accounts as ca', 'ca.id', '=', 'jl.account_id')
            ->join('orders as o', 'o.id', '=', 'je.reference_id')
            ->leftJoin('users as u', 'u.id', '=', 'o.customer_id')
            ->where('je.reference_type', 'Order')
            ->where('je.is_reversal', false)
            ->where('je.description', 'like', 'Payment received%')
            ->where('ca.code', '1000')
            ->whereBetween('je.entry_date', [$from, $to])
            ->select('o.customer_id', 'o.customer_name', 'o.customer_phone', 'u.name as user_name', 'u.phone as user_phone', 'jl.debit')
            ->get();

        foreach ($collected as $c) {
            $key = $this->partyKey($c->customer_id, $c->user_name ?? $c->customer_name);
            $k = $row($key, $c->user_name ?? $c->customer_name, $c->user_phone ?? $c->customer_phone, $c->customer_id);
            $rows[$k]['collected'] += (float) $c->debit;
        }

        $result = $this->finalise(array_values($rows), $request, 'outstanding');

        return $this->respondWithRows($request, $result, [
            'Customer', 'Phone', 'Billed', 'Collected', 'Outstanding', '0-30 days', '31-60 days', '61-90 days', '90+ days', 'Open orders', 'Oldest open order',
        ], fn ($r) => [
            $r['name'], $r['phone'], $r['billed'], $r['collected'], $r['outstanding'],
            $r['current'], $r['d31_60'], $r['d61_90'], $r['d90p'], $r['open_orders'], $r['oldest_open'],
        ], 'customer-receivables');
    }

    public function suppliers(Request $request): Response|JsonResponse
    {
        $request->validate(self::FILTER_RULES);
        [$from, $to] = $this->range($request);
        $today = now()->startOfDay();

        $rows = [];
        $row = function (string $key, ?string $name, ?string $phone, ?int $supplierId) use (&$rows) {
            $rows[$key] ??= [
                'key' => $key,
                'supplier_id' => $supplierId,
                'name' => $name ?: 'Unknown supplier',
                'phone' => $phone,
                'billed' => 0.0,
                'paid' => 0.0,
                'outstanding' => 0.0,
                'refund_due' => 0.0,
                'current' => 0.0,
                'd31_60' => 0.0,
                'd61_90' => 0.0,
                'd90p' => 0.0,
                'open_orders' => 0,
                'oldest_open' => null,
            ];
            return $key;
        };

        $purchases = PurchaseOrder::with(['items', 'supplier:id,name,phone'])
            ->where('status', '!=', 'cancelled')
            ->get();

        foreach ($purchases as $po) {
            $key = $this->partyKey($po->supplier_id, $po->supplier?->name, 's');
            $k = $row($key, $po->supplier?->name, $po->supplier?->phone, $po->supplier_id);
            $rows[$k]['refund_due'] += (float) $po->refund_due_from_supplier;

            $outstanding = (float) $po->outstanding_payable;
            if ($outstanding > 0) {
                $bucket = $this->bucketFor(Carbon::parse($po->created_at)->startOfDay()->diffInDays($today));
                $rows[$k]['outstanding'] += $outstanding;
                $rows[$k][$bucket] += $outstanding;
                $rows[$k]['open_orders']++;
                $rows[$k]['oldest_open'] = min($rows[$k]['oldest_open'] ?? $po->created_at, $po->created_at);
            }
        }

        $billed = DB::table('purchase_orders')
            ->leftJoin('suppliers', 'suppliers.id', '=', 'purchase_orders.supplier_id')
            ->whereNull('purchase_orders.deleted_at')
            ->where('purchase_orders.status', '!=', 'cancelled')
            ->whereBetween('purchase_orders.created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->select('purchase_orders.supplier_id', 'suppliers.name', 'suppliers.phone', 'purchase_orders.total')
            ->get();

        foreach ($billed as $b) {
            $key = $this->partyKey($b->supplier_id, $b->name, 's');
            $k = $row($key, $b->name, $b->phone, $b->supplier_id);
            $rows[$k]['billed'] += (float) $b->total;
        }

        $paid = DB::table('journal_entry_lines as jl')
            ->join('journal_entries as je', 'je.id', '=', 'jl.journal_entry_id')
            ->join('chart_of_accounts as ca', 'ca.id', '=', 'jl.account_id')
            ->join('purchase_orders as po', 'po.id', '=', 'je.reference_id')
            ->leftJoin('suppliers as s', 's.id', '=', 'po.supplier_id')
            ->where('je.reference_type', 'PurchaseOrder')
            ->where('je.is_reversal', false)
            ->where('je.description', 'like', 'Payment to supplier%')
            ->where('ca.code', '2000')
            ->whereBetween('je.entry_date', [$from, $to])
            ->select('po.supplier_id', 's.name', 's.phone', 'jl.debit')
            ->get();

        foreach ($paid as $p) {
            $key = $this->partyKey($p->supplier_id, $p->name, 's');
            $k = $row($key, $p->name, $p->phone, $p->supplier_id);
            $rows[$k]['paid'] += (float) $p->debit;
        }

        $result = $this->finalise(array_values($rows), $request, 'outstanding');

        return $this->respondWithRows($request, $result, [
            'Supplier', 'Phone', 'Billed', 'Paid', 'Outstanding', 'Refund due', '0-30 days', '31-60 days', '61-90 days', '90+ days', 'Open POs', 'Oldest open PO',
        ], fn ($r) => [
            $r['name'], $r['phone'], $r['billed'], $r['paid'], $r['outstanding'], $r['refund_due'],
            $r['current'], $r['d31_60'], $r['d61_90'], $r['d90p'], $r['open_orders'], $r['oldest_open'],
        ], 'supplier-payables');
    }

    public function accounts(Request $request): Response|JsonResponse
    {
        $request->validate(self::FILTER_RULES);
        [$from, $to] = $this->range($request);

        $accounts = ChartOfAccount::query()
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->type))
            ->orderBy('code')
            ->get();

        $activity = JournalEntryLine::query()
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
            ->whereBetween('journal_entries.entry_date', [$from ?? '1900-01-01', $to])
            ->select('journal_entry_lines.account_id', DB::raw('SUM(journal_entry_lines.debit) AS debit'), DB::raw('SUM(journal_entry_lines.credit) AS credit'))
            ->groupBy('journal_entry_lines.account_id')
            ->get()
            ->keyBy('account_id');

        $rows = $accounts->map(function (ChartOfAccount $account) use ($from, $to, $activity) {
            $opening = $from ? round($account->balanceAsOf(Carbon::parse($from)->subDay()->toDateString()), 2) : 0.0;
            $closing = round($account->balanceAsOf($to), 2);
            $movement = $activity[$account->id] ?? null;

            return [
                'key' => (string) $account->id,
                'code' => $account->code,
                'name' => $account->name,
                'type' => $account->type,
                'normal_balance' => $account->normal_balance,
                'opening' => $opening,
                'debit' => round((float) ($movement->debit ?? 0), 2),
                'credit' => round((float) ($movement->credit ?? 0), 2),
                'closing' => $closing,
                'movement' => round($closing - $opening, 2),
            ];
        });

        if ($request->boolean('hide_zero')) {
            $rows = $rows->filter(fn ($r) => abs($r['opening']) + $r['debit'] + $r['credit'] + abs($r['closing']) > 0);
        }
        if ($request->filled('search')) {
            $term = strtolower($request->search);
            $rows = $rows->filter(fn ($r) => str_contains(strtolower($r['code'] . ' ' . $r['name']), $term));
        }

        $rows = $rows->values()->all();

        $summary = [
            'accounts' => count($rows),
            'debit' => round(array_sum(array_column($rows, 'debit')), 2),
            'credit' => round(array_sum(array_column($rows, 'credit')), 2),
            'closing' => round(array_sum(array_column($rows, 'closing')), 2),
        ];

        return $this->respondWithRows($request, ['summary' => $summary, 'rows' => $rows], [
            'Code', 'Account', 'Type', 'Normal balance', 'Opening', 'Debit', 'Credit', 'Closing', 'Movement',
        ], fn ($r) => [
            $r['code'], $r['name'], $r['type'], $r['normal_balance'], $r['opening'], $r['debit'], $r['credit'], $r['closing'], $r['movement'],
        ], 'account-activity');
    }

    private function range(Request $request): array
    {
        $from = $request->filled('from') ? $request->from : '1900-01-01';
        $to = $request->filled('to') ? $request->to : now()->toDateString();

        return [$from, $to];
    }

    private function partyKey(?int $id, ?string $name, string $prefix = 'c'): string
    {
        return $id ? "{$prefix}:{$id}" : "{$prefix}:name:" . strtolower(trim((string) $name));
    }

    private function bucketFor(int $ageDays): string
    {
        return match (true) {
            $ageDays <= 30 => 'current',
            $ageDays <= 60 => 'd31_60',
            $ageDays <= 90 => 'd61_90',
            default => 'd90p',
        };
    }

    private function finalise(array $rows, Request $request, string $sortBy): array
    {
        $rows = array_filter($rows, fn ($r) => $r['outstanding'] > 0 || $r['billed'] > 0 || ($r['collected'] ?? 0) > 0 || ($r['paid'] ?? 0) > 0 || ($r['refund_due'] ?? 0) > 0);

        if ($request->filled('search')) {
            $term = strtolower($request->search);
            $rows = array_filter($rows, fn ($r) => str_contains(strtolower($r['name'] . ' ' . ($r['phone'] ?? '')), $term));
        }
        if ($request->filled('min_outstanding')) {
            $min = (float) $request->min_outstanding;
            $rows = array_filter($rows, fn ($r) => $r['outstanding'] >= $min);
        }
        if ($request->filled('bucket')) {
            $bucket = $request->bucket;
            $rows = array_filter($rows, fn ($r) => $r[$bucket] > 0);
        }

        $rows = array_values($rows);
        usort($rows, fn ($a, $b) => $b[$sortBy] <=> $a[$sortBy]);

        $sum = fn (string $field) => round(array_sum(array_column($rows, $field)), 2);

        return [
            'summary' => [
                'parties' => count($rows),
                'billed' => $sum('billed'),
                'collected_or_paid' => round($sum('collected') + $sum('paid'), 2),
                'outstanding' => $sum('outstanding'),
                'refund_due' => $sum('refund_due'),
                'current' => $sum('current'),
                'd31_60' => $sum('d31_60'),
                'd61_90' => $sum('d61_90'),
                'd90p' => $sum('d90p'),
                'open_orders' => array_sum(array_column($rows, 'open_orders')),
            ],
            'rows' => $rows,
        ];
    }

    private function respondWithRows(Request $request, array $result, array $header, callable $cells, string $filename): Response|JsonResponse
    {
        if ($request->input('format') === 'csv') {
            $name = $filename . '-' . now()->format('Y-m-d') . '.csv';
            $callback = function () use ($header, $result, $cells) {
                $file = fopen('php://output', 'w');
                fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));
                fputcsv($file, $header);
                foreach ($result['rows'] as $row) {
                    fputcsv($file, $cells($row));
                }
                fclose($file);
            };

            return response()->stream($callback, 200, [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => "attachment; filename=\"{$name}\"",
            ]);
        }

        return $this->success($result);
    }
}
