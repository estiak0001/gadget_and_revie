import api from './api';
import {
  User, VendorProfile, Product, ProductCategory, ProductBrand, Service, ServiceCategory,
  Order, Ticket, CMSPage, Banner, FAQ, BranchLocation, Setting, AuditLog, Review,
  DashboardStats, PaginatedResponse, ApiResponse, ServiceIntake,
  Expense, ExpenseCategory, ExpenseReport, Supplier, PurchaseOrder,
  ChartOfAccount, JournalEntry, TrialBalance, IncomeStatement, BalanceSheet, AccountLedger, CashPosition, CashBook,
  PendingSyncSummary, Investor, Investment, CustomInvoice, ProductSerial, PurchaseProductHistory, PurchaseSerialHistoryEntry,
  SmsLog, SmsConnection, SmsCampaign, SmsBalance, SmsUsageStats,
  Quotation, QuotationProductSearchResult, QuotationTemplate, QuotationTemplateType,
} from '@/types';

// Query params type
export interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  [key: string]: string | number | boolean | undefined;
}

export const adminService = {
  // Dashboard
  getDashboardStats: (params?: { start_date?: string; end_date?: string }) =>
    api.get<ApiResponse<DashboardStats>>('/admin/dashboard', { params }),
  getDashboardTrends: () => api.get<ApiResponse<DashboardStats>>('/admin/dashboard/trends'),

  // Users
  getUsers: (params?: ListParams) => api.get<{ data: PaginatedResponse<User> }>('/admin/users', { params }),
  getUser: (id: number) => api.get<ApiResponse<User>>(`/admin/users/${id}`),
  updateUserStatus: (id: number, data: { status: string; reason?: string }) =>
    api.put(`/admin/users/${id}/status`, data),
  createUser: (data: Record<string, unknown>) => api.post('/admin/users', data),
  updateUser: (id: number, data: Record<string, unknown>) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
  forceDeleteUser: (id: number) => api.delete(`/admin/users/${id}/force`),
  resetUserPassword: (id: number, password: string) => api.put(`/admin/users/${id}/reset-password`, { password }),

  // Vendors
  getVendors: (params?: ListParams) => api.get<{ data: PaginatedResponse<VendorProfile> }>('/admin/vendors', { params }),
  getVendor: (id: number) => api.get<ApiResponse<VendorProfile>>(`/admin/vendors/${id}`),
  approveVendor: (id: number, data?: { reason?: string }) =>
    api.post(`/admin/vendors/${id}/approve`, data),
  rejectVendor: (id: number, data?: { reason?: string }) =>
    api.post(`/admin/vendors/${id}/reject`, data),
  suspendVendor: (id: number, data?: { reason?: string }) =>
    api.post(`/admin/vendors/${id}/suspend`, data),
  updateVendorStatus: (id: number, data: { status: string; reason?: string }) => {
    const { status, ...rest } = data;
    if (status === 'approved') return api.post(`/admin/vendors/${id}/approve`, rest);
    if (status === 'rejected') return api.post(`/admin/vendors/${id}/reject`, rest);
    if (status === 'suspended') return api.post(`/admin/vendors/${id}/suspend`, rest);
    return api.post(`/admin/vendors/${id}/approve`, rest);
  },

  // Orders
  getOrders: (params?: ListParams) => api.get<PaginatedResponse<Order>>('/admin/orders', { params }),
  getOrder: (id: number) => api.get<ApiResponse<Order>>(`/admin/orders/${id}`),
  createOrder: (data: Record<string, unknown>) => api.post<ApiResponse<Order>>('/admin/orders', data),
  updateOrder: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<Order>>(`/admin/orders/${id}`, data),
  updateOrderStatus: (id: number, data: { order_status: string; note?: string }) =>
    api.put(`/admin/orders/${id}/status`, data),
  sendOrderDeliveredSms: (id: number) => api.post(`/admin/orders/${id}/send-delivered-sms`),
  sendOrderStatusSms: (id: number) => api.post(`/admin/orders/${id}/send-status-sms`),
  sendOrderDueSms: (id: number) => api.post(`/admin/orders/${id}/send-due-sms`),
  previewOrderSms: (id: number, type: 'status' | 'delivered' | 'due') =>
    api.get<ApiResponse<{ phone: string; message: string }>>(`/admin/orders/${id}/sms-preview`, { params: { type } }),
  refundOrder: (id: number, data: { reason: string; refund_amount?: number }) =>
    api.post<ApiResponse<Order>>(`/admin/orders/${id}/refund`, data),
  recordOrderPayment: (id: number, amount: number) =>
    api.post<ApiResponse<Order>>(`/admin/orders/${id}/record-payment`, { amount }),
  correctOrderPayment: (id: number, data: { corrected_paid_amount: number; reason: string }) =>
    api.post<ApiResponse<Order>>(`/admin/orders/${id}/correct-payment`, data),
  exportOrders: (params?: ListParams) =>
    api.get('/admin/orders/export', { params, responseType: 'blob' }),

  // Invoices (Admin)
  downloadInvoice: (orderId: number) =>
    api.get(`/admin/invoices/${orderId}/download`, { responseType: 'blob' }),
  streamInvoiceUrl: (orderId: number) =>
    `${api.defaults.baseURL}/admin/invoices/${orderId}/stream`,
  sendInvoiceEmail: (orderId: number, email?: string) =>
    api.post(`/admin/invoices/${orderId}/send`, email ? { email } : {}),

  // Money Receipt (Admin) — proof of payment for an order, separate from the Invoice
  downloadMoneyReceipt: (orderId: number) =>
    api.get(`/admin/invoices/${orderId}/money-receipt/download`, { responseType: 'blob' }),
  streamMoneyReceiptUrl: (orderId: number) =>
    `${api.defaults.baseURL}/admin/invoices/${orderId}/money-receipt/stream`,

  // Delivery Chalan (Admin) — goods-delivery note, items/qty/serials, no prices
  downloadDeliveryChalan: (orderId: number) =>
    api.get(`/admin/invoices/${orderId}/delivery-chalan/download`, { responseType: 'blob' }),
  streamDeliveryChalanUrl: (orderId: number) =>
    `${api.defaults.baseURL}/admin/invoices/${orderId}/delivery-chalan/stream`,

  // Custom Invoices (Admin) — document-only, doesn't touch the real order/stock/ledger
  getCustomInvoices: (orderId: number) =>
    api.get<ApiResponse<CustomInvoice[]>>(`/admin/invoices/${orderId}/custom`),
  createCustomInvoice: (orderId: number, data: Record<string, unknown>) =>
    api.post<ApiResponse<CustomInvoice>>(`/admin/invoices/${orderId}/custom`, data),
  downloadCustomInvoice: (id: number) =>
    api.get(`/admin/invoices/custom/${id}/download`, { responseType: 'blob' }),
  sendCustomInvoiceSms: (id: number) => api.post(`/admin/invoices/custom/${id}/send-sms`),
  previewCustomInvoiceSms: (id: number) =>
    api.get<ApiResponse<{ phone: string; message: string }>>(`/admin/invoices/custom/${id}/sms-preview`),

  // Quotations — standalone pre-sale offers, never tied to an Order
  getQuotations: (params?: ListParams & { status?: string }) =>
    api.get<PaginatedResponse<Quotation>>('/admin/quotations', { params }),
  getQuotation: (id: number) => api.get<ApiResponse<Quotation>>(`/admin/quotations/${id}`),
  createQuotation: (data: Record<string, unknown>) =>
    api.post<ApiResponse<Quotation>>('/admin/quotations', data),
  updateQuotation: (id: number, data: Record<string, unknown>) =>
    api.put<ApiResponse<Quotation>>(`/admin/quotations/${id}`, data),
  updateQuotationStatus: (id: number, status: string) =>
    api.put<ApiResponse<Quotation>>(`/admin/quotations/${id}/status`, { status }),
  deleteQuotation: (id: number) => api.delete(`/admin/quotations/${id}`),
  downloadQuotation: (id: number) =>
    api.get(`/admin/quotations/${id}/download`, { responseType: 'blob' }),
  streamQuotationUrl: (id: number) => `${api.defaults.baseURL}/admin/quotations/${id}/stream`,
  searchQuotationProducts: (search: string) =>
    api.get<ApiResponse<QuotationProductSearchResult[]>>('/admin/quotations/search-products', { params: { search } }),

  // Quotation Templates — reusable saved Notes / Terms & Conditions snippets
  getQuotationTemplates: (type?: QuotationTemplateType) =>
    api.get<ApiResponse<QuotationTemplate[]>>('/admin/quotation-templates', { params: type ? { type } : undefined }),
  createQuotationTemplate: (data: { type: QuotationTemplateType; title: string; content: string; is_default?: boolean }) =>
    api.post<ApiResponse<QuotationTemplate>>('/admin/quotation-templates', data),
  updateQuotationTemplate: (id: number, data: { type: QuotationTemplateType; title: string; content: string; is_default?: boolean }) =>
    api.put<ApiResponse<QuotationTemplate>>(`/admin/quotation-templates/${id}`, data),
  deleteQuotationTemplate: (id: number) => api.delete(`/admin/quotation-templates/${id}`),

  // Service Intakes (device received → receipt → convert to order)
  getServiceIntakes: (params?: ListParams) =>
    api.get<PaginatedResponse<ServiceIntake>>('/admin/service-intakes', { params }),
  getServiceIntake: (id: number) =>
    api.get<ApiResponse<ServiceIntake>>(`/admin/service-intakes/${id}`),
  createServiceIntake: (data: Record<string, unknown>) =>
    api.post<ApiResponse<ServiceIntake>>('/admin/service-intakes', data),
  updateServiceIntake: (id: number, data: Record<string, unknown>) =>
    api.put<ApiResponse<ServiceIntake>>(`/admin/service-intakes/${id}`, data),
  deleteServiceIntake: (id: number) => api.delete(`/admin/service-intakes/${id}`),
  updateServiceIntakeStatus: (id: number, status: string) =>
    api.put(`/admin/service-intakes/${id}/status`, { status }),
  convertServiceIntake: (id: number, data: {
    customer_id?: number | null;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    customer_address?: string;
    payment_method: string;
    payment_status: string;
    paid_amount?: number;
    order_status: string;
    tax?: number;
    shipping?: number;
    discount?: number;
    admin_notes?: string;
    items: Array<{ id: number; include: boolean; unit_price?: number | null; quantity?: number }>;
  }) => api.post(`/admin/service-intakes/${id}/convert`, data),
  confirmServiceIntakePrice: (id: number, data: Record<string, unknown>) =>
    api.post(`/admin/service-intakes/${id}/confirm-price`, data),
  downloadServiceReceipt: (id: number) =>
    api.get(`/admin/service-intakes/${id}/receipt/download`, { responseType: 'blob' }),
  streamServiceReceiptUrl: (id: number) =>
    `${api.defaults.baseURL}/admin/service-intakes/${id}/receipt/stream`,

  // Customers
  getCustomers: (params?: ListParams) => api.get<PaginatedResponse<User>>('/admin/customers', { params }),
  getCustomer: (id: number) => api.get<ApiResponse<User>>(`/admin/customers/${id}`),
  updateCustomer: (id: number, data: Record<string, unknown>) => api.put(`/admin/customers/${id}`, data),
  deleteCustomer: (id: number) => api.delete(`/admin/customers/${id}`),

  // Tickets
  getTickets: (params?: ListParams) => api.get<PaginatedResponse<Ticket>>('/admin/tickets', { params }),
  getTicket: (id: number) => api.get<ApiResponse<Ticket>>(`/admin/tickets/${id}`),
  updateTicket: (id: number, data: Record<string, unknown>) => api.put(`/admin/tickets/${id}`, data),
  replyToTicket: (id: number, data: { message: string; status?: string }) =>
    api.post(`/admin/tickets/${id}/reply`, data),
  deleteTicket: (id: number) => api.delete(`/admin/tickets/${id}`),

  // Products
  getProducts: (params?: ListParams) => api.get<PaginatedResponse<Product>>('/admin/products', { params }),
  getProductStats: () => api.get<ApiResponse<{ total: number; active: number; inactive: number; draft: number; low_stock: number; out_of_stock: number }>>('/admin/products/stats'),
  getProduct: (id: number) => api.get<ApiResponse<Product>>(`/admin/products/${id}`),
  createProduct: (data: FormData | Record<string, unknown>) => {
    if (data instanceof FormData) {
      return api.post('/admin/products', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/admin/products', data);
  },
  updateProduct: (id: number, data: FormData | Record<string, unknown>) => {
    if (data instanceof FormData) {
      // Use POST with _method=PUT for file uploads
      data.append('_method', 'PUT');
      return api.post(`/admin/products/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/admin/products/${id}`, data);
  },
  deleteProduct: (id: number) => api.delete(`/admin/products/${id}`),
  toggleProductStatus: (id: number) => api.put(`/admin/products/${id}/toggle-status`),
  toggleProductFeatured: (id: number) => api.put(`/admin/products/${id}/toggle-featured`),
  adjustStock: (id: number, data: { type: string; quantity: number; reason?: string }) =>
    api.post(`/admin/products/${id}/stock`, data),
  getProductSerials: (id: number) => api.get<ApiResponse<ProductSerial[]>>(`/admin/products/${id}/serials`),
  addProductSerials: (id: number, serials: string[]) =>
    api.post<ApiResponse<ProductSerial[]>>(`/admin/products/${id}/serials`, { serials }),

  // Services
  getServices: (params?: ListParams) => api.get<PaginatedResponse<Service>>('/admin/services', { params }),
  getService: (id: number) => api.get<ApiResponse<Service>>(`/admin/services/${id}`),
  createService: (data: FormData | Record<string, unknown>) => {
    if (data instanceof FormData) {
      return api.post('/admin/services', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/admin/services', data);
  },
  updateService: (id: number, data: FormData | Record<string, unknown>) => {
    if (data instanceof FormData) {
      data.append('_method', 'PUT');
      return api.post(`/admin/services/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/admin/services/${id}`, data);
  },
  deleteService: (id: number) => api.delete(`/admin/services/${id}`),
  toggleServiceStatus: (id: number) => api.put(`/admin/services/${id}/toggle-status`),

  // Categories
  // NOTE: these hit the PUBLIC storefront endpoints, which only ever return
  // is_active=true categories. Fine for pickers/dropdowns, but admin category
  // *management* screens must use getAdminServiceCategories/getAdminProductCategories
  // below so deactivated categories remain visible and manageable.
  getServiceCategories: (params?: ListParams) => api.get('/categories/services', { params }),
  getAdminServiceCategories: (params?: ListParams) => api.get('/admin/service-categories', { params }),
  createServiceCategory: (data: Record<string, unknown>) => api.post('/admin/service-categories', data),
  updateServiceCategory: (id: number, data: Record<string, unknown>) => api.put(`/admin/service-categories/${id}`, data),
  deleteServiceCategory: (id: number) => api.delete(`/admin/service-categories/${id}`),
  reorderServiceCategories: (categories: { id: number; sort_order: number }[]) =>
    api.post('/admin/service-categories/reorder', { categories }),

  getProductCategories: (params?: ListParams) => api.get('/categories/products', { params }),
  // Nested (parent -> children -> grandchildren) tree, for hierarchy-aware category pickers.
  getProductCategoriesTree: () => api.get('/categories/products/tree'),
  getAdminProductCategories: (params?: ListParams) => api.get('/admin/product-categories', { params }),
  createProductCategory: (data: Record<string, unknown>) => api.post('/admin/product-categories', data),
  updateProductCategory: (id: number, data: Record<string, unknown>) => api.put(`/admin/product-categories/${id}`, data),
  deleteProductCategory: (id: number) => api.delete(`/admin/product-categories/${id}`),
  reorderProductCategories: (categories: { id: number; sort_order: number }[]) =>
    api.post('/admin/product-categories/reorder', { categories }),

  // Category Attributes
  getCategoryAttributes: (params?: ListParams) =>
    api.get('/admin/category-attributes', { params }),
  getCategoryAttribute: (id: number) =>
    api.get(`/admin/category-attributes/${id}`),
  createCategoryAttribute: (data: Record<string, unknown>) =>
    api.post('/admin/category-attributes', data),
  updateCategoryAttribute: (id: number, data: Record<string, unknown>) =>
    api.put(`/admin/category-attributes/${id}`, data),
  deleteCategoryAttribute: (id: number) =>
    api.delete(`/admin/category-attributes/${id}`),
  syncCategoryAttributeValues: (
    attributeId: number,
    values: Array<{ id?: number; value: string; value_bn?: string | null; sort_order?: number; is_active?: boolean }>
  ) => api.post(`/admin/category-attributes/${attributeId}/values/sync`, { values }),
  createAttributeValue: (
    attributeId: number,
    data: { value: string; value_bn?: string | null; sort_order?: number; is_active?: boolean }
  ) => api.post(`/admin/category-attributes/${attributeId}/values`, data),
  updateAttributeValue: (
    id: number,
    data: { value?: string; value_bn?: string | null; sort_order?: number; is_active?: boolean }
  ) => api.put(`/admin/attribute-values/${id}`, data),
  deleteAttributeValue: (id: number) =>
    api.delete(`/admin/attribute-values/${id}`),

  // Public endpoint — fetch attributes (with values) for the given category,
  // includes inherited attributes from ancestor categories.
  getFormAttributesForCategory: (categoryId: number) =>
    api.get(`/categories/products/${categoryId}/form-attributes`),

  // Spec-name/value suggestions from other products already in this category,
  // so "Technical Specifications" doesn't need retyping the same keys each time.
  getProductSpecSuggestions: (categoryId: number) =>
    api.get<ApiResponse<{ key: string; values: string[]; count: number }[]>>(
      '/admin/products/spec-suggestions',
      { params: { category_id: categoryId } }
    ),

  // Product Brands
  getProductBrands: (params?: ListParams) => api.get<{ data: PaginatedResponse<ProductBrand> }>('/admin/product-brands', { params }),
  getProductBrand: (id: number) => api.get<ApiResponse<ProductBrand>>(`/admin/product-brands/${id}`),
  createProductBrand: (data: FormData | Record<string, unknown>) => {
    if (data instanceof FormData) {
      return api.post('/admin/product-brands', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/admin/product-brands', data);
  },
  updateProductBrand: (id: number, data: FormData | Record<string, unknown>) => {
    if (data instanceof FormData) {
      return api.post(`/admin/product-brands/${id}?_method=PUT`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/admin/product-brands/${id}`, data);
  },
  deleteProductBrand: (id: number) => api.delete(`/admin/product-brands/${id}`),
  toggleProductBrandStatus: (id: number) => api.put(`/admin/product-brands/${id}/toggle-status`),

  // CMS
  getPages: (params?: ListParams) => api.get('/admin/cms-pages', { params }),
  createPage: (data: Record<string, unknown>) => api.post('/admin/cms-pages', data),
  updatePage: (id: number, data: Record<string, unknown>) => api.put(`/admin/cms-pages/${id}`, data),
  deletePage: (id: number) => api.delete(`/admin/cms-pages/${id}`),

  getBanners: (params?: ListParams) => api.get('/admin/banners', { params }),
  createBanner: (data: FormData) => api.post('/admin/banners', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateBanner: (id: number, data: FormData) => api.post(`/admin/banners/${id}?_method=PUT`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteBanner: (id: number) => api.delete(`/admin/banners/${id}`),

  getFaqs: (params?: ListParams) => api.get('/admin/faqs', { params }),
  createFaq: (data: Record<string, unknown>) => api.post('/admin/faqs', data),
  updateFaq: (id: number, data: Record<string, unknown>) => api.put(`/admin/faqs/${id}`, data),
  deleteFaq: (id: number) => api.delete(`/admin/faqs/${id}`),

  // Settings
  getSettings: (params?: { group?: string }) => api.get<{ data: Setting[] }>('/admin/settings', { params }),
  updateSetting: (id: number, data: { value: string }) => api.put(`/admin/settings/${id}`, data),
  updateSettings: (data: Record<string, string>) => {
    // Transform flat key-value pairs to backend format: { settings: { key: { key, value } } }
    const settings: Record<string, { key: string; value: string }> = {};
    Object.entries(data).forEach(([key, value]) => {
      settings[key] = { key, value };
    });
    return api.put('/admin/settings', { settings });
  },
  regenerateApiKey: () => api.post('/admin/settings/api-keys/regenerate'),
  // Brochure editor — content is stored as one HTML blob under a single
  // 'brochure' settings group so it round-trips through the generic settings
  // endpoints without needing dedicated backend routes.
  getBrochureContent: () => api.get<{ data: Record<string, Record<string, string>> }>('/admin/settings', { params: { group: 'brochure' } }),
  saveBrochureContent: (html: string) =>
    api.put('/admin/settings', {
      settings: [{ key: 'brochure_content', value: html, group: 'brochure', type: 'json' }],
    }),
  // SMS — Settings > SMS builds/tests connections; OTP/order/campaign config lives on the
  // dedicated SMS Center page instead (both hit the same /admin/sms/* routes below).
  getSmsConnections: () => api.get<ApiResponse<SmsConnection[]>>('/admin/sms/connections'),
  createSmsConnection: (data: Partial<SmsConnection>) => api.post<ApiResponse<SmsConnection>>('/admin/sms/connections', data),
  updateSmsConnection: (id: number, data: Partial<SmsConnection>) => api.put<ApiResponse<SmsConnection>>(`/admin/sms/connections/${id}`, data),
  deleteSmsConnection: (id: number) => api.delete(`/admin/sms/connections/${id}`),
  testSmsConnection: (data: { connection_id?: number; phone: string; message?: string; name?: string; api_url?: string; method?: string; api_key?: string; sender_id?: string; phone_format?: string }) =>
    api.post('/admin/sms/connections/test', data),
  getSmsConnectionBalance: (id: number) => api.get<ApiResponse<SmsBalance>>(`/admin/sms/connections/${id}/balance`),
  getSmsUsageStats: (params?: { connection_id?: number; from?: string; to?: string }) =>
    api.get<ApiResponse<SmsUsageStats>>('/admin/sms/usage', { params }),
  getSmsLogs: (params?: ListParams & { purpose?: string; status?: string; connection_id?: number }) =>
    api.get<PaginatedResponse<SmsLog>>('/admin/sms/logs', { params }),
  getSmsCampaigns: (params?: ListParams) => api.get<PaginatedResponse<SmsCampaign>>('/admin/sms/campaigns', { params }),
  createSmsCampaign: (data: { name: string; message: string; connection_id: number; recipient_source: 'all_customers' | 'manual'; phones?: string[] }) =>
    api.post<ApiResponse<SmsCampaign>>('/admin/sms/campaigns', data),
  getSmsCampaignRecipientsCount: (source: 'all_customers') =>
    api.get<ApiResponse<{ count: number }>>('/admin/sms/campaigns/recipients-count', { params: { source } }),

  // Notifications
  getNotifications: (params?: ListParams) => api.get('/admin/notifications', { params }),
  createNotification: (data: Record<string, unknown>) => api.post('/admin/notifications', data),
  deleteNotification: (id: number) => api.delete(`/admin/notifications/${id}`),
  markNotificationRead: (id: number) => api.put(`/admin/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put('/admin/notifications/read-all'),

  // Audit Logs
  getAuditLogs: (params?: ListParams) => api.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', { params }),
  exportAuditLogs: (params?: ListParams) =>
    api.get('/admin/reports/audit-logs', { params: { ...params, format: 'csv' }, responseType: 'blob' }),

  // Reviews
  getReviews: (params?: ListParams) => api.get('/admin/reviews', { params }),
  updateReviewStatus: (id: number, status: string, is_featured?: boolean) =>
    api.put(`/admin/reviews/${id}`, { status, ...(is_featured !== undefined ? { is_featured } : {}) }),
  deleteReview: (id: number) => api.delete(`/admin/reviews/${id}`),

  // Reports
  getSalesReport: (params?: ListParams) => api.get('/admin/reports/sales', { params }),
  getCustomerReport: (params?: ListParams) => api.get('/admin/reports/customers', { params }),
  getVendorReport: (params?: ListParams) => api.get('/admin/reports/vendors', { params }),
  getCatalogReport: (params?: ListParams) => api.get('/admin/reports/catalog', { params }),
  getReviewReport: (params?: ListParams) => api.get('/admin/reports/reviews', { params }),
  getTicketReport: (params?: ListParams) => api.get('/admin/reports/tickets', { params }),
  getInventoryReport: (params?: ListParams) => api.get('/admin/reports/inventory', { params }),
  exportReport: (type: string, format: string, params?: ListParams) =>
    api.get(`/admin/reports/export/${type}/${format}`, { params, responseType: 'blob' }),

  // Payments
  getPayments: (params?: ListParams) => api.get('/admin/payments', { params }),
  getPayment: (id: number) => api.get(`/admin/payments/${id}`),
  updatePaymentStatus: (id: number, status: string, note?: string) =>
    api.put(`/admin/payments/${id}`, { status, ...(note ? { note } : {}) }),

  // Contact Inquiries
  getContactInquiries: (params?: ListParams) => api.get('/admin/contact-inquiries', { params }),
  getContactInquiry: (id: number) => api.get(`/admin/contact-inquiries/${id}`),
  updateContactInquiry: (id: number, data: { status?: string; admin_notes?: string }) =>
    api.put(`/admin/contact-inquiries/${id}`, data),
  deleteContactInquiry: (id: number) => api.delete(`/admin/contact-inquiries/${id}`),

  // Branch Locations (physical stores / service centers)
  getBranchLocations: (params?: ListParams) => api.get<{ data: PaginatedResponse<BranchLocation> }>('/admin/branch-locations', { params }),
  createBranchLocation: (data: Record<string, unknown>) => api.post('/admin/branch-locations', data),
  updateBranchLocation: (id: number, data: Record<string, unknown>) => api.put(`/admin/branch-locations/${id}`, data),
  deleteBranchLocation: (id: number) => api.delete(`/admin/branch-locations/${id}`),

  // Locations
  getDivisions: (params?: ListParams) => api.get('/locations/divisions', { params }),
  createDivision: (data: Record<string, unknown>) => api.post('/admin/locations/divisions', data),
  updateDivision: (id: number, data: Record<string, unknown>) => api.put(`/admin/locations/divisions/${id}`, data),
  deleteDivision: (id: number) => api.delete(`/admin/locations/divisions/${id}`),

  getDistricts: (params?: ListParams) => api.get('/locations/districts', { params }),
  createDistrict: (data: Record<string, unknown>) => api.post('/admin/locations/districts', data),
  updateDistrict: (id: number, data: Record<string, unknown>) => api.put(`/admin/locations/districts/${id}`, data),
  deleteDistrict: (id: number) => api.delete(`/admin/locations/districts/${id}`),

  getAreas: (params?: ListParams) => api.get('/locations/areas', { params }),
  createArea: (data: Record<string, unknown>) => api.post('/admin/locations/areas', data),
  updateArea: (id: number, data: Record<string, unknown>) => api.put(`/admin/locations/areas/${id}`, data),
  deleteArea: (id: number) => api.delete(`/admin/locations/areas/${id}`),

  // Access Control
  getRoles: (params?: ListParams) => api.get('/admin/roles', { params }),
  createRole: (data: Record<string, unknown>) => api.post('/admin/roles', data),
  updateRole: (id: number, data: Record<string, unknown>) => api.put(`/admin/roles/${id}`, data),
  deleteRole: (id: number) => api.delete(`/admin/roles/${id}`),
  assignRoleToUser: (userId: number, roleId: number) => api.post('/admin/roles/assign', { user_id: userId, role_id: roleId }),
  removeRoleFromUser: (userId: number, roleId: number) => api.post('/admin/roles/remove', { user_id: userId, role_id: roleId }),

  getPermissions: (params?: ListParams) => api.get('/admin/permissions', { params }),
  createPermission: (data: Record<string, unknown>) => api.post('/admin/permissions', data),
  updatePermission: (id: number, data: Record<string, unknown>) => api.put(`/admin/permissions/${id}`, data),
  deletePermission: (id: number) => api.delete(`/admin/permissions/${id}`),

  // Vendor Portal
  getVendorDashboard: (params?: { vendor_id?: number }) => api.get('/vendor/dashboard', { params }),
  getVendorDashboardStats: (params?: { vendor_id?: number }) => api.get('/vendor/dashboard', { params }),
  getVendorRecentOrders: (params?: { vendor_id?: number }) => api.get('/vendor/dashboard', { params }),
  getVendorChart: (params?: { vendor_id?: number }) => api.get('/vendor/dashboard', { params }),
  getVendorOrders: (params?: ListParams & { vendor_id?: number }) => api.get('/vendor/orders', { params }),
  updateVendorOrderStatus: (id: number, data: { status: string; note?: string }) =>
    api.put(`/vendor/orders/${id}/status`, data),
  getVendorServices: (params?: ListParams & { vendor_id?: number }) => api.get('/vendor/services', { params }),
  createVendorService: (data: Record<string, unknown>) => api.post('/vendor/services', data),
  updateVendorService: (id: number, data: Record<string, unknown>) => api.put(`/vendor/services/${id}`, data),
  deleteVendorService: (id: number) => api.delete(`/vendor/services/${id}`),
  toggleVendorServiceStatus: (id: number) => api.put(`/vendor/services/${id}/toggle-status`),
  getVendorPayouts: (params?: ListParams & { vendor_id?: number }) => api.get('/vendor/payouts', { params }),
  getVendorPayoutStats: (params?: { vendor_id?: number }) => api.get('/vendor/payouts/stats', { params }),
  getVendorEarnings: (params?: ListParams & { vendor_id?: number }) => api.get('/vendor/earnings', { params }),
  requestVendorPayout: (data: Record<string, unknown>) => api.post('/vendor/payouts/request', data),

  // Expense Categories
  getExpenseCategories: (params?: ListParams) =>
    api.get<ApiResponse<ExpenseCategory[]>>('/admin/expense-categories', { params }),
  createExpenseCategory: (data: Record<string, unknown>) =>
    api.post<ApiResponse<ExpenseCategory>>('/admin/expense-categories', data),
  updateExpenseCategory: (id: number, data: Record<string, unknown>) =>
    api.put<ApiResponse<ExpenseCategory>>(`/admin/expense-categories/${id}`, data),
  deleteExpenseCategory: (id: number) => api.delete(`/admin/expense-categories/${id}`),

  // Expenses
  getExpenses: (params?: ListParams) =>
    api.get<{ data: PaginatedResponse<Expense> }>('/admin/expenses', { params }),
  createExpense: (data: Record<string, unknown>) =>
    api.post<ApiResponse<Expense>>('/admin/expenses', data),
  updateExpense: (id: number, data: Record<string, unknown>) =>
    api.put<ApiResponse<Expense>>(`/admin/expenses/${id}`, data),
  // Always reverses the journal entry and keeps the expense (soft-deleted, flagged
  // is_reversed) visible under the "Reversed" filter — never a bare, silent delete.
  deleteExpense: (id: number) => api.delete(`/admin/expenses/${id}`),
  getExpenseReport: (params: { start_date: string; end_date: string; group_by?: string }) =>
    api.get<ApiResponse<ExpenseReport>>('/admin/expenses/report', { params }),

  // Investors & Investments
  getInvestors: (params?: ListParams) => api.get<ApiResponse<Investor[]>>('/admin/investors', { params }),
  createInvestor: (data: Record<string, unknown>) => api.post<ApiResponse<Investor>>('/admin/investors', data),
  updateInvestor: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<Investor>>(`/admin/investors/${id}`, data),
  deleteInvestor: (id: number) => api.delete(`/admin/investors/${id}`),
  returnInvestment: (investorId: number, data: { amount: number; investment_date: string; description?: string }) =>
    api.post<ApiResponse<Investment>>(`/admin/investors/${investorId}/return`, data),
  getInvestments: (params?: ListParams) => api.get<{ data: PaginatedResponse<Investment> }>('/admin/investments', { params }),
  createInvestment: (data: Record<string, unknown>) => api.post<ApiResponse<Investment>>('/admin/investments', data),

  // Suppliers
  getSuppliers: (params?: ListParams) => api.get<{ data: PaginatedResponse<Supplier> }>('/admin/suppliers', { params }),
  getSupplier: (id: number) => api.get<ApiResponse<Supplier>>(`/admin/suppliers/${id}`),
  createSupplier: (data: Record<string, unknown>) => api.post<ApiResponse<Supplier>>('/admin/suppliers', data),
  updateSupplier: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<Supplier>>(`/admin/suppliers/${id}`, data),
  deleteSupplier: (id: number) => api.delete(`/admin/suppliers/${id}`),

  // Purchase Orders
  getPurchases: (params?: ListParams) => api.get<{ data: PaginatedResponse<PurchaseOrder> }>('/admin/purchases', { params }),
  getPurchaseProductHistory: (productId: number) =>
    api.get<ApiResponse<PurchaseProductHistory>>('/admin/purchases/product-history', { params: { product_id: productId } }),
  getPurchaseSerialHistory: (serialNumber: string) =>
    api.get<ApiResponse<PurchaseSerialHistoryEntry[]>>('/admin/purchases/serial-history', { params: { serial_number: serialNumber } }),
  getPurchase: (id: number) => api.get<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}`),
  createPurchase: (data: Record<string, unknown>) => api.post<ApiResponse<PurchaseOrder>>('/admin/purchases', data),
  updatePurchase: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}`, data),
  deletePurchase: (id: number) => api.delete(`/admin/purchases/${id}`),
  markPurchaseOrdered: (id: number) => api.post<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}/mark-ordered`),
  receivePurchase: (id: number, data: { items: { id: number; received_qty: number; serials?: string[] }[] }) =>
    api.post<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}/receive`, data),
  returnPurchaseItems: (id: number, data: { items: { id: number; quantity: number; serials?: string[]; reason?: string }[]; collect_refund_now?: boolean }) =>
    api.post<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}/return`, data),
  restockPurchaseReturn: (id: number, data: { items: { id: number; quantity: number; serials?: string[]; reason?: string }[] }) =>
    api.post<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}/restock-return`, data),
  correctPurchaseReceipt: (id: number, data: { items: { id: number; unit_cost?: number; received_qty?: number; reason: string }[] }) =>
    api.post<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}/correct-receipt`, data),
  cancelPurchase: (id: number) => api.post<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}/cancel`),
  payPurchase: (id: number, amount: number) => api.post<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}/pay`, { amount }),
  downloadPurchasePdf: (id: number) =>
    api.get(`/admin/purchases/${id}/download`, { responseType: 'blob' }),
  downloadPaymentVoucher: (id: number) =>
    api.get(`/admin/purchases/${id}/payment-voucher/download`, { responseType: 'blob' }),

  // Chart of Accounts
  getAccounts: (params?: ListParams) => api.get<ApiResponse<ChartOfAccount[]>>('/admin/accounting/accounts', { params }),
  createAccount: (data: Record<string, unknown>) => api.post<ApiResponse<ChartOfAccount>>('/admin/accounting/accounts', data),
  updateAccount: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<ChartOfAccount>>(`/admin/accounting/accounts/${id}`, data),
  deleteAccount: (id: number) => api.delete(`/admin/accounting/accounts/${id}`),

  // Journal
  getJournalEntries: (params?: ListParams) => api.get<{ data: PaginatedResponse<JournalEntry> }>('/admin/accounting/journal', { params }),
  getJournalEntry: (id: number) => api.get<ApiResponse<JournalEntry>>(`/admin/accounting/journal/${id}`),
  createJournalEntry: (data: Record<string, unknown>) => api.post<ApiResponse<JournalEntry>>('/admin/accounting/journal', data),

  // Accounting Reports
  getTrialBalance: (asOf?: string) => api.get<ApiResponse<TrialBalance>>('/admin/accounting/trial-balance', { params: { as_of: asOf } }),
  getIncomeStatement: (from?: string, to?: string) => api.get<ApiResponse<IncomeStatement>>('/admin/accounting/income-statement', { params: { from, to } }),
  getBalanceSheet: (asOf?: string) => api.get<ApiResponse<BalanceSheet>>('/admin/accounting/balance-sheet', { params: { as_of: asOf } }),
  getCashPosition: (from?: string, to?: string) => api.get<ApiResponse<CashPosition>>('/admin/accounting/cash-position', { params: { from, to } }),
  getCashBook: (from?: string, to?: string) => api.get<ApiResponse<CashBook>>('/admin/accounting/cash-book', { params: { from, to } }),
  getAccountLedger: (accountId: number, from?: string, to?: string) =>
    api.get<ApiResponse<AccountLedger>>(`/admin/accounting/ledger/${accountId}`, { params: { from, to } }),

  // Pending Ledger Sync (backfill historical/unsynced records)
  getPendingSyncSummary: () => api.get<ApiResponse<PendingSyncSummary>>('/admin/accounting/pending'),
  getPendingExpenses: () => api.get<ApiResponse<Expense[]>>('/admin/accounting/pending/expenses'),
  getPendingOrders: () => api.get<ApiResponse<Order[]>>('/admin/accounting/pending/orders'),
  getPendingPurchaseOrders: () => api.get<ApiResponse<PurchaseOrder[]>>('/admin/accounting/pending/purchase-orders'),
  processExpenseSync: (id: number) => api.post<ApiResponse<JournalEntry>>(`/admin/accounting/process/expense/${id}`),
  processOrderSync: (id: number) => api.post<ApiResponse<JournalEntry>>(`/admin/accounting/process/order/${id}`),
  processPurchaseOrderSync: (id: number) => api.post<ApiResponse<JournalEntry>>(`/admin/accounting/process/purchase-order/${id}`),

  // File Upload
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadMultiple: (files: File[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files[]', f));
    return api.post('/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default adminService;
