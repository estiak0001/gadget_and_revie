# Admin Panel Dynamic Implementation Plan

> **Project:** Gadget Revive Web (Next.js 15 + Laravel API)  
> **Created:** February 15, 2026  
> **Goal:** Convert every admin panel section from static/placeholder to fully dynamic CRUD with real API integration.

---

## Current State Summary

| Admin Page     | Data Source   | CRUD  | API Layer Ready | UI Complete   | Fully Functional |
|----------------|---------------|-------|-----------------|---------------|------------------|
| Dashboard      | API           | Read  | Yes             | Yes           | Partial          |
| Login          | API           | -     | Yes             | Yes           | Yes              |
| Vendors        | API           | Full  | Yes             | Yes           | Yes              |
| Products       | API           | Full  | Yes             | Yes           | Yes              |
| Orders         | None          | None  | No              | Shell only    | No               |
| Customers      | None          | None  | No              | Shell only    | No               |
| Tickets        | None          | None  | No              | Shell only    | No               |
| CMS            | None          | None  | Yes (unused)    | Empty states  | No               |
| Reports        | None          | Read  | Yes (unused)    | Placeholders  | No               |
| Settings       | Hardcoded     | Fake  | No              | Yes           | No               |
| Services       | -             | -     | -               | Page missing  | No               |
| Notifications  | -             | -     | -               | Page missing  | No               |
| Audit Logs     | -             | -     | -               | Page missing  | No               |

---

## Phase 1: Backend API Endpoints (Laravel)

These endpoints must be created/verified on the Laravel backend before frontend work begins.

### Step 1.1 — Admin Order Management API

Create the following endpoints in Laravel:

- `GET /api/admin/orders` — List all orders with filters (status, date range, customer, vendor), search, and pagination
- `GET /api/admin/orders/{id}` — Single order detail with items, customer info, payment info
- `PUT /api/admin/orders/{id}/status` — Update order status (processing, shipped, delivered, cancelled, refunded)
- `POST /api/admin/orders/{id}/refund` — Process refund
- `GET /api/admin/orders/export` — Export orders as CSV/Excel

### Step 1.2 — Admin Customer Management API

- `GET /api/admin/customers` — List all customers with filters (status, registration date, order count), search, pagination
- `GET /api/admin/customers/{id}` — Customer detail with order history, tickets, activity
- `PUT /api/admin/customers/{id}` — Update customer (ban/unban, update role)
- `DELETE /api/admin/customers/{id}` — Soft delete customer

### Step 1.3 — Admin Ticket Management API

- `GET /api/admin/tickets` — List all tickets with filters (status, priority, assignee, date), search, pagination
- `GET /api/admin/tickets/{id}` — Ticket detail with full message thread
- `PUT /api/admin/tickets/{id}` — Update ticket (status, priority, assign to admin)
- `POST /api/admin/tickets/{id}/reply` — Admin reply to ticket
- `DELETE /api/admin/tickets/{id}` — Close/delete ticket

### Step 1.4 — Admin Settings API

- `GET /api/admin/settings` — Get all settings (grouped by category: general, notifications, security, payment, email)
- `PUT /api/admin/settings` — Update settings (accepts partial updates by category)
- `POST /api/admin/settings/api-keys/regenerate` — Regenerate API keys

### Step 1.5 — Admin Services Management API

- `GET /api/admin/services` — List all services with filters, search, pagination
- `POST /api/admin/services` — Create service
- `PUT /api/admin/services/{id}` — Update service
- `DELETE /api/admin/services/{id}` — Delete service
- `PUT /api/admin/services/{id}/toggle-status` — Activate/deactivate

### Step 1.6 — Admin Notifications API

- `GET /api/admin/notifications` — List admin notifications with pagination
- `PUT /api/admin/notifications/{id}/read` — Mark as read
- `PUT /api/admin/notifications/read-all` — Mark all as read
- `DELETE /api/admin/notifications/{id}` — Delete notification

### Step 1.7 — Verify Existing CMS & Report Endpoints

The `adminService` in `lib/api/admin.ts` already defines calls to these endpoints — verify they exist and return proper data:

