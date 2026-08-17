export interface User {
  id: number;
  user_code?: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'customer' | 'vendor' | 'staff' | 'super_admin';
  /** Spatie role names currently assigned to this user (tier role + any custom roles). */
  roles?: string[] | { id: number; name: string }[];
  /** Effective permission names across all assigned roles — only present on the logged-in user (/auth/me, /auth/login). */
  permissions?: string[];
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface VendorProfile {
  id: number;
  user_id: number;
  business_name: string;
  owner_name: string;
  description?: string;
  address: string;
  division_id: number;
  district_id: number;
  area_id: number;
  logo?: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  is_featured: boolean;
  rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
  user?: User;
  division?: Division;
  district?: District;
  area?: Area;
}

export interface Division {
  id: number;
  name: string;
  bn_name?: string;
  status?: string;
  districts_count?: number;
}

export interface District {
  id: number;
  division_id: number;
  name: string;
  bn_name?: string;
  status?: string;
  division?: Division;
  areas_count?: number;
}

export interface Area {
  id: number;
  district_id: number;
  name: string;
  bn_name?: string;
  post_code?: string;
  status?: string;
  district?: District;
}

export interface ServiceCategory {
  id: number;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  parent_id?: number | null;
  description?: string;
  is_active?: boolean;
  is_featured?: boolean;
  sort_order?: number;
  status?: string;
  services_count?: number;
  parent?: {
    id: number;
    name: string;
    parent_id?: number | null;
    parent?: {
      id: number;
      name: string;
    } | null;
  } | null;
}

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  parent_id?: number | null;
  description?: string;
  is_active?: boolean;
  is_featured?: boolean;
  sort_order?: number;
  status?: string;
  products_count?: number;
  parent?: {
    id: number;
    name: string;
    parent_id?: number | null;
    parent?: {
      id: number;
      name: string;
    } | null;
  };
  children?: ProductCategory[];
}

