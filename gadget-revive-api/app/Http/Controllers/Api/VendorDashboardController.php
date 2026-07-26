<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\VendorProfileResource;
use App\Http\Resources\ServiceResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\OrderResource;
use App\Http\Resources\InventoryLogResource;
use App\Http\Resources\PaymentNoticeResource;
use App\Models\AuditLog;
use App\Models\InventoryLog;
use App\Models\Notification;
use App\Models\Order;
use App\Models\PaymentNotice;
use App\Models\Product;
use App\Models\Service;
use App\Models\VendorProfile;
use App\Models\VendorServiceArea;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorDashboardController extends BaseController
{
    /**
     * Get vendor dashboard statistics
     */
    public function dashboard(Request $request): JsonResponse
    {
        $vendor = $this->getVendorProfile($request);

        if (!$vendor) {
            return $this->error(
                'Vendor profile not found. ' . 
                ($request->user()->isAdmin() 
                    ? 'Admins must provide vendor_id parameter (e.g., ?vendor_id=1)' 
                    : 'No vendor profile associated with your account'),
                404
            );
        }

        // Date filters
        $startDate = $request->get('start_date', now()->startOfMonth());
        $endDate = $request->get('end_date', now()->endOfDay());

        // Order statistics
        $orderStats = Order::where('vendor_profile_id', $vendor->id)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_orders,
                SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN status = "processing" THEN 1 ELSE 0 END) as processing_orders,
                SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed_orders,
                SUM(CASE WHEN status = "cancelled" THEN 1 ELSE 0 END) as cancelled_orders,
                SUM(total_amount) as total_revenue,
                SUM(CASE WHEN payment_status = "paid" THEN total_amount ELSE 0 END) as paid_revenue
            ')
            ->first();

        // Product stats
        $productStats = Product::where('vendor_profile_id', $vendor->id)
            ->selectRaw('
                COUNT(*) as total_products,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products,
                SUM(CASE WHEN stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_products
            ')
            ->first();

        // Service stats
        $serviceStats = Service::where('vendor_profile_id', $vendor->id)
            ->selectRaw('
                COUNT(*) as total_services,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_services
            ')
            ->first();

        // Recent orders
        $recentOrders = Order::with(['customer', 'items'])
            ->where('vendor_profile_id', $vendor->id)
            ->latest()
            ->take(5)
            ->get();

        // Pending payment notices
        $pendingPayments = PaymentNotice::where('vendor_profile_id', $vendor->id)
            ->where('status', 'pending')
            ->count();

        return $this->success([
            'vendor' => new VendorProfileResource($vendor),
            'statistics' => [
                'orders' => [
                    'total' => (int) $orderStats->total_orders,
                    'pending' => (int) $orderStats->pending_orders,
                    'processing' => (int) $orderStats->processing_orders,
                    'completed' => (int) $orderStats->completed_orders,
                    'cancelled' => (int) $orderStats->cancelled_orders,
                ],
                'revenue' => [
                    'total' => (float) $orderStats->total_revenue,
                    'paid' => (float) $orderStats->paid_revenue,
                ],
                'products' => [
                    'total' => (int) $productStats->total_products,
                    'active' => (int) $productStats->active_products,
                    'low_stock' => (int) $productStats->low_stock_products,
                ],
                'services' => [
                    'total' => (int) $serviceStats->total_services,
                    'active' => (int) $serviceStats->active_services,
                ],
                'pending_payments' => $pendingPayments,
                'rating' => [
                    'average' => $vendor->average_rating,
                    'total_reviews' => $vendor->total_reviews,
                ],
            ],
            'recent_orders' => OrderResource::collection($recentOrders),
        ]);
    }

    /**
     * Update vendor profile
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $request->validate([
            'business_name' => 'sometimes|string|max:255',
            'business_description' => 'sometimes|string|max:2000',
            'business_email' => 'sometimes|email|max:255',
            'business_phone' => 'sometimes|string|max:20',
            'business_address' => 'sometimes|string|max:500',
            'division_id' => 'sometimes|exists:divisions,id',
            'district_id' => 'sometimes|exists:districts,id',
            'area_id' => 'sometimes|exists:areas,id',
            'logo' => 'sometimes|image|max:2048',
            'banner_image' => 'sometimes|image|max:4096',
            'operating_hours' => 'sometimes|array',
            'payment_methods' => 'sometimes|array',
            'bkash_number' => 'nullable|string|max:20',
            'nagad_number' => 'nullable|string|max:20',
            'bank_account_details' => 'nullable|array',
            'website' => 'nullable|url|max:255',
            'facebook' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $oldData = $vendor->toArray();
        $updateData = $request->only([
            'business_name',
            'business_description',
            'business_email',
            'business_phone',
            'business_address',
            'division_id',
            'district_id',
            'area_id',
            'operating_hours',
            'payment_methods',
            'bkash_number',
            'nagad_number',
            'bank_account_details',
            'website',
            'facebook',
        ]);

        // Handle logo upload
        if ($request->hasFile('logo')) {
            $updateData['logo'] = $request->file('logo')->store('vendor-logos', 'public');
        }

        // Handle banner upload
        if ($request->hasFile('banner_image')) {
            $updateData['banner_image'] = $request->file('banner_image')->store('vendor-banners', 'public');
        }

        $vendor->update($updateData);

        AuditLog::log($user, 'update_vendor_profile', 'VendorProfile', $vendor->id, $oldData, $updateData, 'Vendor profile updated');

        return $this->success(new VendorProfileResource($vendor->fresh()), 'Profile updated successfully');
    }

    /**
     * Manage service areas
     */
    public function serviceAreas(Request $request): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $serviceAreas = VendorServiceArea::with(['division', 'district', 'area'])
            ->where('vendor_profile_id', $vendor->id)
            ->get();

        return $this->success($serviceAreas);
    }

    /**
     * Add service area
     */
    public function addServiceArea(Request $request): JsonResponse
    {
        $request->validate([
            'division_id' => 'required|exists:divisions,id',
            'district_id' => 'nullable|exists:districts,id',
            'area_id' => 'nullable|exists:areas,id',
            'delivery_charge' => 'nullable|numeric|min:0',
            'is_active' => 'boolean',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        // Check for duplicate
        $exists = VendorServiceArea::where('vendor_profile_id', $vendor->id)
            ->where('division_id', $request->division_id)
            ->where('district_id', $request->district_id)
            ->where('area_id', $request->area_id)
            ->exists();

        if ($exists) {
            return $this->error('Service area already exists', 400);
        }

        $serviceArea = VendorServiceArea::create([
            'vendor_profile_id' => $vendor->id,
            'division_id' => $request->division_id,
            'district_id' => $request->district_id,
            'area_id' => $request->area_id,
            'delivery_charge' => $request->delivery_charge ?? 0,
            'is_active' => $request->is_active ?? true,
        ]);

        return $this->created($serviceArea->load(['division', 'district', 'area']), 'Service area added');
    }

    /**
     * Remove service area
     */
    public function removeServiceArea(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $serviceArea = VendorServiceArea::where('vendor_profile_id', $vendor->id)
            ->findOrFail($id);

        $serviceArea->delete();

        return $this->success(null, 'Service area removed');
    }

    // ========== SERVICES MANAGEMENT ==========

    /**
     * Get vendor's services
     */
    public function services(Request $request): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $query = Service::with(['category'])
            ->where('vendor_profile_id', $vendor->id);

        // Filter by category
        if ($request->has('category_id')) {
            $query->where('service_category_id', $request->category_id);
        }

        // Filter by status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $services = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($services);
    }

    /**
     * Create a service
     */
    public function createService(Request $request): JsonResponse
    {
        $request->validate([
            'service_category_id' => 'required|exists:service_categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'price' => 'required|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'estimated_duration' => 'nullable|string|max:100',
            'features' => 'nullable|array',
            'images' => 'nullable|array|max:5',
            'images.*' => 'image|max:2048',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        // Handle images
        $images = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $image) {
                $images[] = $image->store('service-images', 'public');
            }
        }

        $service = Service::create([
            'vendor_profile_id' => $vendor->id,
            'service_category_id' => $request->service_category_id,
            'name' => $request->name,
            'slug' => \Str::slug($request->name) . '-' . uniqid(),
            'description' => $request->description,
            'price' => $request->price,
            'sale_price' => $request->sale_price,
            'estimated_duration' => $request->estimated_duration,
            'features' => $request->features,
            'images' => !empty($images) ? $images : null,
            'is_active' => $request->is_active ?? true,
            'is_featured' => $request->is_featured ?? false,
        ]);

        AuditLog::log($user, 'create_service', 'Service', $service->id, null, $service->toArray(), 'Service created');

        return $this->created(new ServiceResource($service->load('category')), 'Service created successfully');
    }

    /**
     * Update a service
     */
    public function updateService(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'service_category_id' => 'sometimes|exists:service_categories,id',
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:2000',
            'price' => 'sometimes|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'estimated_duration' => 'nullable|string|max:100',
            'features' => 'nullable|array',
            'images' => 'nullable|array|max:5',
            'images.*' => 'image|max:2048',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $service = Service::where('vendor_profile_id', $vendor->id)->findOrFail($id);

        $oldData = $service->toArray();
        $updateData = $request->only([
            'service_category_id',
            'name',
            'description',
            'price',
            'sale_price',
            'estimated_duration',
            'features',
            'is_active',
            'is_featured',
        ]);

        // Handle images
        if ($request->hasFile('images')) {
            $images = [];
            foreach ($request->file('images') as $image) {
                $images[] = $image->store('service-images', 'public');
            }
            $updateData['images'] = $images;
        }

        // Update slug if name changed
        if ($request->has('name') && $request->name !== $service->name) {
            $updateData['slug'] = \Str::slug($request->name) . '-' . uniqid();
        }

        $service->update($updateData);

        AuditLog::log($user, 'update_service', 'Service', $service->id, $oldData, $updateData, 'Service updated');

        return $this->success(new ServiceResource($service->fresh('category')), 'Service updated');
    }

    /**
     * Delete a service
     */
    public function deleteService(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $service = Service::where('vendor_profile_id', $vendor->id)->findOrFail($id);

        AuditLog::log($user, 'delete_service', 'Service', $service->id, $service->toArray(), null, 'Service deleted');

        $service->delete();

        return $this->success(null, 'Service deleted');
    }

    // ========== PRODUCTS MANAGEMENT ==========

    /**
     * Get vendor's products
     */
    public function products(Request $request): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $query = Product::with(['category'])
            ->where('vendor_profile_id', $vendor->id);

        // Filter by category
        if ($request->has('category_id')) {
            $query->where('product_category_id', $request->category_id);
        }

        // Filter by status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Filter by stock status
        if ($request->has('stock_status')) {
            if ($request->stock_status === 'low') {
                $query->whereColumn('stock_quantity', '<=', 'low_stock_threshold');
            } elseif ($request->stock_status === 'out') {
                $query->where('stock_quantity', 0);
            }
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        $products = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($products);
    }

    /**
     * Create a product
     */
    public function createProduct(Request $request): JsonResponse
    {
        $request->validate([
            'product_category_id' => 'required|exists:product_categories,id',
            'name' => 'required|string|max:255',
            'sku' => 'nullable|string|max:100|unique:products,sku',
            'description' => 'nullable|string|max:2000',
            'price' => 'required|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'stock_quantity' => 'required|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'specifications' => 'nullable|array',
            'images' => 'nullable|array|max:5',
            'images.*' => 'image|max:2048',
            'brand_id' => 'nullable|exists:product_brands,id',
            'brand' => 'nullable|string|max:255',
            'model' => 'nullable|string|max:255',
            'warranty' => 'nullable|string|max:255',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        // Handle images
        $images = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $image) {
                $images[] = $image->store('product-images', 'public');
            }
        }

        $product = Product::create([
            'vendor_profile_id' => $vendor->id,
            'product_category_id' => $request->product_category_id,
            'name' => $request->name,
            'slug' => \Str::slug($request->name) . '-' . uniqid(),
            'sku' => $request->sku ?? strtoupper(uniqid('SKU-')),
            'description' => $request->description,
            'price' => $request->price,
            'sale_price' => $request->sale_price,
            'stock_quantity' => $request->stock_quantity,
            'low_stock_threshold' => $request->low_stock_threshold ?? 5,
            'specifications' => $request->specifications,
            'images' => !empty($images) ? $images : null,
            'brand_id' => $request->brand_id,
            'brand' => $request->brand,
            'model' => $request->model,
            'warranty' => $request->warranty,
            'is_active' => $request->is_active ?? true,
            'is_featured' => $request->is_featured ?? false,
        ]);

        // Log initial inventory
        InventoryLog::create([
            'product_id' => $product->id,
            'vendor_profile_id' => $vendor->id,
            'user_id' => $user->id,
            'type' => 'addition',
            'quantity_change' => $request->stock_quantity,
            'quantity_before' => 0,
            'quantity_after' => $request->stock_quantity,
            'reason' => 'Initial stock',
        ]);

        AuditLog::log($user, 'create_product', 'Product', $product->id, null, $product->toArray(), 'Product created');

        return $this->created(new ProductResource($product->load('category')), 'Product created successfully');
    }

    /**
     * Update a product
     */
    public function updateProduct(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'product_category_id' => 'sometimes|exists:product_categories,id',
            'name' => 'sometimes|string|max:255',
            'sku' => 'nullable|string|max:100|unique:products,sku,' . $id,
            'description' => 'nullable|string|max:2000',
            'price' => 'sometimes|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'specifications' => 'nullable|array',
            'images' => 'nullable|array|max:5',
            'images.*' => 'image|max:2048',
            'brand_id' => 'nullable|exists:product_brands,id',
            'brand' => 'nullable|string|max:255',
            'model' => 'nullable|string|max:255',
            'warranty' => 'nullable|string|max:255',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $product = Product::where('vendor_profile_id', $vendor->id)->findOrFail($id);

        $oldData = $product->toArray();
        $updateData = $request->only([
            'product_category_id',
            'name',
            'sku',
            'description',
            'price',
            'sale_price',
            'low_stock_threshold',
            'specifications',
            'brand_id',
            'brand',
            'model',
            'warranty',
            'is_active',
            'is_featured',
        ]);

        // Handle images
        if ($request->hasFile('images')) {
            $images = [];
            foreach ($request->file('images') as $image) {
                $images[] = $image->store('product-images', 'public');
            }
            $updateData['images'] = $images;
        }

        // Update slug if name changed
        if ($request->has('name') && $request->name !== $product->name) {
            $updateData['slug'] = \Str::slug($request->name) . '-' . uniqid();
        }

        $product->update($updateData);

        AuditLog::log($user, 'update_product', 'Product', $product->id, $oldData, $updateData, 'Product updated');

        return $this->success(new ProductResource($product->fresh('category')), 'Product updated');
    }

    /**
     * Delete a product
     */
    public function deleteProduct(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $product = Product::where('vendor_profile_id', $vendor->id)->findOrFail($id);

        AuditLog::log($user, 'delete_product', 'Product', $product->id, $product->toArray(), null, 'Product deleted');

        $product->delete();

        return $this->success(null, 'Product deleted');
    }

    /**
     * Update product stock
     */
    public function updateStock(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'quantity' => 'required|integer',
            'type' => 'required|in:addition,deduction,adjustment',
            'reason' => 'required|string|max:255',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $product = Product::where('vendor_profile_id', $vendor->id)->findOrFail($id);

        $quantityBefore = $product->stock_quantity;
        $quantityChange = $request->quantity;

        if ($request->type === 'deduction') {
            $quantityChange = -abs($quantityChange);
        } elseif ($request->type === 'adjustment') {
            $quantityChange = $request->quantity - $quantityBefore;
        }

        $quantityAfter = $quantityBefore + $quantityChange;

        if ($quantityAfter < 0) {
            return $this->error('Stock cannot be negative', 400);
        }

        $product->update(['stock_quantity' => $quantityAfter]);

        InventoryLog::create([
            'product_id' => $product->id,
            'vendor_profile_id' => $vendor->id,
            'user_id' => $user->id,
            'type' => $request->type,
            'quantity_change' => $quantityChange,
            'quantity_before' => $quantityBefore,
            'quantity_after' => $quantityAfter,
            'reason' => $request->reason,
        ]);

        AuditLog::log($user, 'update_stock', 'Product', $product->id, [
            'quantity_before' => $quantityBefore,
        ], [
            'quantity_after' => $quantityAfter,
            'change' => $quantityChange,
        ], "Stock {$request->type}: {$request->reason}");

        return $this->success(new ProductResource($product->fresh('category')), 'Stock updated');
    }

    /**
     * Get inventory logs
     */
    public function inventoryLogs(Request $request): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $productIds = Product::where('vendor_profile_id', $vendor->id)->pluck('id');

        $query = InventoryLog::with(['product', 'user'])
            ->whereIn('product_id', $productIds);

        // Filter by product
        if ($request->has('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        // Filter by type
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        // Date range
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $logs = $query->latest()->paginate($request->get('per_page', 20));

        return $this->paginated($logs);
    }

    // ========== ORDERS MANAGEMENT ==========

    /**
     * Get vendor orders
     */
    public function orders(Request $request): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $query = Order::with(['customer', 'items.service', 'items.product', 'paymentNotice'])
            ->where('vendor_profile_id', $vendor->id);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by payment status
        if ($request->has('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        // Filter by date range
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        // Search by order number
        if ($request->has('search')) {
            $query->where('order_number', 'like', "%{$request->search}%");
        }

        $orders = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($orders);
    }

    /**
     * Update order status
     */
    public function updateOrderStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:pending,confirmed,processing,shipped,delivered,completed,cancelled',
            'notes' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $order = Order::where('vendor_profile_id', $vendor->id)->findOrFail($id);

        $oldStatus = $order->status;
        $newStatus = $request->status;

        // Validate status transition
        $validTransitions = [
            'pending' => ['confirmed', 'cancelled'],
            'confirmed' => ['processing', 'cancelled'],
            'processing' => ['shipped', 'delivered', 'completed', 'cancelled'],
            'shipped' => ['delivered', 'completed'],
            'delivered' => ['completed'],
        ];

        if (!isset($validTransitions[$oldStatus]) || !in_array($newStatus, $validTransitions[$oldStatus])) {
            return $this->error("Cannot change status from {$oldStatus} to {$newStatus}", 400);
        }

        $updateData = ['status' => $newStatus];

        if ($newStatus === 'shipped') {
            $updateData['shipped_at'] = now();
        } elseif ($newStatus === 'delivered') {
            $updateData['delivered_at'] = now();
        } elseif ($newStatus === 'completed') {
            $updateData['completed_at'] = now();
        }

        if ($request->notes) {
            $updateData['vendor_notes'] = $request->notes;
        }

        $order->update($updateData);

        AuditLog::log($user, 'update_order_status', 'Order', $order->id, [
            'status' => $oldStatus,
        ], [
            'status' => $newStatus,
        ], "Order status changed from {$oldStatus} to {$newStatus}");

        // Notify customer
        Notification::notify(
            $order->customer,
            'order_status_update',
            'Order Status Updated',
            "Your order #{$order->order_number} is now {$newStatus}",
            ['order_id' => $order->id, 'status' => $newStatus],
            "/orders/{$order->id}"
        );

        return $this->success(new OrderResource($order->fresh(['customer', 'items'])), 'Order status updated');
    }

    /**
     * Confirm payment
     */
    public function confirmPayment(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'notes' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $order = Order::where('vendor_profile_id', $vendor->id)->findOrFail($id);

        if ($order->payment_status === 'paid') {
            return $this->error('Payment already confirmed', 400);
        }

        // Update order
        $order->update([
            'payment_status' => 'paid',
            'paid_at' => now(),
        ]);

        // Update payment notice if exists
        if ($order->paymentNotice) {
            $order->paymentNotice->update([
                'status' => 'verified',
                'verified_by' => $user->id,
                'verified_at' => now(),
            ]);
        }

        AuditLog::log($user, 'confirm_payment', 'Order', $order->id, null, [
            'payment_status' => 'paid',
        ], 'Payment confirmed');

        // Notify customer
        Notification::notify(
            $order->customer,
            'payment_confirmed',
            'Payment Confirmed',
            "Payment for order #{$order->order_number} has been confirmed",
            ['order_id' => $order->id],
            "/orders/{$order->id}"
        );

        return $this->success(new OrderResource($order->fresh(['customer', 'items', 'paymentNotice'])), 'Payment confirmed');
    }

    /**
     * Get pending payment notices
     */
    public function paymentNotices(Request $request): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $query = PaymentNotice::with(['order.customer', 'user'])
            ->where('vendor_profile_id', $vendor->id);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $notices = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($notices);
    }

    /**
     * Verify payment notice
     */
    public function verifyPaymentNotice(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:verified,rejected',
            'admin_notes' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $notice = PaymentNotice::where('vendor_profile_id', $vendor->id)
            ->where('status', 'pending')
            ->findOrFail($id);

        $notice->update([
            'status' => $request->status,
            'admin_notes' => $request->admin_notes,
            'verified_by' => $user->id,
            'verified_at' => now(),
        ]);

        // If verified, update order payment status
        if ($request->status === 'verified') {
            $notice->order->update([
                'payment_status' => 'paid',
                'paid_at' => now(),
            ]);

            Notification::notify(
                $notice->user,
                'payment_verified',
                'Payment Verified',
                "Your payment for order #{$notice->order->order_number} has been verified",
                ['order_id' => $notice->order_id],
                "/orders/{$notice->order_id}"
            );
        } else {
            Notification::notify(
                $notice->user,
                'payment_rejected',
                'Payment Rejected',
                "Your payment for order #{$notice->order->order_number} was rejected. Please resubmit.",
                ['order_id' => $notice->order_id, 'reason' => $request->admin_notes],
                "/orders/{$notice->order_id}"
            );
        }

        AuditLog::log($user, 'verify_payment', 'PaymentNotice', $notice->id, null, [
            'status' => $request->status,
        ], 'Payment notice ' . $request->status);

        return $this->success(new PaymentNoticeResource($notice->fresh(['order', 'user'])), 'Payment notice ' . $request->status);
    }

    // ========== EARNINGS & PAYOUTS ==========

    /**
     * Get vendor earnings summary
     */
    public function earnings(Request $request): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $startDate = $request->get('start_date', now()->startOfMonth());
        $endDate = $request->get('end_date', now()->endOfDay());

        $earnings = Order::where('vendor_profile_id', $vendor->id)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('
                SUM(CASE WHEN payment_status = "paid" THEN total_amount ELSE 0 END) as total_earned,
                SUM(CASE WHEN payment_status = "paid" AND status = "completed" THEN total_amount ELSE 0 END) as available_balance,
                SUM(CASE WHEN payment_status = "pending" THEN total_amount ELSE 0 END) as pending_earnings,
                COUNT(CASE WHEN payment_status = "paid" THEN 1 END) as paid_orders,
                COUNT(CASE WHEN payment_status = "pending" THEN 1 END) as pending_orders
            ')
            ->first();

        return $this->success([
            'total_earned' => (float) $earnings->total_earned,
            'available_balance' => (float) $earnings->available_balance,
            'pending_earnings' => (float) $earnings->pending_earnings,
            'paid_orders' => (int) $earnings->paid_orders,
            'pending_orders' => (int) $earnings->pending_orders,
            'period' => [
                'start' => $startDate,
                'end' => $endDate,
            ],
        ]);
    }

    /**
     * Get payout history (uses payment notices as payout records)
     */
    public function payouts(Request $request): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $query = PaymentNotice::where('vendor_profile_id', $vendor->id)
            ->with(['order']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $payouts = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($payouts);
    }

    /**
     * Request payout (create payment notice for completed orders)
     */
    public function requestPayout(Request $request): JsonResponse
    {
        $request->validate([
            'amount' => 'required|numeric|min:0',
            'method' => 'required|string|in:bank_transfer,mobile_money,cash',
            'notes' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        // Check available balance
        $availableBalance = Order::where('vendor_profile_id', $vendor->id)
            ->where('payment_status', 'paid')
            ->where('status', 'completed')
            ->sum('total_amount');

        if ($request->amount > $availableBalance) {
            return $this->error('Insufficient balance. Available: ' . $availableBalance, 422);
        }

        // Create a payout request (using payment notice structure)
        $payout = PaymentNotice::create([
            'vendor_profile_id' => $vendor->id,
            'method' => $request->method,
            'amount' => $request->amount,
            'status' => 'pending',
            'notes' => $request->notes,
        ]);

        return $this->created($payout, 'Payout request submitted. Admin will process it soon.');
    }

    /**
     * Get payout statistics
     */
    public function payoutStats(Request $request): JsonResponse
    {
        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $stats = PaymentNotice::where('vendor_profile_id', $vendor->id)
            ->selectRaw('
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = "confirmed" OR status = "verified" THEN 1 ELSE 0 END) as approved_count,
                SUM(CASE WHEN status = "rejected" THEN 1 ELSE 0 END) as rejected_count,
                SUM(amount) as total_requested,
                SUM(CASE WHEN status = "pending" THEN amount ELSE 0 END) as pending_amount,
                SUM(CASE WHEN status = "confirmed" OR status = "verified" THEN amount ELSE 0 END) as approved_amount,
                SUM(CASE WHEN status = "rejected" THEN amount ELSE 0 END) as rejected_amount
            ')
            ->first();

        return $this->success([
            'total_requests' => (int) $stats->total_requests,
            'pending_count' => (int) $stats->pending_count,
            'approved_count' => (int) $stats->approved_count,
            'rejected_count' => (int) $stats->rejected_count,
            'total_requested' => (float) $stats->total_requested,
            'pending_amount' => (float) $stats->pending_amount,
            'approved_amount' => (float) $stats->approved_amount,
            'rejected_amount' => (float) $stats->rejected_amount,
        ]);
    }

    /**
     * Get vendor profile - supports both vendor users and admin users
     * Admins can pass vendor_id parameter to view any vendor's data
     */
    protected function getVendorProfile(Request $request): ?VendorProfile
    {
        $user = $request->user();
        
        // If user is admin and vendor_id is provided, get that vendor
        if ($user->isAdmin()) {
            if ($request->has('vendor_id')) {
                return VendorProfile::findOrFail($request->vendor_id);
            }
            // Admin without vendor_id - return null
            return null;
        }
        
        // Otherwise, get the current user's vendor profile
        return $user->vendorProfile;
    }
}
