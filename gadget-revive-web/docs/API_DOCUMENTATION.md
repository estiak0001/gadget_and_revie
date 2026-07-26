# Gadget Revive API Documentation

## Overview
**Gadget Revive** is a comprehensive repair services marketplace API that connects customers with verified vendors for gadget repair services and spare parts. Built with Laravel 11, it features a robust three-tier role system, location-based service discovery, and a complete order management workflow.

## Base URL
```
http://localhost:8000/api
```

## Authentication
All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer {your_token_here}
```

The API uses Laravel Sanctum for token-based authentication. Tokens are obtained through the login endpoint and should be included in subsequent requests.

---

## Quick Start

### 1. Register a New User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "01712345678",
  "password": "password123",
  "password_confirmation": "password123",
  "role": "customer"
}
```

### 2. Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

# Response includes token
{
  "user": {...},
  "token": "1|abc123..."
}
```

### 3. Use Token for Authenticated Requests
```bash
GET /api/auth/profile
Authorization: Bearer 1|abc123...
```

---

## Default Credentials

After running the seeder, you can use these test accounts:

**Super Admin:**
- Email: `admin@gadgetrevive.com`
- Password: `password`
- Access: Full system control, vendor approvals, CMS management, reports

**Vendor Account:**
- Register as vendor and complete onboarding
- Requires admin approval before activation

**Customer Account:**
- Register normally with role: "customer"
- Immediate access to browse and order

---

## API Endpoints

## 🔐 Authentication

### Register
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "01712345678",
  "password": "password123",
  "password_confirmation": "password123",
  "role": "customer"
}
```

**Response:** `201 Created`
```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "01712345678",
    "role": {
      "id": 4,
      "name": "customer"
    }
  },
  "token": "1|abc123..."
}
```

---

### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": {
      "id": 4,
      "name": "customer"
    }
  },
  "token": "1|abc123..."
}
```

---

### Verify Email
```http
POST /api/auth/verify-email
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "token": "verification_token_from_email"
}
```

---

### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "01712345678",
  "email_verified_at": "2025-12-27T10:00:00.000000Z",
  "role": {
    "id": 4,
    "name": "customer"
  }
}
```

---

### Update Profile
```http
PUT /api/auth/profile
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "name": "John Doe Updated",
  "phone": "01798765432",
  "current_password": "password123",
  "password": "newpassword123",
  "password_confirmation": "newpassword123"
}
```

---

### Logout
```http
POST /api/auth/logout
Authorization: Bearer {token}
```

---

## 🏪 Vendors

### Get All Vendors (Public)
```http
GET /api/vendors
```

**Query Parameters:**
- `search` - Search by business name or description
- `division_id` - Filter by division
- `district_id` - Filter by district
- `area_id` - Filter by area
- `rating_min` - Minimum rating (1-5)
- `per_page` - Items per page (default: 15)
- `page` - Page number

**Example:**
```
GET /api/vendors?division_id=1&rating_min=4&per_page=10
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "business_name": "Tech Repair Pro",
      "slug": "tech-repair-pro",
      "description": "Professional gadget repair services",
      "address": "123 Main Street, Dhaka",
      "division": {
        "id": 1,
        "name": "Dhaka"
      },
      "district": {
        "id": 1,
        "name": "Dhaka"
      },
      "area": {
        "id": 1,
        "name": "Gulshan"
      },
      "rating_average": 4.5,
      "total_reviews": 120,
      "total_orders": 350,
      "is_verified": true,
      "status": "approved"
    }
  ],
  "links": {...},
  "meta": {...}
}
```

---

### Get Vendor Details (Public)
```http
GET /api/vendors/{slug}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "business_name": "Tech Repair Pro",
  "slug": "tech-repair-pro",
  "description": "Professional gadget repair services",
  "address": "123 Main Street, Dhaka",
  "trade_license": "TL123456",
  "bkash_number": "01712345678",
  "payment_instructions": "Send payment to bKash and provide transaction ID",
  "rating_average": 4.5,
  "total_reviews": 120,
  "total_orders": 350,
  "services": [
    {
      "id": 1,
      "name": "Screen Replacement",
      "base_price": 2500,
      "category": {
        "id": 1,
        "name": "Smartphone Repair"
      }
    }
  ],
  "products": [
    {
      "id": 1,
      "name": "iPhone 13 Battery",
      "price": 4500,
      "stock_qty": 20
    }
  ]
}
```