export interface ProductBrand {
  id: number;
  name: string;
  name_bn?: string;
  slug: string;
  logo?: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  products_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface Service {
  id: number;
  vendor_profile_id?: number | null;
  category_id: number;
  name: string;
  name_bn?: string;
  code?: string;
  slug?: string;
  description?: string;
  short_description?: string;
  base_price: number;
  discount_price?: number | null;
  current_price?: number;
  has_discount?: boolean;
  duration_estimate?: string;
  image?: string | null;
  gallery?: string[];
  features?: string[];
  is_active: boolean;
  is_featured: boolean;
  sort_order?: number;
  vendor?: VendorProfile;
  category?: ServiceCategory;
  created_by?: number;
  creator?: { id: number; name: string };
  created_at: string;
  updated_at?: string;
}

export interface Product {
  id: number;
  vendor_profile_id: number;
  category_id: number;
  brand_id?: number;
  name: string;
  name_bn?: string;
  sku: string;
  description?: string;
  short_description?: string;
  price: number;
  discount_price?: number;
  stock_qty: number;
  low_stock_threshold: number;
  always_in_stock?: boolean;
  current_cost?: number | null;
  unit?: string;
  brand?: string; // Deprecated text field
  brand_name?: string;
  brand_details?: ProductBrand;
  model?: string;
  warranty_value?: number | null;
  warranty_unit?: 'day' | 'week' | 'month' | 'year' | null;
  /** Free-text exceptions/details, e.g. "No warranty for fan or cooler" — kept alongside the structured value/unit above. */
  warranty_note?: string;
  specifications?: Record<string, string>;
  image?: string;
  gallery?: string[];
  is_active: boolean;
  is_draft?: boolean;
  is_featured: boolean;
  sort_order?: number;
  created_by?: number;
  creator?: { id: number; name: string };
  created_at: string;
  updated_at?: string;
  vendor?: VendorProfile;
  category?: ProductCategory;
  attribute_values?: ProductAttributeValueEntry[];
  serials?: ProductSerial[];
}

export interface ProductSerial {
  id: number;
  serial_number: string;
  status: 'in_stock' | 'sold' | 'returned';
  created_at?: string;
}

export interface AttributeValue {
  id: number;
  attribute_id: number;
  value: string;
  value_bn?: string | null;
  slug: string;
  sort_order: number;
  is_active: boolean;
  products_count?: number;
}

export interface CategoryAttribute {
  id: number;
  category_id: number;
  name: string;
  name_bn?: string | null;
  slug: string;
  unit?: string | null;
  input_type: 'select' | 'multiselect' | 'text' | 'number';
  is_filterable: boolean;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  values?: AttributeValue[];
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

export interface PaymentNotice {
  id: number;
  order_id: number;
  vendor_profile_id?: number | null;
  method: string;
  instructions_shown?: string | null;
  transaction_reference?: string | null;
  payment_proof_image?: string | null;
  amount: number;
  status: string;
  marked_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number | null;            // null for guest orders
  session_id?: string | null;            // set for guest orders
  is_guest?: boolean;                    // true when customer_id is null
  vendor_profile_id?: number | null;
  order_status: 'pending' | 'accepted' | 'rejected' | 'confirmed' | 'in_progress' | 'processing' | 'awaiting_payment' | 'completed' | 'cancelled' | 'refunded';
  status?: string; // alias kept for compatibility
  payment_status: 'pending' | 'awaiting_confirmation' | 'partially_paid' | 'paid' | 'verified' | 'failed' | 'refunded';
  payment_method: string;
  subtotal: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  delivery_charge?: number; // kept for compatibility
  total: number;
  refund_amount?: number | null;
  paid_amount?: number;
  outstanding_receivable?: number;
  is_payment_ledger_synced?: boolean;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  delivery_address?: string; // kept for compatibility
  division?: { id: number; name: string; is_active?: boolean };
  district?: { id: number; name: string; is_active?: boolean };
  area?: { id: number; name: string; is_active?: boolean };
  customer_notes?: string;
  vendor_notes?: string;
  admin_notes?: string;
  can_be_cancelled?: boolean;
  can_be_reviewed?: boolean;
  can_be_edited?: boolean;
  can_edit_items_and_pricing?: boolean;
  requires_super_admin_to_amend?: boolean;
  accepted_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  created_by?: number;
  creator?: { id: number; name: string };
  created_at: string;
  updated_at: string;
  customer?: User;
  vendor?: VendorProfile | null;
  items?: OrderItem[];
  payment_notices?: PaymentNotice[];
  review?: Review | null;
  service_intake?: {
    id: number;
    receipt_number: string;
    status: ServiceIntakeStatus;
    received_at?: string | null;
  } | null;
  /** Purchase Order(s) manually created to source stock for this order. */
  purchase_orders?: { id: number; po_number: string; status: PurchaseOrderStatus; product_ids: number[] }[];
}

export interface CustomInvoiceItem {
  item_name: string;
  item_sku?: string | null;
  notes?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CustomInvoice {
  id: number;
  order_id: number;
  invoice_number: string;
  invoice_date: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  items: CustomInvoiceItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  notes?: string | null;
  created_by?: number | null;
  creator?: { id: number; name: string };
  created_at: string;
  updated_at: string;
}

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface QuotationItem {
  product_id?: number | null;
  item_name: string;
  item_sku?: string | null;
  item_sn?: string | null;
  description?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  /** Whether SKU / Serial No. / "Catalog Item" badge print on the PDF for this row — off by
   *  default so the printed item list stays to just the name/description. */
  show_details?: boolean;
}

export type QuotationTemplateType = 'notes' | 'terms';

export interface QuotationTemplate {
  id: number;
  type: QuotationTemplateType;
  title: string;
  content: string;
  is_default: boolean;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  quotation_date: string;
  valid_until?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  notes?: string | null;
  terms?: string | null;
  status: QuotationStatus;
  is_expired: boolean;
  created_by?: number | null;
  customer?: User | null;
  creator?: { id: number; name: string };
  created_at: string;
  updated_at: string;
}

export interface QuotationProductSearchResult {
  id: number;
  name: string;
  sku?: string | null;
  current_price: number;
  image?: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  item_type: 'service' | 'product';
  item_id?: number;
  product_id?: number | null;
  service_id?: number | null;
  item_name: string;
  item_sku?: string;
  name?: string; // kept for compatibility
  unit_price: number;
  price?: number; // kept for compatibility
  quantity: number;
  /** What this line item actually cost — snapshotted at time of sale, editable in the admin order form. */
  cost_price?: number | null;
  /** The warranty promised to the customer for this sale — defaults from the product, editable per line. */
  warranty_value?: number | null;
  warranty_unit?: string | null;
  total_price: number;
  total?: number; // kept for compatibility
  notes?: string | null;
  total_cost?: number;
  margin?: number;
  costs?: {
    id: number;
    title: string;
    amount: number;
    expense_date: string;
    description?: string | null;
    is_reversed?: boolean;
  }[];
  product?: Product | null;
  service?: Service | null;
  /** Which specific in-stock unit(s) were sold under this line item, when the product is serialized. */
  serials?: ProductSerial[];
}

export type ServiceIntakeStatus =
  | 'received'
  | 'in_progress'
  | 'ready'
  | 'converted'
  | 'delivered'
  | 'cancelled';

export type ServiceIntakeItemStatus = 'pending' | 'converted' | 'returned';

export interface ServiceIntakeItem {
  id?: number;
  service_intake_id?: number;
  service_id?: number | null;
  item_name: string;
  serial_number?: string | null;
  problem_reported?: string | null;
  accessories?: string | null;
  condition_notes?: string | null;
  quantity: number;
  estimated_price?: number | string | null;
  status?: ServiceIntakeItemStatus;
  service?: Service | null;
}

export interface ServiceIntake {
  id: number;
  receipt_number: string;
  customer_id?: number | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  customer_address?: string | null;
  branch_location_id?: number | null;
  division_id?: number | null;
  district_id?: number | null;
  area_id?: number | null;
  status: ServiceIntakeStatus;
  estimated_cost?: number | string | null;
  received_at?: string | null;
  expected_delivery_at?: string | null;
  delivered_at?: string | null;
  notes?: string | null;
  admin_notes?: string | null;
  order_id?: number | null;
  created_by?: number | null;
  created_at: string;
  updated_at?: string;
  items?: ServiceIntakeItem[];
  customer?: User | null;
  creator?: { id: number; name: string };
  branch_location?: BranchLocation | null;
  order?: Order | null;
}

export interface Review {
  id: number;
  order_id: number;
  customer_id: number;
  vendor_profile_id: number;
  rating: number;
  review?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  customer?: User;
  vendor?: VendorProfile;
}

export interface Ticket {
  id: number;
  ticket_number: string;
  user_id: number;
  order_id?: number;
  subject: string;
  description?: string;
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'in-progress' | 'waiting' | 'resolved' | 'closed';
  messages_count?: number;
  assigned_staff?: { id: number; name: string };
  order?: { id: number; order_number: string };
  created_at: string;
  updated_at: string;
  user?: User;
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  message: string;
  is_staff?: boolean;
  created_at: string;
  user?: User;
}

export type CMSPageType = 'page' | 'faq' | 'terms' | 'privacy' | 'about' | 'contact' | 'guide';

export interface CMSPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  status: 'draft' | 'published';
  page_type?: CMSPageType;
  featured_image?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BannerMeta {
  gradient_from?: string;
  gradient_to?: string;
  icon?: string;
  [key: string]: string | undefined;
}

export interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  image: string;
  mobile_image?: string;
  link_url?: string;
  link_text?: string;
  link?: string; // legacy
  position: string;
  sort_order: number;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  meta?: BannerMeta | null;
  created_at: string;
  updated_at?: string;
}

export interface FAQ {
  id: number;
  question: string;
  answer: string;
  category?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

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

export interface Setting {
  id: number;
  key: string;
  value: string;
  group: string;
  type?: 'text' | 'number' | 'boolean' | 'textarea' | 'select';
  label?: string;
  options?: string[];
  description?: string;
}

export interface AuditLog {
  id: number;
  actor_id: number;
  action_type: string;
  resource_type?: string;
  resource_id?: number | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  description?: string;
  ip_address: string;
  user_agent?: string;
  created_at: string;
  updated_at?: string;
  actor?: User;
  // legacy aliases
  user_id?: number;
  user?: User;
  action?: string;
  model_type?: string;
  model_id?: number;
}

export interface Role {
  id: number;
  name: string;
  guard_name?: string;
  description?: string;
  users_count?: number;
  created_at?: string;
  updated_at?: string;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  name: string;
  guard_name?: string;
  description?: string;
  module?: string;
  created_at?: string;
}

export interface DashboardStats {
  total_users: number;
  total_vendors: number;
  total_orders: number;
  total_revenue: number;
  current_cash_balance?: number;
  pending_vendors: number;
  pending_orders: number;
  recent_orders: Order[];
  revenue_chart: { date: string; revenue: number; orders: number }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  channel: string;
  target_type: string;
  target_id?: number;
  link?: string;
  image?: string;
  data?: Record<string, unknown>;
  sent_at?: string;
  read_count: number;
  total_sent: number;
  is_read?: boolean;
  created_at: string;
  created_by?: { id: number; name: string };
}


export interface InventoryLog {
  id: number;
  product_id: number;
  type: 'addition' | 'subtraction' | 'adjustment';
  quantity: number;
  previous_qty: number;
  new_qty: number;
  reason?: string;
  created_at: string;
  product?: Product;
}

export interface DashboardStatsWithTrends extends DashboardStats {
  trends?: {
    users_change: number;
    vendors_change: number;
    orders_change: number;
    revenue_change: number;
  };
  low_stock_products?: Product[];
  recent_tickets?: Ticket[];
}

export interface ExpenseCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  expenses_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: number;
  expense_category_id: number;
  title: string;
  amount: number | string;
  expense_date: string;
  description?: string;
  reference?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  is_ledger_synced: boolean;
  is_reversed?: boolean;
  reversed_at?: string;
  category?: ExpenseCategory;
  creator?: { id: number; name: string };
  reverser?: { id: number; name: string };
}

export interface ExpenseReport {
  period: { start: string; end: string; group_by: string };
  summary: { total_sales: number; total_expenses: number; net_revenue: number };
  by_category: Array<{ id: number; name: string; slug: string; total: number }>;
  expense_trend: Array<{ period: string; total: string }>;
  sales_trend: Array<{ period: string; total: string; order_count: number }>;
  recent_expenses: Expense[];
}

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Investor {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  balance?: number;
  created_at: string;
  updated_at: string;
}

export interface Investment {
  id: number;
  investor_id: number;
  type: 'contribution' | 'return';
  amount: number;
  investment_date: string;
  description?: string;
  created_by?: number;
  investor?: Investor;
  creator?: { id: number; name: string };
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  product_id: number;
  quantity: number;
  received_qty: number;
  returned_qty: number;
  unit_cost: number | string;
  total_cost: number | string;
  /** The supplier's warranty on this specific batch — independent of the product's own warranty. */
  warranty_value?: number | null;
  warranty_unit?: string | null;
  product?: Product;
  serials?: ProductSerial[];
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  /** Set when this PO was created specifically to source stock for an order already placed. */
  order_id?: number | null;
  status: PurchaseOrderStatus;
  subtotal: number | string;
  tax: number | string;
  shipping_cost: number | string;
  total: number | string;
  paid_amount: number | string;
  received_value: number;
  returned_value: number;
  outstanding_payable: number;
  /** Set when returns have pushed net-owed below zero — a refund owed back to us. */
  refund_due_from_supplier: number;
  unposted_received_value: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  expected_date?: string | null;
  ordered_at?: string | null;
  received_at?: string | null;
  cancelled_at?: string | null;
  notes?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
  creator?: { id: number; name: string };
  order?: { id: number; order_number: string } | null;
}

/** One serial number from a purchase batch, traced forward to whichever sale (order/invoice)
 *  consumed it — `sold` is null while the unit is still `in_stock` or was `returned` upstream. */
export interface PurchaseProductHistorySerial {
  serial_number: string;
  status: 'in_stock' | 'sold' | 'returned';
  sold: {
    order_id: number;
    order_number: string;
    customer_name?: string | null;
    sold_at: string;
  } | null;
}

/** Every purchase-order line that's ever brought a given product in, across every supplier —
 *  used by the Purchase History page's "By Product" tab. A single purchase order can carry
 *  multiple products (and each product line its own serials), so this is scoped per line item,
 *  not per PO. */
export interface PurchaseProductHistoryItem {
  id: number;
  po_id: number;
  po_number: string;
  po_status: PurchaseOrderStatus;
  date: string;
  supplier: { id: number; name: string } | null;
  quantity: number;
  received_qty: number;
  returned_qty: number;
  unit_cost: number | string;
  total_cost: number | string;
  warranty_value?: number | null;
  warranty_unit?: 'day' | 'week' | 'month' | 'year' | null;
  serials: PurchaseProductHistorySerial[];
}

export interface PurchaseProductHistory {
  product: {
    id: number;
    name: string;
    sku: string;
    current_cost?: number | string | null;
    stock_qty: number;
    warranty_value?: number | null;
    warranty_unit?: 'day' | 'week' | 'month' | 'year' | null;
    warranty_note?: string;
  };
  items: PurchaseProductHistoryItem[];
  summary: {
    total_purchase_orders: number;
    total_quantity_ordered: number;
    total_quantity_received: number;
    total_spent: number;
    avg_unit_cost: number;
    last_purchase_date: string | null;
  };
}

/** One unit found by a serial-number lookup — used by the Purchase History page's "By Serial"
 *  tab. `serial_number` is unique per product but not globally, so a search can legitimately
 *  return more than one match (e.g. two different products that happen to share a serial string). */
export interface PurchaseSerialHistoryEntry {
  serial_number: string;
  status: 'in_stock' | 'sold' | 'returned';
  product: {
    id: number;
    name: string;
    sku: string;
    warranty_value?: number | null;
    warranty_unit?: 'day' | 'week' | 'month' | 'year' | null;
    warranty_note?: string;
  } | null;
  purchase: {
    po_id: number;
    po_number: string;
    supplier: { id: number; name: string } | null;
    date: string;
    unit_cost: number | string;
    warranty_value?: number | null;
    warranty_unit?: 'day' | 'week' | 'month' | 'year' | null;
  } | null;
  sold: {
    order_id: number;
    order_number: string;
    customer_name?: string | null;
    sold_at: string;
  } | null;
}

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface ChartOfAccount {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  description?: string;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryLine {
  id: number;
  journal_entry_id: number;
  account_id: number;
  debit: number | string;
  credit: number | string;
  description?: string;
  account?: ChartOfAccount;
}

export interface JournalEntry {
  id: number;
  entry_number: string;
  entry_date: string;
  reference_type?: string;
  reference_id?: number;
  description: string;
  created_by?: number;
  reversed_entry_id?: number;
  is_reversal: boolean;
  created_at: string;
  lines?: JournalEntryLine[];
  creator?: { id: number; name: string };
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
}

export interface TrialBalance {
  as_of: string;
  accounts: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
}

export interface IncomeStatement {
  from: string;
  to: string;
  revenue: { code: string; name: string; amount: number }[];
  total_revenue: number;
  expenses: { code: string; name: string; amount: number }[];
  total_expenses: number;
  net_income: number;
}

export interface BalanceSheet {
  as_of: string;
  assets: { code: string; name: string; balance: number }[];
  total_assets: number;
  liabilities: { code: string; name: string; balance: number }[];
  total_liabilities: number;
  equity: { code: string; name: string; balance: number }[];
  computed_retained_earnings: number;
  total_equity: number;
}

export interface CashPosition {
  from: string;
  to: string;
  opening_balance: number;
  cash_in: number;
  cash_out: number;
  net_change: number;
  closing_balance: number;
}

export interface CashBookReceipt {
  date: string;
  voucher: string;
  particulars: string;
  cheque: number;
  cash_received: number;
}

export interface CashBookPayment {
  date: string;
  voucher: string;
  particulars: string;
  salary: number;
  cash_payment: number;
  cheque: number;
}

export interface CashBook {
  from: string;
  to: string;
  opening_balance: number;
  receipts: CashBookReceipt[];
  total_received: number;
  payments: CashBookPayment[];
  total_salary: number;
  total_cash_payment: number;
  total_payment_cheque: number;
  total_paid: number;
  closing_balance: number;
}

export interface AccountLedgerLine {
  date: string;
  entry_number: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
}

export interface AccountLedger {
  account: ChartOfAccount;
  lines: AccountLedgerLine[];
}

export interface PendingSyncSummary {
  expenses: number;
  orders: number;
  purchase_orders: number;
}

export interface SmsConnection {
  id: number;
  name: string;
  provider_name?: string | null;
  api_url: string;
  balance_url?: string | null;
  report_url?: string | null;
  method: 'GET' | 'POST';
  api_key?: string | null;
  sender_id?: string | null;
  phone_format: 'as_is' | 'bd_880';
  is_active: boolean;
  creator?: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface SmsBalance {
  configured: boolean;
  ok: boolean;
  balance: string | null;
  validity: string | null;
  raw: string | null;
}

export interface SmsUsageByPurpose {
  purpose: string;
  total: number;
  sent: number;
  failed: number;
  total_cost: number | string | null;
}

export interface SmsUsageStats {
  by_purpose: SmsUsageByPurpose[];
  overall: { total: number; sent: number; failed: number; total_cost: number | string | null };
}

export interface SmsCampaign {
  id: number;
  name: string;
  message: string;
  sms_connection_id?: number | null;
  connection?: { id: number; name: string } | null;
  recipient_source: 'all_customers' | 'manual';
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: 'completed' | 'failed';
  creator?: { id: number; name: string } | null;
  created_at: string;
}

export interface SmsLog {
  id: number;
  phone: string;
  message: string;
  purpose: 'otp' | 'order_placed' | 'order_status' | 'order_delivered' | 'custom_invoice' | 'payment_due' | 'campaign' | 'test' | 'other';
  status: 'sent' | 'failed';
  response?: string | null;
  provider_request_id?: string | null;
  cost?: number | string | null;
  related_id?: number | null;
  sender?: { id: number; name: string } | null;
  connection?: { id: number; name: string } | null;
  created_at: string;
}