- `GET /api/admin/pages`, `POST`, `PUT`, `DELETE`
- `GET /api/admin/banners`, `POST`, `PUT`, `DELETE`
- `GET /api/admin/service-categories`, `POST`, `PUT`, `DELETE`
- `GET /api/admin/product-categories`, `POST`, `PUT`, `DELETE`
- `GET /api/admin/faqs`, `POST`, `PUT`, `DELETE`
- `GET /api/admin/reports/sales`
- `GET /api/admin/reports/inventory`
- `GET /api/admin/reports/audit-logs`
- `GET /api/admin/reports/dashboard` (already working)

### Step 1.8 — Image Upload API

- `POST /api/upload` — Accept multipart file upload, return URL
- Support multiple image uploads for products, banners, categories

---

## Phase 2: Frontend API Service Layer (`lib/api/admin.ts`)

### Step 2.1 — Add Missing Admin Service Methods

Add to `lib/api/admin.ts`:

- `getOrders(params)` → `GET /api/admin/orders`
- `getOrder(id)` → `GET /api/admin/orders/{id}`
- `updateOrderStatus(id, status)` → `PUT /api/admin/orders/{id}/status`
- `refundOrder(id, data)` → `POST /api/admin/orders/{id}/refund`
- `exportOrders(params)` → `GET /api/admin/orders/export`
- `getCustomers(params)` → `GET /api/admin/customers`
- `getCustomer(id)` → `GET /api/admin/customers/{id}`
- `updateCustomer(id, data)` → `PUT /api/admin/customers/{id}`
- `deleteCustomer(id)` → `DELETE /api/admin/customers/{id}`
- `getAllTickets(params)` → `GET /api/admin/tickets`
- `getTicket(id)` → `GET /api/admin/tickets/{id}`
- `updateTicket(id, data)` → `PUT /api/admin/tickets/{id}`
- `replyToTicket(id, message)` → `POST /api/admin/tickets/{id}/reply`
- `deleteTicket(id)` → `DELETE /api/admin/tickets/{id}`
- `getSettings()` → `GET /api/admin/settings`
- `updateSettings(data)` → `PUT /api/admin/settings`
- `getNotifications(params)` → `GET /api/admin/notifications`
- `markNotificationRead(id)` → `PUT /api/admin/notifications/{id}/read`
- `markAllNotificationsRead()` → `PUT /api/admin/notifications/read-all`
- `uploadImage(file)` → `POST /api/upload`

### Step 2.2 — Add Admin Services Management Methods

Add to `lib/api/admin.ts` or create `lib/api/admin-service.ts`:

- `getServices(params)` → `GET /api/admin/services`
- `createService(data)` → `POST /api/admin/services`
- `updateService(id, data)` → `PUT /api/admin/services/{id}`
- `deleteService(id)` → `DELETE /api/admin/services/{id}`
- `toggleServiceStatus(id)` → `PUT /api/admin/services/{id}/toggle-status`

### Step 2.3 — Add TypeScript Types

Add to `lib/types.ts`:

- `AdminOrder` — order with full details for admin view
- `AdminCustomer` — customer with stats (total orders, total spent, last active)
- `AdminTicket` — ticket with admin-specific fields (assignee, internal notes)
- `AdminSettings` — typed settings by category
- `AdminNotification` — notification type
- `PaginatedResponse<T>` — generic paginated response wrapper `{ data: T[], meta: { current_page, last_page, per_page, total } }`
- `AdminService` — service management type

---

## Phase 3: Wire Existing Pages to API

### Step 3.1 — Admin Orders Page (`app/admin/orders/page.tsx`)

**Current:** `setOrders([])` with TODO comment

**Changes:**
- Import and call `adminService.getOrders()` in `useEffect` with filter/search params
- Wire status filter, search, date range to API query parameters
- Add pagination component at bottom of table
- Wire status change buttons to `adminService.updateOrderStatus()`
- Make order ID links navigate to `/admin/orders/[id]` detail page

### Step 3.2 — Create Admin Order Detail Page (`app/admin/orders/[id]/page.tsx`)

**New page:**
- Fetch order via `adminService.getOrder(id)`
- Display: customer info, order items table, payment details, shipping info, status timeline
- Actions: update status dropdown, process refund button, add internal notes
- Navigation: back to orders list, link to customer profile