---

### Vendor Onboarding (Authenticated)
```http
POST /api/vendor/onboarding
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "business_name": "Tech Repair Pro",
  "description": "Professional gadget repair services",
  "address": "123 Main Street, Dhaka",
  "division_id": 1,
  "district_id": 1,
  "area_id": 1,
  "trade_license": "TL123456",
  "bkash_number": "01712345678",
  "payment_instructions": "Send payment to bKash and provide transaction ID"
}
```

**Response:** `201 Created`
```json
{
  "message": "Vendor profile created successfully. Awaiting admin approval.",
  "vendor_profile": {
    "id": 1,
    "business_name": "Tech Repair Pro",
    "status": "pending"
  }
}
```

---

### Get Vendor Profile (Vendor Only)
```http
GET /api/vendor/profile
Authorization: Bearer {token}
```

---

### Update Vendor Profile (Vendor Only)
```http
PUT /api/vendor/profile
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "business_name": "Tech Repair Pro Updated",
  "description": "Updated description",
  "bkash_number": "01798765432"
}
```

---

## 🔧 Services

### Get All Services (Public)
```http
GET /api/services
```

**Query Parameters:**
- `category_id` - Filter by service category
- `vendor_id` - Filter by vendor
- `search` - Search by name or description
- `min_price` - Minimum price
- `max_price` - Maximum price
- `per_page` - Items per page (default: 15)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "name": "Screen Replacement",
      "code": "SRV-001",
      "description": "Professional screen replacement service",
      "base_price": 2500,
      "duration_estimate": 60,
      "category": {
        "id": 1,
        "name": "Smartphone Repair"
      },
      "vendor": {
        "id": 1,
        "business_name": "Tech Repair Pro",
        "rating_average": 4.5
      },
      "is_active": true
    }
  ],
  "links": {...},
  "meta": {...}
}
```

---

### Get Service Details (Public)
```http
GET /api/services/{id}
```

---

### Create Service (Vendor Only)
```http
POST /api/vendor/services
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "service_category_id": 1,
  "name": "Screen Replacement",
  "code": "SRV-001",
  "description": "Professional screen replacement service",
  "base_price": 2500,
  "duration_estimate": 60,
  "is_active": true
}
```

---

### Update Service (Vendor Only)
```http
PUT /api/vendor/services/{id}
Authorization: Bearer {token}
```

---

### Delete Service (Vendor Only)
```http
DELETE /api/vendor/services/{id}
Authorization: Bearer {token}
```

---

## 📦 Products

### Get All Products (Public)
```http
GET /api/products
```

**Query Parameters:**
- `category_id` - Filter by product category
- `vendor_id` - Filter by vendor
- `search` - Search by name or description
- `in_stock` - Filter by stock availability (true/false)
- `per_page` - Items per page (default: 15)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "sku": "PRD-001",
      "name": "iPhone 13 Battery",
      "description": "Original iPhone 13 replacement battery",
      "price": 4500,
      "stock_qty": 20,
      "low_stock_threshold": 5,
      "warranty_period": "6 months",
      "category": {
        "id": 1,
        "name": "Batteries"
      },
      "vendor": {
        "id": 1,
        "business_name": "Tech Repair Pro"
      },
      "is_active": true,
      "in_stock": true
    }
  ],
  "links": {...},
  "meta": {...}
}
```

---

### Get Product Details (Public)
```http
GET /api/products/{id}
```

---

### Create Product (Vendor Only)
```http
POST /api/vendor/products
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "product_category_id": 1,
  "sku": "PRD-001",
  "name": "iPhone 13 Battery",
  "description": "Original iPhone 13 replacement battery",
  "price": 4500,
  "stock_qty": 20,
  "low_stock_threshold": 5,
  "warranty_period": "6 months",
  "is_active": true
}
```

---

### Update Product (Vendor Only)
```http
PUT /api/vendor/products/{id}
Authorization: Bearer {token}
```

