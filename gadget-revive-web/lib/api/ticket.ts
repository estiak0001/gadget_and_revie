import apiClient from './config';
import { 
  Ticket, 
  CreateTicketRequest,
  AddTicketMessageRequest,
  PaginatedResponse,
  ApiResponse 
} from '../types';

export const ticketService = {
  /**
   * Create ticket (authenticated)
   */
  create: async (data: CreateTicketRequest): Promise<Ticket> => {
    const response = await apiClient.post('/tickets', data);
    return response.data.data;
  },

  /**
   * Get my tickets (authenticated)
   */
  getMyTickets: async (params?: {
    status?: string;
    priority?: string;
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<Ticket>> => {
    const response = await apiClient.get('/tickets', { params });
    return {
      data: response.data.data || [],
      meta: response.data.meta || { current_page: 1, last_page: 1, per_page: 15, total: 0, from: 0, to: 0 },
      links: response.data.links || { first: '', last: '', prev: null, next: null },
    };
  },

  /**
   * Get ticket by ID (authenticated)
   */
  getById: async (id: number): Promise<Ticket> => {
    const response = await apiClient.get(`/tickets/${id}`);
    return response.data.data;
  },

  /**
   * Add message to ticket (authenticated)
   */
  addMessage: async (id: number, data: AddTicketMessageRequest): Promise<Ticket> => {
    const response = await apiClient.post(`/tickets/${id}/messages`, data);
    return response.data.data;
  },

  /**
   * Close ticket (authenticated)
   */
  close: async (id: number): Promise<Ticket> => {
    const response = await apiClient.post(`/tickets/${id}/close`);
    return response.data.data;
  },
};