### Step 3.3 — Admin Customers Page (`app/admin/customers/page.tsx`)

**Current:** `setCustomers([])` with TODO comment

**Changes:**
- Call `adminService.getCustomers()` in `useEffect`
- Wire search and status filter to API params
- Add pagination
- Wire "View" button to `/admin/customers/[id]` (future detail page)
- Add ban/unban toggle action
- Show customer stats (total orders, total spent, registration date)

### Step 3.4 — Admin Tickets Page (`app/admin/tickets/page.tsx`)

**Current:** `setTickets([])` with TODO comment

**Changes:**
- Call `adminService.getAllTickets()` in `useEffect`
- Wire status filter, priority filter, search to API params
- Add pagination
- Wire ticket links to detail page

### Step 3.5 — Create Admin Ticket Detail Page (`app/admin/tickets/[id]/page.tsx`)

**New page:**
- Fetch ticket via `adminService.getTicket(id)`
- Display: ticket info (subject, status, priority, customer, created date)
- Message thread with timestamps and avatar
- Admin reply form
- Actions: change status, change priority, assign to admin

### Step 3.6 — Admin CMS Page (`app/admin/cms/page.tsx`)

**Current:** All counts hardcoded to 0, no data loaded, buttons non-functional

**Changes:**
- On mount, fetch counts/lists from:
  - `adminService.getPages()` → display in Pages section
  - `adminService.getBanners()` → display in Banners section
  - `adminService.getServiceCategories()` → display in Service Categories section
  - `adminService.getProductCategories()` → display in Product Categories section
  - `adminService.getFaqs()` → display in FAQs section
- Each section gets: list table/grid, "Add New" button → modal/form, edit button, delete with confirmation
- Build modal forms for each CMS entity type using React Hook Form + Zod validation
- Wire create/update/delete to respective `adminService` methods
- Add image upload for banners using `adminService.uploadImage()`

### Step 3.7 — Admin Reports Page (`app/admin/reports/page.tsx`)

**Current:** All values show 0/৳0, commented-out API call

**Changes:**
- Install charting library: `npm install recharts` (works well with React/Next.js)
- Uncomment and call `adminService.getSalesReport(params)` with date range picker
- Call `adminService.getInventoryReport()` for inventory tab
- Call `adminService.getAuditLogs(params)` for audit log tab
- Build charts: revenue line chart, orders bar chart, category pie chart
- Wire export button to generate CSV/PDF
- Replace all hardcoded summary values with API response data
- Replace hardcoded percentage changes with calculated trends from API

### Step 3.8 — Admin Settings Page (`app/admin/settings/page.tsx`)

**Current:** Hardcoded `defaultValue` strings, fake save with `setTimeout`

**Changes:**
- On mount, call `adminService.getSettings()` → populate all form fields
- Replace `setTimeout` save with `adminService.updateSettings(data)` for each settings section
- Use React Hook Form for form state management and Zod for validation
- Each tab (General, Notifications, Security, Payment, Email, API Keys) saves independently
- Add real toggle functionality for notification preferences
- Add real API key display/regeneration (masked keys with copy button)

### Step 3.9 — Admin Dashboard (`app/admin/page.tsx`)

**Current:** Stats from API but trend percentages hardcoded (12%, 8%, 15%, 22%)

**Changes:**
- Modify `GET /api/admin/reports/dashboard` to include trend/change percentages
- Replace hardcoded `change` prop values with API response data
- Add "Recent Orders" widget (latest 5 orders from `adminService.getOrders({ limit: 5 })`)
- Add "Recent Tickets" widget (latest 5 tickets)
- Add "Low Stock Alerts" widget from inventory data
- Make revenue chart dynamic (currently just a colored div)
- Add quick-action buttons (approve pending vendors, ship orders, etc.)

---

## Phase 4: Create Missing Admin Pages

### Step 4.1 — Admin Services Page (`app/admin/services/page.tsx`)

**Currently:** Linked in `AdminSidebar` (`/admin/services`) but page doesn't exist

**Build:**
- List all services from `adminService.getServices()` or `serviceService.getAll()`
- Table columns: name, category, price, duration, vendor, status, actions
- Filters: category, status (active/inactive), price range
- Search by service name
- CRUD: create/edit via modal or separate page, delete with confirmation
- Toggle active/inactive status
- Follow the same pattern as the Vendors page (most complete reference)

