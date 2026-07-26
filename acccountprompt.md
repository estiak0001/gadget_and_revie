# Accounting / Ledger Module — Audit Report & Implementation Prompt (Basic Scope)

> **Scope note**: Vendor payouts/commission-split accounting are explicitly **out of scope for this pass** — that's real complexity (marketplace revenue splitting, per-vendor payables) that will be tackled in a later phase once the basic ledger is working. This spec covers a **simple, standard single-entity ledger**: Cash, Sales Revenue, Expenses, Suppliers (Accounts Payable), Tax, and the four core reports (Trial Balance, Income Statement, Balance Sheet, General Ledger). No vendor-commission postings, no vendor-payable account, no vendor-payout journal entries.

## Part A — Audit findings

### Verdict: No proper ledger exists

This codebase has **zero** double-entry accounting anywhere — no chart of accounts, no journal entries, no debit/credit postings, no trial balance, no balance sheet, no P&L, no accounts-receivable/accounts-payable tracking. Confirmed by exhaustive grep across both repos (`ledger`, `journal`, `debit`, `credit`, `chart of accounts`, `trial balance`, `balance sheet`, `accounting`) — the only hit anywhere is SQLite's unrelated `journal_mode` connection setting in `config/database.php`.

Every "financial" figure in the system today is a live `SUM()`/`COUNT()`/`AVG()` aggregate computed on the fly over flat CRUD tables (`orders`, `expenses`, `payment_notices`, `purchase_orders`) — never a persisted, balance-checked ledger.

### What financial visibility currently exists

| Area | What exists today | File(s) |
|---|---|---|
| Sales | `orders.subtotal/tax/shipping/discount/total` decimal columns + `payment_status`/`order_status` enums | `app/Models/Order.php`, migration `2026_01_10_000013` |
| Expenses | Flat `expenses` log (title, amount, date, category) | `app/Models/Expense.php`, `ExpenseController.php` |
| "Revenue Report" | `total_sales - total_expenses` = one subtracted number, plus a merged trend chart | `ExpenseController::report()`, admin `src/app/expenses/report/page.tsx` |
| Purchase orders | Already implemented — `subtotal/tax/shipping_cost/total`, draft→ordered→received/cancelled workflow | `app/Models/PurchaseOrder.php`, `PurchaseOrderController.php` |
| Descriptive reports | Sales/Vendor/Customer report dashboards — revenue trend, growth %, top-N lists | `ReportController.php`, admin `src/app/reports/*` |
| Tax | Flat `tax` decimal column, hard-coded to `0` almost everywhere | `OrderController.php:126`, `GuestController.php:277` |
| Cash/bank/wallet | No balance table of any kind anywhere | — |

### Notes deferred to a later pass (not part of this spec, flagged for awareness only)