---

### Delete Product (Vendor Only)
```http
DELETE /api/vendor/products/{id}
Authorization: Bearer {token}
```

---

### Adjust Stock (Vendor Only)
```http
POST /api/vendor/products/{id}/adjust-stock
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "adjusted_qty": -5,
  "type": "damaged",
  "reason": "Water damaged batteries"
}
```

**Stock Adjustment Types:**
- `restock` - Adding new inventory
- `sale` - Manual sale (not through order)
- `damaged` - Damaged or defective items
- `returned` - Customer returns
- `correction` - Inventory correction

---

## 🛒 Cart

### Get Cart (Authenticated)
```http
GET /api/cart
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "items": [
    {
      "id": 1,
      "item_type": "product",
      "product": {
        "id": 1,
        "name": "iPhone 13 Battery",
        "price": 4500,
        "vendor": {
          "id": 1,
          "business_name": "Tech Repair Pro"
        }
      },
      "quantity": 2,
      "price": 4500,
      "subtotal": 9000,
      "notes": "Please check quality before shipping"
    },
    {
      "id": 2,
      "item_type": "service",
      "service": {
        "id": 1,
        "name": "Screen Replacement",
        "base_price": 2500,
        "vendor": {
          "id": 1,
          "business_name": "Tech Repair Pro"
        }
      },
      "quantity": 1,
      "price": 2500,
      "subtotal": 2500
    }
  ],
  "total": 11500
}
```

---

### Add Item to Cart (Authenticated)
```http
POST /api/cart/items
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "item_type": "product",
  "item_id": 1,
  "quantity": 2,
  "notes": "Please check quality before shipping"
}
```

**Item Types:**
- `product` - Physical products
- `service` - Repair services

---

### Update Cart Item (Authenticated)
```http
PUT /api/cart/items/{id}
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "quantity": 3,
  "notes": "Updated notes"
}
```

---

### Remove Cart Item (Authenticated)
```http
DELETE /api/cart/items/{id}
Authorization: Bearer {token}
```

---

### Clear Cart (Authenticated)
```http
DELETE /api/cart
Authorization: Bearer {token}
```

---

## 📋 Orders

### Checkout (Customer Only)
```http
POST /api/orders/checkout
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "vendor_profile_id": 1,
  "payment_method": "bkash",
  "delivery_address": "123 Main St, Dhaka",
  "division_id": 1,
  "district_id": 1,
  "area_id": 1,
  "contact_phone": "01712345678",
  "customer_notes": "Please call before delivery"
}
```

**Payment Methods:**
- `bkash` - bKash mobile payment
- `cash` - Cash on delivery/service
- `bank_transfer` - Bank transfer

**Response:** `201 Created`
```json
{
  "message": "Order placed successfully",
  "order": {
    "id": 1,
    "order_number": "ORD-20251227-0001",
    "status": "pending",
    "total_amount": 11500,
    "payment_method": "bkash",
    "payment_status": "pending",
    "payment_instructions": "Send payment to bKash: 01712345678 and provide transaction ID",
    "items": [...]
  }
}
```

---

### Get My Orders (Customer Only)
```http
GET /api/orders
Authorization: Bearer {token}
```

**Query Parameters:**
- `status` - Filter by order status
- `per_page` - Items per page (default: 15)

**Order Statuses:**
- `pending` - Awaiting vendor confirmation
- `confirmed` - Vendor accepted
- `in_progress` - Work in progress
- `completed` - Order completed
- `cancelled` - Order cancelled
- `rejected` - Vendor rejected

---

### Get Order Details (Customer Only)
```http
GET /api/orders/{id}
Authorization: Bearer {token}
```

---

### Cancel Order (Customer Only)
```http
POST /api/orders/{id}/cancel
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "cancellation_reason": "Changed my mind"
}
```

---

### Submit Payment Notice (Customer Only)
```http
POST /api/orders/{id}/payment-notice
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "transaction_reference": "TRX123456789",
  "amount": 11500,
  "notes": "Paid via bKash on Dec 27, 2025"
}
```

---

## 🏪 Vendor Orders

### Get Vendor Orders (Vendor Only)
```http
GET /api/vendor/orders
Authorization: Bearer {token}
```