### Step 4.2 — Admin Notifications Page (`app/admin/notifications/page.tsx`)

**Currently:** Bell icon in `AdminHeader` but no notifications page

**Build:**
- List notifications from `adminService.getNotifications()`
- Types: new order, new vendor registration, new ticket, low stock, system alerts
- Filters: read/unread, type
- Actions: mark as read, mark all as read, delete
- Click notification → navigate to relevant admin page
- Badge count in `AdminHeader` bell icon (poll or WebSocket for real-time)

### Step 4.3 — Admin Audit Logs Page (`app/admin/audit-logs/page.tsx`)

**Build:**
- Fetch from `adminService.getAuditLogs(params)`
- Table: timestamp, admin user, action, entity type, entity ID, details, IP address
- Filters: action type, admin user, date range, entity type
- Search by entity or action
- Pagination
- Export to CSV

---

## Phase 5: Shared UI Components & Improvements

### Step 5.1 — Pagination Component

**Create:** `components/admin/Pagination.tsx`

- Reusable component accepting `currentPage`, `totalPages`, `onPageChange`
- Shows page numbers, prev/next, "Showing X to Y of Z results"
- Use across all admin list pages (orders, customers, tickets, vendors, products, services)

### Step 5.2 — Image Upload Component

**Create:** `components/admin/ImageUpload.tsx`

- Drag-and-drop zone + file picker
- Preview thumbnails before upload
- Upload to `POST /api/upload` via `adminService.uploadImage()`
- Return URL for form integration
- Use in: product create/edit, banner create/edit, category create/edit

### Step 5.3 — Confirmation Modal Component

**Create:** `components/admin/ConfirmModal.tsx`

- Reusable delete/action confirmation dialog
- Props: title, message, confirmLabel, variant (danger/warning/info), onConfirm, onCancel
- Replace all `window.confirm()` calls in admin pages

### Step 5.4 — Form Modal Component

**Create:** `components/admin/FormModal.tsx`

- Reusable modal wrapper for create/edit forms
- Props: title, isOpen, onClose, size (sm/md/lg/xl)
- Use in CMS CRUD, vendor create, service create

### Step 5.5 — Date Range Picker

**Create:** `components/admin/DateRangePicker.tsx`

- Start date + end date inputs
- Preset ranges: Today, Last 7 days, Last 30 days, This month, This year
- Use in: reports, orders filter, audit logs

### Step 5.6 — Admin Table Enhancements

**Update:** `components/admin/AdminTable.tsx`

- Add sortable columns (click header to sort)
- Add bulk selection checkboxes
- Add bulk actions bar (delete selected, export selected, update status)
- Integrate pagination component
- Currently available but most pages build inline tables — migrate all pages to use `AdminTable`

### Step 5.7 — Admin Header Search

**Update:** `components/admin/AdminHeader.tsx`

- Make search bar functional
- Global search across orders, customers, products, vendors, tickets
- Dropdown search results with navigation links
- Keyboard shortcut (Ctrl+K / Cmd+K)

---

## Phase 6: Frontend Pages Dynamic Data

### Step 6.1 — Products Page (`app/products/page.tsx`)

- Replace `import { sampleProducts } from '@/lib/data'` with `productService.getAll()`
- Dynamic category list from `adminService.getProductCategories()`
- Add pagination, real search, proper filters
- Show loading states during fetch

### Step 6.2 — Services Page (`app/services/page.tsx`)

- Replace `import { sampleServices } from '@/lib/data'` with `serviceService.getAll()`
- Dynamic categories from API
- Add pagination and search

### Step 6.3 — Homepage (`app/page.tsx`)

- Featured products from `productService.getAll({ featured: true })`
- Stats from CMS API or settings
- Testimonials from CMS banners or new testimonials API
- Hero images from CMS banners

### Step 6.4 — Checkout Page (`app/checkout/page.tsx`)

- Replace "Coming Soon" with actual checkout flow
- Cart summary from cart store
- Address form with `locationService` (divisions → districts → areas)
- Payment method selection (bKash, CoD)
- Call `orderService.checkout()` on submit

