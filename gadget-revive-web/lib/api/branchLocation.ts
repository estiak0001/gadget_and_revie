import apiClient from './config';

export interface BranchLocation {
  id: number;
  name: string;
  type: string;
  address: string;
  phone: string;
  email?: string;
  hours?: string;
  services?: string[];
  map_url?: string;
  map_embed_url?: string;
  latitude?: number;
  longitude?: number;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export const branchLocationService = {
  /**
   * Get all active branch locations (public).
   */
  getAll: async (): Promise<BranchLocation[]> => {
    const response = await apiClient.get('/branch-locations');
    return response.data.data || [];
  },

  /**
   * Get the featured (main) branch location (public).
   */
  getFeatured: async (): Promise<BranchLocation | null> => {
    const response = await apiClient.get('/branch-locations/featured');
    return response.data.data || null;
  },

  /**
   * Get a single branch location by id (public).
   */
  getById: async (id: number): Promise<BranchLocation | null> => {
    const response = await apiClient.get(`/branch-locations/${id}`);
    return response.data.data || null;
  },
};