**Query Parameters:**
- `status` - Filter by order status
- `payment_status` - Filter by payment status (pending/paid/failed)
- `per_page` - Items per page (default: 15)

---

### Accept Order (Vendor Only)
```http
POST /api/vendor/orders/{id}/accept
Authorization: Bearer {token}
```

---

### Reject Order (Vendor Only)
```http
POST /api/vendor/orders/{id}/reject
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "reason": "Out of stock"
}
```

---

### Update Order Status (Vendor Only)
```http
PATCH /api/vendor/orders/{id}/status
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "status": "in_progress",
  "vendor_notes": "Started working on the repair"
}
```

---

### Mark Payment Received (Vendor Only)
```http
POST /api/vendor/orders/{id}/payment-received
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "transaction_reference": "TRX123456789",
  "amount": 11500
}
```

---

## ⭐ Reviews

### Submit Review (Customer Only)
```http
POST /api/reviews
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "order_id": 1,
  "rating": 5,
  "comment": "Excellent service! Very professional and quick."
}
```

**Rating:** 1-5 stars

---

### Get Vendor Reviews (Public)
```http
GET /api/vendors/{vendorId}/reviews
```

**Query Parameters:**
- `per_page` - Items per page (default: 15)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "rating": 5,
      "comment": "Excellent service! Very professional and quick.",
      "customer": {
        "id": 1,
        "name": "John Doe"
      },
      "order": {
        "id": 1,
        "order_number": "ORD-20251227-0001"
      },
      "vendor_reply": "Thank you for your kind words!",
      "created_at": "2025-12-27T10:00:00.000000Z"
    }
  ],
  "links": {...},
  "meta": {...}
}
```

---

### Reply to Review (Vendor Only)
```http
POST /api/vendor/reviews/{id}/reply
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "vendor_reply": "Thank you for your kind words! We're glad you're satisfied."
}
```

---

## 🎫 Support Tickets

### Create Ticket (Authenticated)
```http
POST /api/tickets
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "subject": "Issue with my order",
  "message": "I haven't received my order yet",
  "order_id": 1,
  "priority": "high"
}
```

**Priority Levels:**
- `low` - General inquiries
- `medium` - Standard support
- `high` - Urgent issues

---

### Get My Tickets (Authenticated)
```http
GET /api/tickets
Authorization: Bearer {token}
```

**Query Parameters:**
- `status` - Filter by status (open/in_progress/resolved/closed)
- `priority` - Filter by priority
- `per_page` - Items per page (default: 15)

---

### Get Ticket Details (Authenticated)
```http
GET /api/tickets/{id}
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "ticket_number": "TICKET-20251227-0001",
  "subject": "Issue with my order",
  "status": "open",
  "priority": "high",
  "order": {
    "id": 1,
    "order_number": "ORD-20251227-0001"
  },
  "messages": [
    {
      "id": 1,
      "message": "I haven't received my order yet",
      "sender": {
        "id": 1,
        "name": "John Doe",
        "role": "customer"
      },
      "created_at": "2025-12-27T10:00:00.000000Z"
    },
    {
      "id": 2,
      "message": "We're checking on your order status",
      "sender": {
        "id": 2,
        "name": "Support Agent",
        "role": "admin"
      },
      "created_at": "2025-12-27T10:15:00.000000Z"
    }
  ]
}
```

---

### Add Message to Ticket (Authenticated)
```http
POST /api/tickets/{id}/messages
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "message": "Any update on this?"
}
```

---

### Close Ticket (Authenticated)
```http
POST /api/tickets/{id}/close
Authorization: Bearer {token}
```

---

## 📍 Locations

### Get Divisions (Public)
```http
GET /api/locations/divisions
```

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Dhaka",
    "bn_name": "ঢাকা"
  },
  {
    "id": 2,
    "name": "Chittagong",
    "bn_name": "চট্টগ্রাম"
  }
]
```

---

