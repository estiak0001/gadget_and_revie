<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\JournalEntry;
use App\Models\Order;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ExpenseController extends BaseController
{
    private const FILTER_RULES = [
        'start_date'           => 'nullable|date',
        'end_date'             => 'nullable|date|after_or_equal:start_date',
        'expense_category_ids' => ['nullable', 'regex:/^\d+(,\d+)*$/'],
        'ledger_status'        => 'nullable|in:synced,unsynced',
        'min_amount'           => 'nullable|numeric|min:0',
        'max_amount'           => 'nullable|numeric|min:0',
        'search'               => 'nullable|string|max:200',
    ];

    // =========================================================================
    // EXPENSE CATEGORIES
    // =========================================================================

    public function categoryIndex(Request $request): JsonResponse
    {
        $categories = ExpenseCategory::withCount('expenses')
            ->withSum('expenses', 'amount')
            ->when($request->boolean('active_only'), fn($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->get();

        return $this->success($categories);
    }

    public function categoryStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:100|unique:expense_categories,name',
            'description' => 'nullable|string|max:500',
            'is_active'   => 'boolean',
        ]);

        $data['slug'] = Str::slug($data['name']);

        $category = ExpenseCategory::create($data);

        return $this->created($category, 'Expense category created.');
    }

    public function categoryShow(int $id): JsonResponse
    {
        $category = ExpenseCategory::withCount('expenses')->findOrFail($id);

        return $this->success($category);
    }

    public function categoryUpdate(Request $request, int $id): JsonResponse
    {
        $category = ExpenseCategory::findOrFail($id);

        $data = $request->validate([
            'name'        => 'sometimes|string|max:100|unique:expense_categories,name,' . $id,
            'description' => 'nullable|string|max:500',
            'is_active'   => 'boolean',
        ]);

        $category->update($data);

        return $this->success($category->fresh(), 'Expense category updated.');
    }

    public function categoryDestroy(int $id): JsonResponse
    {
        $category = ExpenseCategory::withCount('expenses')->findOrFail($id);

        if ($category->expenses_count > 0) {
            return $this->error('Cannot delete a category that has expenses. Deactivate it instead.', 422);
        }

        $category->delete();

        return $this->noContent('Expense category deleted.');
    }

    // =========================================================================
    // EXPENSES
    // =========================================================================

    public function index(Request $request): JsonResponse
    {
        $request->validate(self::FILTER_RULES + [
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        // Reversed expenses are soft-deleted, so they're excluded from every normal query
        // (this list, reports, sums) by Eloquent's default scope. The only way to see them
        // is this explicit opt-in — a separate view, not a toggle on the main list.
        $query = Expense::with(['category:id,name,slug', 'reverser:id,name', 'creator:id,name'])
            ->when($request->boolean('reversed'), fn($q) => $q->onlyTrashed()->where('expenses.is_reversed', true));

        $expenses = $this->applyExpenseFilters($query, $request->only(array_keys(self::FILTER_RULES)))
            ->orderByDesc('expenses.expense_date')
            ->orderByDesc('expenses.id')
            ->paginate($request->get('per_page', 15));

        return $this->paginated($expenses);
    }

    public function analytics(Request $request): JsonResponse
    {
        $request->validate(self::FILTER_RULES + [
            'group_by' => 'nullable|in:day,week,month',
        ]);

        $filters = $request->only(array_keys(self::FILTER_RULES));
        $groupBy = $request->input('group_by', 'month');
        $scoped = fn() => $this->applyExpenseFilters(Expense::query(), $filters);

        $totals = $scoped()
            ->selectRaw('COUNT(*) AS count, COALESCE(SUM(expenses.amount), 0) AS total, COALESCE(AVG(expenses.amount), 0) AS average')
            ->first();

        $largest = $scoped()->with('category:id,name')->orderByDesc('expenses.amount')->first();

        $unposted = $scoped()
            ->whereNotExists($this->postedToLedger())
            ->selectRaw('COUNT(*) AS count, COALESCE(SUM(expenses.amount), 0) AS total')
            ->first();

        $previous = null;
        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $start = Carbon::parse($filters['start_date']);
            $days = (int) $start->diffInDays(Carbon::parse($filters['end_date'])) + 1;
            $prevEnd = $start->copy()->subDay();
            $prevStart = $prevEnd->copy()->subDays($days - 1);

            $prev = $this->applyExpenseFilters(Expense::query(), array_merge($filters, [
                'start_date' => $prevStart->toDateString(),
                'end_date'   => $prevEnd->toDateString(),
            ]))->selectRaw('COUNT(*) AS count, COALESCE(SUM(expenses.amount), 0) AS total')->first();

            $previous = [
                'start' => $prevStart->toDateString(),
                'end'   => $prevEnd->toDateString(),
                'total' => (float) $prev->total,
                'count' => (int) $prev->count,
            ];
        }

        $format = match ($groupBy) {
            'day'  => '%Y-%m-%d',
            'week' => '%x-W%v',
            default => '%Y-%m',
        };

        $trend = $scoped()
            ->selectRaw("DATE_FORMAT(expenses.expense_date, '{$format}') AS period, COALESCE(SUM(expenses.amount), 0) AS total, COUNT(*) AS count")
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        $byCategory = $scoped()
            ->join('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->selectRaw('expense_categories.id AS category_id, expense_categories.name AS category_name, COALESCE(SUM(expenses.amount), 0) AS total, COUNT(*) AS count')
            ->groupBy('expense_categories.id', 'expense_categories.name')
            ->orderByDesc('total')
            ->get();

        $topTitles = $scoped()
            ->selectRaw('expenses.title, COALESCE(SUM(expenses.amount), 0) AS total, COUNT(*) AS count')
            ->groupBy('expenses.title')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        return $this->success([
            'period' => [
                'start'    => $filters['start_date'] ?? null,
                'end'      => $filters['end_date'] ?? null,
                'group_by' => $groupBy,
            ],
            'summary' => [
                'total'          => (float) $totals->total,
                'count'          => (int) $totals->count,
                'average'        => round((float) $totals->average, 2),
                'largest'        => $largest ? [
                    'id'           => $largest->id,
                    'title'        => $largest->title,
                    'amount'       => (float) $largest->amount,
                    'expense_date' => $largest->expense_date->toDateString(),
                    'category'     => $largest->category?->name,
                ] : null,
                'unposted_total' => (float) $unposted->total,
                'unposted_count' => (int) $unposted->count,
            ],
            'previous' => $previous,
            'trend' => $trend->map(fn($r) => [
                'period' => $r->period,
                'total'  => (float) $r->total,
                'count'  => (int) $r->count,
            ])->values(),
            'by_category' => $byCategory->map(fn($r) => [
                'id'    => (int) $r->category_id,
                'name'  => $r->category_name,
                'total' => (float) $r->total,
                'count' => (int) $r->count,
            ])->values(),
            'top_titles' => $topTitles->map(fn($r) => [
                'title' => $r->title,
                'total' => (float) $r->total,
                'count' => (int) $r->count,
            ])->values(),
        ], 'Expense analytics generated.');
    }

    public function export(Request $request)
    {
        $request->validate(self::FILTER_RULES);

        $query = Expense::with(['category:id,name', 'creator:id,name', 'reverser:id,name'])
            ->when($request->boolean('reversed'), fn($q) => $q->onlyTrashed()->where('expenses.is_reversed', true));

        $expenses = $this->applyExpenseFilters($query, $request->only(array_keys(self::FILTER_RULES)))
            ->orderByDesc('expenses.expense_date')
            ->orderByDesc('expenses.id')
            ->get();

        $posted = JournalEntry::where('reference_type', 'Expense')
            ->whereIn('reference_id', $expenses->pluck('id'))
            ->pluck('reference_id')
            ->flip();

        $csvData = [['Date', 'Title', 'Category', 'Amount (BDT)', 'Reference', 'Description', 'Posted to ledger', 'Recorded by', 'Status', 'Reversed at']];
        foreach ($expenses as $expense) {
            $csvData[] = [
                $expense->expense_date->toDateString(),
                $expense->title,
                $expense->category?->name,
                $expense->amount,
                $expense->reference,
                $expense->description,
                isset($posted[$expense->id]) ? 'Yes' : 'No',
                $expense->creator?->name,
                $expense->is_reversed ? 'Reversed' : 'Active',
                $expense->reversed_at?->format('Y-m-d H:i'),
            ];
        }

        $filename = 'expenses_export_' . now()->format('Y-m-d_His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($csvData) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));
            foreach ($csvData as $row) {
                fputcsv($file, $row);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function applyExpenseFilters(Builder $query, array $filters): Builder
    {
        if (!empty($filters['start_date'])) {
            $query->where('expenses.expense_date', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->where('expenses.expense_date', '<=', $filters['end_date']);
        }
        if (!empty($filters['expense_category_ids'])) {
            $query->whereIn('expenses.expense_category_id', explode(',', $filters['expense_category_ids']));
        }
        if (isset($filters['min_amount']) && $filters['min_amount'] !== '') {
            $query->where('expenses.amount', '>=', $filters['min_amount']);
        }
        if (isset($filters['max_amount']) && $filters['max_amount'] !== '') {
            $query->where('expenses.amount', '<=', $filters['max_amount']);
        }
        if (!empty($filters['search'])) {
            $term = '%' . addcslashes($filters['search'], '%_\\') . '%';
            $query->where(fn($q) => $q
                ->where('expenses.title', 'like', $term)
                ->orWhere('expenses.reference', 'like', $term)
                ->orWhere('expenses.description', 'like', $term));
        }
        if (!empty($filters['ledger_status'])) {
            if ($filters['ledger_status'] === 'synced') {
                $query->whereExists($this->postedToLedger());
            } else {
                $query->whereNotExists($this->postedToLedger());
            }
        }

        return $query;
    }

    private function postedToLedger(): Builder
    {
        return JournalEntry::query()
            ->where('journal_entries.reference_type', 'Expense')
            ->whereColumn('journal_entries.reference_id', 'expenses.id');
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'expense_category_id' => 'required|integer|exists:expense_categories,id',
            // Optional: ties this expense to the order line item it was incurred to fulfill
            // (an outsourced repair, a part bought for it) — posts to Cost of Goods Sold
            // instead of Operating Expenses and surfaces in that item's margin on the order.
            'order_item_id'       => 'nullable|integer|exists:order_items,id',
            'title'               => 'required|string|max:200',
            'amount'              => 'required|numeric|min:0.01',
            'expense_date'        => 'required|date',
            'description'         => 'nullable|string|max:1000',
            'reference'           => 'nullable|string|max:100',
        ]);

        $data['created_by'] = $request->user()->id;

        $expense = Expense::create($data);
        $expense->postJournalEntry($request->user());

        AuditLog::log($request->user(), 'create_expense', 'Expense', $expense->id, null, $expense->toArray(), 'Expense recorded');

        return $this->created(
            $expense->load('category:id,name,slug'),
            'Expense recorded.'
        );
    }

    public function show(int $id): JsonResponse
    {
        $expense = Expense::with(['category:id,name,slug', 'creator:id,name'])->findOrFail($id);

        return $this->success($expense);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $expense = Expense::findOrFail($id);

        // Once an expense is posted to the ledger it's locked — no in-place edits, financial
        // or otherwise. To change a posted expense, delete it (optionally reversing the ledger
        // entry) and add a new one; this keeps every journal entry an exact, untouched record
        // of what was posted and when, instead of a value that can silently drift from history.
        if ($expense->hasActiveLedgerEntry()) {
            return $this->error(
                'This expense has already been posted to the accounting ledger and can no longer be edited. Delete it (optionally reversing the ledger entry) and add a new expense instead.',
                422
            );
        }

        $data = $request->validate([
            'expense_category_id' => 'sometimes|integer|exists:expense_categories,id',
            'title'               => 'sometimes|string|max:200',
            'amount'              => 'sometimes|numeric|min:0.01',
            'expense_date'        => 'sometimes|date',
            'description'         => 'nullable|string|max:1000',
            'reference'           => 'nullable|string|max:100',
        ]);

        $oldData = $expense->toArray();
        $expense->update($data);

        AuditLog::log($request->user(), 'update_expense', 'Expense', $expense->id, $oldData, $expense->fresh()->toArray(), 'Expense updated');

        return $this->success(
            $expense->fresh()->load('category:id,name,slug'),
            'Expense updated.'
        );
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $expense = Expense::findOrFail($id);
        $oldData = $expense->toArray();
        $wasLedgerSynced = $expense->isLedgerSynced();

        // Deleting an expense always reverses its journal entry — there's no "delete but
        // leave the ledger as-is" option, so the books can never silently drift from what's
        // shown here. The expense itself isn't gone either: it's flagged and soft-deleted,
        // visible under the admin UI's "Reversed" filter rather than disappearing outright.
        if ($wasLedgerSynced) {
            JournalEntry::reverseAllFor(
                'Expense',
                $expense->id,
                "Expense reversed: {$expense->title} ({$expense->amount})",
                $request->user()
            );
        }

        $expense->update([
            'is_reversed' => true,
            'reversed_at' => now(),
            'reversed_by' => $request->user()->id,
        ]);
        $expense->delete();

        // Not fresh(): Expense is soft-deleted, and fresh() re-queries without withTrashed(),
        // which would return null right after delete(). The in-memory model already reflects
        // is_reversed/reversed_at/reversed_by (from update() above) and deleted_at (from delete()).
        AuditLog::log($request->user(), 'reverse_expense', 'Expense', $expense->id, $oldData, $expense->toArray(), 'Expense reversed');

        return $this->success([
            'was_ledger_synced' => $wasLedgerSynced,
            'ledger_reversed'   => $wasLedgerSynced,
        ], 'Expense reversed.');
    }

    // =========================================================================
    // REPORT — Revenue = Sales - Expenses
    // =========================================================================

    public function report(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date'   => 'required|date|after_or_equal:start_date',
            'group_by'   => 'nullable|in:day,month',
        ]);

        $from    = $request->start_date;
        $to      = $request->end_date;
        $groupBy = $request->get('group_by', 'day');

        $groupFormat = $groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

        // Total completed sales
        $totalSales = (float) Order::whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->whereIn('payment_status', ['paid', 'partially_paid', 'verified'])
            ->sum('total');

        // Total expenses
        $totalExpenses = (float) Expense::whereBetween('expense_date', [$from, $to])
            ->sum('amount');

        // Net revenue
        $netRevenue = $totalSales - $totalExpenses;

        // Expenses broken down by category
        $byCategory = ExpenseCategory::select('id', 'name', 'slug')
            ->withSum(['expenses' => fn($q) => $q->whereBetween('expense_date', [$from, $to])], 'amount')
            ->get()
            ->filter(fn($c) => $c->expenses_sum_amount > 0)
            ->map(fn($c) => [
                'id'     => $c->id,
                'name'   => $c->name,
                'slug'   => $c->slug,
                'total'  => (float) $c->expenses_sum_amount,
            ])
            ->values();

        // Daily / monthly expense trend
        $expenseTrend = Expense::whereBetween('expense_date', [$from, $to])
            ->selectRaw("DATE_FORMAT(expense_date, '{$groupFormat}') as period, SUM(amount) as total")
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        // Daily / monthly sales trend (same grouping, on created_at)
        $salesTrend = Order::whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->whereIn('payment_status', ['paid', 'partially_paid', 'verified'])
            ->selectRaw("DATE_FORMAT(created_at, '{$groupFormat}') as period, SUM(total) as total, COUNT(*) as order_count")
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        // Recent expenses list (last 50)
        $recentExpenses = Expense::with('category:id,name')
            ->whereBetween('expense_date', [$from, $to])
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        return $this->success([
            'period' => [
                'start'    => $from,
                'end'      => $to,
                'group_by' => $groupBy,
            ],
            'summary' => [
                'total_sales'    => $totalSales,
                'total_expenses' => $totalExpenses,
                'net_revenue'    => $netRevenue,
            ],
            'by_category'      => $byCategory,
            'expense_trend'    => $expenseTrend,
            'sales_trend'      => $salesTrend,
            'recent_expenses'  => $recentExpenses,
        ], 'Expense report generated.');
    }
}
