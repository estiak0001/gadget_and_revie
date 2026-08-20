// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  };
}

// ============================================
// User & Authentication Types
// ============================================

export interface Role {
  id: number;
  name: 'super_admin' | 'admin' | 'vendor' | 'customer';
}

export interface User {
  id: number;
  name: string;
  email: string | null;    // optional – phone is the primary identifier
  phone: string;
  email_verified_at: string | null;
  role: 'super_admin' | 'admin' | 'vendor' | 'customer';
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface RegisterRequest {
  name: string;
  phone: string;
  email?: string;          // optional – phone is the primary identifier
  password: string;
  password_confirmation: string;
  role: 'customer' | 'vendor';
}

export interface LoginRequest {
  phone_or_email: string;  // phone number is primary; email accepted as fallback
  password: string;
}

// ============================================
// Location Types
// ============================================

export interface Division {
  id: number;
  name: string;
  bn_name: string;
}

export interface District {
  id: number;
  division_id: number;
  name: string;
  bn_name: string;
}

export interface Area {
  id: number;
  district_id: number;
  name: string;
  bn_name: string;
  type: string;
}

// ============================================
// Vendor Types
// ============================================

export interface VendorProfile {
  id: number;
  user_id: number;
  business_name: string;
  slug: string;
  description: string;
  address: string;
  division: Division;
  district: District;
  area: Area;
  trade_license: string;
  bkash_number: string;
  payment_instructions: string;
  rating_average: number;
  total_reviews: number;
  total_orders: number;
  is_verified: boolean;
  is_active: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'info_requested';
  rejection_reason?: string;
  info_request?: string;
  created_at: string;
  updated_at: string;
}

export interface VendorOnboardingRequest {
  business_name: string;
  description: string;
  address: string;
  division_id: number;
  district_id: number;
  area_id: number;
  trade_license: string;
  bkash_number: string;
  payment_instructions: string;
}

// ============================================
// Category Types
// ============================================

export interface ServiceCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string | null;
  image?: string | null;
  is_active: boolean;
  is_featured?: boolean;
  sort_order?: number;
  services_count?: number;
  // Lowest active price across this category's whole subtree — only present on a single
  // category detail request (GET /service-categories/{slug}), powers the hero's "Starting
  // from ৳X" badge.
  starting_price?: number | string | null;
  // Up to 3 real services (cheapest/middle/priciest by price) relabeled Basic/Minor/Major —
  // the category page's whole "book a service" grid.
  tier_services?: Array<{
    tier: string | null;
    id: number;
    name: string;
    slug: string;
    price: number | string;
    duration_estimate?: string | null;
    image?: string | null;
    short_description?: string | null;
  }>;
  parent_id?: number | null;
  parent?: ServiceCategory;
  children?: ServiceCategory[];
  breadcrumb?: Array<{ id: number; name: string; slug: string }>;
  path?: string;
}

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string | null;
  image?: string | null;
  is_active: boolean;
  is_featured?: boolean;
  sort_order?: number;
  products_count?: number;
  parent_id?: number | null;
  parent?: ProductCategory;
  children?: ProductCategory[];
  breadcrumb?: Array<{ id: number; name: string; slug: string }>;
  path?: string;
}

// ============================================
// Service Types
// ============================================

