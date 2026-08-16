import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
export const STORAGE_URL =
  process.env.NEXT_PUBLIC_STORAGE_URL || "http://localhost:8000/storage/";

/**
 * Get full URL for a storage file path (e.g. product images)
 */
export function getStorageUrl(path?: string | null): string {
  if (!path) return "/images/placeholder.jpg";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Remove leading slash if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  // Always use /storage/ after the API base
  let base = API_URL.replace(/\/api$/, "");
  return `${base}/storage/${cleanPath.replace(/^storage\//, "")}`;
}

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Debounce guard to prevent multiple rapid redirects (crashes mobile browsers)
let isRedirecting = false;

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url ?? "";

    // Skip 401 handling for auth endpoints, public endpoints, and cart endpoints — these
    // should never trigger a redirect or clear tokens. Public/guest endpoints may 401 when a
    // stale Bearer token is attached; that's harmless. Cart is deliberately never supposed to
    // require an account (guest checkout is fully supported) — a 401 there means the attached
    // token went stale, which cart-store.ts already recovers from by falling back to the guest
    // cart itself, so this must not also force a full-page redirect out from under it.
    const isIgnoredEndpoint =
      requestUrl.includes("/auth/") ||
      requestUrl.includes("/public/") ||
      requestUrl.includes("/categories/") ||
      requestUrl.includes("/cart") ||
      requestUrl.includes("/guest/");

    if (error.response?.status === 401 && !isIgnoredEndpoint) {
      if (typeof window !== "undefined") {
        // Only clear the token, NOT the Zustand persist store (auth-storage).
        // Clearing auth-storage from here races with Zustand's rehydration and
        // causes cascading re-renders that crash mobile browsers.
        localStorage.removeItem("auth_token");

        // Redirect once. Multiple concurrent 401s would otherwise trigger rapid
        // full-page reloads that mobile browsers surface as "Can't Open Page".
        if (
          !isRedirecting &&
          !window.location.pathname.startsWith("/auth")
        ) {
          isRedirecting = true;
          window.location.href = "/auth/login";
        }
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
