<?php

use App\Http\Controllers\Api\AccountingController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CategoryAttributeController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\BranchLocationController;
use App\Http\Controllers\Api\ContactInquiryController;
use App\Http\Controllers\Api\GuestController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\InvestmentController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PublicController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\ServiceIntakeController;
use App\Http\Controllers\Api\SmsCampaignController;
use App\Http\Controllers\Api\SmsConnectionController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\QuotationController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\VendorController;
use App\Http\Controllers\Api\VendorDashboardController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group.
|
*/

// ============================================================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================================================

// Authentication
Route::prefix('auth')->group(function () {
    Route::post('/register/customer', [AuthController::class, 'registerCustomer']);
    Route::post('/register/vendor', [AuthController::class, 'registerVendor']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/resend-reset-otp', [AuthController::class, 'resendResetOtp']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::post('/verify-email', [AuthController::class, 'verifyEmail']);
    Route::post('/verify-phone', [AuthController::class, 'verifyPhone']);
    Route::post('/resend-otp', [AuthController::class, 'resendOtp']);
    Route::post('/resend-verification', [AuthController::class, 'resendVerification']);
    // Public, unauthenticated — captures a registration attempt in progress even if it never
    // completes (see AuthController::captureLead).
    Route::post('/capture-lead', [AuthController::class, 'captureLead']);
});

// Locations (Bangladesh administrative: divisions / districts / areas)
Route::prefix('locations')->group(function () {
    Route::get('/divisions', [LocationController::class, 'divisions']);
    Route::get('/districts', [LocationController::class, 'districts']);
    Route::get('/areas', [LocationController::class, 'areas']);
    Route::get('/divisions/{division}/districts', [LocationController::class, 'districts']);
    Route::get('/districts/{district}/areas', [LocationController::class, 'areas']);
    Route::get('/search', [LocationController::class, 'search']);
});

// Branch Locations (physical store / service center locations)
Route::prefix('branch-locations')->group(function () {
    Route::get('/', [BranchLocationController::class, 'index']);
    Route::get('/featured', [BranchLocationController::class, 'featured']);
    Route::get('/{id}', [BranchLocationController::class, 'show']);
});

// Categories
Route::prefix('categories')->group(function () {
    Route::get('/services', [CategoryController::class, 'serviceCategories']);
    Route::get('/services/tree', [CategoryController::class, 'serviceCategoriesWithChildren']);
    Route::get('/services/{id}', [CategoryController::class, 'serviceCategory']);
    Route::get('/products', [CategoryController::class, 'productCategories']);
    Route::get('/products/tree', [CategoryController::class, 'productCategoriesWithChildren']);
    Route::get('/products/{id}/filter-attributes', [CategoryAttributeController::class, 'filterAttributesForCategory']);
    Route::get('/products/{id}/form-attributes', [CategoryAttributeController::class, 'attributesForProductForm']);
    Route::get('/products/{id}', [CategoryController::class, 'productCategory']);
});

// Public Vendors
Route::prefix('vendors')->group(function () {
    Route::get('/', [VendorController::class, 'index']);
    Route::get('/search', [VendorController::class, 'search']);
    Route::get('/featured', [VendorController::class, 'featured']);
    Route::get('/nearby', [VendorController::class, 'nearby']);
    Route::get('/{id}', [VendorController::class, 'show']);
    Route::get('/{id}/services', [VendorController::class, 'services']);
    Route::get('/{id}/products', [VendorController::class, 'products']);
});

// Public Services
Route::prefix('services')->group(function () {
    Route::get('/', [ServiceController::class, 'index']);
    Route::get('/search', [ServiceController::class, 'search']);
    Route::get('/featured', [ServiceController::class, 'featured']);
    Route::get('/category/{categoryId}', [ServiceController::class, 'byCategory']);
    Route::get('/{id}', [ServiceController::class, 'show']);
});

// Public Products
Route::prefix('products')->group(function () {
    Route::get('/', [ProductController::class, 'index']);
    Route::get('/search', [ProductController::class, 'search']);
    Route::get('/featured', [ProductController::class, 'featured']);
    Route::get('/category/{categoryId}', [ProductController::class, 'byCategory']);
    Route::get('/{id}', [ProductController::class, 'show']);
    Route::get('/{id}/check-stock', [ProductController::class, 'checkStock']);
});

// Public Product Brands
Route::get('/product-brands', [ProductController::class, 'brands']);
Route::get('/product-brands/by-category/{categoryId}', [ProductController::class, 'brandsByCategory']);

// Public Reviews
Route::get('/vendors/{vendorId}/reviews', [ReviewController::class, 'vendorReviews']);
Route::post('/reviews/{id}/helpful', [ReviewController::class, 'markHelpful']);

// Contact form submission (public)
Route::post('/contact', [ContactInquiryController::class, 'store']);

// Public CMS
Route::prefix('public')->group(function () {
    Route::get('/home', [PublicController::class, 'homePage']);
    Route::get('/data-recovery', [PublicController::class, 'dataRecoveryPage']);
    Route::get('/about', [PublicController::class, 'aboutPage']);
    Route::get('/contact', [PublicController::class, 'contactPage']);
    Route::get('/pages/{slug}', [PublicController::class, 'cmsPage']);
    Route::get('/banners', [PublicController::class, 'banners']);
    Route::get('/faqs', [PublicController::class, 'faqs']);
    Route::get('/faq-categories', [PublicController::class, 'faqCategories']);
    Route::get('/settings', [PublicController::class, 'settings']);
    Route::get('/settings/{key}', [PublicController::class, 'setting']);
});

// ============================================================================
// GUEST ROUTES (No Authentication Required — identified by session_id)
// ============================================================================

Route::prefix('guest')->group(function () {
    // Guest Cart
    Route::get('/cart', [GuestController::class, 'getCart']);
    Route::post('/cart/items', [GuestController::class, 'addItem']);
    Route::put('/cart/items/{itemId}', [GuestController::class, 'updateItem']);
    Route::delete('/cart/items/{itemId}', [GuestController::class, 'removeItem']);
    Route::delete('/cart', [GuestController::class, 'clearCart']);

    // Guest Orders
    Route::post('/orders', [GuestController::class, 'placeOrder']);
    Route::post('/orders/service', [GuestController::class, 'placeServiceOrder']);
    Route::get('/orders/session', [GuestController::class, 'getSessionOrders']);
    Route::get('/orders/track/{orderNumber}', [GuestController::class, 'trackOrder']);

    // Guest Invoice (by order_number param)
    Route::get('/invoice/download', [InvoiceController::class, 'guestDownload']);
    // Guest Service Receipt (by order_number param)
    Route::get('/service-receipt/download', [ServiceIntakeController::class, 'guestReceiptDownload']);
});

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

Route::middleware(['auth:sanctum'])->group(function () {
    // Auth (Authenticated)
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::put('/change-password', [AuthController::class, 'changePassword']);
    });

    // Merge guest cart after login
    Route::post('/guest/cart/merge', [GuestController::class, 'mergeCart']);
    // Notifications
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::put('/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::put('/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::delete('/{id}', [NotificationController::class, 'destroy']);
        Route::delete('/', [NotificationController::class, 'destroyAll']);
    });

    // ========================================================================
    // CUSTOMER ROUTES
    // ========================================================================

    Route::middleware(['role:customer'])->group(function () {
        // Cart
        Route::prefix('cart')->group(function () {
            Route::get('/', [CartController::class, 'index']);
            Route::post('/items', [CartController::class, 'addItem']);
            Route::put('/items/{itemId}', [CartController::class, 'updateItem']);
            Route::delete('/items/{itemId}', [CartController::class, 'removeItem']);
            Route::delete('/', [CartController::class, 'clear']);
            Route::post('/items/{itemId}/save-later', [CartController::class, 'saveForLater']);
            Route::post('/items/{itemId}/move-to-cart', [CartController::class, 'moveToCart']);
            Route::get('/saved', [CartController::class, 'savedItems']);
        });

        // Orders (Customer)
        Route::prefix('orders')->group(function () {
            Route::get('/', [OrderController::class, 'index']);
            Route::post('/', [OrderController::class, 'checkout']);
            Route::post('/service', [OrderController::class, 'placeServiceOrder']);
            Route::get('/{id}', [OrderController::class, 'show']);
            Route::post('/{id}/cancel', [OrderController::class, 'cancel']);
            Route::post('/{id}/payment-proof', [OrderController::class, 'submitPaymentProof']);
            // Service receipt (available before the price is confirmed)
            Route::get('/{id}/receipt/download', [ServiceIntakeController::class, 'customerReceiptDownload']);
            Route::get('/{id}/receipt/stream', [ServiceIntakeController::class, 'customerReceiptStream']);
        });

        // Customer Invoices
        Route::prefix('invoices')->group(function () {
            Route::get('/{id}/download', [InvoiceController::class, 'download']);
            Route::get('/{id}/stream', [InvoiceController::class, 'stream']);
            Route::post('/{id}/send', [InvoiceController::class, 'sendEmail']);
            Route::get('/{id}/money-receipt/download', [InvoiceController::class, 'moneyReceiptDownload']);
            Route::get('/{id}/money-receipt/stream', [InvoiceController::class, 'moneyReceiptStream']);
            Route::get('/{id}/delivery-chalan/download', [InvoiceController::class, 'deliveryChalanDownload']);
            Route::get('/{id}/delivery-chalan/stream', [InvoiceController::class, 'deliveryChalanStream']);
        });

        // Reviews (Customer)
        Route::prefix('reviews')->group(function () {
            Route::get('/', [ReviewController::class, 'index']);
            Route::post('/', [ReviewController::class, 'store']);
            Route::put('/{id}', [ReviewController::class, 'update']);
            Route::delete('/{id}', [ReviewController::class, 'destroy']);
        });

        // Tickets (Customer)
        Route::prefix('tickets')->group(function () {
            Route::get('/', [TicketController::class, 'index']);
            Route::post('/', [TicketController::class, 'store']);
            Route::get('/{id}', [TicketController::class, 'show']);
            Route::post('/{id}/messages', [TicketController::class, 'addMessage']);
            Route::post('/{id}/close', [TicketController::class, 'close']);
        });
    });

    // ========================================================================
    // VENDOR ROUTES
    // ========================================================================

    Route::middleware(['role:vendor,admin,super_admin', 'vendor.approved'])->prefix('vendor')->group(function () {
        // Dashboard
        Route::get('/dashboard', [VendorDashboardController::class, 'dashboard']);

        // Profile
        Route::put('/profile', [VendorDashboardController::class, 'updateProfile']);

        // Service Areas
        Route::get('/service-areas', [VendorDashboardController::class, 'serviceAreas']);
        Route::post('/service-areas', [VendorDashboardController::class, 'addServiceArea']);
        Route::delete('/service-areas/{id}', [VendorDashboardController::class, 'removeServiceArea']);

        // Services
        Route::prefix('services')->group(function () {
            Route::get('/', [VendorDashboardController::class, 'services']);
            Route::post('/', [VendorDashboardController::class, 'createService']);
            Route::put('/{id}', [VendorDashboardController::class, 'updateService']);
            Route::delete('/{id}', [VendorDashboardController::class, 'deleteService']);
        });

        // Products
        Route::prefix('products')->group(function () {
            Route::get('/', [VendorDashboardController::class, 'products']);
            Route::post('/', [VendorDashboardController::class, 'createProduct']);
            Route::put('/{id}', [VendorDashboardController::class, 'updateProduct']);
            Route::delete('/{id}', [VendorDashboardController::class, 'deleteProduct']);
            Route::post('/{id}/stock', [VendorDashboardController::class, 'updateStock']);
        });

        // Inventory
        Route::get('/inventory-logs', [VendorDashboardController::class, 'inventoryLogs']);

        // Orders
        Route::prefix('orders')->group(function () {
            Route::get('/', [VendorDashboardController::class, 'orders']);
            Route::put('/{id}/status', [VendorDashboardController::class, 'updateOrderStatus']);
            Route::post('/{id}/confirm-payment', [VendorDashboardController::class, 'confirmPayment']);
        });

        // Payment Notices
        Route::prefix('payment-notices')->group(function () {
            Route::get('/', [VendorDashboardController::class, 'paymentNotices']);
            Route::put('/{id}/verify', [VendorDashboardController::class, 'verifyPaymentNotice']);
        });

        // Reviews (Vendor response)
        Route::post('/reviews/{id}/respond', [ReviewController::class, 'respond']);

        // Tickets (Vendor)
        Route::prefix('tickets')->group(function () {
            Route::get('/', [TicketController::class, 'index']);
            Route::get('/{id}', [TicketController::class, 'show']);
            Route::post('/{id}/messages', [TicketController::class, 'addMessage']);
            Route::post('/{id}/close', [TicketController::class, 'close']);
        });

        // Reports
        Route::prefix('reports')->group(function () {
            Route::get('/sales', [ReportController::class, 'vendorSalesReport']);
        });

        // Earnings & Payouts
        Route::get('/earnings', [VendorDashboardController::class, 'earnings']);
        Route::get('/payouts', [VendorDashboardController::class, 'payouts']);
        Route::get('/payouts/stats', [VendorDashboardController::class, 'payoutStats']);
        Route::post('/payouts/request', [VendorDashboardController::class, 'requestPayout']);
    });

    // ========================================================================
    // ADMIN ROUTES
    // ========================================================================

    Route::middleware(['role:admin,staff,super_admin'])->prefix('admin')->group(function () {
        // Dashboard
        Route::get('/dashboard', [AdminController::class, 'dashboard']);
        Route::get('/dashboard/trends', [AdminController::class, 'dashboardWithTrends']);

        // User Management — fine-grained permission on top of the coarse admin-tier gate above.
        // manage_users stays as a full-module master key (unchanged); each mutation additionally
        // gets its own specific permission so a role can be granted just one of these.
        Route::prefix('users')->group(function () {
            Route::get('/', [AdminController::class, 'users']);
            Route::get('/{id}', [AdminController::class, 'userShow']);

            Route::post('/', [AdminController::class, 'userStore'])->middleware('permission:manage_users,create_users');
            Route::put('/{id}', [AdminController::class, 'userUpdate'])->middleware('permission:manage_users,edit_users');
            Route::delete('/{id}', [AdminController::class, 'userDelete'])->middleware('permission:manage_users,delete_users');
            Route::put('/{id}/status', [AdminController::class, 'userUpdateStatus'])->middleware('permission:manage_users,update_user_status');
            Route::put('/{id}/reset-password', [AdminController::class, 'userResetPassword'])->middleware('permission:manage_users,reset_user_password');
            Route::delete('/{id}/force', [AdminController::class, 'userForceDelete'])->middleware('role:super_admin');
        });

        // Vendor Management — old 3-way OR kept valid everywhere (zero regression); reject/suspend
        // additionally get their own specific permission.
        Route::prefix('vendors')->group(function () {
            Route::get('/', [AdminController::class, 'vendors'])->middleware('permission:view_vendors,manage_vendors,approve_vendors');
            Route::get('/{id}', [AdminController::class, 'vendorShow'])->middleware('permission:view_vendors,manage_vendors,approve_vendors');
            Route::post('/{id}/approve', [AdminController::class, 'vendorApprove'])->middleware('permission:view_vendors,manage_vendors,approve_vendors');
            Route::post('/{id}/reject', [AdminController::class, 'vendorReject'])->middleware('permission:view_vendors,manage_vendors,approve_vendors,reject_vendors');
            Route::post('/{id}/suspend', [AdminController::class, 'vendorSuspend'])->middleware('permission:view_vendors,manage_vendors,approve_vendors,suspend_vendors');
        });

        // Order Management (Enhanced) — old 3-way OR kept valid everywhere; refund and
        // correct-payment additionally get their own specific permission (correct-payment's
        // in-method super_admin check also now accepts this permission, see AdminController).
        Route::prefix('orders')->group(function () {
            Route::get('/', [AdminController::class, 'orders'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::post('/', [AdminController::class, 'orderCreate'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::get('/export', [AdminController::class, 'orderExport'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::get('/{id}', [AdminController::class, 'orderShow'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::put('/{id}', [AdminController::class, 'orderUpdate'])->middleware('permission:view_orders,manage_orders,process_orders,amend_paid_orders');
            Route::put('/{id}/status', [AdminController::class, 'orderUpdateStatus'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::post('/{id}/send-delivered-sms', [AdminController::class, 'orderSendDeliveredSms'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::post('/{id}/send-status-sms', [AdminController::class, 'orderSendStatusSms'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::post('/{id}/send-due-sms', [AdminController::class, 'orderSendDueSms'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::get('/{id}/sms-preview', [AdminController::class, 'orderPreviewSms'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::post('/{id}/refund', [AdminController::class, 'orderRefund'])->middleware('permission:view_orders,manage_orders,process_orders,refund_orders');
            Route::post('/{id}/record-payment', [AdminController::class, 'orderRecordPayment'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::post('/{id}/correct-payment', [AdminController::class, 'orderCorrectPayment'])->middleware('permission:view_orders,manage_orders,process_orders,correct_payment_amounts');
        });

        // Admin Invoice Management — custom-invoice creation additionally gets its own permission
        // (its in-method super_admin check also now accepts this permission, see InvoiceController).
        Route::prefix('invoices')->group(function () {
            Route::get('/{id}/download', [InvoiceController::class, 'download'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::get('/{id}/stream', [InvoiceController::class, 'stream'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::post('/{id}/send', [InvoiceController::class, 'sendEmail'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::get('/{id}/money-receipt/download', [InvoiceController::class, 'moneyReceiptDownload'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::get('/{id}/money-receipt/stream', [InvoiceController::class, 'moneyReceiptStream'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::get('/{id}/delivery-chalan/download', [InvoiceController::class, 'deliveryChalanDownload'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::get('/{id}/delivery-chalan/stream', [InvoiceController::class, 'deliveryChalanStream'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::get('/custom/{id}/download', [InvoiceController::class, 'customDownload'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::get('/{orderId}/custom', [InvoiceController::class, 'customIndex'])->middleware('permission:view_orders,manage_orders,process_orders');
            Route::post('/{orderId}/custom', [InvoiceController::class, 'customStore'])->middleware('permission:view_orders,manage_orders,process_orders,create_custom_invoices');
            Route::post('/custom/{id}/send-sms', [InvoiceController::class, 'customSendSms'])->middleware('permission:view_orders,manage_orders,process_orders,create_custom_invoices');
            Route::get('/custom/{id}/sms-preview', [InvoiceController::class, 'customPreviewSms'])->middleware('permission:view_orders,manage_orders,process_orders,create_custom_invoices');
        });

        // Quotations — a pre-sale offer, deliberately never tied to an Order (see CustomInvoice
        // above for the order-tied equivalent). Read routes accept either permission; writes
        // require manage_quotations specifically.
        Route::prefix('quotations')->group(function () {
            Route::get('/', [QuotationController::class, 'index'])->middleware('permission:view_quotations,manage_quotations');
            Route::get('/search-products', [QuotationController::class, 'searchProducts'])->middleware('permission:view_quotations,manage_quotations');
            Route::get('/{id}', [QuotationController::class, 'show'])->middleware('permission:view_quotations,manage_quotations');
            Route::get('/{id}/download', [QuotationController::class, 'download'])->middleware('permission:view_quotations,manage_quotations');
            Route::get('/{id}/stream', [QuotationController::class, 'stream'])->middleware('permission:view_quotations,manage_quotations');
            Route::post('/', [QuotationController::class, 'store'])->middleware('permission:manage_quotations');
            Route::put('/{id}', [QuotationController::class, 'update'])->middleware('permission:manage_quotations');
            Route::put('/{id}/status', [QuotationController::class, 'updateStatus'])->middleware('permission:manage_quotations');
            Route::delete('/{id}', [QuotationController::class, 'destroy'])->middleware('permission:manage_quotations');
        });

        // Service Intakes (device received → receipt → convert to order) — old 5-way OR kept
        // valid everywhere; convert and confirm-price additionally get their own permission.
        Route::prefix('service-intakes')->group(function () {
            Route::get('/', [ServiceIntakeController::class, 'index'])->middleware('permission:view_orders,manage_orders,process_orders,view_service_intakes,manage_service_intakes');
            Route::post('/', [ServiceIntakeController::class, 'store'])->middleware('permission:view_orders,manage_orders,process_orders,view_service_intakes,manage_service_intakes');
            Route::get('/{id}', [ServiceIntakeController::class, 'show'])->middleware('permission:view_orders,manage_orders,process_orders,view_service_intakes,manage_service_intakes');
            Route::put('/{id}', [ServiceIntakeController::class, 'update'])->middleware('permission:view_orders,manage_orders,process_orders,view_service_intakes,manage_service_intakes');
            Route::delete('/{id}', [ServiceIntakeController::class, 'destroy'])->middleware('permission:view_orders,manage_orders,process_orders,view_service_intakes,manage_service_intakes');
            Route::put('/{id}/status', [ServiceIntakeController::class, 'updateStatus'])->middleware('permission:view_orders,manage_orders,process_orders,view_service_intakes,manage_service_intakes');
            Route::post('/{id}/convert', [ServiceIntakeController::class, 'convertToOrder'])->middleware('permission:view_orders,manage_orders,process_orders,view_service_intakes,manage_service_intakes,convert_service_intakes');
            Route::post('/{id}/confirm-price', [ServiceIntakeController::class, 'confirmPrice'])->middleware('permission:view_orders,manage_orders,process_orders,view_service_intakes,manage_service_intakes,confirm_service_intake_price');
            Route::get('/{id}/receipt/download', [ServiceIntakeController::class, 'downloadReceipt'])->middleware('permission:view_orders,manage_orders,process_orders,view_service_intakes,manage_service_intakes');
            Route::get('/{id}/receipt/stream', [ServiceIntakeController::class, 'streamReceipt'])->middleware('permission:view_orders,manage_orders,process_orders,view_service_intakes,manage_service_intakes');
        });

        // Customer Management — old 2-way OR kept valid everywhere; edit/delete additionally get
        // their own specific permission (reusing the Users module's new permission names).
        Route::prefix('customers')->group(function () {
            Route::get('/', [AdminController::class, 'customers'])->middleware('permission:view_users,manage_users');
            Route::get('/{id}', [AdminController::class, 'customerShow'])->middleware('permission:view_users,manage_users');
            Route::put('/{id}', [AdminController::class, 'customerUpdate'])->middleware('permission:view_users,manage_users,edit_users');
            Route::delete('/{id}', [AdminController::class, 'customerDelete'])->middleware('permission:view_users,manage_users,delete_users');
        });

        // Service Categories (Admin CRUD) — manage_categories stays as master key; read and
        // reorder additionally get their own specific permission.
        Route::prefix('service-categories')->group(function () {
            Route::get('/', [CategoryController::class, 'adminServiceCategories'])->middleware('permission:manage_categories,view_categories');
            Route::post('/', [CategoryController::class, 'storeServiceCategory'])->middleware('permission:manage_categories');
            Route::post('/reorder', [CategoryController::class, 'reorderServiceCategories'])->middleware('permission:manage_categories,reorder_categories');
            Route::get('/{id}', [CategoryController::class, 'adminServiceCategoryShow'])->middleware('permission:manage_categories,view_categories');
            Route::put('/{id}', [CategoryController::class, 'updateServiceCategory'])->middleware('permission:manage_categories');
            Route::delete('/{id}', [CategoryController::class, 'deleteServiceCategory'])->middleware('permission:manage_categories');
        });

        // Product Categories (Admin CRUD) — same pattern as Service Categories.
        Route::prefix('product-categories')->group(function () {
            Route::get('/', [CategoryController::class, 'adminProductCategories'])->middleware('permission:manage_categories,view_categories');
            Route::post('/', [CategoryController::class, 'storeProductCategory'])->middleware('permission:manage_categories');
            Route::post('/reorder', [CategoryController::class, 'reorderProductCategories'])->middleware('permission:manage_categories,reorder_categories');
            Route::get('/{id}', [CategoryController::class, 'adminProductCategoryShow'])->middleware('permission:manage_categories,view_categories');
            Route::put('/{id}', [CategoryController::class, 'updateProductCategory'])->middleware('permission:manage_categories');
            Route::delete('/{id}', [CategoryController::class, 'deleteProductCategory'])->middleware('permission:manage_categories');
        });

        // Category Attributes (Admin CRUD) — read additionally gets its own specific permission;
        // value add/sync stay under manage_categories only.
        Route::prefix('category-attributes')->group(function () {
            Route::get('/', [CategoryAttributeController::class, 'index'])->middleware('permission:manage_categories,view_categories');
            Route::post('/', [CategoryAttributeController::class, 'store'])->middleware('permission:manage_categories');
            Route::get('/{id}', [CategoryAttributeController::class, 'show'])->middleware('permission:manage_categories,view_categories');
            Route::put('/{id}', [CategoryAttributeController::class, 'update'])->middleware('permission:manage_categories');
            Route::delete('/{id}', [CategoryAttributeController::class, 'destroy'])->middleware('permission:manage_categories');
            Route::post('/{id}/values', [CategoryAttributeController::class, 'storeValue'])->middleware('permission:manage_categories');
            Route::post('/{id}/values/sync', [CategoryAttributeController::class, 'bulkSyncValues'])->middleware('permission:manage_categories');
        });

        Route::middleware(['permission:manage_categories'])->prefix('attribute-values')->group(function () {
            Route::put('/{id}', [CategoryAttributeController::class, 'updateValue']);
            Route::delete('/{id}', [CategoryAttributeController::class, 'destroyValue']);
        });

        // Branch Locations (Admin CRUD) — old 3-way OR kept valid everywhere; additionally gets
        // its own specific permission.
        Route::middleware(['permission:manage_cms,manage_banners,manage_faqs,manage_branch_locations'])->prefix('branch-locations')->group(function () {
            Route::get('/', [BranchLocationController::class, 'adminIndex']);
            Route::post('/', [BranchLocationController::class, 'store']);
            Route::put('/{id}', [BranchLocationController::class, 'update']);
            Route::delete('/{id}', [BranchLocationController::class, 'destroy']);
        });

        // Contact Inquiries (Admin) — same treatment as Branch Locations.
        Route::middleware(['permission:manage_cms,manage_banners,manage_faqs,manage_contact_inquiries'])->prefix('contact-inquiries')->group(function () {
            Route::get('/', [ContactInquiryController::class, 'adminIndex']);
            Route::get('/{id}', [ContactInquiryController::class, 'adminShow']);
            Route::put('/{id}', [ContactInquiryController::class, 'adminUpdate']);
            Route::delete('/{id}', [ContactInquiryController::class, 'adminDelete']);
        });

        // Locations (Admin CRUD) — manage_locations stays as master key; split additionally by
        // entity so a role can be granted just divisions, just districts, or just areas.
        Route::prefix('locations')->group(function () {
            // Divisions
            Route::post('/divisions', [LocationController::class, 'storeDivision'])->middleware('permission:manage_locations,manage_divisions');
            Route::put('/divisions/{id}', [LocationController::class, 'updateDivision'])->middleware('permission:manage_locations,manage_divisions');
            Route::delete('/divisions/{id}', [LocationController::class, 'deleteDivision'])->middleware('permission:manage_locations,manage_divisions');

            // Districts
            Route::post('/districts', [LocationController::class, 'storeDistrict'])->middleware('permission:manage_locations,manage_districts');
            Route::put('/districts/{id}', [LocationController::class, 'updateDistrict'])->middleware('permission:manage_locations,manage_districts');
            Route::delete('/districts/{id}', [LocationController::class, 'deleteDistrict'])->middleware('permission:manage_locations,manage_districts');

            // Areas
            Route::post('/areas', [LocationController::class, 'storeArea'])->middleware('permission:manage_locations,manage_areas');
            Route::put('/areas/{id}', [LocationController::class, 'updateArea'])->middleware('permission:manage_locations,manage_areas');
            Route::delete('/areas/{id}', [LocationController::class, 'deleteArea'])->middleware('permission:manage_locations,manage_areas');
        });

        // Tickets (Enhanced) — old 2-way OR kept valid everywhere; reply/assign/close/delete
        // additionally get their own specific permission.
        Route::prefix('tickets')->group(function () {
            Route::get('/', [AdminController::class, 'tickets'])->middleware('permission:manage_tickets,respond_tickets');
            Route::get('/{id}', [TicketController::class, 'show'])->middleware('permission:manage_tickets,respond_tickets');
            Route::put('/{id}', [AdminController::class, 'ticketUpdate'])->middleware('permission:manage_tickets,respond_tickets');
            Route::post('/{id}/reply', [AdminController::class, 'ticketReply'])->middleware('permission:manage_tickets,respond_tickets,reply_tickets');
            Route::post('/{id}/messages', [TicketController::class, 'addMessage'])->middleware('permission:manage_tickets,respond_tickets,reply_tickets');
            Route::post('/{id}/assign', [AdminController::class, 'ticketAssign'])->middleware('permission:manage_tickets,respond_tickets,assign_tickets');
            Route::post('/{id}/close', [TicketController::class, 'close'])->middleware('permission:manage_tickets,respond_tickets,close_tickets');
            Route::delete('/{id}', [AdminController::class, 'ticketDelete'])->middleware('permission:manage_tickets,respond_tickets,delete_tickets');
        });

        // Reviews — old 2-way OR kept valid everywhere; moderate/delete additionally get their
        // own specific permission.
        Route::prefix('reviews')->group(function () {
            Route::get('/', [AdminController::class, 'reviews'])->middleware('permission:manage_reviews,respond_reviews');
            Route::put('/{id}/moderate', [AdminController::class, 'reviewModerate'])->middleware('permission:manage_reviews,respond_reviews,moderate_reviews');
            Route::delete('/{id}', [AdminController::class, 'reviewDelete'])->middleware('permission:manage_reviews,respond_reviews,delete_reviews');
        });

        // Payments Management — already adequately granular (view_payments for read,
        // manage_payments for the one write route), left unchanged.
        Route::middleware(['permission:view_orders,manage_orders,process_orders,view_payments,manage_payments'])->prefix('payments')->group(function () {
            Route::get('/', [AdminController::class, 'payments']);
            Route::put('/{id}', [AdminController::class, 'paymentUpdate']);
        });

        // Payment Notices (Admin) — same as Payments, unchanged.
        Route::middleware(['permission:view_orders,manage_orders,process_orders,view_payments,manage_payments'])->prefix('payment-notices')->group(function () {
            Route::get('/', [AdminController::class, 'paymentNotices']);
            Route::put('/{id}', [AdminController::class, 'paymentNoticeUpdate']);
        });

        // CMS Pages — old 3-way OR kept valid everywhere; additionally gets its own specific
        // permission (manage_banners/manage_faqs were already specific enough to their own
        // modules below, so only Pages/Branch-Locations/Contact-Inquiries needed a new name).
        Route::middleware(['permission:manage_cms,manage_banners,manage_faqs,manage_cms_pages'])->prefix('cms-pages')->group(function () {
            Route::get('/', [AdminController::class, 'cmsPages']);
            Route::post('/', [AdminController::class, 'cmsPageStore']);
            Route::get('/{id}', [AdminController::class, 'cmsPageShow']);
            Route::put('/{id}', [AdminController::class, 'cmsPageUpdate']);
            Route::delete('/{id}', [AdminController::class, 'cmsPageDestroy']);
        });

        // Banners — manage_banners is already specific to this module; unchanged.
        Route::middleware(['permission:manage_cms,manage_banners,manage_faqs'])->prefix('banners')->group(function () {
            Route::get('/', [AdminController::class, 'banners']);
            Route::post('/', [AdminController::class, 'bannerStore']);
            Route::put('/{id}', [AdminController::class, 'bannerUpdate']);
            Route::delete('/{id}', [AdminController::class, 'bannerDestroy']);
        });

        // FAQs — manage_faqs is already specific to this module; unchanged.
        Route::middleware(['permission:manage_cms,manage_banners,manage_faqs'])->prefix('faqs')->group(function () {
            Route::get('/', [AdminController::class, 'faqs']);
            Route::post('/', [AdminController::class, 'faqStore']);
            Route::put('/{id}', [AdminController::class, 'faqUpdate']);
            Route::delete('/{id}', [AdminController::class, 'faqDestroy']);
        });

        // Site Settings (Enhanced) — manage_settings stays as master key; regenerating API keys
        // additionally gets its own specific permission (materially more sensitive than editing
        // general settings, previously gated identically).
        Route::prefix('settings')->group(function () {
            Route::get('/', [AdminController::class, 'settings'])->middleware('permission:manage_settings');
            Route::put('/', [AdminController::class, 'settingsUpdate'])->middleware('permission:manage_settings');
            Route::post('/api-keys/regenerate', [AdminController::class, 'settingsRegenerateApiKey'])->middleware('permission:manage_settings,regenerate_api_keys');
        });

        // SMS — Settings > SMS tab only builds/tests connections (below); which connection each
        // purpose (OTP, order updates, campaigns) actually uses, plus message templates, is
        // configured on the dedicated SMS Center page instead (same permission either way).
        Route::prefix('sms')->middleware('permission:manage_settings')->group(function () {
            Route::get('/connections', [SmsConnectionController::class, 'index']);
            Route::post('/connections', [SmsConnectionController::class, 'store']);
            Route::put('/connections/{id}', [SmsConnectionController::class, 'update']);
            Route::delete('/connections/{id}', [SmsConnectionController::class, 'destroy']);
            Route::post('/connections/test', [SmsConnectionController::class, 'test']);
            Route::get('/connections/{id}/balance', [SmsConnectionController::class, 'balance']);
            Route::get('/logs', [SmsConnectionController::class, 'logs']);
            Route::get('/usage', [SmsConnectionController::class, 'usage']);

            Route::get('/campaigns', [SmsCampaignController::class, 'index']);
            Route::post('/campaigns', [SmsCampaignController::class, 'store']);
            Route::get('/campaigns/recipients-count', [SmsCampaignController::class, 'recipientsCount']);
        });

        // Products Management (Admin) — manage_products stays as a full-module master key on
        // every route. create/edit/delete_products and manage_inventory now actually mean only
        // their own action (previously bundled into one OR covering all 9 routes, so e.g.
        // edit_products alone could also delete — a real gap this closes); view/toggle-status/
        // toggle-featured are newly-added permissions where none existed before.
        Route::prefix('products')->group(function () {
            Route::get('/', [AdminController::class, 'adminProducts'])->middleware('permission:manage_products,view_products');
            Route::get('/stats', [AdminController::class, 'adminProductStats'])->middleware('permission:manage_products,view_products');
            Route::get('/spec-suggestions', [AdminController::class, 'adminProductSpecSuggestions'])->middleware('permission:manage_products,view_products');
            Route::post('/', [AdminController::class, 'adminProductStore'])->middleware('permission:manage_products,create_products');
            Route::get('/{id}', [AdminController::class, 'adminProductShow'])->middleware('permission:manage_products,view_products');
            Route::put('/{id}', [AdminController::class, 'adminProductUpdate'])->middleware('permission:manage_products,edit_products,manage_inventory');
            Route::delete('/{id}', [AdminController::class, 'adminProductDelete'])->middleware('permission:manage_products,delete_products');
            Route::put('/{id}/toggle-status', [AdminController::class, 'adminProductToggleStatus'])->middleware('permission:manage_products,toggle_product_status');
            Route::put('/{id}/toggle-featured', [AdminController::class, 'adminProductToggleFeatured'])->middleware('permission:manage_products,toggle_product_featured');
            Route::get('/{id}/serials', [AdminController::class, 'adminProductSerials'])->middleware('permission:manage_products,view_products,manage_inventory');
            Route::post('/{id}/serials', [AdminController::class, 'adminProductAddSerials'])->middleware('permission:manage_products,edit_products,manage_inventory');
        });

        // Product Brands Management (Admin) — grouped under "Categories" in the sidebar; read
        // additionally gets its own specific permission.
        Route::prefix('product-brands')->group(function () {
            Route::get('/', [AdminController::class, 'adminProductBrands'])->middleware('permission:manage_categories,view_categories');
            Route::post('/', [AdminController::class, 'adminProductBrandStore'])->middleware('permission:manage_categories');
            Route::get('/{id}', [AdminController::class, 'adminProductBrandShow'])->middleware('permission:manage_categories,view_categories');
            Route::put('/{id}', [AdminController::class, 'adminProductBrandUpdate'])->middleware('permission:manage_categories');
            Route::delete('/{id}', [AdminController::class, 'adminProductBrandDelete'])->middleware('permission:manage_categories');
            Route::put('/{id}/toggle-status', [AdminController::class, 'adminProductBrandToggleStatus'])->middleware('permission:manage_categories');
        });

        // Services Management (Admin) — same treatment as Products.
        Route::prefix('services')->group(function () {
            Route::get('/', [AdminController::class, 'adminServices'])->middleware('permission:manage_services,view_services');
            Route::post('/', [AdminController::class, 'adminServiceStore'])->middleware('permission:manage_services,create_services');
            Route::put('/{id}', [AdminController::class, 'adminServiceUpdate'])->middleware('permission:manage_services,edit_services');
            Route::delete('/{id}', [AdminController::class, 'adminServiceDelete'])->middleware('permission:manage_services,delete_services');
            Route::put('/{id}/toggle-status', [AdminController::class, 'adminServiceToggleStatus'])->middleware('permission:manage_services,toggle_service_status');
        });

        // Admin Notifications — view_notifications stays read-only (list only); mutating actions
        // now require manage_notifications (previously view_notifications alone also granted
        // mark-read/delete, a real gap this closes).
        Route::prefix('notifications')->group(function () {
            Route::get('/', [AdminController::class, 'adminNotifications'])->middleware('permission:view_notifications,manage_notifications');
            Route::put('/{id}/read', [AdminController::class, 'adminNotificationMarkRead'])->middleware('permission:manage_notifications');
            Route::put('/read-all', [AdminController::class, 'adminNotificationMarkAllRead'])->middleware('permission:manage_notifications');
            Route::delete('/{id}', [AdminController::class, 'adminNotificationDelete'])->middleware('permission:manage_notifications');
        });

        // Reports — old 2-way OR kept valid everywhere on every route; each report view
        // additionally gets its own specific permission so e.g. sales figures can be shared
        // without also exposing customer/vendor reports.
        Route::prefix('reports')->group(function () {
            Route::get('/sales', [ReportController::class, 'salesReport'])->middleware('permission:view_reports,export_reports,view_sales_reports');
            Route::get('/vendors', [ReportController::class, 'vendorReport'])->middleware('permission:view_reports,export_reports,view_vendor_reports');
            Route::get('/customers', [ReportController::class, 'customerReport'])->middleware('permission:view_reports,export_reports,view_customer_reports');
            Route::get('/catalog', [ReportController::class, 'catalogReport'])->middleware('permission:view_reports,export_reports,view_catalog_reports');
            Route::get('/reviews', [ReportController::class, 'reviewReport'])->middleware('permission:view_reports,export_reports,view_review_reports');
            Route::get('/tickets', [ReportController::class, 'ticketReport'])->middleware('permission:view_reports,export_reports,view_ticket_reports');

            // Exports
            Route::get('/export/sales/csv', [ReportController::class, 'exportSalesCSV'])->middleware('permission:view_reports,export_reports');
            Route::get('/export/sales/pdf', [ReportController::class, 'exportSalesPDF'])->middleware('permission:view_reports,export_reports');
            Route::get('/export/vendors/csv', [ReportController::class, 'exportVendorsCSV'])->middleware('permission:view_reports,export_reports');
            Route::get('/export/customers/csv', [ReportController::class, 'exportCustomersCSV'])->middleware('permission:view_reports,export_reports');
        });

        // Expense Categories — old 2-way OR kept valid everywhere; each action additionally gets
        // its own specific permission (previously view_ledger — nominally read-only — also
        // granted create/edit/delete of expenses, a real gap this closes).
        Route::prefix('expense-categories')->group(function () {
            Route::get('/', [ExpenseController::class, 'categoryIndex'])->middleware('permission:manage_accounts,view_ledger,view_expenses');
            Route::post('/', [ExpenseController::class, 'categoryStore'])->middleware('permission:manage_accounts,create_expenses');
            Route::get('/{id}', [ExpenseController::class, 'categoryShow'])->middleware('permission:manage_accounts,view_ledger,view_expenses');
            Route::put('/{id}', [ExpenseController::class, 'categoryUpdate'])->middleware('permission:manage_accounts,edit_expenses');
            Route::delete('/{id}', [ExpenseController::class, 'categoryDestroy'])->middleware('permission:manage_accounts,delete_expenses');
        });

        // Expenses — same treatment as Expense Categories.
        Route::prefix('expenses')->group(function () {
            Route::get('/report', [ExpenseController::class, 'report'])->middleware('permission:manage_accounts,view_ledger,view_expenses');
            Route::get('/', [ExpenseController::class, 'index'])->middleware('permission:manage_accounts,view_ledger,view_expenses');
            Route::post('/', [ExpenseController::class, 'store'])->middleware('permission:manage_accounts,create_expenses');
            Route::get('/{id}', [ExpenseController::class, 'show'])->middleware('permission:manage_accounts,view_ledger,view_expenses');
            Route::put('/{id}', [ExpenseController::class, 'update'])->middleware('permission:manage_accounts,edit_expenses');
            Route::delete('/{id}', [ExpenseController::class, 'destroy'])->middleware('permission:manage_accounts,delete_expenses');
        });

        // Suppliers — already its own dedicated permission (manage_suppliers); unchanged.
        Route::middleware(['permission:manage_purchases,view_purchases,manage_suppliers'])->prefix('suppliers')->group(function () {
            Route::get('/', [SupplierController::class, 'index']);
            Route::post('/', [SupplierController::class, 'store']);
            Route::get('/{id}', [SupplierController::class, 'show']);
            Route::put('/{id}', [SupplierController::class, 'update']);
            Route::delete('/{id}', [SupplierController::class, 'destroy']);
        });

        // Purchase Orders — old 3-way OR kept valid everywhere; each workflow-state action
        // (mark-ordered/receive/pay/cancel) additionally gets its own specific permission — `pay`
        // in particular releases money to a supplier and previously needed nothing more than
        // view_purchases, a real gap this closes.
        Route::prefix('purchases')->group(function () {
            Route::get('/', [PurchaseOrderController::class, 'index'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers');
            Route::post('/', [PurchaseOrderController::class, 'store'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers');
            // Must come before the /{id} wildcard below, or "product-history"/"serial-history" would be parsed as an id.
            Route::get('/product-history', [PurchaseOrderController::class, 'productHistory'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers,view_purchase_history');
            Route::get('/serial-history', [PurchaseOrderController::class, 'serialHistory'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers,view_purchase_history');
            Route::get('/{id}', [PurchaseOrderController::class, 'show'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers');
            Route::put('/{id}', [PurchaseOrderController::class, 'update'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers');
            Route::delete('/{id}', [PurchaseOrderController::class, 'destroy'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers');
            Route::post('/{id}/mark-ordered', [PurchaseOrderController::class, 'markOrdered'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers,mark_purchase_orders');
            Route::post('/{id}/receive', [PurchaseOrderController::class, 'receive'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers,receive_purchase_orders');
            Route::post('/{id}/return', [PurchaseOrderController::class, 'returnToSupplier'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers,receive_purchase_orders');
            Route::post('/{id}/restock-return', [PurchaseOrderController::class, 'restockReturn'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers,receive_purchase_orders');
            Route::post('/{id}/correct-receipt', [PurchaseOrderController::class, 'correctReceipt'])->middleware('permission:manage_purchases,correct_purchase_receipts');
            Route::post('/{id}/pay', [PurchaseOrderController::class, 'pay'])->middleware('permission:manage_purchases,pay_purchase_orders');
            Route::post('/{id}/cancel', [PurchaseOrderController::class, 'cancel'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers,cancel_purchase_orders');
            Route::get('/{id}/download', [PurchaseOrderController::class, 'downloadPdf'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers');
            Route::get('/{id}/payment-voucher/download', [PurchaseOrderController::class, 'paymentVoucherDownload'])->middleware('permission:manage_purchases,view_purchases,manage_suppliers');
        });

        // Investors & Investments — old 4-way OR kept valid everywhere; processing a return
        // (paying an investor back) additionally gets its own specific permission — previously
        // needed nothing more than view_ledger, a real gap this closes.
        Route::prefix('investors')->group(function () {
            Route::get('/', [InvestmentController::class, 'investorIndex'])->middleware('permission:manage_accounts,view_ledger,view_investors,manage_investors');
            Route::post('/', [InvestmentController::class, 'investorStore'])->middleware('permission:manage_accounts,view_ledger,view_investors,manage_investors');
            Route::put('/{id}', [InvestmentController::class, 'investorUpdate'])->middleware('permission:manage_accounts,view_ledger,view_investors,manage_investors');
            Route::delete('/{id}', [InvestmentController::class, 'investorDestroy'])->middleware('permission:manage_accounts,view_ledger,view_investors,manage_investors');
            Route::post('/{id}/return', [InvestmentController::class, 'processReturn'])->middleware('permission:manage_accounts,manage_investors,process_investor_returns');
        });
        Route::middleware(['permission:manage_accounts,view_ledger,view_investors,manage_investors'])->prefix('investments')->group(function () {
            Route::get('/', [InvestmentController::class, 'index']);
            Route::post('/', [InvestmentController::class, 'store']);
        });

        // Accounting — old 2-way OR kept valid everywhere; split additionally into reading
        // financial statements, managing the chart of accounts, posting journal entries, and
        // processing pending items into the ledger — previously all 20 routes (including posting
        // journal entries and deleting chart-of-accounts rows) shared just these same 2
        // permissions as reading a trial balance, a real gap this closes.
        Route::prefix('accounting')->group(function () {
            Route::get('/accounts', [AccountingController::class, 'accountsIndex'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');
            Route::post('/accounts', [AccountingController::class, 'accountStore'])->middleware('permission:manage_accounts,manage_chart_of_accounts');
            Route::put('/accounts/{id}', [AccountingController::class, 'accountUpdate'])->middleware('permission:manage_accounts,manage_chart_of_accounts');
            Route::delete('/accounts/{id}', [AccountingController::class, 'accountDestroy'])->middleware('permission:manage_accounts,manage_chart_of_accounts');

            Route::get('/journal', [AccountingController::class, 'journalIndex'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');
            Route::post('/journal', [AccountingController::class, 'journalStore'])->middleware('permission:manage_accounts,post_journal_entries');
            Route::get('/journal/{id}', [AccountingController::class, 'journalShow'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');

            Route::get('/trial-balance', [AccountingController::class, 'trialBalance'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');
            Route::get('/income-statement', [AccountingController::class, 'incomeStatement'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');
            Route::get('/balance-sheet', [AccountingController::class, 'balanceSheet'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');
            Route::get('/cash-position', [AccountingController::class, 'cashPosition'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');
            Route::get('/cash-book', [AccountingController::class, 'cashBook'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');
            Route::get('/ledger/{accountId}', [AccountingController::class, 'accountLedger'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');

            Route::get('/pending', [AccountingController::class, 'pendingSummary'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');
            Route::get('/pending/expenses', [AccountingController::class, 'pendingExpenses'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');
            Route::get('/pending/orders', [AccountingController::class, 'pendingOrders'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');
            Route::get('/pending/purchase-orders', [AccountingController::class, 'pendingPurchaseOrders'])->middleware('permission:manage_accounts,view_ledger,view_financial_statements');
            Route::post('/process/expense/{id}', [AccountingController::class, 'processExpense'])->middleware('permission:manage_accounts,process_pending_ledger_items');
            Route::post('/process/order/{id}', [AccountingController::class, 'processOrder'])->middleware('permission:manage_accounts,process_pending_ledger_items');
            Route::post('/process/purchase-order/{id}', [AccountingController::class, 'processPurchaseOrder'])->middleware('permission:manage_accounts,process_pending_ledger_items');
        });

        // Audit Logs
        Route::get('/audit-logs', [AdminController::class, 'auditLogs'])->middleware('permission:view_audit_logs');

        // RBAC - Roles Management (viewing is open to any admin-tier role). manage_roles stays as
        // master key; split additionally into managing role *definitions* (create/edit/delete a
        // role) vs *exercising* roles on users (assign/remove/sync) — previously one bucket for
        // both categories.
        Route::prefix('roles')->group(function () {
            Route::get('/', [RoleController::class, 'index']);
            Route::get('/{id}', [RoleController::class, 'show']);
            Route::get('/{id}/users', [RoleController::class, 'getUsersByRole']);

            Route::post('/', [RoleController::class, 'store'])->middleware('permission:manage_roles,manage_role_definitions');
            Route::put('/{id}', [RoleController::class, 'update'])->middleware('permission:manage_roles,manage_role_definitions');
            Route::delete('/{id}', [RoleController::class, 'destroy'])->middleware('permission:manage_roles,manage_role_definitions');
            Route::post('/assign', [RoleController::class, 'assignToUser'])->middleware('permission:manage_roles,assign_roles');
            Route::post('/remove', [RoleController::class, 'removeFromUser'])->middleware('permission:manage_roles,assign_roles');
            Route::post('/sync-user', [RoleController::class, 'syncUserRoles'])->middleware('permission:manage_roles,assign_roles');
        });

        // RBAC - Permissions Management — same split as Roles above (defining permissions vs
        // assigning them to roles).
        Route::prefix('permissions')->group(function () {
            Route::get('/', [PermissionController::class, 'index']);
            Route::get('/modules', [PermissionController::class, 'getModules']);
            Route::get('/role/{roleId}', [PermissionController::class, 'getByRole']);
            Route::get('/{id}', [PermissionController::class, 'show']);

            Route::post('/', [PermissionController::class, 'store'])->middleware('permission:manage_roles,manage_role_definitions');
            Route::put('/{id}', [PermissionController::class, 'update'])->middleware('permission:manage_roles,manage_role_definitions');
            Route::delete('/{id}', [PermissionController::class, 'destroy'])->middleware('permission:manage_roles,manage_role_definitions');
            Route::post('/assign', [PermissionController::class, 'assignToRole'])->middleware('permission:manage_roles,assign_roles');
            Route::post('/remove', [PermissionController::class, 'removeFromRole'])->middleware('permission:manage_roles,assign_roles');
            Route::post('/sync-role', [PermissionController::class, 'syncRolePermissions'])->middleware('permission:manage_roles,assign_roles');
            Route::post('/bulk-create', [PermissionController::class, 'bulkCreate'])->middleware('permission:manage_roles,manage_role_definitions');
        });
    });

    // ========================================================================
    // FILE UPLOAD (Authenticated)
    // ========================================================================

    Route::post('/upload', [UploadController::class, 'upload']);
    Route::post('/upload/multiple', [UploadController::class, 'uploadMultiple']);
    Route::delete('/upload', [UploadController::class, 'delete']);
});
