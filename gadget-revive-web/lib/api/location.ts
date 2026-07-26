import apiClient from './config';
import { Division, District, Area, ApiResponse } from '../types';

export const locationService = {
  /**
   * Get all divisions (public)
   */
  getDivisions: async (): Promise<Division[]> => {
    const response = await apiClient.get('/locations/divisions');
    return response.data.data || [];
  },

  /**
   * Get districts by division (public)
   */
  getDistricts: async (divisionId: number): Promise<District[]> => {
    const response = await apiClient.get(`/locations/divisions/${divisionId}/districts`);
    return response.data.data || [];
  },

  /**
   * Get areas by district (public)
   */
  getAreas: async (districtId: number): Promise<Area[]> => {
    const response = await apiClient.get(`/locations/districts/${districtId}/areas`);
    return response.data.data || [];
  },
};