### Get Districts by Division (Public)
```http
GET /api/locations/divisions/{divisionId}/districts
```

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "division_id": 1,
    "name": "Dhaka",
    "bn_name": "ঢাকা"
  }
]
```

---

### Get Areas by District (Public)
```http
GET /api/locations/districts/{districtId}/areas
```

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "district_id": 1,
    "name": "Gulshan",
    "bn_name": "গুলশান",
    "type": "thana"
  }
]
```

---

## 👨‍💼 Admin - Vendor Management

### Get Pending Vendors (Admin Only)
```http
GET /api/admin/vendors/pending
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "business_name": "Tech Repair Pro",
      "status": "pending",
      "user": {
        "id": 2,
        "name": "Vendor Owner",
        "email": "vendor@example.com"
      },
      "trade_license": "TL123456",
      "created_at": "2025-12-27T10:00:00.000000Z"
    }
  ]
}
```

---

### Approve Vendor (Admin Only)
```http
POST /api/admin/vendors/{id}/approve
Authorization: Bearer {token}
```

---

### Reject Vendor (Admin Only)
```http
POST /api/admin/vendors/{id}/reject
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "rejection_reason": "Invalid trade license"
}
```

---

### Request More Info (Admin Only)
```http
POST /api/admin/vendors/{id}/request-info
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "info_request": "Please provide clearer images of your trade license"
}
```

---

## 📄 Admin - CMS Management

### Get All Pages (Admin Only)
```http
GET /api/admin/cms/pages
Authorization: Bearer {token}
```

---

### Create Page (Admin Only)
```http
POST /api/admin/cms/pages
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "title": "About Us",
  "slug": "about-us",
  "content": "<h1>About Gadget Revive</h1><p>We connect customers with trusted repair vendors...</p>",
  "meta_title": "About Us - Gadget Revive",
  "meta_description": "Learn about Gadget Revive marketplace",
  "is_active": true
}
```

---

### Update Page (Admin Only)
```http
PUT /api/admin/cms/pages/{id}
Authorization: Bearer {token}
```

---

### Delete Page (Admin Only)
```http
DELETE /api/admin/cms/pages/{id}
Authorization: Bearer {token}
```

---

### Get Banners (Admin Only)
```http
GET /api/admin/cms/banners
Authorization: Bearer {token}
```

---

### Create Banner (Admin Only)
```http
POST /api/admin/cms/banners
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "title": "Summer Sale",
  "description": "Get 20% off on all repairs",
  "image": "banners/summer-sale.jpg",
  "link": "/services",
  "position": "home_slider",
  "is_active": true
}
```

**Banner Positions:**
- `home_slider` - Homepage main slider
- `home_sidebar` - Homepage sidebar
- `category_top` - Top of category pages

---

### Get Service Categories (Admin Only)
```http
GET /api/admin/cms/service-categories
Authorization: Bearer {token}
```

---

### Create Service Category (Admin Only)
```http
POST /api/admin/cms/service-categories
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "name": "Laptop Repair",
  "slug": "laptop-repair",
  "description": "All types of laptop repair services",
  "is_active": true
}
```

---

### Get Product Categories (Admin Only)
```http
GET /api/admin/cms/product-categories
Authorization: Bearer {token}
```

---

### Create Product Category (Admin Only)
```http
POST /api/admin/cms/product-categories
Authorization: Bearer {token}
```

---

### Get FAQs (Admin Only)
```http
GET /api/admin/cms/faqs
Authorization: Bearer {token}
```

---

### Create FAQ (Admin Only)
```http
POST /api/admin/cms/faqs
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "question": "How long does repair take?",
  "answer": "Most repairs are completed within 24-48 hours depending on the service.",
  "category": "general",
  "display_order": 1,
  "is_active": true
}
```

---

## 📊 Admin - Reports

### Dashboard Stats (Admin Only)
```http
GET /api/admin/reports/dashboard
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "total_vendors": 150,
  "active_vendors": 120,
  "pending_vendors": 10,
  "total_customers": 5000,
  "total_orders": 8500,
  "pending_orders": 45,
  "total_revenue": 1500000,
  "this_month_revenue": 250000,
  "total_services": 450,
  "total_products": 680,
  "low_stock_products": 12,
  "open_tickets": 8
}
```

---

### Sales Report (Admin Only)
```http
GET /api/admin/reports/sales
Authorization: Bearer {token}
```

