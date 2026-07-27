export interface User {
  id: number;
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
  average_cost?: number | null;
  unit?: string;
  brand?: string; // Deprecated text field
  brand_name?: string;
  brand_details?: ProductBrand;
  model?: string;
  warranty?: string;
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
}

export type ServiceIntakeStatus =
  | 'received'
  | 'in_progress'
  | 'ready'
  | 'converted'
  | 'delivered'
  | 'cancelled';

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

export interface CMSPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  status: 'draft' | 'published';
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
  unit_cost: number | string;
  total_cost: number | string;
  product?: Product;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  status: PurchaseOrderStatus;
  subtotal: number | string;
  tax: number | string;
  shipping_cost: number | string;
  total: number | string;
  paid_amount: number | string;
  received_value: number;
  outstanding_payable: number;
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
