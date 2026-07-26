import apiClient from './config';
import {
  Order,
  CheckoutRequest,
  PaymentNoticeRequest,
  PaginatedResponse,
  ApiResponse
} from '../types';

export const orderService = {
  /**
   * Place order from cart (customer only)
   */
  placeOrder: async (data: CheckoutRequest): Promise<Order> => {
    const response = await apiClient.post('/orders', data);
    const result = response.data.data;
    // API returns { order: {...}, payment_instructions: ... }
    return result.order || result;
  },

  /**
   * Place direct service order (customer only)
   */
  placeServiceOrder: async (data: {
    service_id: number;
    vendor_profile_id: number;
    payment_method: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    customer_address: string;
    division_id: number;
    district_id: number;
    area_id?: number;
    customer_notes?: string;
  }): Promise<Order> => {
    const response = await apiClient.post('/orders/service', data);
    const result = response.data.data;
    // API returns { order: {...}, payment_instructions: ... }
    return result.order || result;
  },

  /**
   * Get my orders (customer only)
   */
  getMyOrders: async (params?: {
    status?: string;
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<Order>> => {
    const response = await apiClient.get('/orders', { params });
    return {
      data: response.data.data || [],
      meta: response.data.meta || { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: response.data.links || { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Get order by ID (customer only)
   */
  getById: async (id: number): Promise<Order> => {
    const response = await apiClient.get(`/orders/${id}`);
    return response.data.data;
  },

  /**
   * Cancel order (customer only)
   */
  cancel: async (id: number, cancellation_reason: string): Promise<Order> => {
    const response = await apiClient.post(`/orders/${id}/cancel`, { cancellation_reason });
    return response.data.data;
  },

  /**
   * Submit payment proof (customer only)
   */
  submitPaymentProof: async (id: number, data: PaymentNoticeRequest): Promise<Order> => {
    const response = await apiClient.post(`/orders/${id}/payment-proof`, data);
    return response.data.data;
  },

  // Vendor Order Management

  /**
   * Get vendor orders (vendor only)
   */
  getVendorOrders: async (params?: {
    status?: string;
    payment_status?: string;
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<Order>> => {
    const response = await apiClient.get('/vendor/orders', { params });
    return {
      data: response.data.data || [],
      meta: response.data.meta || { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: response.data.links || { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Update order status (vendor only)
   */
  updateOrderStatus: async (id: number, status: string, vendor_notes?: string): Promise<Order> => {
    const response = await apiClient.put(`/vendor/orders/${id}/status`, {
      status,
      vendor_notes
    });
    return response.data.data;
  },

  /**
   * Confirm payment (vendor only)
   */
  confirmPayment: async (id: number): Promise<Order> => {
    const response = await apiClient.post(`/vendor/orders/${id}/confirm-payment`);
    return response.data.data;
  },

  // ─── Invoice Methods ─────────────────────────────────────────────────

  /**
   * Download invoice PDF for a given order (customer: own orders only)
   */
  downloadInvoice: async (id: number): Promise<Blob> => {
    const response = await apiClient.get(`/invoices/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get a streaming URL for an invoice PDF (opens in new tab)
   * Returns the full URL with auth token as a query param for streaming.
   */
  getInvoiceStreamUrl: (id: number): string => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '';
    return `${baseUrl}/invoices/${id}/stream?token=${token}`;
  },

  /**
   * Send invoice to the customer's registered email
   */
  sendInvoiceEmail: async (id: number): Promise<{ sent_to: string }> => {
    const response = await apiClient.post(`/invoices/${id}/send`);
    return response.data.data;
  },
};