- Vendor payout/earnings (`VendorDashboardController`) has a pre-existing bug querying non-existent `orders.total_amount`/`orders.status` columns (real columns: `total`/`order_status`). Unrelated to this ledger work; fix separately whenever the vendor-payout phase is picked up.
- `purchase_orders.expense_id` FK exists but is never populated — this spec doesn't rely on it (purchases post directly to Accounts Payable, see §B.5).
- `vendor_commission_rate` site setting is defined but unused — irrelevant until the vendor phase.
- Refunds currently only write a free-text note, no structured `refund_amount` column, and `ReportController` doesn't exclude refunded orders from revenue totals. This spec adds a minimal fix (§B.5, §B.2) since it directly affects ledger accuracy even in the basic scope.
- Tax is mostly hard-coded to `0` throughout order creation — out of scope to build a tax engine; the ledger just posts whatever `tax` value the order already has (likely `0` until that's addressed elsewhere).

---

## Part B — Implementation spec: a basic double-entry ledger

### B.1 Design decisions

1. **Standard 5-type chart of accounts** (Assets / Liabilities / Equity / Revenue / Expense), numbered `1000s/2000s/3000s/4000s/5000s`. Small, fixed starter set — no vendor-specific accounts.
2. **Journal entries must balance.** Every `JournalEntry` has 2+ `JournalEntryLine` rows; `sum(debit) === sum(credit)` enforced before commit.
3. **No `permission:` middleware, no FormRequest, no observers** — matches this codebase's conventions. Ledger posting happens via explicit calls added to existing controllers at the point money already changes hands (order paid, expense created, purchase order received) — same manual style as the existing `AuditLog::log(...)` calls.
4. **One revenue path.** Every order is treated the same way regardless of vendor — full order total posts to Sales Revenue (or Cash/AR). No commission split, no vendor-payable account. (This is the piece explicitly deferred — see scope note at the top.)
5. **No period-close / closing entries.** Balance Sheet shows a computed "Retained Earnings (undistributed)" = lifetime Revenue − lifetime Expense, not a formally closed figure. This is a standard, acceptable simplification for a basic ledger.
6. **Reversals, not edits.** A posted journal entry is immutable. A refund posts a new reversing entry (debits/credits swapped), linked via `reversed_entry_id`.
7. **RBAC**: add `manage_accounts`, `view_ledger` snake_case permissions to `RoleSeeder.php` (same pattern as `manage_purchases`). No route-level enforcement needed, matching the rest of the repo.

### B.2 Migrations

New migrations dated after the current latest (`2026_07_07_000004_add_purchase_order_id_to_inventory_logs_table.php`):

**`2026_07_08_000001_create_chart_of_accounts_table.php`**
```php
Schema::create('chart_of_accounts', function (Blueprint $table) {
    $table->id();
    $table->string('code')->unique();          // e.g. '1000', '4000'
    $table->string('name');                     // e.g. 'Cash', 'Sales Revenue'
    $table->enum('type', ['asset', 'liability', 'equity', 'revenue', 'expense']);
    $table->enum('normal_balance', ['debit', 'credit']);
    $table->text('description')->nullable();
    $table->boolean('is_active')->default(true);
    $table->boolean('is_system')->default(false); // seeded/protected accounts, cannot be deleted from UI
    $table->timestamps();

    $table->index(['type', 'is_active']);
});
```

**`2026_07_08_000002_create_journal_entries_table.php`**
```php
Schema::create('journal_entries', function (Blueprint $table) {
    $table->id();
    $table->string('entry_number')->unique();   // 'JE-00000001'
    $table->date('entry_date');
    $table->string('reference_type')->nullable(); // 'Order' | 'Expense' | 'PurchaseOrder' | 'Manual'
    $table->unsignedBigInteger('reference_id')->nullable();
    $table->text('description');
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->foreignId('reversed_entry_id')->nullable()->constrained('journal_entries')->nullOnDelete();
    $table->boolean('is_reversal')->default(false);
    $table->timestamps();

    $table->index(['reference_type', 'reference_id']);
    $table->index('entry_date');
});
```

**`2026_07_08_000003_create_journal_entry_lines_table.php`**
```php
Schema::create('journal_entry_lines', function (Blueprint $table) {
    $table->id();
    $table->foreignId('journal_entry_id')->constrained()->cascadeOnDelete();
    $table->foreignId('account_id')->constrained('chart_of_accounts');
    $table->decimal('debit', 14, 2)->default(0);
    $table->decimal('credit', 14, 2)->default(0);
    $table->string('description')->nullable();
    $table->timestamps();

    $table->index(['account_id']);
});
```

**`2026_07_08_000004_add_refund_amount_to_orders_table.php`**
```php
Schema::table('orders', function (Blueprint $table) {
    $table->decimal('refund_amount', 12, 2)->nullable()->after('total');
});
```

### B.3 Seeder — default chart of accounts (simplified, no vendor accounts)

**`database/seeders/ChartOfAccountSeeder.php`**
```php
class ChartOfAccountSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            ['code' => '1000', 'name' => 'Cash', 'type' => 'asset', 'normal_balance' => 'debit'],
            ['code' => '1010', 'name' => 'Accounts Receivable', 'type' => 'asset', 'normal_balance' => 'debit'],
            ['code' => '1020', 'name' => 'Inventory', 'type' => 'asset', 'normal_balance' => 'debit'],
            ['code' => '2000', 'name' => 'Accounts Payable - Suppliers', 'type' => 'liability', 'normal_balance' => 'credit'],
            ['code' => '2020', 'name' => 'Tax Payable', 'type' => 'liability', 'normal_balance' => 'credit'],
            ['code' => '3000', 'name' => 'Retained Earnings', 'type' => 'equity', 'normal_balance' => 'credit'],
            ['code' => '4000', 'name' => 'Sales Revenue', 'type' => 'revenue', 'normal_balance' => 'credit'],
            ['code' => '4900', 'name' => 'Sales Refunds & Allowances', 'type' => 'revenue', 'normal_balance' => 'debit'], // contra-revenue
            ['code' => '5100', 'name' => 'Operating Expenses', 'type' => 'expense', 'normal_balance' => 'debit'],
        ];

        foreach ($accounts as $account) {
            ChartOfAccount::updateOrCreate(['code' => $account['code']], $account + ['is_system' => true, 'is_active' => true]);
        }
    }
}
```
Call this from `DatabaseSeeder::run()` alongside the existing seeders. All expenses post to `5100` for now (no per-category account mapping needed at this scope).

### B.4 Models

**`app/Models/ChartOfAccount.php`**
```php
class ChartOfAccount extends Model
{
    protected $fillable = ['code', 'name', 'type', 'normal_balance', 'description', 'is_active', 'is_system'];
    protected $casts = ['is_active' => 'boolean', 'is_system' => 'boolean'];

    public function lines(): HasMany { return $this->hasMany(JournalEntryLine::class, 'account_id'); }

    /** Signed balance as of an optional date, in the account's normal-balance direction. */
    public function balanceAsOf(?string $date = null): float
    {
        $query = $this->lines()->when($date, fn ($q) => $q->whereHas('journalEntry', fn ($j) => $j->where('entry_date', '<=', $date)));
        $debit = (clone $query)->sum('debit');
        $credit = (clone $query)->sum('credit');
        return $this->normal_balance === 'debit' ? $debit - $credit : $credit - $debit;
    }
}
```

**`app/Models/JournalEntry.php`**
```php
class JournalEntry extends Model
{
    protected $fillable = [
        'entry_number', 'entry_date', 'reference_type', 'reference_id', 'description',
        'created_by', 'reversed_entry_id', 'is_reversal',
    ];
    protected $casts = ['entry_date' => 'date', 'is_reversal' => 'boolean'];

    protected static function boot()
    {
        parent::boot();
        static::creating(fn (JournalEntry $e) => $e->entry_number ??= 'JE-PENDING');
        static::created(function (JournalEntry $e) {
            if ($e->entry_number === 'JE-PENDING') {
                $e->updateQuietly(['entry_number' => 'JE-' . str_pad($e->id, 8, '0', STR_PAD_LEFT)]);
            }
        });
    }

    public function lines(): HasMany { return $this->hasMany(JournalEntryLine::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function reversedEntry(): BelongsTo { return $this->belongsTo(JournalEntry::class, 'reversed_entry_id'); }

    /**
     * Post a balanced journal entry. $lines = [['account_code' => '1000', 'debit' => 500], ['account_code' => '4000', 'credit' => 500]]
     * Throws InvalidArgumentException if debits != credits.
     */
    public static function post(string $entryDate, ?string $referenceType, ?int $referenceId, string $description, array $lines, ?User $user = null): self
    {
        $totalDebit = collect($lines)->sum('debit');
        $totalCredit = collect($lines)->sum('credit');
        if (round($totalDebit, 2) !== round($totalCredit, 2)) {
            throw new \InvalidArgumentException("Unbalanced journal entry: debit {$totalDebit} != credit {$totalCredit}");
        }

        return DB::transaction(function () use ($entryDate, $referenceType, $referenceId, $description, $lines, $user) {
            $entry = self::create([
                'entry_date' => $entryDate,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'description' => $description,
                'created_by' => $user?->id,
            ]);

            foreach ($lines as $line) {
                $account = ChartOfAccount::where('code', $line['account_code'])->firstOrFail();
                $entry->lines()->create([
                    'account_id' => $account->id,
                    'debit' => $line['debit'] ?? 0,
                    'credit' => $line['credit'] ?? 0,
                    'description' => $line['description'] ?? null,
                ]);
            }

            return $entry;
        });
    }

    /** Post a reversing entry (swap debit/credit on every line of $this), linked back via reversed_entry_id. */
    public function reverse(string $entryDate, string $description, ?User $user = null): self
    {
        $lines = $this->lines->map(fn ($l) => [
            'account_code' => $l->account->code,
            'debit' => $l->credit,
            'credit' => $l->debit,
            'description' => $l->description,
        ])->toArray();

        $reversal = self::post($entryDate, $this->reference_type, $this->reference_id, $description, $lines, $user);
        $reversal->update(['is_reversal' => true, 'reversed_entry_id' => $this->id]);
        return $reversal;
    }
}
```

**`app/Models/JournalEntryLine.php`**
```php
class JournalEntryLine extends Model
{
    protected $fillable = ['journal_entry_id', 'account_id', 'debit', 'credit', 'description'];
    protected $casts = ['debit' => 'decimal:2', 'credit' => 'decimal:2'];

    public function journalEntry(): BelongsTo { return $this->belongsTo(JournalEntry::class); }
    public function account(): BelongsTo { return $this->belongsTo(ChartOfAccount::class, 'account_id'); }
}
```

### B.5 Wiring postings into existing controllers

Add one `JournalEntry::post(...)` call at each of these three points — no vendor-split logic, just the whole order/expense/PO amount.

**1. Order payment confirmed** (wherever `payment_status` flips to `paid` — locate the exact method, e.g. in `AdminController` around the `PaymentNotice::confirm()` flow):
```php
$lines = [
    ['account_code' => '1000', 'debit' => $order->total], // Cash
    ['account_code' => '4000', 'credit' => $order->subtotal + $order->shipping - $order->discount],
];
if ($order->tax > 0) {
    $lines[] = ['account_code' => '2020', 'credit' => $order->tax]; // Tax Payable
}

JournalEntry::post(now()->toDateString(), 'Order', $order->id, "Order #{$order->id} payment received", $lines, $request->user());
```

**2. Order refunded** (`AdminController::orderRefund()`) — after the existing status/inventory logic, reverse the original posting:
```php
$originalEntry = JournalEntry::where('reference_type', 'Order')->where('reference_id', $order->id)->where('is_reversal', false)->latest()->first();
if ($originalEntry) {
    $originalEntry->reverse(now()->toDateString(), "Refund for order #{$order->id}: {$reason}", $request->user());
}
$order->update(['refund_amount' => $refundAmount]);
```
Also update `ReportController` revenue queries to exclude `order_status = 'refunded'` alongside the existing `cancelled` exclusion, so reports stay consistent with the ledger.

**3. Expense created** (`ExpenseController::store()`):
```php
JournalEntry::post($expense->expense_date, 'Expense', $expense->id, $expense->title, [
    ['account_code' => '5100', 'debit' => $expense->amount],
    ['account_code' => '1000', 'credit' => $expense->amount],
], $request->user());
```

**4. Purchase order received** (`PurchaseOrderController::receive()`, after the existing inventory-log/stock-increment loop) — post the value actually received in that call (handles partial receipts correctly):
```php
$receivedValue = /* sum of qtyToAdd * unit_cost across this receive() call */;
if ($receivedValue > 0) {
    JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $po->id, "Goods received for {$po->po_number}", [
        ['account_code' => '1020', 'debit' => $receivedValue],  // Inventory
        ['account_code' => '2000', 'credit' => $receivedValue], // Accounts Payable - Suppliers
    ], $request->user());
}
```

**5. Supplier paid** (new endpoint, e.g. `PATCH /admin/purchases/{id}/pay`, body `{ amount }`):
```php
JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $po->id, "Payment to supplier for {$po->po_number}", [
    ['account_code' => '2000', 'debit' => $amountPaid],  // reduce Accounts Payable
    ['account_code' => '1000', 'credit' => $amountPaid], // Cash out
], $request->user());
```

That's the complete set of posting points for this scope — no vendor payout entry, no commission split.

### B.6 Controller — `app/Http/Controllers/Api/AccountingController.php`

```php
class AccountingController extends BaseController
{
    // --- Chart of Accounts CRUD ---
    public function accountsIndex(Request $request)
    {
        $query = ChartOfAccount::query();
        if ($request->filled('type')) $query->where('type', $request->type);
        if ($request->filled('is_active')) $query->where('is_active', $request->boolean('is_active'));
        return $this->success($query->orderBy('code')->get());
    }

    public function accountStore(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string|unique:chart_of_accounts,code',
            'name' => 'required|string|max:255',
            'type' => 'required|in:asset,liability,equity,revenue,expense',
            'normal_balance' => 'required|in:debit,credit',
            'description' => 'nullable|string',
        ]);
        $account = ChartOfAccount::create($data + ['is_system' => false]);
        AuditLog::log($request->user(), 'create_account', 'ChartOfAccount', $account->id, null, $account->toArray(), 'Account created');
        return $this->created($account);
    }

    public function accountUpdate(Request $request, $id)
    {
        $account = ChartOfAccount::findOrFail($id);
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

    public function accountDestroy(Request $request, $id)
    {
        $account = ChartOfAccount::withCount('lines')->findOrFail($id);
        if ($account->is_system) return $this->error('Cannot delete a system account', 422);
        if ($account->lines_count > 0) return $this->error('Cannot delete an account that has journal entries', 422);
        $account->delete();
        return $this->noContent('Account deleted');
    }

    // --- Journal Entries (read-only list + manual entry for adjustments) ---
    public function journalIndex(Request $request)
    {
        $query = JournalEntry::query()->with('lines.account');
        if ($request->filled('reference_type')) $query->where('reference_type', $request->reference_type);
        if ($request->filled('from_date')) $query->whereDate('entry_date', '>=', $request->from_date);
        if ($request->filled('to_date')) $query->whereDate('entry_date', '<=', $request->to_date);
        return $this->paginated($query->latest('entry_date')->paginate($request->get('per_page', 20)));
    }

    public function journalShow($id)
    {
        return $this->success(JournalEntry::with('lines.account', 'creator', 'reversedEntry')->findOrFail($id));
    }

    public function journalStore(Request $request)
    {
        $data = $request->validate([
            'entry_date' => 'required|date',
            'description' => 'required|string',
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

    // --- Reports ---

    /** GET /admin/accounting/trial-balance?as_of=YYYY-MM-DD */
    public function trialBalance(Request $request)
    {
        $asOf = $request->get('as_of', now()->toDateString());
        $accounts = ChartOfAccount::where('is_active', true)->orderBy('code')->get();

        $rows = $accounts->map(function ($account) use ($asOf) {
            $balance = $account->balanceAsOf($asOf);
            return [
                'code' => $account->code,
                'name' => $account->name,
                'type' => $account->type,
                'debit' => $balance > 0 && $account->normal_balance === 'debit' ? $balance : ($balance < 0 && $account->normal_balance === 'credit' ? abs($balance) : 0),
                'credit' => $balance > 0 && $account->normal_balance === 'credit' ? $balance : ($balance < 0 && $account->normal_balance === 'debit' ? abs($balance) : 0),
            ];
        });

        return $this->success([
            'as_of' => $asOf,
            'accounts' => $rows,
            'total_debit' => $rows->sum('debit'),
            'total_credit' => $rows->sum('credit'),
        ]);
    }

    /** GET /admin/accounting/income-statement?from=&to= */
    public function incomeStatement(Request $request)
    {
        $from = $request->get('from', now()->startOfMonth()->toDateString());
        $to = $request->get('to', now()->toDateString());

        $revenue = ChartOfAccount::where('type', 'revenue')->get()->map(fn ($a) => [
            'code' => $a->code, 'name' => $a->name, 'amount' => $this->accountActivityBetween($a, $from, $to),
        ]);
        $expenses = ChartOfAccount::where('type', 'expense')->get()->map(fn ($a) => [
            'code' => $a->code, 'name' => $a->name, 'amount' => $this->accountActivityBetween($a, $from, $to),
        ]);

        return $this->success([
            'from' => $from, 'to' => $to,
            'revenue' => $revenue, 'total_revenue' => $revenue->sum('amount'),
            'expenses' => $expenses, 'total_expenses' => $expenses->sum('amount'),
            'net_income' => $revenue->sum('amount') - $expenses->sum('amount'),
        ]);
    }

    /** GET /admin/accounting/balance-sheet?as_of= */
    public function balanceSheet(Request $request)
    {
        $asOf = $request->get('as_of', now()->toDateString());

        $section = fn (string $type) => ChartOfAccount::where('type', $type)->where('is_active', true)->get()
            ->map(fn ($a) => ['code' => $a->code, 'name' => $a->name, 'balance' => $a->balanceAsOf($asOf)]);

        $assets = $section('asset');
        $liabilities = $section('liability');
        $equity = $section('equity');

        $lifetimeRevenue = ChartOfAccount::where('type', 'revenue')->get()->sum(fn ($a) => $a->balanceAsOf($asOf));
        $lifetimeExpense = ChartOfAccount::where('type', 'expense')->get()->sum(fn ($a) => $a->balanceAsOf($asOf));
        $retainedEarnings = $lifetimeRevenue - $lifetimeExpense;

        return $this->success([
            'as_of' => $asOf,
            'assets' => $assets, 'total_assets' => $assets->sum('balance'),
            'liabilities' => $liabilities, 'total_liabilities' => $liabilities->sum('balance'),
            'equity' => $equity, 'computed_retained_earnings' => $retainedEarnings,
            'total_equity' => $equity->sum('balance') + $retainedEarnings,
        ]);
    }

    /** GET /admin/accounting/ledger/{accountId}?from=&to= */
    public function accountLedger(Request $request, $accountId)
    {
        $account = ChartOfAccount::findOrFail($accountId);
        $query = JournalEntryLine::where('account_id', $accountId)->with('journalEntry')
            ->whereHas('journalEntry', function ($q) use ($request) {
                if ($request->filled('from')) $q->whereDate('entry_date', '>=', $request->from);
                if ($request->filled('to')) $q->whereDate('entry_date', '<=', $request->to);
            });

        $lines = $query->get()->sortBy('journalEntry.entry_date');
        $running = 0;
        $rows = $lines->map(function ($line) use (&$running, $account) {
            $running += $account->normal_balance === 'debit' ? ($line->debit - $line->credit) : ($line->credit - $line->debit);
            return [
                'date' => $line->journalEntry->entry_date, 'entry_number' => $line->journalEntry->entry_number,
                'description' => $line->description ?? $line->journalEntry->description,
                'debit' => $line->debit, 'credit' => $line->credit, 'running_balance' => $running,
            ];
        });

        return $this->success(['account' => $account, 'lines' => $rows->values()]);
    }

    private function accountActivityBetween(ChartOfAccount $account, string $from, string $to): float
    {
        $lines = $account->lines()->whereHas('journalEntry', fn ($q) => $q->whereBetween('entry_date', [$from, $to]));
        $debit = (clone $lines)->sum('debit');
        $credit = (clone $lines)->sum('credit');
        return $account->normal_balance === 'debit' ? $debit - $credit : $credit - $debit;
    }
}
```

### B.7 Routes — add inside the existing `role:admin` group

```php
Route::prefix('accounting')->group(function () {
    Route::get('/accounts', [AccountingController::class, 'accountsIndex']);
    Route::post('/accounts', [AccountingController::class, 'accountStore']);
    Route::put('/accounts/{id}', [AccountingController::class, 'accountUpdate']);
    Route::delete('/accounts/{id}', [AccountingController::class, 'accountDestroy']);

    Route::get('/journal', [AccountingController::class, 'journalIndex']);
    Route::post('/journal', [AccountingController::class, 'journalStore']);
    Route::get('/journal/{id}', [AccountingController::class, 'journalShow']);

    Route::get('/trial-balance', [AccountingController::class, 'trialBalance']);
    Route::get('/income-statement', [AccountingController::class, 'incomeStatement']);
    Route::get('/balance-sheet', [AccountingController::class, 'balanceSheet']);
    Route::get('/ledger/{accountId}', [AccountingController::class, 'accountLedger']);
});
```

### B.8 RBAC

Add to `RoleSeeder.php`'s `$permissions` array: `manage_accounts`, `view_ledger`. `admin` role already gets `Permission::all()` — no further change needed.

---

## Part C — Frontend (`gadget-revive-admin`)

### C.1 Types — add to `src/types/index.ts`

```ts
export interface ChartOfAccount {
  id: number;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  normal_balance: 'debit' | 'credit';
  description?: string;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryLine {
  id: number;
  journal_entry_id: number;
  account_id: number;
  debit: number | string;
  credit: number | string;
  description?: string;
  account?: ChartOfAccount;
}

export interface JournalEntry {
  id: number;
  entry_number: string;
  entry_date: string;
  reference_type?: string;
  reference_id?: number;
  description: string;
  created_by?: number;
  reversed_entry_id?: number;
  is_reversal: boolean;
  created_at: string;
  lines?: JournalEntryLine[];
  creator?: { id: number; name: string };
}

export interface TrialBalanceRow { code: string; name: string; type: string; debit: number; credit: number; }
export interface TrialBalance { as_of: string; accounts: TrialBalanceRow[]; total_debit: number; total_credit: number; }

export interface IncomeStatement {
  from: string; to: string;
  revenue: { code: string; name: string; amount: number }[]; total_revenue: number;
  expenses: { code: string; name: string; amount: number }[]; total_expenses: number;
  net_income: number;
}

export interface BalanceSheet {
  as_of: string;
  assets: { code: string; name: string; balance: number }[]; total_assets: number;
  liabilities: { code: string; name: string; balance: number }[]; total_liabilities: number;
  equity: { code: string; name: string; balance: number }[]; computed_retained_earnings: number; total_equity: number;
}
```

### C.2 `adminService` — append to `src/lib/adminService.ts`

```ts
// Chart of Accounts
getAccounts: (params?: ListParams) => api.get<ApiResponse<ChartOfAccount[]>>('/admin/accounting/accounts', { params }),
createAccount: (data: Record<string, unknown>) => api.post<ApiResponse<ChartOfAccount>>('/admin/accounting/accounts', data),
updateAccount: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<ChartOfAccount>>(`/admin/accounting/accounts/${id}`, data),
deleteAccount: (id: number) => api.delete(`/admin/accounting/accounts/${id}`),

// Journal
getJournalEntries: (params?: ListParams) => api.get<{ data: PaginatedResponse<JournalEntry> }>('/admin/accounting/journal', { params }),
getJournalEntry: (id: number) => api.get<ApiResponse<JournalEntry>>(`/admin/accounting/journal/${id}`),
createJournalEntry: (data: Record<string, unknown>) => api.post<ApiResponse<JournalEntry>>('/admin/accounting/journal', data),

// Reports
getTrialBalance: (asOf?: string) => api.get<ApiResponse<TrialBalance>>('/admin/accounting/trial-balance', { params: { as_of: asOf } }),
getIncomeStatement: (from?: string, to?: string) => api.get<ApiResponse<IncomeStatement>>('/admin/accounting/income-statement', { params: { from, to } }),
getBalanceSheet: (asOf?: string) => api.get<ApiResponse<BalanceSheet>>('/admin/accounting/balance-sheet', { params: { as_of: asOf } }),
getAccountLedger: (accountId: number, from?: string, to?: string) =>
  api.get(`/admin/accounting/ledger/${accountId}`, { params: { from, to } }),
```

### C.3 Pages

Add a new **"Accounts"** sidebar section, alongside the existing "Finance" group (Expenses + Reports):

```tsx
{
  title: 'Accounts',
  icon: <BookOpen className="w-5 h-5" />, // pick an unused lucide-react icon
  children: [
    { title: 'Chart of Accounts', href: '/accounts' },
    { title: 'Journal Entries', href: '/accounts/journal' },
    { title: 'General Ledger', href: '/accounts/ledger' },
    { title: 'Trial Balance', href: '/accounts/trial-balance' },
    { title: 'Income Statement', href: '/accounts/income-statement' },
    { title: 'Balance Sheet', href: '/accounts/balance-sheet' },
  ],
},
```

**`src/app/accounts/page.tsx`** — Chart of Accounts CRUD, copy the simple list+modal pattern from `src/app/suppliers/page.tsx` (table: Code, Name, Type badge, Normal Balance, Active toggle, Actions). System accounts (`is_system: true`) show a lock icon and disable delete.

**`src/app/accounts/journal/page.tsx`** — read-only list (copy `src/app/expenses/page.tsx` shape): filters by `reference_type` and date range, table columns Entry #, Date, Description, Reference, Debit Total, Credit Total. Row click → `src/app/accounts/journal/[id]/page.tsx` detail view showing every line (Account, Debit, Credit). A "+ New Manual Entry" button opens a form (dynamic line-item rows, each with an account `SearchableSelect` + debit/credit inputs, a running "difference" indicator that must hit exactly 0.00 before submit enables).

**`src/app/accounts/ledger/page.tsx`** — pick an account via `SearchableSelect` (fed by `getAccounts()`), date range, then render `getAccountLedger(accountId, from, to)` as a running-balance table (Date, Entry #, Description, Debit, Credit, Running Balance).

**`src/app/accounts/trial-balance/page.tsx`** — "As of" date picker, a two-column (Debit/Credit) table of every active account, totals row confirming `total_debit === total_credit`.

**`src/app/accounts/income-statement/page.tsx`** — date range picker, Revenue section + subtotal, Expenses section + subtotal, Net Income total (bold, colored green/red by sign).

**`src/app/accounts/balance-sheet/page.tsx`** — "As of" date picker, three sections (Assets, Liabilities, Equity incl. computed Retained Earnings), with `total_assets === total_liabilities + total_equity` shown as a visible check.

---

## Part D — QA checklist & build order

### QA checklist

- [ ] `JournalEntry::post()` rejects an unbalanced set of lines (verify in tinker).
- [ ] Refunding an order posts a correct reversal (original entry's debits/credits exactly swapped) and the trial balance still balances afterward.
- [ ] Trial balance `total_debit === total_credit` at all times, for any `as_of` date — including before any activity (all zeros, no error).
- [ ] Receiving a purchase order posts Dr Inventory / Cr Accounts Payable for the correct partial-received amount on each partial receipt (not the whole PO).
- [ ] `ReportController` revenue queries now exclude `order_status = 'refunded'`, matching the ledger's reversal behavior.

### Suggested implementation order

1. Migrations → `ChartOfAccount`/`JournalEntry`/`JournalEntryLine` models → `ChartOfAccountSeeder` → verify via tinker that `JournalEntry::post()` works and rejects unbalanced entries.
2. `AccountingController` (accounts CRUD + manual journal entry + trial balance) → routes → verify manually.
3. Wire posting into `ExpenseController::store()` (simplest integration) → verify a 2-line balanced entry is created.
4. Wire posting into `PurchaseOrderController::receive()` → verify partial-receive posts the correct partial value.
5. Wire posting into the order-payment-confirmed flow (no vendor split — full order total to Sales Revenue + Tax Payable).
6. Wire the refund-reversal call into `AdminController::orderRefund()`, plus the `refund_amount` column + `ReportController` exclusion fix.
7. Income statement + balance sheet + general ledger report endpoints.
8. Frontend: types + `adminService` methods → Chart of Accounts page → Journal Entries list/detail/manual-entry → General Ledger → Trial Balance/Income Statement/Balance Sheet → Sidebar nav.
9. End-to-end manual test: seed chart of accounts → create an expense → confirm an order payment → receive a purchase order → refund an order → pull trial balance and confirm it balances → pull income statement and balance sheet and sanity-check against what you just did.

### Deferred to a later phase (do not build now)

- Vendor-fulfilled order commission split (Vendor Payable account, Commission Revenue account).
- Vendor payout journal entries.
- Fixing the pre-existing `VendorDashboardController` column-name bug (unrelated to this ledger work, but will need fixing before the vendor phase can post anything).
- Per-unit COGS/inventory-costing on sales (needs FIFO/weighted-average costing from `PurchaseOrderItem.unit_cost`).
- Formal period-close / closing entries into Retained Earnings.
