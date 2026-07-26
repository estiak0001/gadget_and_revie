# Gadget Revive Admin — Frontend Implementation Plan

> **Project:** gadget-revive-admin (Next.js 16 + React 18 + TypeScript)  
> **Created:** February 15, 2026  
> **Backend:** gadget-revive-api (Laravel 11) — Phase 1 backend endpoints already implemented  
> **Goal:** Remove all hardcoded demo/fallback data from every admin page and wire them to real API endpoints.

---

## Current State Audit

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1 (canary), React 18, TypeScript |
| Styling | Tailwind CSS 3.4, tailwind-merge, clsx |
| State | Zustand 4.5 (auth store) |
| HTTP | Axios (via `src/lib/api.ts`) with cookie-based auth |
| Forms | react-hook-form 7.50 + Zod 3.22 |
| Charts | recharts 2.12 (already installed) |
| Tables | @tanstack/react-table 8.11 (installed but unused) |
| Icons | lucide-react |
| Toasts | react-hot-toast |
| Auth | Cookie-based (`js-cookie`) with Bearer token |

### UI Components (Already Built)
| Component | Location | Status |
|-----------|----------|--------|
| Button | `src/components/ui/Button.tsx` | Complete |
| Input | `src/components/ui/Input.tsx` | Complete |
| Select | `src/components/ui/Select.tsx` | Complete |
| Textarea | `src/components/ui/Textarea.tsx` | Complete |
| Badge | `src/components/ui/Badge.tsx` | Complete |
| Modal | `src/components/ui/Modal.tsx` | Complete (sm/md/lg/xl sizes) |
| Pagination | `src/components/ui/Pagination.tsx` | Complete (page numbers, prev/next) |
| DataTable | `src/components/ui/DataTable.tsx` | Complete (sortable, generic, skeleton) |
| LoadingSpinner | `src/components/ui/LoadingSpinner.tsx` | Complete |
| Card/CardHeader/CardTitle/CardContent | `src/components/ui/Card.tsx` | Complete |
| AdminLayout | `src/components/layout/AdminLayout.tsx` | Complete (auth gate, sidebar, header) |
| Sidebar | `src/components/layout/Sidebar.tsx` | Complete (all nav items) |
| Header | `src/components/layout/Header.tsx` | Partial (notification dropdown is static) |

### Page Status Matrix

| Page | Route | Lines | API Calls | Demo Fallback | CRUD | Fully Dynamic |
|------|-------|-------|-----------|---------------|------|--------------|
| Dashboard | `/dashboard` | 342 | `GET /admin/dashboard` | Yes (mock stats + hardcoded trends) | Read | **No** |
| Login | `/login` | ~100 | `POST /auth/login` | No | - | **Yes** |
| Users | `/users` | 769 | `GET /admin/users`, `PUT /admin/users/{id}/status`, `POST /auth/register/*` | Yes (5 mock users) | CRUD | **Partial** |
| Vendors | `/vendors` | 550 | `GET /admin/vendors`, `PUT /admin/vendors/{id}/status` | Yes (mock vendors) | Read + Status | **Partial** |
| Vendors Pending | `/vendors/pending` | exists | `GET /admin/vendors?status=pending` | Yes | Read + Action | **Partial** |
| Products | `/products` | 687 | `GET /admin/products`, `POST`, `PUT`, `DELETE` | Yes (6 mock products) | Full CRUD | **Partial** |
| Services | `/services` | 508 | `GET /admin/services`, `POST`, `PUT`, `DELETE` | Yes (6 mock services) | Full CRUD | **Partial** |
| Orders | `/orders` | 496 | `GET /admin/orders`, `PUT /admin/orders/{id}/status` | Yes (6 mock orders) | Read + Status | **Partial** |
| Tickets | `/tickets` | 571 | `GET /admin/tickets`, `POST /{id}/reply`, `PUT /{id}/status` | Yes (6 mock tickets) | Read + Reply | **Partial** |
| Notifications | `/notifications` | 619 | `GET /admin/notifications`, `POST`, `DELETE` | Yes (7 mock notifs) | CRUD | **Partial** |
| Audit Logs | `/audit-logs` | 443 | `GET /admin/audit-logs` | Yes (10 mock logs) | Read | **Partial** |
| Settings | `/settings` | ~250 | `GET /admin/settings`, `PUT /admin/settings/{id}` | Yes (36 mock settings) | Read + Update | **Partial** |
| CMS Pages | `/cms/pages` | 386 | `GET /admin/cms-pages`, `POST`, `PUT`, `DELETE` | Yes (4 mock pages) | Full CRUD | **Partial** |
| CMS Banners | `/cms/banners` | 426 | `GET /admin/banners`, `POST`, `PUT`, `DELETE` | Yes (4 mock banners) | Full CRUD | **Partial** |
| CMS FAQs | `/cms/faqs` | 385 | `GET /admin/faqs`, `POST`, `PUT`, `DELETE` | Yes (5 mock FAQs) | Full CRUD | **Partial** |
| Sales Report | `/reports/sales` | 406 | `GET /admin/reports/sales` | Yes (mock charts) | Read | **Partial** |
| Customer Report | `/reports/customers` | 376 | `GET /admin/reports/customers` | Yes (mock stats) | Read | **Partial** |
| Vendor Report | `/reports/vendors` | 329 | `GET /admin/reports/vendors` | Yes (mock stats) | Read | **Partial** |
| Reviews | `/reviews` | exists | Likely `GET /admin/reviews` | Yes | Read | **Partial** |
| Payments | `/payments` | exists | Unknown | Yes | Read | **No** |
| Locations | `/locations/*` | 3 pages | `GET /locations/*` | Yes | CRUD | **Partial** |
| Categories | `/categories/*` | 2 pages | `GET /admin/service-categories`, `GET /admin/product-categories` | Yes | CRUD | **Partial** |
| Access Control | `/access/roles`, `/access/permissions` | 2 pages | Likely `GET /admin/roles`, `GET /admin/permissions` | Yes | CRUD | **Partial** |
| Vendor Portal | `/vendor/*` | 4 pages | Various vendor endpoints | Yes | Various | **Partial** |

