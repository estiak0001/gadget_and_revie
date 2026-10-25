<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\ChartOfAccount;
use App\Models\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentMethodController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $query = PaymentMethod::with('chartOfAccount');

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        $today = now()->toDateString();

        $methods = $query->orderBy('sort_order')->orderBy('name')->get()->map(
            fn (PaymentMethod $method) => array_merge(
                $method->toArray(),
                ['balance' => round($method->chartOfAccount?->balanceAsOf($today) ?? 0, 2)],
            )
        );

        return $this->success($methods);
    }

    /**
     * Creating a payment method auto-creates its own Chart of Accounts entry (asset, debit-normal,
     * code in the reserved 11xx range so it never collides with manually-managed 10xx codes) — the
     * whole point is this never needs a separate manual chart-of-accounts step.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:cash,bank,mobile_banking,card,other',
            'account_holder_name' => 'nullable|string|max:255',
            'account_number' => 'nullable|string|max:100',
            'bank_name' => 'nullable|string|max:255',
            'branch_name' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $method = DB::transaction(function () use ($data, $request) {
            $nextCode = (int) (ChartOfAccount::where('code', 'like', '11%')->max('code') ?? 1099) + 1;

            $account = ChartOfAccount::create([
                'code' => (string) $nextCode,
                'name' => $data['name'],
                'type' => 'asset',
                'normal_balance' => 'debit',
                'description' => 'Auto-created for the "' . $data['name'] . '" payment method.',
                'is_system' => false,
                'is_active' => true,
            ]);

            $code = $this->uniqueCode($data['name']);

            return PaymentMethod::create($data + [
                'code' => $code,
                'chart_of_account_id' => $account->id,
                'is_system' => false,
                'is_active' => $data['is_active'] ?? true,
            ]);
        });

        $method->load('chartOfAccount');

        AuditLog::log($request->user(), 'create_payment_method', 'PaymentMethod', $method->id, null, $method->toArray(), 'Payment method created');

        return $this->created($method);
    }

    /**
     * Name/type/bank details/active status are editable; the linked ledger account is not
     * reassignable, same immutability principle as ChartOfAccount's own code/type/normal_balance.
     * A name change also renames the linked account so ledger reports stay readable.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $method = PaymentMethod::find($id);
        if (!$method) {
            return $this->notFound('Payment method not found');
        }

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'type' => 'sometimes|required|in:cash,bank,mobile_banking,card,other',
            'account_holder_name' => 'nullable|string|max:255',
            'account_number' => 'nullable|string|max:100',
            'bank_name' => 'nullable|string|max:255',
            'branch_name' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $old = $method->toArray();

        DB::transaction(function () use ($method, $data) {
            $method->update($data);
            if (isset($data['name']) && $method->chartOfAccount) {
                $method->chartOfAccount->update(['name' => $data['name']]);
            }
        });

        $method->load('chartOfAccount');

        AuditLog::log($request->user(), 'update_payment_method', 'PaymentMethod', $method->id, $old, $method->toArray(), 'Payment method updated');

        return $this->success($method);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $method = PaymentMethod::with('chartOfAccount.lines')->find($id);
        if (!$method) {
            return $this->notFound('Payment method not found');
        }
        if ($method->is_system) {
            return $this->error('Cannot delete a built-in payment method — deactivate it instead', 422);
        }
        if ($method->chartOfAccount && $method->chartOfAccount->lines->isNotEmpty()) {
            return $this->error('Cannot delete a payment method that has ledger activity — deactivate it instead', 422);
        }

        $method->delete();

        AuditLog::log($request->user(), 'delete_payment_method', 'PaymentMethod', $id, null, null, 'Payment method deleted');

        return $this->noContent('Payment method deleted');
    }

    /** A URL/orders.payment_method-safe slug, unique even against soft-deleted rows. */
    private function uniqueCode(string $name): string
    {
        $base = Str::slug($name, '_') ?: 'method';
        $code = $base;
        $i = 1;
        while (PaymentMethod::withTrashed()->where('code', $code)->exists()) {
            $code = $base . '_' . (++$i);
        }

        return $code;
    }
}
