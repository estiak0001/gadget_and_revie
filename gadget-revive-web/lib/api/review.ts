import apiClient from './config';
import { 
  Review, 
  CreateReviewRequest,
  PaginatedResponse 
} from '../types';

export const reviewService = {
  /**
   * Submit review (customer only)
   */
  create: async (data: CreateReviewRequest): Promise<Review> => {
    const response = await apiClient.post('/reviews', data);
    return response.data.data;
  },

  /**
   * Get vendor reviews (public)
   */
  getVendorReviews: async (vendorId: number, params?: {
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<Review>> => {
    const response = await apiClient.get(`/vendors/${vendorId}/reviews`, { params });
    return {
      data: response.data.data || [],
      meta: response.data.meta || { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: response.data.links || { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Reply to review (vendor only)
   */
  reply: async (id: number, vendor_reply: string): Promise<Review> => {
    const response = await apiClient.post(`/vendor/reviews/${id}/respond`, { vendor_reply });
    return response.data.data;
  },
};
