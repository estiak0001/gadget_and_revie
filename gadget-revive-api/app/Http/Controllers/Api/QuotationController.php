<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\User;
use App\Traits\ResolvesBrandingSettings;
use App\Traits\StampsPdfPageNumbers;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class QuotationController extends BaseController
{
    use ResolvesBrandingSettings, StampsPdfPageNumbers;

    public function index(Request $request): JsonResponse
    {
        $query = Quotation::with(['customer:id,name,phone', 'creator:id,name'])->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('quotation_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%");
            });
        }

        return $this->paginated($query->paginate($request->get('per_page', 20)));
    }

    public function show(int $id): JsonResponse
    {
        $quotation = Quotation::with(['customer', 'creator:id,name'])->find($id);
        if (!$quotation) {
            return $this->notFound('Quotation not found');
        }

        return $this->success($quotation);
    }

    private function rules(): array
    {
        return [
            'quotation_date'    => 'nullable|date',
            'valid_until'       => 'nullable|date',
            'customer_id'       => 'nullable|exists:users,id',
            'customer_name'     => 'nullable|string|max:255',
            'customer_phone'    => 'nullable|string|max:20',
            'customer_email'    => 'nullable|email|max:255',
            'customer_address'  => 'nullable|string|max:500',
            'items'                 => 'required|array|min:1',
            'items.*.product_id'    => 'nullable|exists:products,id',
            'items.*.item_name'     => 'required|string|max:255',
            'items.*.item_sku'      => 'nullable|string|max:100',
            'items.*.description'   => 'nullable|string|max:500',
            'items.*.quantity'      => 'required|integer|min:1',
            'items.*.unit_price'    => 'required|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'shipping' => 'nullable|numeric|min:0',
            'tax'      => 'nullable|numeric|min:0',
            'notes'    => 'nullable|string|max:1000',
            'terms'    => 'nullable|string|max:2000',
            'status'   => 'nullable|in:draft,sent,accepted,rejected,expired',
        ];
    }

    /**
     * Every item is a snapshot at save time — whether it came from the catalog (product_id set,
     * name/price pre-filled but editable) or was typed in freehand (product_id null throughout).
     * Neither kind stays live-linked to anything afterward.
     */
    private function buildItemsAndTotals(array $data): array
    {
        $items = collect($data['items'])->map(fn ($item) => [
            'product_id'  => $item['product_id'] ?? null,
            'item_name'   => $item['item_name'],
            'item_sku'    => $item['item_sku'] ?? null,
            'description' => $item['description'] ?? null,
            'quantity'    => (int) $item['quantity'],
            'unit_price'  => (float) $item['unit_price'],
            'total_price' => round($item['quantity'] * $item['unit_price'], 2),
        ])->all();

        $subtotal = round(collect($items)->sum('total_price'), 2);
        $discount = (float) ($data['discount'] ?? 0);
        $shipping = (float) ($data['shipping'] ?? 0);
        $tax      = (float) ($data['tax'] ?? 0);
        $total    = round($subtotal - $discount + $shipping + $tax, 2);

        return compact('items', 'subtotal', 'discount', 'shipping', 'tax', 'total');
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $admin = $request->user();

        // Same resolution pattern as AdminController::orderCreate() — an explicitly picked
        // existing customer, or find-by-phone/email-else-create from the typed details.
        $customerId = $data['customer_id'] ?? null;
        $customerName = $data['customer_name'] ?? null;
        $customerPhone = $data['customer_phone'] ?? null;
        $customerEmail = $data['customer_email'] ?? null;

        if ($customerId) {
            $customer = User::find($customerId);
            if ($customer) {
                $customerName  = $customerName  ?: $customer->name;
                $customerPhone = $customerPhone ?: $customer->phone;
                $customerEmail = $customerEmail ?: $customer->email;
            }
        } elseif ($customerName || $customerPhone) {
            $customer = User::findOrCreateCustomer($customerName, $customerPhone, $customerEmail);
            $customerId = $customer?->id;
        }

        $computed = $this->buildItemsAndTotals($data);

        $quotation = Quotation::create([
            'quotation_date'   => $data['quotation_date'] ?? now()->toDateString(),
            'valid_until'      => $data['valid_until'] ?? null,
            'customer_id'      => $customerId,
            'customer_name'    => $customerName,
            'customer_phone'   => $customerPhone,
            'customer_email'   => $customerEmail,
            'customer_address' => $data['customer_address'] ?? null,
            'items'            => $computed['items'],
            'subtotal'         => $computed['subtotal'],
            'discount'         => $computed['discount'],
            'shipping'         => $computed['shipping'],
            'tax'              => $computed['tax'],
            'total'            => $computed['total'],
            'notes'            => $data['notes'] ?? null,
            'terms'            => $data['terms'] ?? null,
            'status'           => $data['status'] ?? 'draft',
            'created_by'       => $admin->id,
        ]);

        AuditLog::log($admin, 'create_quotation', 'Quotation', $quotation->id, null, [
            'quotation_number' => $quotation->quotation_number,
            'total'            => $quotation->total,
        ], "Quotation {$quotation->quotation_number} created");

        return $this->created($quotation->fresh(['customer', 'creator:id,name']));
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $quotation = Quotation::find($id);
        if (!$quotation) {
            return $this->notFound('Quotation not found');
        }

        $data = $request->validate($this->rules());
        $admin = $request->user();

        $customerId = $data['customer_id'] ?? null;
        $customerName = $data['customer_name'] ?? null;
        $customerPhone = $data['customer_phone'] ?? null;
        $customerEmail = $data['customer_email'] ?? null;

        if ($customerId) {
            $customer = User::find($customerId);
            if ($customer) {
                $customerName  = $customerName  ?: $customer->name;
                $customerPhone = $customerPhone ?: $customer->phone;
                $customerEmail = $customerEmail ?: $customer->email;
            }
        } elseif ($customerName || $customerPhone) {
            $customer = User::findOrCreateCustomer($customerName, $customerPhone, $customerEmail);
            $customerId = $customer?->id;
        }

        $computed = $this->buildItemsAndTotals($data);
        $old = $quotation->only(['status', 'total']);

        $quotation->update([
            'quotation_date'   => $data['quotation_date'] ?? $quotation->quotation_date,
            'valid_until'      => $data['valid_until'] ?? null,
            'customer_id'      => $customerId,
            'customer_name'    => $customerName,
            'customer_phone'   => $customerPhone,
            'customer_email'   => $customerEmail,
            'customer_address' => $data['customer_address'] ?? null,
            'items'            => $computed['items'],
            'subtotal'         => $computed['subtotal'],
            'discount'         => $computed['discount'],
            'shipping'         => $computed['shipping'],
            'tax'              => $computed['tax'],
            'total'            => $computed['total'],
            'notes'            => $data['notes'] ?? null,
            'terms'            => $data['terms'] ?? null,
            'status'           => $data['status'] ?? $quotation->status,
        ]);

        AuditLog::log($admin, 'update_quotation', 'Quotation', $quotation->id, $old, [
            'status' => $quotation->status, 'total' => $quotation->total,
        ], "Quotation {$quotation->quotation_number} updated");

        return $this->success($quotation->fresh(['customer', 'creator:id,name']));
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $quotation = Quotation::find($id);
        if (!$quotation) {
            return $this->notFound('Quotation not found');
        }

        $data = $request->validate(['status' => 'required|in:draft,sent,accepted,rejected,expired']);
        $old = $quotation->status;
        $quotation->update(['status' => $data['status']]);

        AuditLog::log($request->user(), 'update_quotation_status', 'Quotation', $quotation->id, [
            'status' => $old,
        ], ['status' => $data['status']], "Quotation {$quotation->quotation_number} status changed to {$data['status']}");

        return $this->success($quotation->fresh());
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $quotation = Quotation::find($id);
        if (!$quotation) {
            return $this->notFound('Quotation not found');
        }

        $number = $quotation->quotation_number;
        $quotation->delete();

        AuditLog::log($request->user(), 'delete_quotation', 'Quotation', $id, [
            'quotation_number' => $number,
        ], null, "Quotation {$number} deleted");

        return $this->success(null, 'Quotation deleted');
    }

    /**
     * GET /admin/quotations/search-products — lightweight product lookup for the "Add from
     * Catalog" picker; deliberately separate from the main admin product list endpoint so the
     * quotation UI only ever gets the handful of fields it actually needs.
     */
    public function searchProducts(Request $request): JsonResponse
    {
        $search = $request->get('search', '');
        $products = Product::query()
            ->when($search, fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%"))
            ->where('is_active', true)
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'sku', 'current_price', 'image']);

        return $this->success($products);
    }

    private function renderPdf(Quotation $quotation): \Barryvdh\DomPDF\PDF
    {
        ini_set('memory_limit', '256M');

        $pdf = Pdf::loadView('invoices.quotation', [
            'quotation' => $quotation,
            'settings'  => $this->brandingSettings(),
        ]);
        $pdf->setPaper('A4', 'portrait');
        $pdf->setOptions([
            'dpi'                  => 150,
            'defaultFont'          => 'DejaVu Sans',
            'isRemoteEnabled'      => false,
            'isHtml5ParserEnabled' => true,
            'enable_php'           => false,
        ]);

        $this->stampPageNumbers($pdf);

        return $pdf;
    }

    public function download(int $id): Response|JsonResponse
    {
        $quotation = Quotation::find($id);
        if (!$quotation) {
            return $this->notFound('Quotation not found');
        }

        return $this->renderPdf($quotation)->download("Quotation-{$quotation->quotation_number}.pdf");
    }

    public function stream(int $id): Response|JsonResponse
    {
        $quotation = Quotation::find($id);
        if (!$quotation) {
            return $this->notFound('Quotation not found');
        }

        return $this->renderPdf($quotation)->stream("Quotation-{$quotation->quotation_number}.pdf");
    }
}