**Query Parameters:**
- `start_date` - Start date (YYYY-MM-DD)
- `end_date` - End date (YYYY-MM-DD)
- `vendor_id` - Filter by vendor
- `per_page` - Items per page (default: 15)

**Response:** `200 OK`
```json
{
  "summary": {
    "total_orders": 450,
    "total_revenue": 500000,
    "average_order_value": 1111,
    "completed_orders": 420,
    "cancelled_orders": 30
  },
  "orders": {
    "data": [...],
    "links": {...},
    "meta": {...}
  }
}
```

---

### Inventory Report (Admin Only)
```http
GET /api/admin/reports/inventory
Authorization: Bearer {token}
```

**Query Parameters:**
- `vendor_id` - Filter by vendor
- `low_stock` - Show only low stock items (true/false)

**Response:** `200 OK`
```json
{
  "summary": {
    "total_products": 680,
    "in_stock_products": 650,
    "out_of_stock_products": 30,
    "low_stock_products": 12,
    "total_inventory_value": 2500000
  },
  "products": [...]
}
```

---

### Audit Logs (Admin Only)
```http
GET /api/admin/reports/audit-logs
Authorization: Bearer {token}
```

**Query Parameters:**
- `user_id` - Filter by user
- `action` - Filter by action (create/update/delete)
- `resource_type` - Filter by resource type (Order/Product/User/etc.)
- `per_page` - Items per page (default: 20)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "user": {
        "id": 1,
        "name": "Admin User"
      },
      "action": "create",
      "resource_type": "Order",
      "resource_id": 1,
      "old_values": null,
      "new_values": {
        "order_number": "ORD-20251227-0001",
        "total_amount": 11500
      },
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2025-12-27T10:00:00.000000Z"
    }
  ],
  "links": {...},
  "meta": {...}
}
```

---

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "message": "Validation error",
  "errors": {
    "email": ["The email field is required."],
    "password": ["The password must be at least 8 characters."]
  }
}
```

### 401 Unauthorized
```json
{
  "message": "Unauthenticated."
}
```

### 403 Forbidden
```json
{
  "message": "This action is unauthorized."
}
```

### 404 Not Found
```json
{
  "message": "Resource not found."
}
```

### 422 Unprocessable Entity
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "quantity": ["The quantity must be at least 1."]
  }
}
```

### 500 Internal Server Error
```json
{
  "message": "Server Error"
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authentication endpoints**: 5 requests per minute
- **General API**: 60 requests per minute per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1640000000
```

---

## Pagination

All list endpoints return paginated results using Laravel's pagination:

**Response Structure:**
```json
{
  "data": [...],
  "links": {
    "first": "http://localhost:8000/api/vendors?page=1",
    "last": "http://localhost:8000/api/vendors?page=10",
    "prev": null,
    "next": "http://localhost:8000/api/vendors?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 10,
    "per_page": 15,
    "to": 15,
    "total": 150
  }
}
```

---

## Best Practices

### 1. Authentication
- Always store tokens securely
- Refresh tokens periodically
- Logout on session end

### 2. Error Handling
- Check response status codes
- Display validation errors to users
- Implement retry logic for failed requests

### 3. Performance
- Use pagination parameters appropriately
- Cache responses where possible
- Implement debouncing for search queries

### 4. Security
- Use HTTPS in production
- Validate all user inputs
- Never expose sensitive data in URLs

---

## Testing

Use the included Postman collection (`docs/postman_collection.json`) for easy API testing:

1. Import the collection into Postman
2. Set the `base_url` environment variable
3. Login using the authentication endpoints
4. The token will be automatically saved for subsequent requests

---

## Support

For issues or questions:
- Create a ticket through the API
- Contact: admin@gadgetrevive.com
- Check the setup guide: `docs/SETUP_GUIDE.md`

---

## Changelog

### Version 1.0.0 (December 27, 2025)
- Initial release
- Complete marketplace functionality
- Role-based access control
- Vendor management system
- Order workflow
- Review system
- Support ticketing
- Admin CMS and reporting
- Bangladesh location system
- Manual payment processing

---

**© 2025 Gadget Revive. All rights reserved.**