export interface Service {
  id: number;
  vendor_profile_id?: number | null;
  service_category_id?: number;
  category_id?: number;
  code?: string;
  slug?: string;
  name: string;
  description?: string;
  short_description?: string;
  features?: string[];
  base_price: number;
  discount_price?: number | null;
  current_price?: number;
  has_discount?: boolean;
  duration_estimate?: string; // in string format like "1-2 days", "3 days"
  category?: ServiceCategory;
  vendor?: {
    id: number;
    business_name: string;
    slug: string;
    rating_average: number;
  };
  image?: string | null;
  gallery?: string[];
  is_active: boolean;
  is_featured?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateServiceRequest {
  service_category_id: number;
  name: string;
  code: string;
  description: string;
  base_price: number;
  duration_estimate: number;
  is_active: boolean;
}

// ============================================
// Product Types
// ============================================

export interface ProductBrand {
  id: number;
  name: string;
  name_bn?: string;
  slug: string;
  logo?: string;
  description?: string;
  is_active: boolean;
  sort_order?: number;
  products_count?: number;
}

export interface Product {
  id: number;
  vendor_id: number;
  product_category_id: number;
  category_id?: number;
  slug: string;
  sku: string;
  name: string;
  description: string;
  short_description?: string;
  price: number;
  discount_price?: number;
  stock_qty: number;
  low_stock_threshold: number;
  always_in_stock?: boolean;
  warranty_period?: string;
  image?: string;
  gallery?: string[];
  images?: string[];
  specifications?: Record<string, any>;
  brand?: string;
  brand_id?: number;
  brand_name?: string;
  brand_details?: ProductBrand;
  model?: string;
  warranty?: string;
  unit?: string;
  category: ProductCategory;
  vendor: {
    id: number;
    business_name: string;
    slug: string;
  };
  is_active: boolean;
  is_featured?: boolean;
  in_stock?: boolean;
  is_in_stock?: boolean;
  current_price?: number;
  has_discount?: boolean;
  attribute_values?: ProductAttributeValueEntry[];
  created_at?: string;
  updated_at?: string;
}

export interface ProductAttributeValueEntry {
  id: number;
  attribute_id: number;
  attribute_value_id: number | null;
  text_value: string | null;
  attribute: {
    id: number;
    name: string;
    name_bn?: string | null;
    slug: string;
    unit?: string | null;
    input_type: string;
  } | null;
  value: {
    id: number;
    value: string;
    value_bn?: string | null;
    slug: string;
  } | null;
}

export interface CategoryFilterAttribute {
  id: number;
  category_id: number;
  name: string;
  name_bn?: string | null;
  slug: string;
  unit?: string | null;
  input_type: 'select' | 'multiselect' | 'text' | 'number';
  is_filterable: boolean;
  is_required: boolean;
  sort_order: number;
  values: Array<{
    id: number;
    attribute_id: number;
    value: string;
    value_bn?: string | null;
    slug: string;
    sort_order: number;
    is_active: boolean;
    products_count: number;
  }>;
}

export interface CreateProductRequest {
  product_category_id: number;
  sku: string;
  name: string;
  description: string;
  price: number;
  discount_price?: number;
  stock_qty: number;
  low_stock_threshold: number;
  warranty_period?: string;
  images?: string[];
  specifications?: Record<string, any>;
  is_active: boolean;
}

export interface StockAdjustmentRequest {
  adjusted_qty: number;
  type: 'restock' | 'sale' | 'damaged' | 'returned' | 'correction';
  reason: string;
}

// ============================================
// Cart Types
// ============================================

export interface CartItem {
  id: number;
  cart_id?: number;
  item_type: 'product' | 'service';
  product_id?: number;
  service_id?: number;
  product?: Product;
  service?: Service;
  quantity: number;
  unit_price: number;
  total_price: number;
  price?: number;
  subtotal?: number;
  notes?: string;
  is_saved_for_later?: boolean;
}

export interface Cart {
  id: number;
  items: CartItem[];
  total: number;
}

export interface AddToCartRequest {
  item_type: 'product' | 'service';
  item_id: number;
  quantity: number;
  notes?: string;
}

// ============================================
// Order Types
// ============================================

export interface Order {
  id: number;
  customer_id?: number;
  user_id?: number;
  vendor_profile_id?: number | null;
  order_number: string;
  order_status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';
  /** @deprecated Use order_status instead */
  status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';
  payment_method: 'bkash' | 'cash' | 'bank_transfer';
  payment_status: 'pending' | 'paid' | 'failed';
  payment_instructions?: string;
  transaction_reference?: string;
  subtotal?: number | string;
  tax?: number | string;
  shipping?: number | string;
  discount?: number | string;
  total: number | string;
  /** @deprecated Use total instead */
  total_amount?: number | string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  /** @deprecated Use customer_address instead */
  delivery_address?: string;
  /** @deprecated Use customer_phone instead */
  contact_phone?: string;
  division_id?: number;
  district_id?: number;
  area_id?: number;
  division?: { id: number; name: string; name_bn?: string };
  district?: { id: number; name: string; name_bn?: string };
  area?: { id: number; name: string; name_bn?: string };
  customer_notes?: string;
  vendor_notes?: string;
  admin_notes?: string;
  cancellation_reason?: string;
  rejection_reason?: string;
  items: OrderItem[];
  vendor?: VendorProfile | null;
  vendor_profile?: VendorProfile | null;
  payment_notices?: any[];
  can_be_cancelled?: boolean;
  can_be_reviewed?: boolean;
  accepted_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  item_type: 'product' | 'service';
  product_id?: number | null;
  service_id?: number | null;
  item_name?: string;
  item_sku?: string;
  product?: Product;
  service?: Service;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
  /** @deprecated Use total_price instead */
  subtotal?: number | string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CheckoutRequest {
  cart_id: number;
  payment_method: 'bkash' | 'nagad' | 'cash' | 'bank_transfer';
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address: string;
  division_id: number;
  district_id: number;
  area_id?: number;
  customer_notes?: string;
}

export interface VendorCart {
  id: number;
  vendor: {
    id: number;
    business_name: string;
  };
  items: CartItem[];
  total: number;
}

export interface PaymentNoticeRequest {
  transaction_reference: string;
  amount: number;
  notes?: string;
}

// ============================================
// Review Types
// ============================================

export interface Review {
  id: number;
  order_id: number;
  vendor_profile_id: number;
  customer_id: number;
  rating: number;
  comment: string;
  vendor_reply?: string;
  customer: {
    id: number;
    name: string;
  };
  order: {
    id: number;
    order_number: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateReviewRequest {
  order_id: number;
  rating: number;
  comment: string;
}

// ============================================
// Support Ticket Types
// ============================================

export interface Ticket {
  id: number;
  user_id: number;
  order_id?: number;
  ticket_number: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  order?: {
    id: number;
    order_number: string;
  };
  messages: TicketMessage[];
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  message: string;
  sender: {
    id: number;
    name: string;
    role: string;
  };
  created_at: string;
}

export interface CreateTicketRequest {
  subject: string;
  message: string;
  order_id?: number;
  priority: 'low' | 'medium' | 'high';
}

export interface AddTicketMessageRequest {
  message: string;
}

// ============================================
// CMS Types
// ============================================

export interface CmsPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Banner {
  id: number;
  title: string;
  description?: string;
  image: string;
  link?: string;
  position: 'home_slider' | 'home_sidebar' | 'category_top';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Faq {
  id: number;
  question: string;
  question_bn?: string;
  answer: string;
  answer_bn?: string;
  category: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Admin Report Types
// ============================================

export interface DashboardStats {
  total_vendors: number;
  active_vendors: number;
  pending_vendors: number;
  total_customers: number;
  total_orders: number;
  pending_orders: number;
  total_revenue: number;
  this_month_revenue: number;
  total_services: number;
  total_products: number;
  low_stock_products: number;
  open_tickets: number;
}

export interface SalesReport {
  summary: {
    total_orders: number;
    total_revenue: number;
    average_order_value: number;
    completed_orders: number;
    cancelled_orders: number;
  };
  orders: PaginatedResponse<Order>;
}

export interface InventoryReport {
  summary: {
    total_products: number;
    in_stock_products: number;
    out_of_stock_products: number;
    low_stock_products: number;
    total_inventory_value: number;
  };
  products: Product[];
}

export interface AuditLog {
  id: number;
  user: {
    id: number;
    name: string;
  };
  action: 'create' | 'update' | 'delete';
  resource_type: string;
  resource_id: number;
  old_values: any;
  new_values: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
}