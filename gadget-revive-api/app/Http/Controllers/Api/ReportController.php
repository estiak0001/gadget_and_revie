<?php

namespace App\Http\Controllers\Api;

use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use App\Models\Service;
use App\Models\Ticket;
use App\Models\User;
use App\Models\VendorProfile;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends BaseController
{
    // ========== ADMIN REPORTS ==========

    /**
     * Get sales report
     */
    public function salesReport(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'group_by' => 'nullable|in:day,week,month',
        ]);

        $startDate = $request->start_date;
        $endDate = $request->end_date;
        $groupBy = $request->get('group_by', 'day');

        // Group format for SQL
        $groupFormat = match ($groupBy) {
            'week' => '%Y-%u',
            'month' => '%Y-%m',
            default => '%Y-%m-%d',
        };

        $salesData = Order::whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw("
                DATE_FORMAT(created_at, '{$groupFormat}') as period,
                COUNT(*) as total_orders,
                SUM(CASE WHEN order_status != 'refunded' THEN total ELSE 0 END) as total_revenue,
                SUM(CASE WHEN order_status = 'completed' THEN total ELSE 0 END) as completed_revenue,
                SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
                AVG(total) as average_order_value
            ")
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        // Summary statistics
        $summary = Order::whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_orders,
                SUM(CASE WHEN order_status != "refunded" THEN total ELSE 0 END) as total_revenue,
                SUM(CASE WHEN order_status = "completed" THEN total ELSE 0 END) as completed_revenue,
                SUM(CASE WHEN order_status = "cancelled" THEN 1 ELSE 0 END) as cancelled_orders,
                AVG(total) as average_order_value
            ')
            ->first();

        // Revenue growth vs. the immediately preceding period of equal length
        $periodDays = max(1, \Carbon\Carbon::parse($startDate)->diffInDays(\Carbon\Carbon::parse($endDate)) + 1);
        $prevEnd = \Carbon\Carbon::parse($startDate)->subDay()->toDateString();
        $prevStart = \Carbon\Carbon::parse($startDate)->subDays($periodDays)->toDateString();
        $prevRevenue = (float) (Order::whereBetween('created_at', [$prevStart, $prevEnd])
            ->where('order_status', '!=', 'refunded')
            ->sum('total') ?? 0);
        $currentRevenue = (float) ($summary->total_revenue ?? 0);
        $revenueGrowth = $prevRevenue > 0
            ? round((($currentRevenue - $prevRevenue) / $prevRevenue) * 100, 1)
            : ($currentRevenue > 0 ? 100.0 : 0.0);

        // Top vendors by revenue
        $topVendors = Order::whereBetween('created_at', [$startDate, $endDate])
            ->where('order_status', 'completed')
            ->select('vendor_profile_id', DB::raw('SUM(total) as total_revenue'), DB::raw('COUNT(*) as order_count'))
            ->groupBy('vendor_profile_id')
            ->orderByDesc('total_revenue')
            ->with('vendorProfile:id,business_name')
            ->take(10)
            ->get();

        // Top services by revenue (used by the "Top Services" panel on the Sales Report page)
        $topServices = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('services', 'services.id', '=', 'order_items.service_id')
            ->whereNotNull('order_items.service_id')
            ->whereBetween('orders.created_at', [$startDate, $endDate])
            ->select(
                'services.name',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(order_items.total_price) as revenue')
            )
            ->groupBy('services.id', 'services.name')
            ->orderByDesc('revenue')
            ->take(10)
            ->get();

        // Payment method breakdown
        $paymentBreakdown = Order::whereBetween('created_at', [$startDate, $endDate])
            ->select('payment_method', DB::raw('COUNT(*) as count'), DB::raw('SUM(total) as total'))
            ->groupBy('payment_method')
            ->get();
        $paymentMethods = $paymentBreakdown->map(fn ($row) => [
            'method' => $row->payment_method,
            'count' => (int) $row->count,
            'total' => (float) $row->total,
        ]);

        return $this->success([
            'period' => [
                'start' => $startDate,
                'end' => $endDate,
                'group_by' => $groupBy,
            ],
            // Flattened so the frontend can read report.total_revenue directly.
            'total_orders' => (int) $summary->total_orders,
            'total_revenue' => $currentRevenue,
            'completed_revenue' => (float) ($summary->completed_revenue ?? 0),
            'cancelled_orders' => (int) $summary->cancelled_orders,
            'average_order_value' => round($summary->average_order_value ?? 0, 2),
            'revenue_growth' => $revenueGrowth,
            'summary' => [
                'total_orders' => (int) $summary->total_orders,
                'total_revenue' => $currentRevenue,
                'completed_revenue' => (float) ($summary->completed_revenue ?? 0),
                'cancelled_orders' => (int) $summary->cancelled_orders,
                'average_order_value' => round($summary->average_order_value ?? 0, 2),
            ],
            'chart_data' => $salesData->map(fn ($row) => [
                'date' => $row->period,
                'revenue' => (float) $row->total_revenue,
                'orders' => (int) $row->total_orders,
            ]),
            'top_vendors' => $topVendors,
            'top_services' => $topServices,
            'payment_breakdown' => $paymentBreakdown,
            'payment_methods' => $paymentMethods,
        ]);
    }

    /**
     * Get vendor performance report
     */
    public function vendorReport(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $startDate = $request->start_date;
        $endDate = $request->end_date;

        $vendors = VendorProfile::with(['user:id,name,email'])
            ->withCount(['services', 'products'])
            ->withCount(['orders' => function ($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', [$startDate, $endDate]);
            }])
            ->withSum(['orders' => function ($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', [$startDate, $endDate])
                    ->where('order_status', 'completed');
            }], 'total')
            ->orderByDesc('orders_sum_total')
            ->paginate($request->get('per_page', 20));

        return $this->paginated($vendors);
    }

    /**
     * Get customer report
     */
    public function customerReport(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $startDate = $request->start_date;
        $endDate = $request->end_date;

        // Total customers (all-time — an overview metric independent of the date filter)
        $totalCustomers = User::where('role', 'customer')->count();

        // New customers (registered within the selected range)
        $newCustomers = User::where('role', 'customer')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->count();

        // Active customers (placed at least one order within the range)
        $activeCustomerIds = Order::whereBetween('created_at', [$startDate, $endDate])
            ->whereNotNull('customer_id')
            ->distinct()
            ->pluck('customer_id');
        $activeCustomers = $activeCustomerIds->count();

        // Sales generated in the range (completed orders only)
        $completedInRange = Order::whereBetween('created_at', [$startDate, $endDate])
            ->where('order_status', 'completed');
        $totalSpent = (float) ($completedInRange->clone()->sum('total') ?? 0);
        $completedOrderCount = $completedInRange->clone()->count();
        $averageOrderValue = $completedOrderCount > 0 ? round($totalSpent / $completedOrderCount, 2) : 0.0;

        // Repeat rate — of customers active in this range, what % have more than one order all-time
        $repeatRate = 0.0;
        if ($activeCustomers > 0) {
            $repeatCount = Order::whereIn('customer_id', $activeCustomerIds)
                ->select('customer_id', DB::raw('COUNT(*) as cnt'))
                ->groupBy('customer_id')
                ->havingRaw('COUNT(*) > 1')
                ->get()
                ->count();
            $repeatRate = round(($repeatCount / $activeCustomers) * 100, 1);
        }

        // Top customers by spending in the selected range
        $topCustomers = User::where('role', 'customer')
            ->withCount(['orders' => function ($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', [$startDate, $endDate]);
            }])
            ->withSum(['orders' => function ($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', [$startDate, $endDate])
                    ->where('order_status', 'completed');
            }], 'total')
            ->withMax(['orders' => function ($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', [$startDate, $endDate]);
            }], 'created_at')
            ->orderByDesc('orders_sum_total')
            ->get()
            ->filter(fn ($c) => (float) ($c->orders_sum_total ?? 0) > 0)
            ->take(20)
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'email' => $c->email,
                'total_spent' => (float) ($c->orders_sum_total ?? 0),
                'orders' => (int) $c->orders_count,
                'last_order' => $c->orders_max_created_at,
            ]);

        // Customer growth over time (new registrations)
        $customerGrowth = User::where('role', 'customer')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('DATE_FORMAT(created_at, "%Y-%m-%d") as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Customer segments by lifetime order count (all-time, independent of the date filter)
        $customerSegments = DB::table('users')
            ->leftJoin('orders', 'orders.customer_id', '=', 'users.id')
            ->where('users.role', 'customer')
            ->select('users.id', DB::raw('COUNT(orders.id) as order_count'))
            ->groupBy('users.id')
            ->get()
            ->groupBy(fn ($u) => match (true) {
                $u->order_count == 0 => 'No Orders',
                $u->order_count == 1 => 'New (1 order)',
                $u->order_count <= 4 => 'Returning (2-4)',
                default => 'Loyal (5+)',
            })
            ->map(fn ($group, $segment) => ['segment' => $segment, 'count' => $group->count()])
            ->values();

        return $this->success([
            // Flattened so the frontend can read report.total_customers directly.
            'total_customers' => $totalCustomers,
            'active_customers' => $activeCustomers,
            'new_customers' => $newCustomers,
            'total_spent' => $totalSpent,
            'average_order_value' => $averageOrderValue,
            'repeat_rate' => $repeatRate,
            'summary' => [
                'new_customers' => $newCustomers,
                'active_customers' => $activeCustomers,
            ],
            'top_customers' => $topCustomers,
            'customer_growth' => $customerGrowth,
            'growth_chart' => $customerGrowth,
            'customer_segments' => $customerSegments,
        ]);
    }

    /**
     * Get service/product performance report
     */
    public function catalogReport(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'type' => 'nullable|in:service,product,all',
        ]);

        $startDate = $request->start_date;
        $endDate = $request->end_date;
        $type = $request->get('type', 'all');

        $data = [];

        if ($type === 'all' || $type === 'service') {
            // Top services by revenue
            $topServices = DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->join('services', 'services.id', '=', 'order_items.service_id')
                ->whereNotNull('order_items.service_id')
                ->whereBetween('orders.created_at', [$startDate, $endDate])
                ->select(
                    'services.id',
                    'services.name',
                    DB::raw('COUNT(*) as order_count'),
                    DB::raw('SUM(order_items.quantity) as total_quantity'),
                    DB::raw('SUM(order_items.total_price) as total_revenue')
                )
                ->groupBy('services.id', 'services.name')
                ->orderByDesc('total_revenue')
                ->take(20)
                ->get();

            $data['top_services'] = $topServices;
        }

        if ($type === 'all' || $type === 'product') {
            // Top products by revenue
            $topProducts = DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->join('products', 'products.id', '=', 'order_items.product_id')
                ->whereNotNull('order_items.product_id')
                ->whereBetween('orders.created_at', [$startDate, $endDate])
                ->select(
                    'products.id',
                    'products.name',
                    'products.sku',
                    DB::raw('COUNT(*) as order_count'),
                    DB::raw('SUM(order_items.quantity) as total_quantity'),
                    DB::raw('SUM(order_items.total_price) as total_revenue')
                )
                ->groupBy('products.id', 'products.name', 'products.sku')
                ->orderByDesc('total_revenue')
                ->take(20)
                ->get();

            $data['top_products'] = $topProducts;

            // Low stock products
            $lowStockProducts = Product::whereColumn('stock_qty', '<=', 'low_stock_threshold')
                ->where('is_active', true)
                ->with('vendorProfile:id,business_name')
                ->take(20)
                ->get();

            $data['low_stock_products'] = $lowStockProducts;
        }

        return $this->success($data);
    }

    /**
     * Get review analytics
     */
    public function reviewReport(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $startDate = $request->start_date;
        $endDate = $request->end_date;

        // Overall statistics
        $stats = Review::whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            ')
            ->first();

        // Reviews over time
        $reviewTrend = Review::whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('DATE_FORMAT(created_at, "%Y-%m-%d") as date, COUNT(*) as count, AVG(rating) as avg_rating')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Top rated vendors
        $topRatedVendors = VendorProfile::where('total_reviews', '>', 0)
            ->orderByDesc('rating')
            ->take(10)
            ->get(['id', 'business_name', 'rating as average_rating', 'total_reviews']);

        // Lowest rated vendors (for attention)
        $lowestRatedVendors = VendorProfile::where('total_reviews', '>=', 3)
            ->where('rating', '<', 3)
            ->orderBy('rating')
            ->take(10)
            ->get(['id', 'business_name', 'rating as average_rating', 'total_reviews']);

        return $this->success([
            'summary' => [
                'total_reviews' => (int) $stats->total_reviews,
                'average_rating' => round($stats->average_rating ?? 0, 2),
                'rating_distribution' => [
                    5 => (int) $stats->five_star,
                    4 => (int) $stats->four_star,
                    3 => (int) $stats->three_star,
                    2 => (int) $stats->two_star,
                    1 => (int) $stats->one_star,
                ],
            ],
            'trend' => $reviewTrend,
            'top_rated_vendors' => $topRatedVendors,
            'attention_needed' => $lowestRatedVendors,
        ]);
    }

    /**
     * Get support ticket analytics
     */
    public function ticketReport(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $startDate = $request->start_date;
        $endDate = $request->end_date;

        // Ticket statistics
        $stats = Ticket::whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_tickets,
                SUM(CASE WHEN status = "open" THEN 1 ELSE 0 END) as open_tickets,
                SUM(CASE WHEN status = "closed" THEN 1 ELSE 0 END) as closed_tickets,
                SUM(CASE WHEN priority = "urgent" THEN 1 ELSE 0 END) as urgent_tickets,
                SUM(CASE WHEN priority = "high" THEN 1 ELSE 0 END) as high_priority_tickets
            ')
            ->first();

        // Tickets by status over time
        $ticketTrend = Ticket::whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('DATE_FORMAT(created_at, "%Y-%m-%d") as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Average resolution time (for closed tickets)
        $avgResolutionTime = Ticket::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'closed')
            ->whereNotNull('closed_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, closed_at)) as avg_hours')
            ->first();

        // Tickets by priority
        $byPriority = Ticket::whereBetween('created_at', [$startDate, $endDate])
            ->select('priority', DB::raw('COUNT(*) as count'))
            ->groupBy('priority')
            ->get();

        return $this->success([
            'summary' => [
                'total_tickets' => (int) $stats->total_tickets,
                'open_tickets' => (int) $stats->open_tickets,
                'closed_tickets' => (int) $stats->closed_tickets,
                'urgent_tickets' => (int) $stats->urgent_tickets,
                'high_priority_tickets' => (int) $stats->high_priority_tickets,
                'avg_resolution_hours' => round($avgResolutionTime->avg_hours ?? 0, 1),
            ],
            'trend' => $ticketTrend,
            'by_priority' => $byPriority,
        ]);
    }

    // ========== VENDOR REPORTS ==========

    /**
     * Get vendor's own sales report
     */
    public function vendorSalesReport(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'group_by' => 'nullable|in:day,week,month',
        ]);

        $user = $request->user();
        $vendor = $user->vendorProfile;

        if (!$vendor) {
            return $this->error('Vendor profile not found', 404);
        }

        $startDate = $request->start_date;
        $endDate = $request->end_date;
        $groupBy = $request->get('group_by', 'day');

        $groupFormat = match ($groupBy) {
            'week' => '%Y-%u',
            'month' => '%Y-%m',
            default => '%Y-%m-%d',
        };

        $salesData = Order::where('vendor_profile_id', $vendor->id)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw("
                DATE_FORMAT(created_at, '{$groupFormat}') as period,
                COUNT(*) as total_orders,
                SUM(total) as total_revenue,
                SUM(CASE WHEN order_status = 'completed' THEN total ELSE 0 END) as completed_revenue,
                AVG(total) as average_order_value
            ")
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        // Summary
        $summary = Order::where('vendor_profile_id', $vendor->id)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_orders,
                SUM(total) as total_revenue,
                SUM(CASE WHEN order_status = "completed" THEN total ELSE 0 END) as completed_revenue,
                AVG(total) as average_order_value
            ')
            ->first();

        // Top selling items
        $topServices = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('services', 'services.id', '=', 'order_items.service_id')
            ->where('orders.vendor_profile_id', $vendor->id)
            ->whereNotNull('order_items.service_id')
            ->whereBetween('orders.created_at', [$startDate, $endDate])
            ->select(
                'services.name',
                DB::raw('SUM(order_items.quantity) as quantity'),
                DB::raw('SUM(order_items.total_price) as revenue')
            )
            ->groupBy('services.id', 'services.name')
            ->orderByDesc('revenue')
            ->take(5)
            ->get();

        $topProducts = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.vendor_profile_id', $vendor->id)
            ->whereNotNull('order_items.product_id')
            ->whereBetween('orders.created_at', [$startDate, $endDate])
            ->select(
                'products.name',
                DB::raw('SUM(order_items.quantity) as quantity'),
                DB::raw('SUM(order_items.total_price) as revenue')
            )
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('revenue')
            ->take(5)
            ->get();

        return $this->success([
            'period' => [
                'start' => $startDate,
                'end' => $endDate,
            ],
            'summary' => [
                'total_orders' => (int) $summary->total_orders,
                'total_revenue' => (float) $summary->total_revenue ?? 0,
                'completed_revenue' => (float) $summary->completed_revenue ?? 0,
                'average_order_value' => round($summary->average_order_value ?? 0, 2),
            ],
            'chart_data' => $salesData,
            'top_services' => $topServices,
            'top_products' => $topProducts,
        ]);
    }

    // ========== EXPORT FUNCTIONS ==========

    /**
     * Export sales report to CSV
     */
    public function exportSalesCSV(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $orders = Order::with(['customer', 'vendorProfile', 'items'])
            ->whereBetween('created_at', [$request->start_date, $request->end_date])
            ->get();

        $csvData = [];
        $csvData[] = ['Order #', 'Date', 'Customer', 'Vendor', 'Status', 'Payment Status', 'Payment Method', 'Total'];

        foreach ($orders as $order) {
            $csvData[] = [
                $order->order_number,
                $order->created_at->format('Y-m-d H:i'),
                $order->customer?->name ?? 'N/A',
                $order->vendorProfile?->business_name ?? 'N/A',
                $order->order_status,
                $order->payment_status,
                $order->payment_method,
                $order->total,
            ];
        }

        $filename = 'sales_report_' . now()->format('Y-m-d') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($csvData) {
            $file = fopen('php://output', 'w');
            foreach ($csvData as $row) {
                fputcsv($file, $row);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Export sales report to PDF
     */
    public function exportSalesPDF(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $orders = Order::with(['customer', 'vendorProfile'])
            ->whereBetween('created_at', [$request->start_date, $request->end_date])
            ->get();

        $summary = Order::whereBetween('created_at', [$request->start_date, $request->end_date])
            ->selectRaw('
                COUNT(*) as total_orders,
                SUM(total) as total_revenue,
                SUM(CASE WHEN order_status = "completed" THEN total ELSE 0 END) as completed_revenue
            ')
            ->first();

        $data = [
            'title' => 'Sales Report',
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'orders' => $orders,
            'summary' => $summary,
            'generated_at' => now()->format('Y-m-d H:i:s'),
        ];

        $pdf = Pdf::loadView('reports.sales', $data);

        return $pdf->download('sales_report_' . now()->format('Y-m-d') . '.pdf');
    }

    /**
     * Export vendors to CSV
     */
    public function exportVendorsCSV(Request $request)
    {
        $vendors = VendorProfile::with(['user', 'division', 'district'])
            ->withCount(['services', 'products', 'orders'])
            ->get();

        $csvData = [];
        $csvData[] = ['ID', 'Business Name', 'Owner', 'Email', 'Phone', 'Location', 'Status', 'Services', 'Products', 'Orders', 'Rating', 'Created'];

        foreach ($vendors as $vendor) {
            $csvData[] = [
                $vendor->id,
                $vendor->business_name,
                $vendor->user?->name ?? 'N/A',
                $vendor->business_email,
                $vendor->business_phone,
                ($vendor->district?->name ?? '') . ', ' . ($vendor->division?->name ?? ''),
                $vendor->status,
                $vendor->services_count,
                $vendor->products_count,
                $vendor->orders_count,
                $vendor->average_rating,
                $vendor->created_at->format('Y-m-d'),
            ];
        }

        $filename = 'vendors_' . now()->format('Y-m-d') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($csvData) {
            $file = fopen('php://output', 'w');
            foreach ($csvData as $row) {
                fputcsv($file, $row);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Export customers to CSV
     */
    public function exportCustomersCSV(Request $request)
    {
        $customers = User::where('role', 'customer')
            ->withCount('orders')
            ->withSum('orders', 'total')
            ->get();

        $csvData = [];
        $csvData[] = ['ID', 'Name', 'Email', 'Phone', 'Status', 'Orders', 'Total Spent', 'Joined'];

        foreach ($customers as $customer) {
            $csvData[] = [
                $customer->id,
                $customer->name,
                $customer->email,
                $customer->phone ?? 'N/A',
                $customer->status,
                $customer->orders_count,
                $customer->orders_sum_total ?? 0,
                $customer->created_at->format('Y-m-d'),
            ];
        }

        $filename = 'customers_' . now()->format('Y-m-d') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($csvData) {
            $file = fopen('php://output', 'w');
            foreach ($csvData as $row) {
                fputcsv($file, $row);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
