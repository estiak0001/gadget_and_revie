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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends BaseController
{
    // ========== ADMIN REPORTS ==========

    /** Payment states that count as recognized sales — the same set the dashboard and the ledger use. */
    private const RECOGNIZED_PAYMENTS = ['paid', 'partially_paid', 'verified'];

    /** Inclusive bounds for a date range; a bare end date would drop every order placed on that day. */
    private function bounds(string $start, string $end): array
    {
        return [$start . ' 00:00:00', $end . ' 23:59:59'];
    }

    private function recognizedOrders(): Builder
    {
        return Order::whereIn('payment_status', self::RECOGNIZED_PAYMENTS);
    }

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

        [$from, $to] = $this->bounds($request->start_date, $request->end_date);
        $groupBy = $request->get('group_by', 'day');
        $groupFormat = match ($groupBy) {
            'week' => '%x-W%v',
            'month' => '%Y-%m',
            default => '%Y-%m-%d',
        };
        $recognized = "'" . implode("','", self::RECOGNIZED_PAYMENTS) . "'";

        $placed = fn () => Order::whereBetween('created_at', [$from, $to]);
        $sales = fn () => $this->recognizedOrders()->whereBetween('created_at', [$from, $to]);

        $placedCount = $placed()->count();
        $cancelledCount = $placed()->where('order_status', 'cancelled')->count();

        $salesTotals = $sales()->selectRaw('COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue')->first();
        $salesOrders = (int) $salesTotals->orders;
        $revenue = (float) $salesTotals->revenue;
        $averageOrderValue = $salesOrders > 0 ? round($revenue / $salesOrders, 2) : 0.0;

        $chart = $placed()
            ->selectRaw("DATE_FORMAT(created_at, '{$groupFormat}') AS period,
                COUNT(*) AS orders,
                COALESCE(SUM(CASE WHEN payment_status IN ({$recognized}) THEN total ELSE 0 END), 0) AS revenue")
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        $days = max(1, Carbon::parse($request->start_date)->diffInDays(Carbon::parse($request->end_date)) + 1);
        $prevStart = Carbon::parse($request->start_date)->subDays($days);
        $prevEnd = Carbon::parse($request->start_date)->subDay();
        $prevRevenue = (float) $this->recognizedOrders()
            ->whereBetween('created_at', $this->bounds($prevStart->toDateString(), $prevEnd->toDateString()))
            ->sum('total');
        $revenueGrowth = $prevRevenue > 0
            ? round((($revenue - $prevRevenue) / $prevRevenue) * 100, 1)
            : null;

        $topVendors = $sales()
            ->select('vendor_profile_id', DB::raw('SUM(total) AS total_revenue'), DB::raw('COUNT(*) AS order_count'))
            ->groupBy('vendor_profile_id')
            ->orderByDesc('total_revenue')
            ->with('vendorProfile:id,business_name')
            ->take(10)
            ->get()
            ->map(fn ($row) => [
                'vendor_id' => $row->vendor_profile_id,
                'name' => $row->vendorProfile?->business_name,
                'order_count' => (int) $row->order_count,
                'total_revenue' => (float) $row->total_revenue,
            ])
            ->values();

        $topServices = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('services', 'services.id', '=', 'order_items.service_id')
            ->whereIn('orders.payment_status', self::RECOGNIZED_PAYMENTS)
            ->whereNotNull('order_items.service_id')
            ->whereBetween('orders.created_at', [$from, $to])
            ->select('services.name', DB::raw('COUNT(DISTINCT orders.id) AS count'), DB::raw('SUM(order_items.total_price) AS revenue'))
            ->groupBy('services.id', 'services.name')
            ->orderByDesc('revenue')
            ->take(10)
            ->get()
            ->map(fn ($row) => ['name' => $row->name, 'count' => (int) $row->count, 'revenue' => (float) $row->revenue])
            ->values();

        $paymentMethods = $sales()
            ->select('payment_method', DB::raw('COUNT(*) AS count'), DB::raw('SUM(total) AS total'))
            ->groupBy('payment_method')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'method' => $row->payment_method ?: 'unknown',
                'count' => (int) $row->count,
                'total' => (float) $row->total,
            ])
            ->values();

        return $this->success([
            'period' => [
                'start' => $request->start_date,
                'end' => $request->end_date,
                'group_by' => $groupBy,
            ],
            'summary' => [
                'orders_placed' => $placedCount,
                'cancelled_orders' => $cancelledCount,
                'sales_orders' => $salesOrders,
                'total_revenue' => $revenue,
                'average_order_value' => $averageOrderValue,
            ],
            'previous_revenue' => $prevRevenue,
            'revenue_growth' => $revenueGrowth,
            'chart_data' => $chart->map(fn ($row) => [
                'date' => $row->period,
                'revenue' => (float) $row->revenue,
                'orders' => (int) $row->orders,
            ])->values(),
            'top_vendors' => $topVendors,
            'top_services' => $topServices,
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

        [$from, $to] = $this->bounds($request->start_date, $request->end_date);

        $vendors = VendorProfile::with(['user:id,name,email'])
            ->withCount(['services', 'products'])
            ->withCount(['orders' => fn ($q) => $q->whereBetween('created_at', [$from, $to])])
            ->withSum(['orders' => fn ($q) => $q->whereBetween('created_at', [$from, $to])
                ->whereIn('payment_status', self::RECOGNIZED_PAYMENTS)], 'total')
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

        [$from, $to] = $this->bounds($request->start_date, $request->end_date);
        $excludedStatuses = ['cancelled', 'refunded'];

        $totalCustomers = User::where('role', 'customer')->count();

        $newCustomers = User::where('role', 'customer')
            ->whereBetween('created_at', [$from, $to])
            ->count();

        $activeCustomerIds = Order::whereBetween('created_at', [$from, $to])
            ->whereNotNull('customer_id')
            ->whereNotIn('order_status', $excludedStatuses)
            ->distinct()
            ->pluck('customer_id');
        $activeCustomers = $activeCustomerIds->count();

        $salesTotals = $this->recognizedOrders()
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('COUNT(*) AS orders, COALESCE(SUM(total), 0) AS spent')
            ->first();
        $totalSpent = (float) $salesTotals->spent;
        $salesOrders = (int) $salesTotals->orders;
        $averageOrderValue = $salesOrders > 0 ? round($totalSpent / $salesOrders, 2) : 0.0;

        $repeatRate = 0.0;
        if ($activeCustomers > 0) {
            $repeatCount = Order::whereIn('customer_id', $activeCustomerIds)
                ->whereNotIn('order_status', $excludedStatuses)
                ->select('customer_id')
                ->groupBy('customer_id')
                ->havingRaw('COUNT(*) > 1')
                ->get()
                ->count();
            $repeatRate = round(($repeatCount / $activeCustomers) * 100, 1);
        }

        $topRows = $this->recognizedOrders()
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('customer_id')
            ->select('customer_id', DB::raw('SUM(total) AS total_spent'), DB::raw('COUNT(*) AS orders'), DB::raw('MAX(created_at) AS last_order'))
            ->groupBy('customer_id')
            ->orderByDesc('total_spent')
            ->take(20)
            ->get();
        $topUsers = User::whereIn('id', $topRows->pluck('customer_id'))->get(['id', 'name', 'email', 'phone'])->keyBy('id');
        $topCustomers = $topRows->map(fn ($row) => [
            'id' => (int) $row->customer_id,
            'name' => $topUsers->get($row->customer_id)?->name ?? 'Deleted customer',
            'email' => $topUsers->get($row->customer_id)?->email,
            'phone' => $topUsers->get($row->customer_id)?->phone,
            'total_spent' => (float) $row->total_spent,
            'orders' => (int) $row->orders,
            'last_order' => $row->last_order,
        ])->values();

        $customerGrowth = User::where('role', 'customer')
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('DATE_FORMAT(created_at, "%Y-%m-%d") AS date, COUNT(*) AS count')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => ['date' => $row->date, 'count' => (int) $row->count])
            ->values();

        $customerSegments = DB::table('users')
            ->leftJoin('orders', function ($join) use ($excludedStatuses) {
                $join->on('orders.customer_id', '=', 'users.id')
                    ->whereNull('orders.deleted_at')
                    ->whereNotIn('orders.order_status', $excludedStatuses);
            })
            ->where('users.role', 'customer')
            ->whereNull('users.deleted_at')
            ->select('users.id', DB::raw('COUNT(orders.id) AS order_count'))
            ->groupBy('users.id')
            ->get()
            ->groupBy(fn ($u) => match (true) {
                $u->order_count == 0 => 'No orders',
                $u->order_count == 1 => 'One order',
                $u->order_count <= 4 => '2–4 orders',
                default => '5+ orders',
            })
            ->map(fn ($group, $segment) => ['segment' => $segment, 'count' => $group->count()])
            ->values();

        return $this->success([
            'total_customers' => $totalCustomers,
            'active_customers' => $activeCustomers,
            'new_customers' => $newCustomers,
            'total_spent' => $totalSpent,
            'sales_orders' => $salesOrders,
            'average_order_value' => $averageOrderValue,
            'repeat_rate' => $repeatRate,
            'top_customers' => $topCustomers,
            'customer_growth' => $customerGrowth,
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

        [$from, $to] = $this->bounds($request->start_date, $request->end_date);
        $type = $request->get('type', 'all');
        $data = [];

        if ($type === 'all' || $type === 'service') {
            $data['top_services'] = DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->join('services', 'services.id', '=', 'order_items.service_id')
                ->whereIn('orders.payment_status', self::RECOGNIZED_PAYMENTS)
                ->whereNotNull('order_items.service_id')
                ->whereBetween('orders.created_at', [$from, $to])
                ->select(
                    'services.id',
                    'services.name',
                    DB::raw('COUNT(DISTINCT orders.id) AS order_count'),
                    DB::raw('SUM(order_items.quantity) AS total_quantity'),
                    DB::raw('SUM(order_items.total_price) AS total_revenue')
                )
                ->groupBy('services.id', 'services.name')
                ->orderByDesc('total_revenue')
                ->take(20)
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'name' => $row->name,
                    'order_count' => (int) $row->order_count,
                    'total_quantity' => (int) $row->total_quantity,
                    'total_revenue' => (float) $row->total_revenue,
                ])
                ->values();
        }

        if ($type === 'all' || $type === 'product') {
            $data['top_products'] = DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->join('products', 'products.id', '=', 'order_items.product_id')
                ->whereIn('orders.payment_status', self::RECOGNIZED_PAYMENTS)
                ->whereNotNull('order_items.product_id')
                ->whereBetween('orders.created_at', [$from, $to])
                ->select(
                    'products.id',
                    'products.name',
                    'products.sku',
                    DB::raw('COUNT(DISTINCT orders.id) AS order_count'),
                    DB::raw('SUM(order_items.quantity) AS total_quantity'),
                    DB::raw('SUM(order_items.total_price) AS total_revenue')
                )
                ->groupBy('products.id', 'products.name', 'products.sku')
                ->orderByDesc('total_revenue')
                ->take(20)
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'name' => $row->name,
                    'sku' => $row->sku,
                    'order_count' => (int) $row->order_count,
                    'total_quantity' => (int) $row->total_quantity,
                    'total_revenue' => (float) $row->total_revenue,
                ])
                ->values();

            $data['low_stock_products'] = Product::whereColumn('stock_qty', '<=', 'low_stock_threshold')
                ->where('is_active', true)
                ->where('always_in_stock', false)
                ->with('vendorProfile:id,business_name')
                ->orderBy('stock_qty')
                ->take(20)
                ->get();
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

        [$from, $to] = $this->bounds($request->start_date, $request->end_date);

        $stats = Review::approved()
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('
                COUNT(*) AS total_reviews,
                AVG(rating) AS average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS one_star
            ')
            ->first();

        $reviewTrend = Review::approved()
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('DATE_FORMAT(created_at, "%Y-%m-%d") AS date, COUNT(*) AS count, AVG(rating) AS avg_rating')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date' => $row->date,
                'count' => (int) $row->count,
                'avg_rating' => round((float) $row->avg_rating, 2),
            ])
            ->values();

        $topRatedVendors = VendorProfile::where('total_reviews', '>', 0)
            ->orderByDesc('rating')
            ->take(10)
            ->get(['id', 'business_name', 'rating as average_rating', 'total_reviews']);

        $lowestRatedVendors = VendorProfile::where('total_reviews', '>=', 3)
            ->where('rating', '<', 3)
            ->orderBy('rating')
            ->take(10)
            ->get(['id', 'business_name', 'rating as average_rating', 'total_reviews']);

        return $this->success([
            'summary' => [
                'total_reviews' => (int) $stats->total_reviews,
                'average_rating' => round((float) ($stats->average_rating ?? 0), 2),
                'pending_reviews' => Review::pending()->count(),
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

        [$from, $to] = $this->bounds($request->start_date, $request->end_date);
        $activeStatuses = ['open', 'in_progress', 'waiting_customer', 'waiting_vendor'];

        $stats = Ticket::whereBetween('created_at', [$from, $to])
            ->selectRaw('
                COUNT(*) AS total_tickets,
                SUM(CASE WHEN status IN ("open", "in_progress", "waiting_customer", "waiting_vendor") THEN 1 ELSE 0 END) AS active_tickets,
                SUM(CASE WHEN status = "resolved" THEN 1 ELSE 0 END) AS resolved_tickets,
                SUM(CASE WHEN status = "closed" THEN 1 ELSE 0 END) AS closed_tickets,
                SUM(CASE WHEN priority = "urgent" THEN 1 ELSE 0 END) AS urgent_tickets,
                SUM(CASE WHEN priority = "high" THEN 1 ELSE 0 END) AS high_priority_tickets
            ')
            ->first();

        $ticketTrend = Ticket::whereBetween('created_at', [$from, $to])
            ->selectRaw('DATE_FORMAT(created_at, "%Y-%m-%d") AS date, COUNT(*) AS count')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => ['date' => $row->date, 'count' => (int) $row->count])
            ->values();

        $avgResolutionHours = Ticket::whereBetween('created_at', [$from, $to])
            ->whereRaw('COALESCE(resolved_at, closed_at) IS NOT NULL')
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, COALESCE(resolved_at, closed_at))) AS avg_hours')
            ->value('avg_hours');

        $byPriority = Ticket::whereBetween('created_at', [$from, $to])
            ->select('priority', DB::raw('COUNT(*) AS count'))
            ->groupBy('priority')
            ->get()
            ->map(fn ($row) => ['priority' => $row->priority, 'count' => (int) $row->count])
            ->values();

        return $this->success([
            'summary' => [
                'total_tickets' => (int) $stats->total_tickets,
                'active_tickets' => (int) $stats->active_tickets,
                'resolved_tickets' => (int) $stats->resolved_tickets,
                'closed_tickets' => (int) $stats->closed_tickets,
                'urgent_tickets' => (int) $stats->urgent_tickets,
                'high_priority_tickets' => (int) $stats->high_priority_tickets,
                'avg_resolution_hours' => round((float) ($avgResolutionHours ?? 0), 1),
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

        [$from, $to] = $this->bounds($request->start_date, $request->end_date);

        $orders = Order::with(['customer', 'vendorProfile'])
            ->whereBetween('created_at', [$from, $to])
            ->orderBy('created_at')
            ->get();

        $csvData = [];
        $csvData[] = ['Order #', 'Date', 'Customer', 'Vendor', 'Status', 'Payment Status', 'Payment Method', 'Total', 'Counted as sale'];

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
                in_array($order->payment_status, self::RECOGNIZED_PAYMENTS, true) ? 'Yes' : 'No',
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

        [$from, $to] = $this->bounds($request->start_date, $request->end_date);
        $recognized = "'" . implode("','", self::RECOGNIZED_PAYMENTS) . "'";

        $orders = Order::with(['customer', 'vendorProfile'])
            ->whereBetween('created_at', [$from, $to])
            ->orderBy('created_at')
            ->get();

        $summary = Order::whereBetween('created_at', [$from, $to])
            ->selectRaw("
                COUNT(*) AS total_orders,
                COALESCE(SUM(CASE WHEN payment_status IN ({$recognized}) THEN total ELSE 0 END), 0) AS total_revenue,
                SUM(CASE WHEN payment_status IN ({$recognized}) THEN 1 ELSE 0 END) AS sales_orders
            ")
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
            ->withCount(['orders as sales_orders_count' => fn ($q) => $q->whereIn('payment_status', self::RECOGNIZED_PAYMENTS)])
            ->withSum(['orders as sales_total' => fn ($q) => $q->whereIn('payment_status', self::RECOGNIZED_PAYMENTS)], 'total')
            ->get();

        $csvData = [];
        $csvData[] = ['ID', 'Name', 'Email', 'Phone', 'Status', 'Sales orders', 'Total spent (recognized sales)', 'Joined'];

        foreach ($customers as $customer) {
            $csvData[] = [
                $customer->id,
                $customer->name,
                $customer->email,
                $customer->phone ?? 'N/A',
                $customer->status,
                $customer->sales_orders_count,
                $customer->sales_total ?? 0,
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
