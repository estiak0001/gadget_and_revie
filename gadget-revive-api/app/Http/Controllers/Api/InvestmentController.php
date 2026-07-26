<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\Investment;
use App\Models\Investor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvestmentController extends BaseController
{
    // ========== INVESTORS ==========

    public function investorIndex(Request $request): JsonResponse
    {
        $query = Investor::query();

        if ($request->filled('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }
        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $investors = $query->latest()->get();

        // Attach each investor's running balance (contributions minus returns).
        $investors->each(fn ($investor) => $investor->setAttribute('balance', $investor->balance));

        return $this->success($investors);
    }

    public function investorStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $investor = Investor::create($data);

        AuditLog::log($request->user(), 'create_investor', 'Investor', $investor->id, null, $investor->toArray(), 'Investor created');

        return $this->created($investor);
    }

    public function investorUpdate(Request $request, int $id): JsonResponse
    {
        $investor = Investor::find($id);
        if (!$investor) {
            return $this->notFound('Investor not found');
        }

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $old = $investor->toArray();
        $investor->update($data);

        AuditLog::log($request->user(), 'update_investor', 'Investor', $investor->id, $old, $investor->toArray(), 'Investor updated');

        return $this->success($investor);
    }

    public function investorDestroy(Request $request, int $id): JsonResponse
    {
        $investor = Investor::withCount('investments')->find($id);
        if (!$investor) {
            return $this->notFound('Investor not found');
        }
        if ($investor->investments_count > 0) {
            return $this->error('Cannot delete an investor that has recorded investments', 422);
        }

        $investor->delete();

        AuditLog::log($request->user(), 'delete_investor', 'Investor', $id, null, null, 'Investor deleted');

        return $this->noContent('Investor deleted');
    }

    // ========== INVESTMENTS ==========

    public function index(Request $request): JsonResponse
    {
        $query = Investment::with('investor:id,name', 'creator:id,name');

        if ($request->filled('investor_id')) {
            $query->where('investor_id', $request->investor_id);
        }
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        return $this->paginated($query->latest('investment_date')->latest('id')->paginate($request->get('per_page', 20)));
    }

    /** Record a new investor contribution — posts Dr Cash / Cr Investor Capital. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'investor_id' => 'nullable|exists:investors,id',
            'investor_name' => 'required_without:investor_id|nullable|string|max:255',
            'investor_phone' => 'nullable|string|max:30',
            'investor_email' => 'nullable|email|max:255',
            'amount' => 'required|numeric|min:0.01',
            'investment_date' => 'required|date',
            'description' => 'nullable|string|max:500',
        ]);

        $admin = $request->user();

        $investor = !empty($data['investor_id'])
            ? Investor::findOrFail($data['investor_id'])
            : Investor::create([
                'name' => $data['investor_name'],
                'phone' => $data['investor_phone'] ?? null,
                'email' => $data['investor_email'] ?? null,
            ]);

        $investment = Investment::create([
            'investor_id' => $investor->id,
            'type' => 'contribution',
            'amount' => $data['amount'],
            'investment_date' => $data['investment_date'],
            'description' => $data['description'] ?? null,
            'created_by' => $admin->id,
        ]);

        $investment->postToLedger($admin);

        AuditLog::log($admin, 'record_investment', 'Investment', $investment->id, null, $investment->toArray(), "Investment of ৳{$data['amount']} recorded from {$investor->name}");

        return $this->created($investment->load('investor'));
    }

    /** Return part or all of an investor's capital — posts Dr Investor Capital / Cr Cash. */
    public function processReturn(Request $request, int $investorId): JsonResponse
    {
        $investor = Investor::find($investorId);
        if (!$investor) {
            return $this->notFound('Investor not found');
        }

        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01|max:' . max($investor->balance, 0.01),
            'investment_date' => 'required|date',
            'description' => 'nullable|string|max:500',
        ]);

        $admin = $request->user();

        $investment = Investment::create([
            'investor_id' => $investor->id,
            'type' => 'return',
            'amount' => $data['amount'],
            'investment_date' => $data['investment_date'],
            'description' => $data['description'] ?? null,
            'created_by' => $admin->id,
        ]);

        $investment->postToLedger($admin);

        AuditLog::log($admin, 'return_investment', 'Investment', $investment->id, null, $investment->toArray(), "Returned ৳{$data['amount']} to {$investor->name}");

        return $this->created($investment->load('investor'));
    }
}
