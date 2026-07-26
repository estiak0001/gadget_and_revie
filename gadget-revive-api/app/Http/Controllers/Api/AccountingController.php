<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\ChartOfAccount;
use App\Models\Expense;
use App\Models\JournalEntry;
use App\Models\JournalEntryLine;
use App\Models\Order;
use App\Models\PurchaseOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountingController extends BaseController
{
    // =========================================================================
    // CHART OF ACCOUNTS
    // =========================================================================

    public function accountsIndex(Request $request): JsonResponse
    {
        $query = ChartOfAccount::query();

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        return $this->success($query->orderBy('code')->get());
    }

    public function accountStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => 'required|string|max:20|unique:chart_of_accounts,code',
            'name' => 'required|string|max:255',
            'type' => 'required|in:asset,liability,equity,revenue,expense',
            'normal_balance' => 'required|in:debit,credit',
            'description' => 'nullable|string',
        ]);

        $account = ChartOfAccount::create($data + ['is_system' => false, 'is_active' => true]);

        AuditLog::log($request->user(), 'create_account', 'ChartOfAccount', $account->id, null, $account->toArray(), 'Account created');

        return $this->created($account);
    }

    public function accountUpdate(Request $request, int $id): JsonResponse
    {
        $account = ChartOfAccount::find($id);
        if (!$account) {
            return $this->notFound('Account not found');
        }

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $old = $account->toArray();
        $account->update($data);

        AuditLog::log($request->user(), 'update_account', 'ChartOfAccount', $account->id, $old, $account->toArray(), 'Account updated');

        return $this->success($account);
    }

    public function accountDestroy(Request $request, int $id): JsonResponse
    {
        $account = ChartOfAccount::withCount('lines')->find($id);
        if (!$account) {
            return $this->notFound('Account not found');
        }
        if ($account->is_system) {
            return $this->error('Cannot delete a system account', 422);
        }
        if ($account->lines_count > 0) {
            return $this->error('Cannot delete an account that has journal entries', 422);
        }

        $account->delete();

        AuditLog::log($request->user(), 'delete_account', 'ChartOfAccount', $id, null, null, 'Account deleted');

        return $this->noContent('Account deleted');
    }

    // =========================================================================
    // JOURNAL ENTRIES
    // =========================================================================

    public function journalIndex(Request $request): JsonResponse
    {
        $query = JournalEntry::query()->with('lines.account', 'creator:id,name');

        if ($request->filled('reference_type')) {
            $query->where('reference_type', $request->reference_type);
        }
        if ($request->filled('from_date')) {
            $query->whereDate('entry_date', '>=', $request->from_date);
        }
        if ($request->filled('to_date')) {
            $query->whereDate('entry_date', '<=', $request->to_date);
        }

        $entries = $query->latest('entry_date')->latest('id')->paginate($request->get('per_page', 20));

        return $this->paginated($entries);
    }

    public function journalShow(int $id): JsonResponse
    {
        $entry = JournalEntry::with('lines.account', 'creator:id,name', 'reversedEntry')->find($id);
        if (!$entry) {
            return $this->notFound('Journal entry not found');
        }

        return $this->success($entry);
    }

    /** Manual adjusting entry — for corrections or anything with no automated trigger. */
    public function journalStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entry_date' => 'required|date',
            'description' => 'required|string|max:500',
            'lines' => 'required|array|min:2',
            'lines.*.account_code' => 'required|exists:chart_of_accounts,code',
            'lines.*.debit' => 'nullable|numeric|min:0',
            'lines.*.credit' => 'nullable|numeric|min:0',
        ]);

        try {
            $entry = JournalEntry::post($data['entry_date'], 'Manual', null, $data['description'], $data['lines'], $request->user());

            AuditLog::log($request->user(), 'create_manual_journal_entry', 'JournalEntry', $entry->id, null, $entry->toArray(), 'Manual journal entry posted');

            return $this->created($entry->load('lines.account'));
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    // =========================================================================
    // REPORTS
    // =========================================================================

    /** GET /admin/accounting/trial-balance?as_of=YYYY-MM-DD */
    public function trialBalance(Request $request): JsonResponse
    {
        $asOf = $request->get('as_of', now()->toDateString());
        $accounts = ChartOfAccount::where('is_active', true)->orderBy('code')->get();

        $rows = $accounts->map(function ($account) use ($asOf) {
            $balance = $account->balanceAsOf($asOf);
            $isDebitNormal = $account->normal_balance === 'debit';

            return [
                'code' => $account->code,
                'name' => $account->name,
                'type' => $account->type,
                'debit' => $balance > 0 && $isDebitNormal ? $balance : ($balance < 0 && !$isDebitNormal ? abs($balance) : 0),
                'credit' => $balance > 0 && !$isDebitNormal ? $balance : ($balance < 0 && $isDebitNormal ? abs($balance) : 0),
            ];
        });

        return $this->success([
            'as_of' => $asOf,
            'accounts' => $rows,
            'total_debit' => round($rows->sum('debit'), 2),
            'total_credit' => round($rows->sum('credit'), 2),
        ]);
    }

    /** GET /admin/accounting/income-statement?from=&to= */
    public function incomeStatement(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $revenue = ChartOfAccount::where('type', 'revenue')->where('is_active', true)->get()->map(fn ($a) => [
            'code' => $a->code, 'name' => $a->name, 'amount' => round($a->activityBetween($from, $to), 2),
        ]);
        $expenses = ChartOfAccount::where('type', 'expense')->where('is_active', true)->get()->map(fn ($a) => [
            'code' => $a->code, 'name' => $a->name, 'amount' => round($a->activityBetween($from, $to), 2),
        ]);

        $totalRevenue = round($revenue->sum('amount'), 2);
        $totalExpenses = round($expenses->sum('amount'), 2);

        return $this->success([
            'from' => $from,
            'to' => $to,
            'revenue' => $revenue,
            'total_revenue' => $totalRevenue,
            'expenses' => $expenses,
            'total_expenses' => $totalExpenses,
            'net_income' => round($totalRevenue - $totalExpenses, 2),
        ]);
    }

    /** GET /admin/accounting/balance-sheet?as_of= */
    public function balanceSheet(Request $request): JsonResponse
    {
        $asOf = $request->get('as_of', now()->toDateString());

        $section = fn (string $type) => ChartOfAccount::where('type', $type)->where('is_active', true)->get()
            ->map(fn ($a) => ['code' => $a->code, 'name' => $a->name, 'balance' => round($a->balanceAsOf($asOf), 2)]);

        $assets = $section('asset');
        $liabilities = $section('liability');
        $equity = $section('equity');

        // MVP simplification: retained earnings shown as computed lifetime net income, not formally closed each period.
        $lifetimeRevenue = ChartOfAccount::where('type', 'revenue')->get()->sum(fn ($a) => $a->balanceAsOf($asOf));
        $lifetimeExpense = ChartOfAccount::where('type', 'expense')->get()->sum(fn ($a) => $a->balanceAsOf($asOf));
        $retainedEarnings = round($lifetimeRevenue - $lifetimeExpense, 2);

        return $this->success([
            'as_of' => $asOf,
            'assets' => $assets,
            'total_assets' => round($assets->sum('balance'), 2),
            'liabilities' => $liabilities,
            'total_liabilities' => round($liabilities->sum('balance'), 2),
            'equity' => $equity,
            'computed_retained_earnings' => $retainedEarnings,
            'total_equity' => round($equity->sum('balance') + $retainedEarnings, 2),
        ]);
    }

    /**
     * GET /admin/accounting/cash-position?from=&to= — opening/closing cash balance for a period,
     * i.e. how much cash we had at the start vs the end, and what moved in/out in between.
     */
    public function cashPosition(Request $request): JsonResponse
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $cash = ChartOfAccount::where('code', '1000')->first();
        if (!$cash) {
            return $this->error('Cash account (1000) not found', 500);
        }

        $dayBeforeFrom = \Carbon\Carbon::parse($from)->subDay()->toDateString();
        $openingBalance = round($cash->balanceAsOf($dayBeforeFrom), 2);
        $closingBalance = round($cash->balanceAsOf($to), 2);

        $linesInRange = $cash->lines()->whereHas('journalEntry', fn ($q) => $q->whereBetween('entry_date', [$from, $to]));
        $cashIn = round((clone $linesInRange)->sum('debit'), 2);
        $cashOut = round((clone $linesInRange)->sum('credit'), 2);

        return $this->success([
            'from' => $from,
            'to' => $to,
            'opening_balance' => $openingBalance,
            'cash_in' => $cashIn,
            'cash_out' => $cashOut,
            'net_change' => round($closingBalance - $openingBalance, 2),
            'closing_balance' => $closingBalance,
        ]);
    }

    /** GET /admin/accounting/ledger/{accountId}?from=&to= — general ledger detail for one account */
    public function accountLedger(Request $request, int $accountId): JsonResponse
    {
        $account = ChartOfAccount::find($accountId);
        if (!$account) {
            return $this->notFound('Account not found');
        }

        $query = JournalEntryLine::where('account_id', $accountId)->with('journalEntry')
            ->whereHas('journalEntry', function ($q) use ($request) {
                if ($request->filled('from')) {
                    $q->whereDate('entry_date', '>=', $request->from);
                }
                if ($request->filled('to')) {
                    $q->whereDate('entry_date', '<=', $request->to);
                }
            });

        $lines = $query->get()->sortBy(fn ($line) => $line->journalEntry->entry_date . '-' . $line->journalEntry->id);

        $running = 0;
        $isDebitNormal = $account->normal_balance === 'debit';
        $rows = $lines->map(function ($line) use (&$running, $isDebitNormal) {
            $running += $isDebitNormal ? ($line->debit - $line->credit) : ($line->credit - $line->debit);

            return [
                'date' => $line->journalEntry->entry_date->toDateString(),
                'entry_number' => $line->journalEntry->entry_number,
                'description' => $line->description ?? $line->journalEntry->description,
                'debit' => (float) $line->debit,
                'credit' => (float) $line->credit,
                'running_balance' => round($running, 2),
            ];
        })->values();

        return $this->success(['account' => $account, 'lines' => $rows]);
    }

    // =========================================================================
    // PENDING SYNC — records from other modules not yet reflected in the ledger.
    // Covers both new records (should be rare/never, since posting is automatic) and
    // historical records that existed before this accounting integration was added.
    // =========================================================================

    /** GET /admin/accounting/pending — counts + a preview list per module */
    public function pendingSummary(Request $request): JsonResponse
    {
        return $this->success([
            'expenses' => $this->unsyncedExpenses()->count(),
            'orders' => $this->unsyncedOrders()->count(),
            'purchase_orders' => $this->unsyncedPurchaseOrders()->count(),
        ]);
    }

    /** GET /admin/accounting/pending/expenses */
    public function pendingExpenses(): JsonResponse
    {
        $expenses = $this->unsyncedExpenses()->with('category:id,name')->orderByDesc('expense_date')->get();

        return $this->success($expenses);
    }

    /** GET /admin/accounting/pending/orders */
    public function pendingOrders(): JsonResponse
    {
        $orders = $this->unsyncedOrders()->orderByDesc('created_at')->get();

        return $this->success($orders);
    }

    /** GET /admin/accounting/pending/purchase-orders */
    public function pendingPurchaseOrders(): JsonResponse
    {
        $purchaseOrders = $this->unsyncedPurchaseOrders()->values();

        return $this->success($purchaseOrders);
    }

    /** POST /admin/accounting/process/expense/{id} — backfill the journal entry for one expense */
    public function processExpense(Request $request, int $id): JsonResponse
    {
        $expense = Expense::find($id);
        if (!$expense) {
            return $this->notFound('Expense not found');
        }

        $entry = $expense->postJournalEntry($request->user());
        if (!$entry) {
            return $this->error('This expense is already synced to the ledger', 422);
        }

        AuditLog::log($request->user(), 'process_pending_expense', 'Expense', $expense->id, null, null, 'Backfilled ledger entry for an existing expense');

        return $this->success($entry->load('lines.account'));
    }

    /** POST /admin/accounting/process/order/{id} — backfill the payment-received entry for one order */
    public function processOrder(Request $request, int $id): JsonResponse
    {
        $order = Order::find($id);
        if (!$order) {
            return $this->notFound('Order not found');
        }
        if (!in_array($order->payment_status, ['paid', 'partially_paid', 'verified'], true)) {
            return $this->error('This order has no payment recorded, so there is nothing to sync', 422);
        }
        if ($order->hasRevenueBeenRecognized()) {
            return $this->error('This order is already synced to the ledger', 422);
        }

        // Historical orders never had paid_amount tracked before this feature existed — if it's
        // still zero despite being marked paid/partially_paid/verified, assume the full total was
        // paid (matching the old all-or-nothing assumption), otherwise trust the recorded paid_amount.
        $originalStatus = $order->payment_status;
        $amountToRecord = $order->paid_amount > 0 ? (float) $order->paid_amount : (float) $order->total;
        $entries = $order->recordPayment($amountToRecord, $request->user());
        if ($originalStatus === 'verified') {
            // recordPayment() derives 'paid'/'partially_paid' from the amount — restore the
            // original 'verified' label now that the ledger is posted.
            $order->update(['payment_status' => 'verified']);
        }

        AuditLog::log($request->user(), 'process_pending_order', 'Order', $order->id, null, ['amount' => $amountToRecord], 'Backfilled ledger entry for an existing paid order');

        return $this->success(collect($entries)->map(fn ($e) => $e->load('lines.account')));
    }

    /** POST /admin/accounting/process/purchase-order/{id} — backfill any unposted received value */
    public function processPurchaseOrder(Request $request, int $id): JsonResponse
    {
        $po = PurchaseOrder::with('items')->find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }

        $unposted = $po->unposted_received_value;
        if ($unposted <= 0) {
            return $this->error('This purchase order is already synced to the ledger', 422);
        }

        $entry = $po->postReceiptJournalEntry($unposted, $request->user());

        AuditLog::log($request->user(), 'process_pending_purchase_order', 'PurchaseOrder', $po->id, null, ['amount' => $unposted], 'Backfilled ledger entry for an existing purchase order');

        return $this->success($entry->load('lines.account'));
    }

    private function unsyncedExpenses()
    {
        return Expense::whereNotExists(function ($q) {
            $q->selectRaw('1')->from('journal_entries')
                ->whereColumn('journal_entries.reference_id', 'expenses.id')
                ->where('journal_entries.reference_type', 'Expense');
        });
    }

    private function unsyncedOrders()
    {
        return Order::whereIn('payment_status', ['paid', 'partially_paid', 'verified'])->whereNotExists(function ($q) {
            $q->selectRaw('1')->from('journal_entry_lines')
                ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
                ->join('chart_of_accounts', 'chart_of_accounts.id', '=', 'journal_entry_lines.account_id')
                ->whereColumn('journal_entries.reference_id', 'orders.id')
                ->where('journal_entries.reference_type', 'Order')
                ->where('journal_entries.is_reversal', false)
                ->where('chart_of_accounts.code', '4000');
        });
    }

    private function unsyncedPurchaseOrders()
    {
        return PurchaseOrder::with('items')->get()->filter(fn (PurchaseOrder $po) => $po->unposted_received_value > 0);
    }
}
