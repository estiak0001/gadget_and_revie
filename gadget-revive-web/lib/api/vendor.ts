import apiClient from './config';
import { 
  VendorProfile, 
  VendorOnboardingRequest,
  PaginatedResponse,
  ApiResponse 
} from '../types';

export const vendorService = {
  /**
   * Register as new vendor (public - no auth required)
   */
  register: async (data: any): Promise<any> => {
    const response = await apiClient.post('/auth/register/vendor', data);
    return response.data.data;
  },

  /**
   * Get all vendors (public)
   */
  getAll: async (params?: {
    search?: string;
    division_id?: number;
    district_id?: number;
    area_id?: number;
    rating_min?: number;
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<VendorProfile>> => {
    const response = await apiClient.get('/vendors', { params });
    return {
      data: response.data.data || [],
      meta: response.data.meta || { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: response.data.links || { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Get vendor by ID (public)
   */
  getById: async (id: number): Promise<VendorProfile> => {
    const response = await apiClient.get(`/vendors/${id}`);
    return response.data.data;
  },

  /**
   * Get vendor profile (vendor only)
   */
  getProfile: async (): Promise<VendorProfile> => {
    const response = await apiClient.get('/vendor/profile');
    return response.data.data;
  },

  /**
   * Update vendor profile (vendor only)
   */
  updateProfile: async (data: Partial<VendorOnboardingRequest>): Promise<VendorProfile> => {
    const response = await apiClient.put('/vendor/profile', data);
    return response.data.data;
  },
};
