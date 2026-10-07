<?php

namespace App\Http\Controllers\Api;

use App\Models\Order;
use App\Models\PurchaseOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * Outstanding balances for the Cash Book's "Dues" section:
 *  - receivable: what customers still owe on orders (Order::getOutstandingReceivableAttribute())
 *  - payable:    what we still owe suppliers on purchase orders (PurchaseOrder::getOutstandingPayableAttribute())
 *
 * Both use the model accessors directly, so these numbers can never drift from the per-order
 * and per-PO figures already shown elsewhere in the app. Balances are current (there's no
 * historical snapshot), so the date filter narrows by when the order/PO was placed, not by an
 * as-of balance date.
 */
class DuesController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'type' => 'nullable|in:receivable,payable',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date|after_or_equal:from_date',
            'search' => 'nullable|string|max:191',
            'min_amount' => 'nullable|numeric|min:0',
            'per_page' => 'nullable|integer|min:1|max:200',
            'page' => 'nullable|integer|min:1',
        ]);

        $type = $request->get('type', 'receivable');
        $receivables = $this->receivableRows($request);
        $payables = $this->payableRows($request);

        $summary = [
            'receivable' => [
                'total' => round((float) $receivables->sum('outstanding'), 2),
                'count' => $receivables->count(),
            ],
            'payable' => [
                'total' => round((float) $payables->sum('outstanding'), 2),
                'count' => $payables->count(),
                'supplier_refund_due' => round((float) $payables->sum('refund_due_from_supplier'), 2),
            ],
        ];

        $rows = ($type === 'payable' ? $payables : $receivables)->sortByDesc('outstanding')->values();
        $perPage = (int) $request->get('per_page', 20);
        $page = (int) $request->get('page', 1);
        $paginator = new LengthAwarePaginator(
            $rows->forPage($page, $perPage)->values(),
            $rows->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        return response()->json([
            'success' => true,
            'message' => 'Success',
            'summary' => $summary,
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /** @return Collection<int, array<string, mixed>> */
    private function receivableRows(Request $request): Collection
    {
        $query = Order::with('customer:id,name,phone')
            ->whereNotIn('order_status', ['cancelled', 'refunded'])
            ->whereColumn('total', '>', 'paid_amount');

        $this->applyDateRange($query, $request);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%");
            });
        }

        return $query->get()
            ->map(fn (Order $order) => [
                'type' => 'receivable',
                'id' => $order->id,
                'reference' => $order->order_number,
                'party_name' => $order->customer_name ?: $order->customer?->name,
                'party_phone' => $order->customer_phone ?: $order->customer?->phone,
                'date' => $order->created_at?->toDateString(),
                'total' => (float) $order->total,
                'paid_amount' => (float) $order->paid_amount,
                'outstanding' => $order->outstanding_receivable,
                'status' => $order->order_status,
                'payment_status' => $order->payment_status,
                'refund_due_from_supplier' => 0.0,
            ])
            ->filter(fn (array $row) => $row['outstanding'] > 0 && $this->passesMinAmount($row, $request))
            ->values();
    }

    /** @return Collection<int, array<string, mixed>> */
    private function payableRows(Request $request): Collection
    {
        $query = PurchaseOrder::with(['supplier:id,name,phone', 'items'])
            ->where('status', '!=', 'cancelled');

        $this->applyDateRange($query, $request);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('po_number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"));
            });
        }

        return $query->get()
            ->map(fn (PurchaseOrder $po) => [
                'type' => 'payable',
                'id' => $po->id,
                'reference' => $po->po_number,
                'party_name' => $po->supplier?->name,
                'party_phone' => $po->supplier?->phone,
                'date' => $po->created_at?->toDateString(),
                'total' => (float) $po->total,
                'paid_amount' => (float) $po->paid_amount,
                'outstanding' => $po->outstanding_payable,
                'status' => $po->status,
                'payment_status' => $po->payment_status,
                'refund_due_from_supplier' => $po->refund_due_from_supplier,
            ])
            ->filter(fn (array $row) => $row['outstanding'] > 0 && $this->passesMinAmount($row, $request))
            ->values();
    }

    private function applyDateRange($query, Request $request): void
    {
        if ($request->filled('from_date')) {
            $query->whereDate('created_at', '>=', $request->from_date);
        }
        if ($request->filled('to_date')) {
            $query->whereDate('created_at', '<=', $request->to_date);
        }
    }

    private function passesMinAmount(array $row, Request $request): bool
    {
        return !$request->filled('min_amount') || $row['outstanding'] >= (float) $request->min_amount;
    }
}
