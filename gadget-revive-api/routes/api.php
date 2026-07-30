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
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Controllers\Api\InvoiceController;
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
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::post('/verify-email', [AuthController::class, 'verifyEmail']);
    Route::post('/verify-phone', [AuthController::class, 'verifyPhone']);
    Route::post('/resend-verification', [AuthController::class, 'resendVerification']);
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

        // User Management — fine-grained permission on top of the coarse admin-tier gate above
        Route::prefix('users')->group(function () {
            Route::get('/', [AdminController::class, 'users']);
            Route::get('/{id}', [AdminController::class, 'userShow']);

            Route::middleware(['permission:manage_users'])->group(function () {
                Route::post('/', [AdminController::class, 'userStore']);
                Route::put('/{id}', [AdminController::class, 'userUpdate']);
                Route::delete('/{id}', [AdminController::class, 'userDelete']);
                Route::put('/{id}/status', [AdminController::class, 'userUpdateStatus']);
                Route::put('/{id}/reset-password', [AdminController::class, 'userResetPassword']);
            });
            Route::delete('/{id}/force', [AdminController::class, 'userForceDelete'])->middleware('role:super_admin');
        });

        // Vendor Management
        Route::middleware(['permission:view_vendors,manage_vendors,approve_vendors'])->prefix('vendors')->group(function () {
            Route::get('/', [AdminController::class, 'vendors']);
            Route::get('/{id}', [AdminController::class, 'vendorShow']);
            Route::post('/{id}/approve', [AdminController::class, 'vendorApprove']);
            Route::post('/{id}/reject', [AdminController::class, 'vendorReject']);
            Route::post('/{id}/suspend', [AdminController::class, 'vendorSuspend']);
        });

        // Order Management (Enhanced)
        Route::middleware(['permission:view_orders,manage_orders,process_orders'])->prefix('orders')->group(function () {
            Route::get('/', [AdminController::class, 'orders']);
            Route::post('/', [AdminController::class, 'orderCreate']);
            Route::get('/export', [AdminController::class, 'orderExport']);
            Route::get('/{id}', [AdminController::class, 'orderShow']);
            Route::put('/{id}', [AdminController::class, 'orderUpdate']);
            Route::put('/{id}/status', [AdminController::class, 'orderUpdateStatus']);
            Route::post('/{id}/refund', [AdminController::class, 'orderRefund']);
            Route::post('/{id}/record-payment', [AdminController::class, 'orderRecordPayment']);
        });

        // Admin Invoice Management
        Route::middleware(['permission:view_orders,manage_orders,process_orders'])->prefix('invoices')->group(function () {
            Route::get('/{id}/download', [InvoiceController::class, 'download']);
            Route::get('/{id}/stream', [InvoiceController::class, 'stream']);
            Route::post('/{id}/send', [InvoiceController::class, 'sendEmail']);
            Route::get('/custom/{id}/download', [InvoiceController::class, 'customDownload']);
            Route::get('/{orderId}/custom', [InvoiceController::class, 'customIndex']);
            Route::post('/{orderId}/custom', [InvoiceController::class, 'customStore']);
        });

        // Service Intakes (device received → receipt → convert to order)
        Route::middleware(['permission:view_orders,manage_orders,process_orders,view_service_intakes,manage_service_intakes'])->prefix('service-intakes')->group(function () {
            Route::get('/', [ServiceIntakeController::class, 'index']);
            Route::post('/', [ServiceIntakeController::class, 'store']);
            Route::get('/{id}', [ServiceIntakeController::class, 'show']);
            Route::put('/{id}', [ServiceIntakeController::class, 'update']);
            Route::delete('/{id}', [ServiceIntakeController::class, 'destroy']);
            Route::put('/{id}/status', [ServiceIntakeController::class, 'updateStatus']);
            Route::post('/{id}/convert', [ServiceIntakeController::class, 'convertToOrder']);
            Route::post('/{id}/confirm-price', [ServiceIntakeController::class, 'confirmPrice']);
            Route::get('/{id}/receipt/download', [ServiceIntakeController::class, 'downloadReceipt']);
            Route::get('/{id}/receipt/stream', [ServiceIntakeController::class, 'streamReceipt']);
        });

        // Customer Management
        Route::middleware(['permission:view_users,manage_users'])->prefix('customers')->group(function () {
            Route::get('/', [AdminController::class, 'customers']);
            Route::get('/{id}', [AdminController::class, 'customerShow']);
            Route::put('/{id}', [AdminController::class, 'customerUpdate']);
            Route::delete('/{id}', [AdminController::class, 'customerDelete']);
        });

        // Service Categories (Admin CRUD)
        Route::middleware(['permission:manage_categories'])->prefix('service-categories')->group(function () {
            Route::get('/', [CategoryController::class, 'adminServiceCategories']);
            Route::post('/', [CategoryController::class, 'storeServiceCategory']);
            Route::post('/reorder', [CategoryController::class, 'reorderServiceCategories']);
            Route::get('/{id}', [CategoryController::class, 'adminServiceCategoryShow']);
            Route::put('/{id}', [CategoryController::class, 'updateServiceCategory']);
            Route::delete('/{id}', [CategoryController::class, 'deleteServiceCategory']);
        });

        // Product Categories (Admin CRUD)
        Route::middleware(['permission:manage_categories'])->prefix('product-categories')->group(function () {
            Route::get('/', [CategoryController::class, 'adminProductCategories']);
            Route::post('/', [CategoryController::class, 'storeProductCategory']);
            Route::post('/reorder', [CategoryController::class, 'reorderProductCategories']);
            Route::get('/{id}', [CategoryController::class, 'adminProductCategoryShow']);
            Route::put('/{id}', [CategoryController::class, 'updateProductCategory']);
            Route::delete('/{id}', [CategoryController::class, 'deleteProductCategory']);
        });

        // Category Attributes (Admin CRUD)
        Route::middleware(['permission:manage_categories'])->prefix('category-attributes')->group(function () {
            Route::get('/', [CategoryAttributeController::class, 'index']);
            Route::post('/', [CategoryAttributeController::class, 'store']);
            Route::get('/{id}', [CategoryAttributeController::class, 'show']);
            Route::put('/{id}', [CategoryAttributeController::class, 'update']);
            Route::delete('/{id}', [CategoryAttributeController::class, 'destroy']);
            Route::post('/{id}/values', [CategoryAttributeController::class, 'storeValue']);
            Route::post('/{id}/values/sync', [CategoryAttributeController::class, 'bulkSyncValues']);
        });

        Route::middleware(['permission:manage_categories'])->prefix('attribute-values')->group(function () {
            Route::put('/{id}', [CategoryAttributeController::class, 'updateValue']);
            Route::delete('/{id}', [CategoryAttributeController::class, 'destroyValue']);
        });

        // Branch Locations (Admin CRUD)
        Route::middleware(['permission:manage_cms,manage_banners,manage_faqs'])->prefix('branch-locations')->group(function () {
            Route::get('/', [BranchLocationController::class, 'adminIndex']);
            Route::post('/', [BranchLocationController::class, 'store']);
            Route::put('/{id}', [BranchLocationController::class, 'update']);
            Route::delete('/{id}', [BranchLocationController::class, 'destroy']);
        });

        // Contact Inquiries (Admin)
        Route::middleware(['permission:manage_cms,manage_banners,manage_faqs'])->prefix('contact-inquiries')->group(function () {
            Route::get('/', [ContactInquiryController::class, 'adminIndex']);
            Route::get('/{id}', [ContactInquiryController::class, 'adminShow']);
            Route::put('/{id}', [ContactInquiryController::class, 'adminUpdate']);
            Route::delete('/{id}', [ContactInquiryController::class, 'adminDelete']);
        });

        // Locations (Admin CRUD)
        Route::middleware(['permission:manage_locations'])->prefix('locations')->group(function () {
            // Divisions
            Route::post('/divisions', [LocationController::class, 'storeDivision']);
            Route::put('/divisions/{id}', [LocationController::class, 'updateDivision']);
            Route::delete('/divisions/{id}', [LocationController::class, 'deleteDivision']);

            // Districts
            Route::post('/districts', [LocationController::class, 'storeDistrict']);
            Route::put('/districts/{id}', [LocationController::class, 'updateDistrict']);
            Route::delete('/districts/{id}', [LocationController::class, 'deleteDistrict']);

            // Areas
            Route::post('/areas', [LocationController::class, 'storeArea']);
            Route::put('/areas/{id}', [LocationController::class, 'updateArea']);
            Route::delete('/areas/{id}', [LocationController::class, 'deleteArea']);
        });

        // Tickets (Enhanced)
        Route::middleware(['permission:manage_tickets,respond_tickets'])->prefix('tickets')->group(function () {
            Route::get('/', [AdminController::class, 'tickets']);
            Route::get('/{id}', [TicketController::class, 'show']);
            Route::put('/{id}', [AdminController::class, 'ticketUpdate']);
            Route::post('/{id}/reply', [AdminController::class, 'ticketReply']);
            Route::post('/{id}/messages', [TicketController::class, 'addMessage']);
            Route::post('/{id}/assign', [AdminController::class, 'ticketAssign']);
            Route::post('/{id}/close', [TicketController::class, 'close']);
            Route::delete('/{id}', [AdminController::class, 'ticketDelete']);
        });

        // Reviews
        Route::middleware(['permission:manage_reviews,respond_reviews'])->prefix('reviews')->group(function () {
            Route::get('/', [AdminController::class, 'reviews']);
            Route::put('/{id}/moderate', [AdminController::class, 'reviewModerate']);
            Route::delete('/{id}', [AdminController::class, 'reviewDelete']);
        });

        // Payments Management
        Route::middleware(['permission:view_orders,manage_orders,process_orders,view_payments,manage_payments'])->prefix('payments')->group(function () {
            Route::get('/', [AdminController::class, 'payments']);
            Route::put('/{id}', [AdminController::class, 'paymentUpdate']);
        });

        // Payment Notices (Admin)
        Route::middleware(['permission:view_orders,manage_orders,process_orders,view_payments,manage_payments'])->prefix('payment-notices')->group(function () {
            Route::get('/', [AdminController::class, 'paymentNotices']);
            Route::put('/{id}', [AdminController::class, 'paymentNoticeUpdate']);
        });

        // CMS Pages
        Route::middleware(['permission:manage_cms,manage_banners,manage_faqs'])->prefix('cms-pages')->group(function () {
            Route::get('/', [AdminController::class, 'cmsPages']);
            Route::post('/', [AdminController::class, 'cmsPageStore']);
            Route::get('/{id}', [AdminController::class, 'cmsPageShow']);
            Route::put('/{id}', [AdminController::class, 'cmsPageUpdate']);
            Route::delete('/{id}', [AdminController::class, 'cmsPageDestroy']);
        });

        // Banners
        Route::middleware(['permission:manage_cms,manage_banners,manage_faqs'])->prefix('banners')->group(function () {
            Route::get('/', [AdminController::class, 'banners']);
            Route::post('/', [AdminController::class, 'bannerStore']);
            Route::put('/{id}', [AdminController::class, 'bannerUpdate']);
            Route::delete('/{id}', [AdminController::class, 'bannerDestroy']);
        });

        // FAQs
        Route::middleware(['permission:manage_cms,manage_banners,manage_faqs'])->prefix('faqs')->group(function () {
            Route::get('/', [AdminController::class, 'faqs']);
            Route::post('/', [AdminController::class, 'faqStore']);
            Route::put('/{id}', [AdminController::class, 'faqUpdate']);
            Route::delete('/{id}', [AdminController::class, 'faqDestroy']);
        });

        // Site Settings (Enhanced)
        Route::middleware(['permission:manage_settings'])->prefix('settings')->group(function () {
            Route::get('/', [AdminController::class, 'settings']);
            Route::put('/', [AdminController::class, 'settingsUpdate']);
            Route::post('/api-keys/regenerate', [AdminController::class, 'settingsRegenerateApiKey']);
        });

        // Products Management (Admin)
        Route::middleware(['permission:manage_products,create_products,edit_products,delete_products,manage_inventory'])->prefix('products')->group(function () {
            Route::get('/', [AdminController::class, 'adminProducts']);
            Route::get('/stats', [AdminController::class, 'adminProductStats']);
            Route::get('/spec-suggestions', [AdminController::class, 'adminProductSpecSuggestions']);
            Route::post('/', [AdminController::class, 'adminProductStore']);
            Route::get('/{id}', [AdminController::class, 'adminProductShow']);
            Route::put('/{id}', [AdminController::class, 'adminProductUpdate']);
            Route::delete('/{id}', [AdminController::class, 'adminProductDelete']);
            Route::put('/{id}/toggle-status', [AdminController::class, 'adminProductToggleStatus']);
            Route::put('/{id}/toggle-featured', [AdminController::class, 'adminProductToggleFeatured']);
        });

        // Product Brands Management (Admin) — grouped under "Categories" in the sidebar
        Route::middleware(['permission:manage_categories'])->prefix('product-brands')->group(function () {
            Route::get('/', [AdminController::class, 'adminProductBrands']);
            Route::post('/', [AdminController::class, 'adminProductBrandStore']);
            Route::get('/{id}', [AdminController::class, 'adminProductBrandShow']);
            Route::put('/{id}', [AdminController::class, 'adminProductBrandUpdate']);
            Route::delete('/{id}', [AdminController::class, 'adminProductBrandDelete']);
            Route::put('/{id}/toggle-status', [AdminController::class, 'adminProductBrandToggleStatus']);
        });

        // Services Management (Admin)
        Route::middleware(['permission:manage_services,create_services,edit_services,delete_services'])->prefix('services')->group(function () {
            Route::get('/', [AdminController::class, 'adminServices']);
            Route::post('/', [AdminController::class, 'adminServiceStore']);
            Route::put('/{id}', [AdminController::class, 'adminServiceUpdate']);
            Route::delete('/{id}', [AdminController::class, 'adminServiceDelete']);
            Route::put('/{id}/toggle-status', [AdminController::class, 'adminServiceToggleStatus']);
        });

        // Admin Notifications
        Route::middleware(['permission:view_notifications'])->prefix('notifications')->group(function () {
            Route::get('/', [AdminController::class, 'adminNotifications']);
            Route::put('/{id}/read', [AdminController::class, 'adminNotificationMarkRead']);
            Route::put('/read-all', [AdminController::class, 'adminNotificationMarkAllRead']);
            Route::delete('/{id}', [AdminController::class, 'adminNotificationDelete']);
        });

        // Reports
        Route::middleware(['permission:view_reports,export_reports'])->prefix('reports')->group(function () {
            Route::get('/sales', [ReportController::class, 'salesReport']);
            Route::get('/vendors', [ReportController::class, 'vendorReport']);
            Route::get('/customers', [ReportController::class, 'customerReport']);
            Route::get('/catalog', [ReportController::class, 'catalogReport']);
            Route::get('/reviews', [ReportController::class, 'reviewReport']);
            Route::get('/tickets', [ReportController::class, 'ticketReport']);

            // Exports
            Route::get('/export/sales/csv', [ReportController::class, 'exportSalesCSV']);
            Route::get('/export/sales/pdf', [ReportController::class, 'exportSalesPDF']);
            Route::get('/export/vendors/csv', [ReportController::class, 'exportVendorsCSV']);
            Route::get('/export/customers/csv', [ReportController::class, 'exportCustomersCSV']);
        });

        // Expense Categories
        Route::middleware(['permission:manage_accounts,view_ledger'])->prefix('expense-categories')->group(function () {
            Route::get('/', [ExpenseController::class, 'categoryIndex']);
            Route::post('/', [ExpenseController::class, 'categoryStore']);
            Route::get('/{id}', [ExpenseController::class, 'categoryShow']);
            Route::put('/{id}', [ExpenseController::class, 'categoryUpdate']);
            Route::delete('/{id}', [ExpenseController::class, 'categoryDestroy']);
        });

        // Expenses
        Route::middleware(['permission:manage_accounts,view_ledger'])->prefix('expenses')->group(function () {
            Route::get('/report', [ExpenseController::class, 'report']);
            Route::get('/', [ExpenseController::class, 'index']);
            Route::post('/', [ExpenseController::class, 'store']);
            Route::get('/{id}', [ExpenseController::class, 'show']);
            Route::put('/{id}', [ExpenseController::class, 'update']);
            Route::delete('/{id}', [ExpenseController::class, 'destroy']);
        });

        // Suppliers
        Route::middleware(['permission:manage_purchases,view_purchases,manage_suppliers'])->prefix('suppliers')->group(function () {
            Route::get('/', [SupplierController::class, 'index']);
            Route::post('/', [SupplierController::class, 'store']);
            Route::get('/{id}', [SupplierController::class, 'show']);
            Route::put('/{id}', [SupplierController::class, 'update']);
            Route::delete('/{id}', [SupplierController::class, 'destroy']);
        });

        // Purchase Orders
        Route::middleware(['permission:manage_purchases,view_purchases,manage_suppliers'])->prefix('purchases')->group(function () {
            Route::get('/', [PurchaseOrderController::class, 'index']);
            Route::post('/', [PurchaseOrderController::class, 'store']);
            Route::get('/{id}', [PurchaseOrderController::class, 'show']);
            Route::put('/{id}', [PurchaseOrderController::class, 'update']);
            Route::delete('/{id}', [PurchaseOrderController::class, 'destroy']);
            Route::post('/{id}/mark-ordered', [PurchaseOrderController::class, 'markOrdered']);
            Route::post('/{id}/receive', [PurchaseOrderController::class, 'receive']);
            Route::post('/{id}/pay', [PurchaseOrderController::class, 'pay']);
            Route::post('/{id}/cancel', [PurchaseOrderController::class, 'cancel']);
            Route::get('/{id}/download', [PurchaseOrderController::class, 'downloadPdf']);
        });

        // Investors & Investments
        Route::middleware(['permission:manage_accounts,view_ledger,view_investors,manage_investors'])->prefix('investors')->group(function () {
            Route::get('/', [InvestmentController::class, 'investorIndex']);
            Route::post('/', [InvestmentController::class, 'investorStore']);
            Route::put('/{id}', [InvestmentController::class, 'investorUpdate']);
            Route::delete('/{id}', [InvestmentController::class, 'investorDestroy']);
            Route::post('/{id}/return', [InvestmentController::class, 'processReturn']);
        });
        Route::middleware(['permission:manage_accounts,view_ledger,view_investors,manage_investors'])->prefix('investments')->group(function () {
            Route::get('/', [InvestmentController::class, 'index']);
            Route::post('/', [InvestmentController::class, 'store']);
        });

        // Accounting
        Route::middleware(['permission:manage_accounts,view_ledger'])->prefix('accounting')->group(function () {
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
            Route::get('/cash-position', [AccountingController::class, 'cashPosition']);
            Route::get('/cash-book', [AccountingController::class, 'cashBook']);
            Route::get('/ledger/{accountId}', [AccountingController::class, 'accountLedger']);

            Route::get('/pending', [AccountingController::class, 'pendingSummary']);
            Route::get('/pending/expenses', [AccountingController::class, 'pendingExpenses']);
            Route::get('/pending/orders', [AccountingController::class, 'pendingOrders']);
            Route::get('/pending/purchase-orders', [AccountingController::class, 'pendingPurchaseOrders']);
            Route::post('/process/expense/{id}', [AccountingController::class, 'processExpense']);
            Route::post('/process/order/{id}', [AccountingController::class, 'processOrder']);
            Route::post('/process/purchase-order/{id}', [AccountingController::class, 'processPurchaseOrder']);
        });

        // Audit Logs
        Route::get('/audit-logs', [AdminController::class, 'auditLogs'])->middleware('permission:view_audit_logs');

        // RBAC - Roles Management (viewing is open to any admin-tier role; changes require manage_roles)
        Route::prefix('roles')->group(function () {
            Route::get('/', [RoleController::class, 'index']);
            Route::get('/{id}', [RoleController::class, 'show']);
            Route::get('/{id}/users', [RoleController::class, 'getUsersByRole']);

            Route::middleware(['permission:manage_roles'])->group(function () {
                Route::post('/', [RoleController::class, 'store']);
                Route::put('/{id}', [RoleController::class, 'update']);
                Route::delete('/{id}', [RoleController::class, 'destroy']);
                Route::post('/assign', [RoleController::class, 'assignToUser']);
                Route::post('/remove', [RoleController::class, 'removeFromUser']);
                Route::post('/sync-user', [RoleController::class, 'syncUserRoles']);
            });
        });

        // RBAC - Permissions Management
        Route::prefix('permissions')->group(function () {
            Route::get('/', [PermissionController::class, 'index']);
            Route::get('/modules', [PermissionController::class, 'getModules']);
            Route::get('/role/{roleId}', [PermissionController::class, 'getByRole']);
            Route::get('/{id}', [PermissionController::class, 'show']);

            Route::middleware(['permission:manage_roles'])->group(function () {
                Route::post('/', [PermissionController::class, 'store']);
                Route::put('/{id}', [PermissionController::class, 'update']);
                Route::delete('/{id}', [PermissionController::class, 'destroy']);
                Route::post('/assign', [PermissionController::class, 'assignToRole']);
                Route::post('/remove', [PermissionController::class, 'removeFromRole']);
                Route::post('/sync-role', [PermissionController::class, 'syncRolePermissions']);
                Route::post('/bulk-create', [PermissionController::class, 'bulkCreate']);
            });
        });
    });

    // ========================================================================
    // FILE UPLOAD (Authenticated)
    // ========================================================================

    Route::post('/upload', [UploadController::class, 'upload']);
    Route::post('/upload/multiple', [UploadController::class, 'uploadMultiple']);
    Route::delete('/upload', [UploadController::class, 'delete']);
});
