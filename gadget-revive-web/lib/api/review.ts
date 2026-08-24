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
    // The backend wraps this as { reviews, pagination, stats } (see ReviewController::
    // vendorReviews()) rather than a flat paginator — unwrap it the same way getProductReviews
    // below does, instead of treating response.data.data as if it were the array itself.
    return {
      data: response.data.data?.reviews || [],
      meta: response.data.data?.pagination
        ? { ...response.data.data.pagination, from: 0, to: 0 }
        : { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Get approved reviews for one product (public) — used by the product detail page's Reviews
   * tab. Only reviews submitted with that product_id (via the token-based feedback flow) and
   * approved by an admin ever show up here.
   */
  getProductReviews: async (productId: number, params?: {
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<Review>> => {
    const response = await apiClient.get(`/products/${productId}/reviews`, { params });
    return {
      data: response.data.data?.reviews || [],
      meta: response.data.data?.pagination
        ? { ...response.data.data.pagination, from: 0, to: 0 }
        : { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Reply to review (vendor only)
   */
  reply: async (id: number, vendor_response: string): Promise<Review> => {
    const response = await apiClient.post(`/vendor/reviews/${id}/respond`, { response: vendor_response });
    return response.data.data;
  },
};