### Step 6.5 — Support Ticket Creation (`app/support/new/page.tsx`)

- Replace local Zustand `useTicketStore` with `ticketService.create()` API call
- On success, redirect to ticket detail or dashboard

### Step 6.6 — Dashboard Page (`app/dashboard/page.tsx`)

- Fetch user orders from `orderService.getMyOrders()`
- Fetch user tickets from `ticketService.getMyTickets()`
- Show real stats instead of hardcoded 0s

### Step 6.7 — Contact Page (`app/contact/page.tsx`)

- Wire contact form `onSubmit` to API endpoint or email service
- Optionally load contact info from CMS/settings API

### Step 6.8 — Data Recovery Page (`app/data-recovery/page.tsx`)

- Replace hardcoded features and process steps with CMS-managed content
- Services from API instead of `sampleServices`

### Step 6.9 — Remove `lib/data.ts`

- After all pages use API data, delete `lib/data.ts` (no more `sampleProducts`/`sampleServices`)

---

## Phase 7: Install Dependencies

```bash
npm install recharts                    # Charts for reports page
npm install react-dropzone              # Image upload drag-and-drop
```

---

## Verification

### Unit Tests
- Test all new `adminService` methods with mocked axios
- Test pagination component renders correctly
- Test form validation in modal forms

### Integration Tests
- Verify each admin page loads data from API (no hardcoded fallbacks)
- Test CRUD flows: create → appears in list → edit → verify changes → delete → removed
- Test filter/search combinations return correct results
- Test pagination navigates correctly

### Manual Testing Checklist
- [ ] Dashboard shows real stats with real trend percentages
- [ ] Orders page lists all orders, filters work, status can be changed
- [ ] Order detail page shows full order info with status management
- [ ] Customers page lists all users, ban/unban works
- [ ] Tickets page lists all tickets, admin can reply and change status
- [ ] Ticket detail page shows conversation thread
- [ ] CMS: can create/edit/delete pages, banners, categories, FAQs
- [ ] Reports show real charts with real data, export works
- [ ] Settings save and load from API
- [ ] Services page: full CRUD
- [ ] Notifications page shows real notifications
- [ ] Audit logs display admin actions
- [ ] Image upload works for products and banners
- [ ] Pagination works on all list pages
- [ ] Admin search bar returns results and navigates
- [ ] Frontend products page loads from API (no sampleProducts)
- [ ] Frontend services page loads from API (no sampleServices)
- [ ] Checkout flow completes an order
- [ ] Support ticket creation uses real API
- [ ] All hardcoded data in `lib/data.ts` is eliminated

---

## Decisions

- **Charting library:** Use `recharts` — best React integration, SSR-compatible, actively maintained
- **Image upload:** Use `react-dropzone` for DnD + server upload via `POST /api/upload`
- **Pagination:** Server-side pagination (API handles `?page=X&per_page=Y`) — not client-side
- **Modals vs separate pages for CRUD:** Use modals for simple entities (CMS items, categories, FAQs) and separate pages for complex entities (orders, tickets) that need detail views
- **AdminTable reuse:** Migrate all admin list pages to use the shared `AdminTable` component for consistency
- **Vendor creation:** Replace public `vendorService.register()` call in admin with a proper `adminService.createVendor()` endpoint

---

## Execution Order (Priority)

1. **Phase 1** — Backend API endpoints (blocking everything else)
2. **Phase 2** — Frontend API service layer + types
3. **Phase 5.1–5.5** — Shared UI components (pagination, upload, modals)
4. **Phase 3.1–3.2** — Orders (highest business value)
5. **Phase 3.6** — CMS (API already exists, quickest wins)
6. **Phase 3.3** — Customers
7. **Phase 3.4–3.5** — Tickets
8. **Phase 3.7** — Reports + chart library
9. **Phase 4.1** — Services page
10. **Phase 3.8** — Settings
11. **Phase 3.9** — Dashboard enhancements
12. **Phase 4.2** — Notifications
13. **Phase 4.3** — Audit Logs
14. **Phase 5.6–5.7** — Table enhancements + global search
15. **Phase 6** — Frontend pages dynamic data
16. **Phase 7** — Dependencies + cleanup
