import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { publicOrderTrackingRedirect } from './utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      Cookies.remove('token');
      Cookies.remove('user');
      if (typeof window !== 'undefined') {
        // A customer scanning a printed invoice/receipt/chalan QR with their phone lands on an
        // admin order link with no session — this 401 is the first definitive confirmation of
        // that (it can arrive before or after AdminLayout's own check), so it must agree on the
        // same destination rather than racing it to /login.
        const storefrontRedirect = publicOrderTrackingRedirect(window.location.pathname, window.location.search);
        window.location.href = storefrontRedirect || '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