---

## Key Finding

**Every page already makes API calls but falls back to hardcoded demo data in the `catch` block.** The pattern across ALL pages is:

```tsx
try {
  const response = await api.get('/admin/endpoint');
  setData(response.data.data);
} catch (error) {
  // Demo data — THIS IS WHAT NEEDS TO BE REMOVED
  setData([{ id: 1, name: 'Mock Item', ... }]);
}
```

**Primary task:** Remove all demo/fallback data from catch blocks and replace with proper error handling (toast + empty state).

---

## Phase 1: API Service Layer (NEW)

### Step 1.1 — Create `src/lib/adminService.ts`

Currently the project has NO centralized API service — each page calls `api.get()`/`api.post()` inline. Create a centralized service:

```typescript
// src/lib/adminService.ts
import api from './api';
import {
  User, VendorProfile, Product, ProductCategory, Service, ServiceCategory,
  Order, Ticket, CMSPage, Banner, FAQ, Setting, AuditLog, Review,
  DashboardStats, PaginatedResponse, ApiResponse
} from '@/types';

// Query params type
interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  [key: string]: string | number | boolean | undefined;
}

export const adminService = {
  // Dashboard
  getDashboardStats: () => api.get<ApiResponse<DashboardStats>>('/admin/dashboard'),
  getDashboardTrends: () => api.get<ApiResponse<DashboardStats>>('/admin/dashboard/trends'),

  // Users
  getUsers: (params: ListParams) => api.get<{ data: PaginatedResponse<User> }>('/admin/users', { params }),
  getUser: (id: number) => api.get<ApiResponse<User>>(`/admin/users/${id}`),
  updateUserStatus: (id: number, data: { status: string; reason?: string }) =>
    api.put(`/admin/users/${id}/status`, data),
  createUser: (data: Record<string, unknown>) => api.post('/admin/users', data),

  // Vendors
  getVendors: (params: ListParams) => api.get<{ data: PaginatedResponse<VendorProfile> }>('/admin/vendors', { params }),
  getVendor: (id: number) => api.get<ApiResponse<VendorProfile>>(`/admin/vendors/${id}`),
  updateVendorStatus: (id: number, data: { status: string; reason?: string }) =>
    api.put(`/admin/vendors/${id}/status`, data),

  // Orders
  getOrders: (params: ListParams) => api.get<PaginatedResponse<Order>>('/admin/orders', { params }),
  getOrder: (id: number) => api.get<ApiResponse<Order>>(`/admin/orders/${id}`),
  updateOrderStatus: (id: number, data: { order_status: string; note?: string }) =>
    api.put(`/admin/orders/${id}/status`, data),
  refundOrder: (id: number, data: { reason: string; amount?: number }) =>
    api.post(`/admin/orders/${id}/refund`, data),
  exportOrders: (params: ListParams) =>
    api.get('/admin/orders/export', { params, responseType: 'blob' }),

  // Customers
  getCustomers: (params: ListParams) => api.get<PaginatedResponse<User>>('/admin/customers', { params }),
  getCustomer: (id: number) => api.get<ApiResponse<User>>(`/admin/customers/${id}`),
  updateCustomer: (id: number, data: Record<string, unknown>) => api.put(`/admin/customers/${id}`, data),
  deleteCustomer: (id: number) => api.delete(`/admin/customers/${id}`),

  // Tickets
  getTickets: (params: ListParams) => api.get<PaginatedResponse<Ticket>>('/admin/tickets', { params }),
  getTicket: (id: number) => api.get<ApiResponse<Ticket>>(`/admin/tickets/${id}`),
  updateTicket: (id: number, data: Record<string, unknown>) => api.put(`/admin/tickets/${id}`, data),
  replyToTicket: (id: number, data: { message: string; status?: string }) =>
    api.post(`/admin/tickets/${id}/reply`, data),
  deleteTicket: (id: number) => api.delete(`/admin/tickets/${id}`),

  // Products
  getProducts: (params: ListParams) => api.get<PaginatedResponse<Product>>('/admin/products', { params }),
  createProduct: (data: Record<string, unknown>) => api.post('/admin/products', data),
  updateProduct: (id: number, data: Record<string, unknown>) => api.put(`/admin/products/${id}`, data),
  deleteProduct: (id: number) => api.delete(`/admin/products/${id}`),

  // Services
  getServices: (params: ListParams) => api.get<PaginatedResponse<Service>>('/admin/services', { params }),
  createService: (data: Record<string, unknown>) => api.post('/admin/services', data),
  updateService: (id: number, data: Record<string, unknown>) => api.put(`/admin/services/${id}`, data),
  deleteService: (id: number) => api.delete(`/admin/services/${id}`),
  toggleServiceStatus: (id: number) => api.put(`/admin/services/${id}/toggle-status`),

  // Categories
  getServiceCategories: (params?: ListParams) => api.get('/admin/service-categories', { params }),
  getProductCategories: (params?: ListParams) => api.get('/admin/product-categories', { params }),

  // CMS
  getPages: (params: ListParams) => api.get('/admin/cms-pages', { params }),
  createPage: (data: Record<string, unknown>) => api.post('/admin/cms-pages', data),
  updatePage: (id: number, data: Record<string, unknown>) => api.put(`/admin/cms-pages/${id}`, data),
  deletePage: (id: number) => api.delete(`/admin/cms-pages/${id}`),

  getBanners: (params: ListParams) => api.get('/admin/banners', { params }),
  createBanner: (data: FormData) => api.post('/admin/banners', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateBanner: (id: number, data: FormData) => api.post(`/admin/banners/${id}?_method=PUT`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteBanner: (id: number) => api.delete(`/admin/banners/${id}`),

  getFaqs: (params: ListParams) => api.get('/admin/faqs', { params }),
  createFaq: (data: Record<string, unknown>) => api.post('/admin/faqs', data),
  updateFaq: (id: number, data: Record<string, unknown>) => api.put(`/admin/faqs/${id}`, data),
  deleteFaq: (id: number) => api.delete(`/admin/faqs/${id}`),

  // Settings
  getSettings: () => api.get<{ data: Setting[] }>('/admin/settings'),
  updateSetting: (id: number, data: { value: string }) => api.put(`/admin/settings/${id}`, data),
  updateSettings: (data: Record<string, string>) => api.put('/admin/settings', data),
  regenerateApiKey: () => api.post('/admin/settings/api-keys/regenerate'),

  // Notifications
  getNotifications: (params: ListParams) => api.get('/admin/notifications', { params }),
  createNotification: (data: Record<string, unknown>) => api.post('/admin/notifications', data),
  deleteNotification: (id: number) => api.delete(`/admin/notifications/${id}`),
  markNotificationRead: (id: number) => api.put(`/admin/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put('/admin/notifications/read-all'),

  // Audit Logs
  getAuditLogs: (params: ListParams) => api.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', { params }),

  // Reviews
  getReviews: (params: ListParams) => api.get('/admin/reviews', { params }),
  updateReviewStatus: (id: number, data: { status: string }) => api.put(`/admin/reviews/${id}`, data),
  deleteReview: (id: number) => api.delete(`/admin/reviews/${id}`),

  // Reports
  getSalesReport: (params: ListParams) => api.get('/admin/reports/sales', { params }),
  getCustomerReport: (params: ListParams) => api.get('/admin/reports/customers', { params }),
  getVendorReport: (params: ListParams) => api.get('/admin/reports/vendors', { params }),
  getInventoryReport: (params?: ListParams) => api.get('/admin/reports/inventory', { params }),

  // File Upload
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadMultiple: (files: File[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files[]', f));
    return api.post('/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default adminService;
```

### Step 1.2 — Add Missing TypeScript Types to `src/types/index.ts`

```typescript
// Add these to existing types/index.ts

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  channel: string;
  target_type: string;
  target_id?: number;
  link?: string;
  image?: string;
  data?: Record<string, unknown>;
  sent_at?: string;
  read_count: number;
  total_sent: number;
  created_at: string;
  created_by?: { id: number; name: string };
}

export interface PaymentNotice {
  id: number;
  order_id: number;
  user_id: number;
  transaction_id: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  payment_account_number?: string;
  notes?: string;
  created_at: string;
  order?: Order;
  user?: User;
}

export interface InventoryLog {
  id: number;
  product_id: number;
  type: 'addition' | 'subtraction' | 'adjustment';
  quantity: number;
  previous_qty: number;
  new_qty: number;
  reason?: string;
  created_at: string;
  product?: Product;
}

// Enhanced dashboard with trends
export interface DashboardStatsWithTrends extends DashboardStats {
  trends: {
    users_change: number;
    vendors_change: number;
    orders_change: number;
    revenue_change: number;
  };
  low_stock_products: Product[];
  recent_tickets: Ticket[];
}
```

---

## Phase 2: Remove Demo Data & Wire to API (Page-by-Page)

### The Pattern

Every page currently has this anti-pattern in their data fetching:

```tsx
// BEFORE (current — every page has this)
try {
  const response = await api.get('/admin/endpoint');
  setData(response.data.data);
} catch (error) {
  console.error('Error:', error);
  // ❌ Hardcoded demo data
  setData([{ id: 1, ... }, { id: 2, ... }]);
  setTotalPages(5);
}
```

**Replace with:**

```tsx
// AFTER (target — all pages should use this)
try {
  const response = await adminService.getEndpoint(params);
  setData(response.data.data);
  setTotalPages(response.data.meta?.last_page || 1);
} catch (error: any) {
  console.error('Error:', error);
  toast.error(error.response?.data?.message || 'Failed to load data');
  setData([]); // ← empty array, NOT mock data
}
```

### Step 2.1 — Dashboard (`src/app/dashboard/page.tsx`)

**Current issues:**
- Trend percentages are hardcoded (`change={12}`, `change={8}`, `change={15}`, `change={22}`)
- Mock stats in catch block (1250 users, 85 vendors, etc.)
- Revenue chart uses mock data on error
- Recent orders table uses `{/* Demo data */}` comment with no data

**Changes:**
1. Import `adminService` instead of raw `api`
2. Call `adminService.getDashboardTrends()` instead of `api.get('/admin/dashboard')`
3. Remove mock `setStats({...})` from catch — show toast + empty state
4. Replace hardcoded `change={12}` etc. with `stats?.trends?.users_change`
5. Populate "Recent Orders" table from `stats?.recent_orders`
6. Add "Recent Tickets" widget using `stats?.recent_tickets`
7. Add "Low Stock" alert widget using `stats?.low_stock_products`

**Estimated effort:** 1-2 hours

---

### Step 2.2 — Orders (`src/app/orders/page.tsx`)

**Current issues:**
- 6 hardcoded mock orders in catch block
- `setTotalPages(5)` hardcoded fallback
- Status update falls back to local state change on error
- Export button is non-functional
- No order detail page (only modal view)

**Changes:**
1. Replace `api.get('/admin/orders')` with `adminService.getOrders(params)`
2. Remove all 6 mock order objects from catch block
3. Remove `setTotalPages(5)` from catch
4. Fix status update — `order_status` field (not `status`) per backend schema
5. Wire Export button to `adminService.exportOrders()` with blob download
6. Add refund button in view modal for completed orders
7. Add link to order detail page (see Step 3.1 for new page)

**Estimated effort:** 2-3 hours

---

### Step 2.3 — Users (`src/app/users/page.tsx`)

**Current issues:**
- 5 hardcoded mock users in catch block
- Create user uses `/auth/register/vendor` and `/auth/register/customer` (public endpoints) instead of admin endpoint
- Status update uses inline `api.put()` instead of service

**Changes:**
1. Replace `api.get('/admin/users')` with `adminService.getUsers(params)`
2. Remove 5 mock users from catch
3. Replace create endpoints with `adminService.createUser(data)` (uses `/admin/users` POST)
4. Replace status update with `adminService.updateUserStatus()`
5. Add "View" action button that navigates to user detail or fetches user profile

**Estimated effort:** 1-2 hours

---

### Step 2.4 — Vendors (`src/app/vendors/page.tsx`)

**Current issues:**
- Mock vendor data in catch block
- Status actions (approve/reject/suspend) use inline `api.put()`

**Changes:**
1. Replace with `adminService.getVendors(params)`
2. Remove mock vendors from catch
3. Replace status update with `adminService.updateVendorStatus()`
4. Add vendor detail view using `adminService.getVendor(id)`

**Estimated effort:** 1-2 hours

---

### Step 2.5 — Products (`src/app/products/page.tsx`)

**Current issues:**
- 6 mock products in catch block
- Create/edit/delete use inline `api.post/put/delete()` with local state fallback on error
- Categories fetched inline with mock fallback

**Changes:**
1. Replace all inline API calls with `adminService.getProducts()`, `.createProduct()`, `.updateProduct()`, `.deleteProduct()`
2. Replace category fetch with `adminService.getProductCategories()`
3. Remove ALL mock data from catch blocks (products + categories)
4. Add image upload for product images using `adminService.uploadFile()`
5. Wire stock adjustment to actual API endpoint

**Estimated effort:** 2-3 hours

---

### Step 2.6 — Services (`src/app/services/page.tsx`)

**Current issues:**
- 6 mock services in catch block
- Create/edit/delete use inline API calls with local state fallback
- Categories have mock fallback

**Changes:**
1. Replace with `adminService.getServices()`, `.createService()`, `.updateService()`, `.deleteService()`
2. Replace category fetch with `adminService.getServiceCategories()`
3. Remove all mock data
4. Add toggle status button using `adminService.toggleServiceStatus()`

**Estimated effort:** 2 hours

---

### Step 2.7 — Tickets (`src/app/tickets/page.tsx`)

**Current issues:**
- 6 mock tickets in catch block
- 3 mock messages in catch block of `fetchTicketMessages`
- Reply falls back to local state update
- Status change uses inline API call
- Ticket detail is modal-only, no dedicated page

**Changes:**
1. Replace with `adminService.getTickets(params)`
2. Replace ticket messages with `adminService.getTicket(id)` (messages included)
3. Replace reply with `adminService.replyToTicket()`
4. Replace status change with `adminService.updateTicket()`
5. Remove ALL mock data (tickets + messages)
6. Add link to ticket detail page (see Step 3.2)

**Estimated effort:** 2-3 hours

---

### Step 2.8 — Notifications (`src/app/notifications/page.tsx`)

**Current issues:**
- 7 mock notifications in catch block
- Create/delete use inline API calls with local state fallback

**Changes:**
1. Replace with `adminService.getNotifications(params)`
2. Replace create with `adminService.createNotification(data)`
3. Replace delete with `adminService.deleteNotification(id)`
4. Remove all mock data
5. Add mark-as-read functionality for individual notifications

**Estimated effort:** 1.5 hours

---

### Step 2.9 — Audit Logs (`src/app/audit-logs/page.tsx`)

**Current issues:**
- 10 mock audit log entries in catch block
- `setTotalPages(5)` hardcoded
- Export button is non-functional

**Changes:**
1. Replace with `adminService.getAuditLogs(params)`
2. Remove all 10 mock log entries
3. Wire export button to `GET /admin/reports/audit-logs?format=csv` (blob download)

**Estimated effort:** 1 hour

---

### Step 2.10 — Settings (`src/app/settings/page.tsx`)

**Current issues:**
- 36 hardcoded demo settings in catch block
- Save sends individual `PUT /admin/settings/{id}` per changed setting
- No API key regeneration functionality

**Changes:**
1. Replace with `adminService.getSettings()`
2. Remove 36 mock settings from catch
3. Use batch update `adminService.updateSettings(data)` instead of per-setting PUT
4. Add API key section with `adminService.regenerateApiKey()`
5. Add toggle inputs for boolean settings (currently text-only)
6. Add select inputs for enum settings (mail_driver, payment_gateway, etc.)

**Estimated effort:** 2 hours

---

### Step 2.11 — CMS Pages (`src/app/cms/pages/page.tsx`)

**Current issues:**
- 4 mock CMS pages in catch block
- CRUD uses inline API calls

**Changes:**
1. Replace with `adminService.getPages()`, `.createPage()`, `.updatePage()`, `.deletePage()`
2. Remove all mock page data
3. Add rich text editor for content field (consider adding `@tiptap/react` or use textarea)

**Estimated effort:** 1.5 hours

---

### Step 2.12 — CMS Banners (`src/app/cms/banners/page.tsx`)

**Current issues:**
- 4 mock banners in catch block
- Image upload handler exists (`imageFile` state) but upload endpoint not wired

**Changes:**
1. Replace with `adminService.getBanners()`, `.createBanner()`, `.updateBanner()`, `.deleteBanner()`
2. Remove mock banners
3. Wire image upload using `adminService.uploadFile()` before form submission
4. Show actual image previews from API URLs

**Estimated effort:** 2 hours

---

### Step 2.13 — CMS FAQs (`src/app/cms/faqs/page.tsx`)

**Current issues:**
- 5 mock FAQs in catch block
- CRUD uses inline API calls

**Changes:**
1. Replace with `adminService.getFaqs()`, `.createFaq()`, `.updateFaq()`, `.deleteFaq()`
2. Remove all mock FAQ data

**Estimated effort:** 1 hour

---

### Step 2.14 — Reports — Sales (`src/app/reports/sales/page.tsx`)

**Current issues:**
- Full mock `SalesReport` object in catch block with chart_data, top_services, payment_methods
- Export button non-functional

**Changes:**
1. Replace with `adminService.getSalesReport(params)`
2. Remove mock report data
3. Wire export button to download CSV/PDF
4. Ensure chart components handle empty data gracefully

**Estimated effort:** 1.5 hours

---

### Step 2.15 — Reports — Customers (`src/app/reports/customers/page.tsx`)

**Current issues:**
- Full mock `CustomerReport` in catch block

**Changes:**
1. Replace with `adminService.getCustomerReport(params)`
2. Remove all mock data
3. Wire export button

**Estimated effort:** 1 hour

---

### Step 2.16 — Reports — Vendors (`src/app/reports/vendors/page.tsx`)

**Current issues:**
- Full mock `VendorReport` in catch block

**Changes:**
1. Replace with `adminService.getVendorReport(params)`
2. Remove all mock data
3. Wire export button

**Estimated effort:** 1 hour

---

### Step 2.17 — Header Notifications (`src/components/layout/Header.tsx`)

**Current issues:**
- Static notification dropdown with 2 hardcoded items ("New vendor registration", "New order received")
- No real notification count badge
- "View all notifications" link non-functional

**Changes:**
1. Fetch latest 5 notifications from `adminService.getNotifications({ per_page: 5 })`
2. Show real unread count badge (poll every 30 seconds or use WebSocket)
3. Wire "View all notifications" to `/notifications` route
4. Click individual notification → navigate to relevant page via `notification.link`

**Estimated effort:** 1.5 hours

---

## Phase 3: Create New Pages

### Step 3.1 — Order Detail Page (`src/app/orders/[id]/page.tsx`)

**Currently:** Does not exist. Orders are viewed in a modal only.

**Build:**
- Fetch order via `adminService.getOrder(id)`
- Layout: full page with breadcrumb navigation
- Sections:
  - Order header: order number, dates, status badge
  - Customer info card: name, email, phone, delivery address
  - Vendor info card: business name, link to vendor profile
  - Order items table: product/service name, quantity, unit price, total
  - Payment info: method, status, transaction ID
  - Status timeline: visual progression of order states
  - Notes/activity log section
- Actions:
  - Update status dropdown → `adminService.updateOrderStatus()`
  - Process refund button → `adminService.refundOrder()` (confirmation modal)
  - Print/download invoice
- Back button → `/orders`

**Estimated effort:** 4-5 hours

---

### Step 3.2 — Ticket Detail Page (`src/app/tickets/[id]/page.tsx`)

**Currently:** Does not exist. Tickets viewed in modal only.

**Build:**
- Fetch ticket via `adminService.getTicket(id)` (includes messages)
- Layout: full page with sidebar info
- Left panel (2/3): Message thread
  - Alternating customer/admin messages with avatars
  - Timestamps in relative format ("5 minutes ago")
  - Admin reply textarea at bottom with send button
- Right panel (1/3): Ticket info
  - Status badge (changeable)
  - Priority badge (changeable)
  - Assigned staff (changeable dropdown)
  - Category
  - Created date
  - Related order link (if order_id exists)
  - Customer info with link to user profile
- Actions:
  - Reply → `adminService.replyToTicket()`
  - Change status → `adminService.updateTicket()`
  - Change priority → `adminService.updateTicket()`
  - Close ticket → `adminService.deleteTicket()` (or status change)
- Back button → `/tickets`

**Estimated effort:** 4-5 hours

---

### Step 3.3 — Customer Detail Page (`src/app/users/[id]/page.tsx`)

**Currently:** Does not exist.

**Build:**
- Fetch user via `adminService.getUser(id)` or `adminService.getCustomer(id)`
- Profile card: name, email, phone, role, status, join date, avatar
- Tabs:
  - **Orders tab:** paginated list of customer's orders
  - **Tickets tab:** list of customer's support tickets
  - **Activity tab:** recent audit log entries for this user
- Actions:
  - Ban/Unban toggle → `adminService.updateUserStatus()`
  - Edit user info → `adminService.updateCustomer()`
- Back button → `/users`

**Estimated effort:** 3-4 hours

---

### Step 3.4 — Vendor Detail Page (enhance existing)

**Currently:** Vendor detail is shown in a modal in `/vendors` page.

**Build:** `src/app/vendors/[id]/page.tsx`
- Fetch vendor via `adminService.getVendor(id)`
- Business profile: name, logo, description, location, contact
- Stats: total orders, revenue, rating, reviews
- Tabs:
  - **Services tab:** vendor's services list
  - **Products tab:** vendor's products list
  - **Orders tab:** orders received by this vendor
  - **Reviews tab:** reviews for this vendor
  - **Payouts tab:** payout history
- Actions: approve, reject, suspend, feature/unfeature
- Back button → `/vendors`

**Estimated effort:** 4-5 hours

---

## Phase 4: UI Component Improvements

### Step 4.1 — Migrate Inline Tables to `DataTable` Component

**Problem:** `DataTable` component exists with sorting, loading states, and empty states — but NO page uses it. Every page builds its own `<table>` inline.

**Action:** 
- Refactor all pages to use `<DataTable columns={...} data={...} />` from `@/components/ui`
- This gives automatic sorting, loading skeletons, and empty states

**Pages to migrate (17 tables):**
- Dashboard recent orders
- Orders list
- Users list
- Vendors list
- Products list
- Services list
- Tickets list
- Notifications list
- Audit logs list
- CMS pages list
- CMS banners list
- CMS FAQs list
- Reviews list
- Reports top items tables
- Payments list
- Locations tables
- Categories tables

**Estimated effort:** 6-8 hours total (30 min per table)

---

### Step 4.2 — Image Upload Component

**Create:** `src/components/ui/ImageUpload.tsx`

```typescript
interface ImageUploadProps {
  value?: string;           // Current image URL
  onChange: (url: string) => void;
  onRemove?: () => void;
  accept?: string;          // 'image/*'
  maxSize?: number;         // in MB
  placeholder?: string;
}
```

- Drag-and-drop area + file picker button
- Preview thumbnail of selected/current image
- Upload to `adminService.uploadFile()` 
- Show upload progress
- Return URL to parent form
- Use in: Banners, Products (future: Categories, Vendor logo)

**Estimated effort:** 2-3 hours

---

### Step 4.3 — Confirm Delete Modal Component

**Create:** `src/components/ui/ConfirmModal.tsx`

```typescript
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;     // "Delete" / "Confirm" / "Yes, ban"
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}
```

- Standardize all delete/action confirmations across the app
- Replace `window.confirm()` if used anywhere
- Many pages already have custom delete modals — consolidate into this component

**Estimated effort:** 1 hour

---

### Step 4.4 — Date Range Picker Component

**Create:** `src/components/ui/DateRangePicker.tsx`

- Two date inputs (start, end) with labels
- Preset buttons: Today, Last 7 days, Last 30 days, This Month, This Year
- Currently, reports pages use bare `<Input type="date" />` — upgrade to this component
- Use in: Sales Report, Customer Report, Vendor Report, Audit Logs, Orders filter

**Estimated effort:** 1.5 hours

---

### Step 4.5 — Status Badge Enhancement

**Update:** `src/lib/utils.ts` → `getStatusColor()`

Add missing statuses from backend:
```typescript
// Order statuses (backend uses order_status column)
'accepted': 'bg-blue-100 text-blue-800',
'in_progress': 'bg-indigo-100 text-indigo-800',
'awaiting_payment': 'bg-yellow-100 text-yellow-800',
'refunded': 'bg-gray-100 text-gray-800',

// Ticket statuses
'waiting_vendor': 'bg-orange-100 text-orange-800',
'waiting_customer': 'bg-amber-100 text-amber-800',

// Payment statuses
'awaiting_confirmation': 'bg-yellow-100 text-yellow-800',
```

**Estimated effort:** 30 minutes

---

### Step 4.6 — Header Search (Global Search)

**Update:** `src/components/layout/Header.tsx`

- Make search bar functional
- On input, call a new `GET /api/admin/search?q=...` endpoint (if backend supports) or search orders, users, vendors, tickets, products client-side with debounce
- Show dropdown results grouped by type
- Click result → navigate to relevant page
- Keyboard shortcut: `Ctrl+K` / `Cmd+K`

**Estimated effort:** 3-4 hours (including backend endpoint if needed)

---

## Phase 5: Error Handling & Loading States Standardization

### Step 5.1 — Create Error Boundary Component

**Create:** `src/components/ui/ErrorState.tsx`

```tsx
interface ErrorStateProps {
  title?: string;          // "Failed to load orders"
  message?: string;        // "Please try again later"
  onRetry?: () => void;   // Retry button callback
}
```

- Use across all pages when API calls fail (instead of just `console.error`)
- Show: error icon, title, message, retry button

**Estimated effort:** 1 hour

---

### Step 5.2 — Create Empty State Component

**Create:** `src/components/ui/EmptyState.tsx`

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;           // "No orders yet"
  description?: string;    // "Orders will appear here when customers place them"
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

- Use across all list pages when data array is empty
- Currently some pages have inline empty states, some don't handle empty at all

**Estimated effort:** 1 hour

---

### Step 5.3 — Standardize Toast Notifications

Ensure all API operations show consistent toasts:
- `toast.success('Order status updated')` on success
- `toast.error(error.response?.data?.message || 'Something went wrong')` on failure
- Many pages currently have `console.error()` only with no user feedback

**Estimated effort:** 2 hours (across all pages)

---

## Phase 6: Backend Column Name Alignment

### Critical Fix: Order Status Column

The backend database uses `order_status` (not `status`) for the Order model. The frontend `Order` type currently has:

```typescript
// Current (WRONG)
status: 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
```

**Should be updated to match backend:**

```typescript
// Updated (CORRECT) — Update in src/types/index.ts
export interface Order {
  // ...
  order_status: 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'awaiting_payment' | 'completed' | 'cancelled' | 'refunded';
  payment_status: 'pending' | 'awaiting_confirmation' | 'paid' | 'failed' | 'refunded';
  // ...
}
```

**Note:** The Laravel API Resource may transform `order_status` → `status` in the JSON response. Check the `OrderResource.php` to see if this mapping occurs. If so, the frontend type can keep `status` — but update the enum values.

**Also check:**
- `stock_quantity` vs `stock_qty` (backend column is `stock_qty`, type says `stock_quantity`)
- `subtotal` vs `total_price` on OrderItem (backend is `total_price`, type says `total`)

**Estimated effort:** 1 hour

---

## Execution Order (Priority)

| # | Task | Phase | Est. Hours | Dependencies |
|---|------|-------|-----------|-------------|
| 1 | Create `adminService.ts` | 1.1 | 2h | None |
| 2 | Add missing types | 1.2 | 1h | None |
| 3 | Fix Order type column names | 6 | 1h | None |
| 4 | Dashboard — remove mocks | 2.1 | 2h | 1 |
| 5 | Orders — remove mocks | 2.2 | 3h | 1 |
| 6 | Order Detail page (NEW) | 3.1 | 5h | 5 |
| 7 | Users — remove mocks | 2.3 | 2h | 1 |
| 8 | Customer Detail page (NEW) | 3.3 | 4h | 7 |
| 9 | Vendors — remove mocks | 2.4 | 2h | 1 |
| 10 | Tickets — remove mocks | 2.7 | 3h | 1 |
| 11 | Ticket Detail page (NEW) | 3.2 | 5h | 10 |
| 12 | CMS Pages — remove mocks | 2.11 | 1.5h | 1 |
| 13 | CMS Banners — remove mocks | 2.12 | 2h | 1 |
| 14 | CMS FAQs — remove mocks | 2.13 | 1h | 1 |
| 15 | Products — remove mocks | 2.5 | 3h | 1 |
| 16 | Services — remove mocks | 2.6 | 2h | 1 |
| 17 | Settings — remove mocks | 2.10 | 2h | 1 |
| 18 | Notifications — remove mocks | 2.8 | 1.5h | 1 |
| 19 | Audit Logs — remove mocks | 2.9 | 1h | 1 |
| 20 | Reports (3 pages) — remove mocks | 2.14-2.16 | 3.5h | 1 |
| 21 | Header notifications — dynamic | 2.17 | 1.5h | 1 |
| 22 | Image Upload component | 4.2 | 3h | None |
| 23 | Confirm Delete modal | 4.3 | 1h | None |
| 24 | Date Range Picker | 4.4 | 1.5h | None |
| 25 | Error/Empty state components | 5.1-5.2 | 2h | None |
| 26 | Standardize toasts | 5.3 | 2h | All pages |
| 27 | Migrate to DataTable | 4.1 | 8h | All pages |
| 28 | Header global search | 4.6 | 4h | 1 |
| 29 | Vendor Detail page (NEW) | 3.4 | 5h | 9 |
| 30 | Status badge updates | 4.5 | 0.5h | None |

**Total estimated effort: ~70 hours (9-10 working days)**

---

## Dependencies to Install

```bash
# None required — all needed packages already installed:
# ✅ recharts (charts)
# ✅ react-hook-form + zod (forms + validation)
# ✅ @tanstack/react-table (reusable table — installed but unused)
# ✅ react-hot-toast (notifications)
# ✅ date-fns (date formatting)
# ✅ lucide-react (icons)
# ✅ axios (HTTP client)

# Optional — only if rich text editing needed for CMS pages:
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link
```

---

## Testing Checklist

### API Integration Tests
- [ ] Every page loads data from API with NO fallback to mock data
- [ ] All `catch` blocks show `toast.error()` and set `setData([])`
- [ ] No hardcoded `setTotalPages(5)` or `setTotalPages(3)`
- [ ] Pagination works correctly with server-side `meta.last_page`
- [ ] Search/filter params are sent as query parameters

### CRUD Tests
- [ ] Products: create → appears in list → edit → changes reflected → delete → removed
- [ ] Services: same CRUD cycle
- [ ] CMS Pages: full CRUD + slug generation
- [ ] CMS Banners: CRUD + image upload
- [ ] CMS FAQs: full CRUD
- [ ] Users: create user, update status (ban/unban)
- [ ] Vendors: approve/reject/suspend works
- [ ] Orders: status update reflected, refund processes
- [ ] Tickets: reply sends, status/priority changes
- [ ] Settings: save persists, reload shows saved values
- [ ] Notifications: create, delete, mark read

### New Pages
- [ ] `/orders/[id]` — shows full order detail with items, customer, payment
- [ ] `/tickets/[id]` — shows message thread, allows reply
- [ ] `/users/[id]` — shows customer profile with order/ticket history
- [ ] `/vendors/[id]` — full vendor profile with tabs

### UI/UX
- [ ] Loading spinners show on all data fetches
- [ ] Empty states shown when no data
- [ ] Error states shown on API failures
- [ ] Toast notifications on all actions (create, update, delete, error)
- [ ] Header notification bell shows real unread count
- [ ] DataTable component used across all list pages
- [ ] Image upload works for banners and products

---

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| API service layer | Single `adminService.ts` file | Project already uses flat structure, separating would add complexity |
| Mock data removal | Replace with empty array + toast | Users should see real state of the system |
| DataTable migration | Gradual (can coexist with inline tables) | Avoid breaking all pages at once |
| Order detail | Full page (not modal) | Complex entity with items, timeline, actions — modal too small |
| Ticket detail | Full page (not modal) | Message thread UX needs full width |
| Rich text for CMS | Optional (start with textarea) | Most CMS content is simple HTML |
| Real-time notifications | Polling every 30s (not WebSocket) | Simpler to implement, adequate for admin panel |
| @tanstack/react-table | Use existing DataTable wrapper | Already installed, just needs adoption |
