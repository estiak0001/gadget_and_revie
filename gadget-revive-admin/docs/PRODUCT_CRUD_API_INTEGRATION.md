# Product CRUD API Integration Guide

## Overview
Complete API documentation for integrating Product CRUD operations in the frontend application.

**Base URL:** `http://localhost:8000/api/admin/products`

**Authentication:** All requests require Bearer token authentication.

---

## Table of Contents
- [Authentication](#authentication)
- [List Products](#1-list-products)
- [Get Single Product](#2-get-single-product)
- [Create Product](#3-create-product)
- [Update Product](#4-update-product)
- [Delete Product](#5-delete-product)
- [Toggle Active Status](#6-toggle-active-status)
- [Frontend Implementation Examples](#frontend-implementation-examples)
- [Field Mappings](#field-mappings-for-frontend)
- [Error Handling](#error-handling)

---

## Authentication

All requests require the following headers:

### For JSON Requests
```javascript
headers: {
  'Authorization': 'Bearer YOUR_TOKEN',
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}
```

### For File Upload Requests
```javascript
headers: {
  'Authorization': 'Bearer YOUR_TOKEN',
  'Content-Type': 'multipart/form-data'
}
```

---

## 1. LIST PRODUCTS

**Endpoint:** `GET /api/admin/products`

Get paginated list of products with filtering and sorting capabilities.

### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | integer | Page number | `1` |
| `per_page` | integer | Items per page (max: 100) | `15` |
| `category_id` | integer | Filter by category | `5` |
| `vendor_id` | integer | Filter by vendor | `12` |
| `is_active` | boolean | Filter by status | `true` |
| `is_featured` | boolean | Filter featured products | `true` |
| `stock_status` | string | `low`, `out`, or `in` | `low` |
| `min_price` | number | Minimum price filter | `100` |
| `max_price` | number | Maximum price filter | `5000` |
| `search` | string | Search in name/description/sku/brand | `GPU` |
| `sort_by` | string | Sort field: `created_at`, `name`, `price`, `stock_qty` | `created_at` |
| `sort_order` | string | `asc` or `desc` | `desc` |

### Example Request
```javascript
GET /api/admin/products?page=1&per_page=15&category_id=5&search=GPU&sort_by=price&sort_order=asc
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": 1,
      "vendor_profile_id": 2,
      "category_id": 5,
      "sku": "GPU-RTX-3060",
      "name": "NVIDIA GeForce RTX 3060",
      "name_bn": null,
      "slug": "nvidia-geforce-rtx-3060",
      "description": "<p>Professional graphics card...</p>",
      "short_description": "High-performance GPU for gaming",
      "price": "35000.00",
      "discount_price": "32000.00",
      "stock_qty": 10,
      "low_stock_threshold": 5,
      "unit": "piece",
      "image": "/storage/products/rtx-3060.jpg",
      "gallery": [
        "/storage/products/gallery/rtx-3060-1.jpg",
        "/storage/products/gallery/rtx-3060-2.jpg"
      ],
      "specifications": {
        "Brand": "NVIDIA",
        "GPU Model": "RTX 3060",
        "Memory": "12GB GDDR6",
        "Interface": "PCIe 4.0",
        "Warranty": "3 years"
      },
      "brand": "NVIDIA",
      "model": "RTX 3060",
      "warranty": "3 years",
      "is_active": true,
      "is_featured": false,
      "sort_order": 0,
      "created_at": "2026-02-15T10:00:00.000000Z",
      "updated_at": "2026-02-15T10:00:00.000000Z",
      "category": {
        "id": 5,
        "name": "Graphics Cards",
        "slug": "graphics-cards"
      },
      "vendorProfile": {
        "id": 2,
        "business_name": "Tech Store BD",
        "contact_number": "+8801712345678"
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 3,
    "per_page": 15,
    "total": 42,
    "from": 1,
    "to": 15
  }
}
```

---

## 2. GET SINGLE PRODUCT

**Endpoint:** `GET /api/admin/products/{id}`

Get detailed information for a specific product.

### Example Request
```javascript
GET /api/admin/products/1
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "vendor_profile_id": 2,
    "category_id": 5,
    "sku": "GPU-RTX-3060",
    "name": "NVIDIA GeForce RTX 3060",
    "price": "35000.00",
    "discount_price": "32000.00",
    "stock_qty": 10,
    "low_stock_threshold": 5,
    "unit": "piece",
    "image": "/storage/products/rtx-3060.jpg",
    "gallery": [...],
    "specifications": {...},
    "category": {...},
    "vendorProfile": {...},
    "inventoryLogs": [
      {
        "id": 1,
        "quantity_change": 10,
        "type": "initial_stock",
        "created_at": "2026-02-15T10:00:00.000000Z"
      }
    ]
  }
}
```

---

## 3. CREATE PRODUCT

**Endpoint:** `POST /api/admin/products`

Create a new product with multipart/form-data for file uploads.

### Request Body (FormData)

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `vendor_profile_id` | integer | Yes | exists:vendor_profiles,id | Vendor ID |
| `category_id` | integer | Yes | exists:product_categories,id | Category ID |
| `sku` | string | No | unique, max:191 | Product SKU |
| `name` | string | Yes | max:255 | Product name |
| `name_bn` | string | No | max:255 | Product name in Bengali |
| `description` | text | No | - | Full description (supports HTML) |
| `short_description` | string | No | max:500 | Brief description |
| `price` | number | Yes | numeric, min:0 | Product price |
| `discount_price` | number | No | numeric, min:0 | Discounted price |
| `stock_qty` | integer | Yes | integer, min:0 | Stock quantity |
| `low_stock_threshold` | integer | No | integer, min:0 | Default: 5 |
| `unit` | string | No | max:50 | Default: "piece" |
| `image` | file | No | image, max:4096 KB | Main product image |
| `gallery[]` | file[] | No | images, max:4096 KB each | Gallery images |
| `specifications` | JSON | No | array/object | Technical specs |
| `brand` | string | No | max:255 | Brand name |
| `model` | string | No | max:255 | Model number |
| `warranty` | string | No | max:255 | Warranty information |
| `is_active` | boolean | No | boolean | Default: true |
| `is_featured` | boolean | No | boolean | Default: false |
| `sort_order` | integer | No | integer | Display order |

### Example Request (JavaScript)
```javascript
const formData = new FormData();

// Required fields
formData.append('vendor_profile_id', 2);
formData.append('category_id', 5);
formData.append('name', 'NVIDIA GeForce RTX 3060');
formData.append('price', 35000);
formData.append('stock_qty', 10);

// Optional fields
formData.append('sku', 'GPU-RTX-3060');
formData.append('name_bn', 'এনভিডিয়া জিফোর্স আরটিএক্স 3060');
formData.append('description', '<p>Professional graphics card for gaming...</p>');
formData.append('short_description', 'High-performance GPU');
formData.append('discount_price', 32000);
formData.append('low_stock_threshold', 5);
formData.append('unit', 'piece');
formData.append('brand', 'NVIDIA');
formData.append('model', 'RTX 3060');
formData.append('warranty', '3 years');
formData.append('is_active', true);
formData.append('is_featured', false);
formData.append('sort_order', 0);

// Main image
formData.append('image', imageFile);

// Gallery images (multiple)
formData.append('gallery[]', galleryFile1);
formData.append('gallery[]', galleryFile2);
formData.append('gallery[]', galleryFile3);

// Specifications as JSON
const specifications = {
  "Brand": "NVIDIA",
  "GPU Model": "RTX 3060",
  "Memory": "12GB GDDR6",
  "Interface": "PCIe 4.0",
  "Warranty": "3 years"
};
formData.append('specifications', JSON.stringify(specifications));

// Send request
const response = await fetch('/api/admin/products', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData
});
```

### Response (201 Created)
```json
{
  "success": true,
  "message": "Product created",
  "data": {
    "id": 1,
    "name": "NVIDIA GeForce RTX 3060",
    "sku": "GPU-RTX-3060",
    "price": "35000.00",
    "discount_price": "32000.00",
    "stock_qty": 10,
    "image": "/storage/products/rtx-3060.jpg",
    "gallery": [...],
    "specifications": {...},
    "created_at": "2026-02-15T10:00:00.000000Z"
  }
}
```

### Validation Error Response (422)
```json
{
  "success": false,
  "message": "The given data was invalid.",
  "errors": {
    "name": ["The name field is required."],
    "price": ["The price must be at least 0."],
    "sku": ["The sku has already been taken."]
  }
}
```

---

## 4. UPDATE PRODUCT

**Endpoint:** `PUT /api/admin/products/{id}`

**Note:** For file uploads, use `POST` method with `_method=PUT` override.

### Request Body (FormData)

Same fields as CREATE, but all are optional. Use `_method=PUT` when uploading files.

### Example Request (JavaScript)
```javascript
const formData = new FormData();
formData.append('_method', 'PUT'); // Laravel method override for file uploads

// Update only specific fields
formData.append('name', 'Updated Product Name');
formData.append('price', 36000);
formData.append('discount_price', 33000);
formData.append('stock_qty', 15);
formData.append('is_featured', true);

// Update image (optional)
if (newImageFile) {
  formData.append('image', newImageFile);
}

// Add new gallery images (optional)
if (newGalleryFiles.length > 0) {
  newGalleryFiles.forEach(file => {
    formData.append('gallery[]', file);
  });
}

// Update specifications (partial update supported)
const updatedSpecs = {
  "Brand": "NVIDIA",
  "GPU Model": "RTX 3060 Ti",  // Updated
  "Memory": "8GB GDDR6",        // Updated
  "NewField": "New Value"       // Added
};
formData.append('specifications', JSON.stringify(updatedSpecs));

// Send request
const response = await fetch(`/api/admin/products/${productId}`, {
  method: 'POST', // Use POST with _method override
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData
});
```

### Alternative: JSON Update (without files)
```javascript
const response = await fetch(`/api/admin/products/${productId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify({
    name: 'Updated Product Name',
    price: 36000,
    stock_qty: 15,
    is_featured: true
  })
});
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Product updated",
  "data": {
    "id": 1,
    "name": "Updated Product Name",
    "price": "36000.00",
    "stock_qty": 15,
    "updated_at": "2026-02-15T12:00:00.000000Z"
  }
}
```

---

## 5. DELETE PRODUCT

**Endpoint:** `DELETE /api/admin/products/{id}`

Soft delete a product (sets `deleted_at` timestamp).

### Example Request
```javascript
const response = await fetch(`/api/admin/products/${productId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
});
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Product deleted",
  "data": null
}
```

---

## 6. TOGGLE ACTIVE STATUS

**Endpoint:** `PUT /api/admin/products/{id}/toggle-status`

Toggle product active/inactive status.

### Example Request
```javascript
const response = await fetch(`/api/admin/products/${productId}/toggle-status`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
});
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Product activated",  // or "Product deactivated"
  "data": {
    "id": 1,
    "name": "NVIDIA GeForce RTX 3060",
    "is_active": true,
    "updated_at": "2026-02-15T12:00:00.000000Z"
  }
}
```

---

## Frontend Implementation Examples

### React/Next.js Service Class

```javascript
// services/productService.js
class ProductService {
  constructor(baseURL, getToken) {
    this.baseURL = baseURL;
    this.getToken = getToken;
  }

  async fetchProducts(filters = {}) {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== null && filters[key] !== undefined) {
        params.append(key, filters[key]);
      }
    });

    const response = await fetch(`${this.baseURL}/admin/products?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch products');
    return await response.json();
  }

  async getProduct(id) {
    const response = await fetch(`${this.baseURL}/admin/products/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch product');
    return await response.json();
  }

  async createProduct(productData, image, gallery) {
    const formData = new FormData();

    // Add text fields
    Object.keys(productData).forEach(key => {
      if (productData[key] !== null && productData[key] !== undefined) {
        if (key === 'specifications') {
          formData.append(key, JSON.stringify(productData[key]));
        } else {
          formData.append(key, productData[key]);
        }
      }
    });

    // Add main image
    if (image) {
      formData.append('image', image);
    }

    // Add gallery images
    if (gallery && gallery.length > 0) {
      gallery.forEach(file => {
        formData.append('gallery[]', file);
      });
    }

    const response = await fetch(`${this.baseURL}/admin/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return await response.json();
  }

  async updateProduct(id, updates, image, gallery) {
    const formData = new FormData();
    formData.append('_method', 'PUT');

    // Add updated fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== null && updates[key] !== undefined) {
        if (key === 'specifications') {
          formData.append(key, JSON.stringify(updates[key]));
        } else {
          formData.append(key, updates[key]);
        }
      }
    });

    // Add new image if provided
    if (image) {
      formData.append('image', image);
    }

    // Add new gallery images if provided
    if (gallery && gallery.length > 0) {
      gallery.forEach(file => {
        formData.append('gallery[]', file);
      });
    }

    const response = await fetch(`${this.baseURL}/admin/products/${id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return await response.json();
  }

  async deleteProduct(id) {
    const response = await fetch(`${this.baseURL}/admin/products/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to delete product');
    return await response.json();
  }

  async toggleStatus(id) {
    const response = await fetch(`${this.baseURL}/admin/products/${id}/toggle-status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to toggle status');
    return await response.json();
  }
}

export default ProductService;
```

### React Component Example

```javascript
// components/ProductList.jsx
import React, { useState, useEffect } from 'react';
import ProductService from '../services/productService';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    per_page: 15,
    search: '',
    category_id: null,
    is_active: null
  });
  const [meta, setMeta] = useState(null);

  const productService = new ProductService(
    'http://localhost:8000/api',
    () => localStorage.getItem('token')
  );

  useEffect(() => {
    loadProducts();
  }, [filters]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await productService.fetchProducts(filters);
      setProducts(response.data);
      setMeta(response.meta);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await productService.toggleStatus(id);
      loadProducts(); // Reload list
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await productService.deleteProduct(id);
        loadProducts(); // Reload list
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  return (
    <div>
      <h1>Products</h1>
      
      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
        />
      </div>

      {/* Product List */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>SKU</th>
              <th>Name</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td>
                  <img src={product.image} alt={product.name} width="50" />
                </td>
                <td>{product.sku}</td>
                <td>{product.name}</td>
                <td>
                  ৳{product.discount_price || product.price}
                  {product.discount_price && (
                    <span className="original-price">৳{product.price}</span>
                  )}
                </td>
                <td>
                  {product.stock_qty}
                  {product.stock_qty <= product.low_stock_threshold && (
                    <span className="low-stock">Low</span>
                  )}
                </td>
                <td>
                  <button onClick={() => handleToggleStatus(product.id)}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td>
                  <button onClick={() => handleDelete(product.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {meta && (
        <div className="pagination">
          <button 
            disabled={meta.current_page === 1}
            onClick={() => setFilters({...filters, page: meta.current_page - 1})}
          >
            Previous
          </button>
          <span>Page {meta.current_page} of {meta.last_page}</span>
          <button 
            disabled={meta.current_page === meta.last_page}
            onClick={() => setFilters({...filters, page: meta.current_page + 1})}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductList;
```

---

## Field Mappings for Frontend

### Display Product Card
```javascript
const formatProduct = (product) => ({
  id: product.id,
  image: product.image || '/placeholder.jpg',
  gallery: product.gallery || [],
  sku: product.sku,
  name: product.name,
  nameBn: product.name_bn,
  description: product.description,
  shortDescription: product.short_description,
  
  // Pricing
  price: parseFloat(product.price),
  discountPrice: product.discount_price ? parseFloat(product.discount_price) : null,
  displayPrice: product.discount_price ? parseFloat(product.discount_price) : parseFloat(product.price),
  discount: product.discount_price 
    ? Math.round((1 - parseFloat(product.discount_price) / parseFloat(product.price)) * 100)
    : 0,
  savings: product.discount_price 
    ? parseFloat(product.price) - parseFloat(product.discount_price)
    : 0,
  
  // Stock
  stock: product.stock_qty,
  lowStockThreshold: product.low_stock_threshold,
  inStock: product.stock_qty > 0,
  isLowStock: product.stock_qty <= product.low_stock_threshold && product.stock_qty > 0,
  isOutOfStock: product.stock_qty === 0,
  unit: product.unit,
  
  // Product details
  brand: product.brand,
  model: product.model,
  warranty: product.warranty,
  specifications: product.specifications || {},
  
  // Relations
  category: product.category?.name,
  categoryId: product.category?.id,
  vendor: product.vendorProfile?.business_name,
  vendorId: product.vendorProfile?.id,
  
  // Status
  isActive: product.is_active,
  isFeatured: product.is_featured,
  
  // Timestamps
  createdAt: new Date(product.created_at),
  updatedAt: new Date(product.updated_at),
});
```

### Specifications Display
```javascript
const SpecificationsTable = ({ specifications }) => (
  <table className="specifications">
    <tbody>
      {Object.entries(specifications).map(([key, value]) => (
        <tr key={key}>
          <th>{key}</th>
          <td>{value}</td>
        </tr>
      ))}
    </tbody>
  </table>
);
```

### Price Display Component
```javascript
const PriceDisplay = ({ product }) => {
  const hasDiscount = product.discount_price && product.discount_price < product.price;
  
  return (
    <div className="price">
      {hasDiscount ? (
        <>
          <span className="discount-price">৳{product.discount_price}</span>
          <span className="original-price">৳{product.price}</span>
          <span className="discount-badge">
            -{Math.round((1 - product.discount_price/product.price) * 100)}%
          </span>
        </>
      ) : (
        <span className="price">৳{product.price}</span>
      )}
    </div>
  );
};
```

### Stock Status Component
```javascript
const StockStatus = ({ product }) => {
  if (product.stock_qty === 0) {
    return <span className="badge out-of-stock">Out of Stock</span>;
  }
  
  if (product.stock_qty <= product.low_stock_threshold) {
    return (
      <span className="badge low-stock">
        Low Stock ({product.stock_qty} {product.unit})
      </span>
    );
  }
  
  return (
    <span className="badge in-stock">
      In Stock ({product.stock_qty} {product.unit})
    </span>
  );
};
```

---

## Error Handling

### Validation Errors (422)
```javascript
const handleValidationErrors = (response) => {
  if (!response.success && response.errors) {
    const formErrors = {};
    
    Object.keys(response.errors).forEach(field => {
      formErrors[field] = response.errors[field][0]; // First error message
    });
    
    return formErrors;
  }
  
  return null;
};

// Usage in form
try {
  const response = await productService.createProduct(formData);
  if (response.success) {
    // Success
    showSuccess('Product created successfully');
  }
} catch (error) {
  const formErrors = handleValidationErrors(error);
  if (formErrors) {
    setErrors(formErrors);
    showError('Please fix the form errors');
  } else {
    showError(error.message || 'An error occurred');
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "The given data was invalid.",
  "errors": {
    "name": ["The name field is required."],
    "price": ["The price must be at least 0."],
    "stock_qty": ["The stock qty field is required."],
    "image": ["The image must be an image.", "The image must not be greater than 4096 kilobytes."],
    "sku": ["The sku has already been taken."]
  }
}
```

---

## File Upload Best Practices

### Image Upload Guidelines
- **Main Image:** Single product image, max 4MB
- **Gallery:** Multiple images, each max 4MB
- **Formats:** JPG, JPEG, PNG, GIF, WEBP
- **Recommended Size:** 800x800px for main image, 1200x1200px for gallery

### File Validation on Frontend
```javascript
const validateImage = (file) => {
  const maxSize = 4 * 1024 * 1024; // 4MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (file.size > maxSize) {
    throw new Error('Image must be less than 4MB');
  }
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Image must be JPG, PNG, GIF, or WEBP');
  }
  
  return true;
};
```

### Image Preview Before Upload
```javascript
const handleImageSelect = (e) => {
  const file = e.target.files[0];
  
  try {
    validateImage(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      setImageFile(file);
    };
    reader.readAsDataURL(file);
  } catch (error) {
    showError(error.message);
  }
};
```

---

## Common Use Cases

### 1. Create Product with Full Data
```javascript
const productData = {
  vendor_profile_id: 2,
  category_id: 5,
  sku: 'GPU-RTX-3060',
  name: 'NVIDIA GeForce RTX 3060',
  name_bn: 'এনভিডিয়া জিফোর্স আরটিএক্স 3060',
  description: '<p>High-performance graphics card...</p>',
  short_description: 'Gaming GPU with ray tracing',
  price: 35000,
  discount_price: 32000,
  stock_qty: 10,
  low_stock_threshold: 5,
  unit: 'piece',
  brand: 'NVIDIA',
  model: 'RTX 3060',
  warranty: '3 years',
  is_active: true,
  is_featured: true,
  sort_order: 0,
  specifications: {
    "Brand": "NVIDIA",
    "GPU Model": "RTX 3060",
    "Memory": "12GB GDDR6",
    "Interface": "PCIe 4.0"
  }
};

const response = await productService.createProduct(
  productData,
  mainImageFile,
  galleryFiles
);
```

### 2. Update Only Price and Stock
```javascript
const updates = {
  price: 36000,
  discount_price: 33000,
  stock_qty: 15
};

const response = await productService.updateProduct(productId, updates);
```

### 3. Search and Filter Products
```javascript
const filters = {
  search: 'graphics card',
  category_id: 5,
  min_price: 20000,
  max_price: 50000,
  is_active: true,
  stock_status: 'in',
  sort_by: 'price',
  sort_order: 'asc',
  page: 1,
  per_page: 20
};

const response = await productService.fetchProducts(filters);
```

### 4. Bulk Toggle Featured Products
```javascript
const toggleFeaturedProducts = async (productIds, isFeatured) => {
  const promises = productIds.map(id =>
    productService.updateProduct(id, { is_featured: isFeatured })
  );
  
  await Promise.all(promises);
};
```

---

## Testing Checklist

- [ ] List all products with pagination
- [ ] Filter products by category
- [ ] Search products by name/SKU
- [ ] Get single product details
- [ ] Create product with required fields only
- [ ] Create product with all fields including gallery and specifications
- [ ] Update product name and price
- [ ] Update product image
- [ ] Add gallery images to existing product
- [ ] Update specifications
- [ ] Toggle product active status
- [ ] Delete product
- [ ] Handle validation errors
- [ ] Handle unauthorized access (401)
- [ ] Handle not found errors (404)
- [ ] Test file upload size limits
- [ ] Test duplicate SKU validation

---

## Notes

1. **File Upload Method Override:** When uploading files in update requests, use `POST` with `_method=PUT` instead of `PUT` directly.

2. **Specifications Format:** Send specifications as JSON string when using FormData, as object when using JSON requests.

3. **Gallery Management:** Uploading new gallery images will append to existing ones. To replace gallery completely, send updated gallery array.

4. **Soft Delete:** Deleted products are soft-deleted (not permanently removed from database).

5. **Slug Generation:** Product slug is auto-generated from name on creation.

6. **Default Values:** `unit` defaults to "piece", `low_stock_threshold` to 5, `is_active` to true, `is_featured` to false.

7. **Image Storage:** Images are stored in `storage/app/public/products/` and `storage/app/public/products/gallery/`.

---

**Last Updated:** February 15, 2026  
**API Version:** 1.0  
**Backend Framework:** Laravel 11.x
