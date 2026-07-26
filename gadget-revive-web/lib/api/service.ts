import apiClient from './config';
import { 
  Service, 
  CreateServiceRequest,
  PaginatedResponse,
  ServiceCategory
} from '../types';

export const serviceService = {
  /**
   * Get all services (public)
   */
  getAll: async (params?: {
    category_id?: number;
    vendor_id?: number;
    search?: string;
    min_price?: number;
    max_price?: number;
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<Service>> => {
    const response = await apiClient.get('/services', { params });
    return {
      data: response.data.data || [],
      meta: response.data.meta || { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: response.data.links || { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Search services (public)
   */
  search: async (query: string, params?: {
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<Service>> => {
    const response = await apiClient.get('/services/search', { params: { q: query, ...params } });
    return {
      data: response.data.data || [],
      meta: response.data.meta || { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: response.data.links || { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Get featured services (public)
   */
  getFeatured: async (): Promise<Service[]> => {
    const response = await apiClient.get('/services/featured');
    return response.data.data || [];
  },

  /**
   * Get services by category (public)
   */
  getByCategory: async (categoryId: number, params?: {
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<Service>> => {
    const response = await apiClient.get(`/services/category/${categoryId}`, { params });
    return {
      data: response.data.data || [],
      meta: response.data.meta || { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: response.data.links || { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Get service categories (public) — flat list
   */
  getCategories: async (): Promise<ServiceCategory[]> => {
    const response = await apiClient.get('/categories/services');
    return response.data.data || [];
  },

  /**
   * Get service categories as a nested tree (root → children → grandchildren)
   */
  getCategoriesTree: async (): Promise<ServiceCategory[]> => {
    const response = await apiClient.get('/categories/services/tree');
    return response.data.data || [];
  },

  /**
   * Get service category by slug (public)
   */
  getCategoryBySlug: async (slug: string): Promise<ServiceCategory> => {
    const response = await apiClient.get(`/categories/services/${slug}`);
    return response.data.data;
  },

  /**
   * Get service by ID or slug (public)
   */
  getById: async (id: number | string): Promise<Service> => {
    const response = await apiClient.get(`/services/${id}`);
    return response.data.data;
  },

  /**
   * Create service (vendor only)
   */
  create: async (data: CreateServiceRequest): Promise<Service> => {
    const response = await apiClient.post('/vendor/services', data);
    return response.data.data;
  },

  /**
   * Update service (vendor only)
   */
  update: async (id: number, data: Partial<CreateServiceRequest>): Promise<Service> => {
    const response = await apiClient.put(`/vendor/services/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete service (vendor only)
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/vendor/services/${id}`);
  },

  /**
   * Get vendor's services (vendor only)
   */
  getVendorServices: async (): Promise<Service[]> => {
    const response = await apiClient.get('/vendor/services');
    return response.data.data || [];
  },
};
