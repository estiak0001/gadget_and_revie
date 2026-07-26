import apiClient from './config';
import {
  Product,
  CreateProductRequest,
  StockAdjustmentRequest,
  PaginatedResponse,
  ProductCategory,
  ProductBrand,
  CategoryFilterAttribute
} from '../types';

export const productService = {
  /**
   * Get all products (public)
   */
  getAll: async (params?: {
    category_id?: number;
    vendor_id?: number;
    search?: string;
    in_stock?: boolean;
    min_price?: number;
    max_price?: number;
    sort?: string;
    sort_by?: string;
    brand?: string;
    brand_id?: number;
    brand_ids?: number[];
    per_page?: number;
    page?: number;
    // Dynamic attribute filters: attribute_values[] = [valueId, valueId, ...]
    attribute_values?: number[];
  }): Promise<PaginatedResponse<Product>> => {
    const response = await apiClient.get('/products', { params });
    return {
      data: response.data.data || [],
      meta: response.data.meta || { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: response.data.links || { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Get the filter attributes available for a category (with per-value counts,
   * including all inherited attributes from ancestor categories).
   */
  getCategoryFilterAttributes: async (
    categoryId: number
  ): Promise<CategoryFilterAttribute[]> => {
    const response = await apiClient.get(`/categories/products/${categoryId}/filter-attributes`);
    return response.data.data || [];
  },

  /**
   * Search products (public)
   */
  search: async (query: string, params?: {
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<Product>> => {
    const response = await apiClient.get('/products/search', { params: { q: query, ...params } });
    return {
      data: response.data.data || [],
      meta: response.data.meta || { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: response.data.links || { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Get featured products (public)
   */
  getFeatured: async (): Promise<Product[]> => {
    const response = await apiClient.get('/products/featured');
    return response.data.data || [];
  },

  /**
   * Get products by category (public)
   */
  getByCategory: async (categoryId: number, params?: {
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<Product>> => {
    const response = await apiClient.get(`/products/category/${categoryId}`, { params });
    return {
      data: response.data.data || [],
      meta: response.data.meta || { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: response.data.links || { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Get product categories (public) — flat list
   */
  getCategories: async (): Promise<ProductCategory[]> => {
    const response = await apiClient.get('/categories/products');
    return response.data.data || [];
  },

  /**
   * Get product categories as a nested tree (root → children → grandchildren)
   */
  getCategoriesTree: async (): Promise<ProductCategory[]> => {
    const response = await apiClient.get('/categories/products/tree');
    return response.data.data || [];
  },

  /**
   * Get a single product category by slug (public)
   */
  getCategoryBySlug: async (slug: string): Promise<ProductCategory> => {
    const response = await apiClient.get(`/categories/products/${slug}`);
    return response.data.data;
  },

  /**
   * Get featured product categories (public)
   */
  getFeaturedCategories: async (): Promise<ProductCategory[]> => {
    const response = await apiClient.get('/categories/products', { params: { is_featured: true } });
    return response.data.data || [];
  },

  /**
   * Get product brands (public)
   */
  getBrands: async (): Promise<ProductBrand[]> => {
    const response = await apiClient.get('/product-brands');
    return response.data.data || [];
  },

  getBrandsByCategory: async (categoryId: number): Promise<ProductBrand[]> => {
    const response = await apiClient.get(`/product-brands/by-category/${categoryId}`);
    return response.data.data || [];
  },

  /**
   * Get product by ID (public)
   */
  getById: async (id: number): Promise<Product> => {
    const response = await apiClient.get(`/products/${id}`);
    return response.data.data;
  },

  /**
   * Get product by slug (public)
   */
  getBySlug: async (slug: string): Promise<Product> => {
    const response = await apiClient.get(`/products/${slug}`);
    return response.data.data;
  },

  /**
   * Check stock (public)
   */
  checkStock: async (id: number): Promise<{ in_stock: boolean; stock_qty: number }> => {
    const response = await apiClient.get(`/products/${id}/check-stock`);
    return response.data.data;
  },

  /**
   * Create product (vendor only)
   */
  create: async (data: CreateProductRequest): Promise<Product> => {
    const response = await apiClient.post('/vendor/products', data);
    return response.data.data;
  },

  /**
   * Update product (vendor only)
   */
  update: async (id: number, data: Partial<CreateProductRequest>): Promise<Product> => {
    const response = await apiClient.put(`/vendor/products/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete product (vendor only)
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/vendor/products/${id}`);
  },

  /**
   * Adjust stock (vendor only)
   */
  adjustStock: async (id: number, data: StockAdjustmentRequest): Promise<Product> => {
    const response = await apiClient.post(`/vendor/products/${id}/stock`, data);
    return response.data.data;
  },

  /**
   * Get vendor's products (vendor only)
   */
  getVendorProducts: async (): Promise<Product[]> => {
    const response = await apiClient.get('/vendor/products');
    return response.data.data || [];
  },
};
