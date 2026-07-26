'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, Search, Package, Wrench, FileText, User, MapPin, CreditCard, Save,
  UserPlus, CheckCircle2, X, Sparkles, Lock,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Select, SearchableSelect, Badge, LoadingSpinner,
} from '@/components/ui';
import { Product, Service, User as UserType, ProductCategory, Order, OrderItem } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemType = 'product' | 'service' | 'custom';

interface OrderLineItem {
  id: string;
  item_type: ItemType;
  product_id?: number;
  service_id?: number;
  item_name: string;
  item_sku: string;
  quantity: number;
  unit_price: number;
  notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'awaiting_confirmation', label: 'Awaiting Confirmation' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
];

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'processing', label: 'Processing' },
  { value: 'awaiting_payment', label: 'Awaiting Payment' },
  { value: 'completed', label: 'Completed' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

// Flattens a parent -> children -> grandchildren category tree into a depth-indented,
// search-friendly option list (top-level categories first, each immediately followed by
// its own children, rather than one flat alphabetical/sort_order list with no hierarchy).
function flattenCategoryTree(categories: ProductCategory[], depth = 0): { value: string; label: string }[] {
  return categories.flatMap((cat) => [
    { value: String(cat.id), label: `${'    '.repeat(depth)}${depth > 0 ? '↳ ' : ''}${cat.name}` },
    ...(cat.children?.length ? flattenCategoryTree(cat.children, depth + 1) : []),
  ]);
}

function newLineItem(type: ItemType = 'custom'): OrderLineItem {
  return {
    id: generateId(),
    item_type: type,
    item_name: '',
    item_sku: '',
    quantity: 1,
    unit_price: 0,
    notes: '',
  };
}

// Custom (non-catalog) charges are stored server-side as item_type 'product' with no product_id,
// so classify by presence of product_id/service_id rather than trusting item_type alone.
function classifyItem(item: OrderItem): ItemType {
  if (item.service_id) return 'service';
  if (item.product_id) return 'product';
  return 'custom';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ItemSearchModalProps {
  type: 'product' | 'service';
  onSelect: (item: Product | Service) => void;
  onClose: () => void;
}

const EMPTY_QUICK_PRODUCT = { name: '', category_id: '', price: '', sku: '', stock_qty: '0' };

function ItemSearchModal({ type, onSelect, onClose }: ItemSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Product | Service)[]>([]);
  const [loading, setLoading] = useState(false);

  // Instant/draft product creation — only relevant when searching products
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [quickProduct, setQuickProduct] = useState(EMPTY_QUICK_PRODUCT);
  const [isCreating, setIsCreating] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      if (type === 'product') {
        const res = await adminService.getProducts({ search: q, per_page: 20 });
        const data = (res.data as { data?: unknown })?.data ?? res.data;
        setResults(Array.isArray(data) ? data : []);
      } else {
        const res = await adminService.getServices({ search: q, per_page: 20 });
        const data = (res.data as { data?: unknown })?.data ?? res.data;
        setResults(Array.isArray(data) ? data : []);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    search('');
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 350);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (type !== 'product') return;
    adminService.getProductCategoriesTree().then((res) => {
      const data = (res.data as { data?: unknown })?.data ?? res.data;
      setCategories(Array.isArray(data) ? data as ProductCategory[] : []);
    }).catch(() => setCategories([]));
  }, [type]);

  const openCreateMode = () => {
    setQuickProduct({ ...EMPTY_QUICK_PRODUCT, name: query });
    setMode('create');
  };

  const handleQuickCreate = async () => {
    if (!quickProduct.name.trim()) {
      toast.error('Enter a product name');
      return;
    }
    if (!quickProduct.category_id) {
      toast.error('Select a category');
      return;
    }
    if (!quickProduct.price || parseFloat(quickProduct.price) < 0) {
      toast.error('Enter a valid price');
      return;
    }

    setIsCreating(true);
    try {
      const res = await adminService.createProduct({
        name: quickProduct.name.trim(),
        category_id: Number(quickProduct.category_id),
        price: parseFloat(quickProduct.price),
        stock_qty: parseInt(quickProduct.stock_qty, 10) || 0,
        sku: quickProduct.sku.trim() || undefined,
        // Instant products stay hidden from the storefront until an admin fills in the
        // remaining details (description, images, etc.) and activates them from Products.
        is_active: false,
        is_draft: true,
      });
      const created = res.data?.data as Product;
      toast.success(`"${created.name}" created as a draft product and added to the order.`);
      onSelect(created);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">
            {mode === 'create' ? 'Create Instant Product' : `Search ${type === 'product' ? 'Products' : 'Services'}`}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {mode === 'search' ? (
          <>
            {/* Search box */}
            <div className="p-4 border-b space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={`Search by name or SKU...`}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {type === 'product' && (
                <button
                  type="button"
                  onClick={openCreateMode}
                  className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  Can&apos;t find it? Create an instant product
                </button>
              )}
            </div>

            {/* Results */}
            <div className="overflow-y-auto flex-1 p-2">
              {loading && (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              )}
              {!loading && results.length === 0 && (
                <p className="text-center text-gray-500 py-8 text-sm">No results found</p>
              )}
              {!loading && results.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {results.map(item => {
                    const isProduct = type === 'product';
                    const price = isProduct
                      ? ((item as Product).discount_price ?? (item as Product).price)
                      : ((item as Service).discount_price ?? (item as Service).base_price);
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelect(item)}
                        className="text-left rounded-lg border border-gray-200 px-4 py-3 hover:border-primary-300 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                            {isProduct && (item as Product).sku && (
                              <p className="text-xs text-gray-500">SKU: {(item as Product).sku}</p>
                            )}
                            {isProduct && (
                              <p className="text-xs text-gray-500">
                                Stock: {(item as Product).stock_qty}
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-primary-600 whitespace-nowrap">
                            {formatCurrency(price)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              This creates a real product record with just the basics, kept hidden from the storefront
              (marked &quot;Inactive&quot;). Find it later in Products to add a description, images, and activate it.
            </div>
            <Input
              label="Product Name *"
              value={quickProduct.name}
              onChange={e => setQuickProduct(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Generic USB-C Cable"
              autoFocus
            />
            <SearchableSelect
              label="Category"
              required
              value={quickProduct.category_id}
              onChange={value => setQuickProduct(p => ({ ...p, category_id: String(value) }))}
              options={flattenCategoryTree(categories)}
              placeholder="Select category..."
              searchPlaceholder="Search categories..."
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Price (৳) *"
                type="number"
                min={0}
                step="0.01"
                value={quickProduct.price}
                onChange={e => setQuickProduct(p => ({ ...p, price: e.target.value }))}
                placeholder="0.00"
              />
              <Input
                label="Initial Stock"
                type="number"
                min={0}
                value={quickProduct.stock_qty}
                onChange={e => setQuickProduct(p => ({ ...p, stock_qty: e.target.value }))}
              />
            </div>
            <Input
              label="SKU"
              value={quickProduct.sku}
              onChange={e => setQuickProduct(p => ({ ...p, sku: e.target.value }))}
              placeholder="Optional — auto-generated if left blank"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setMode('search')}>Back to Search</Button>
              <Button type="button" onClick={handleQuickCreate} isLoading={isCreating}>
                Create &amp; Add to Order
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

interface OrderFormProps {
  /** When set, the form loads and edits an existing order instead of creating a new one. */
  orderId?: number;
}

export default function OrderForm({ orderId }: OrderFormProps) {
  const router = useRouter();
  const isEditMode = orderId != null;

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingOrder, setIsLoadingOrder] = useState(isEditMode);
  const [loadedOrder, setLoadedOrder] = useState<Order | null>(null);

  // Customer lookup (create mode only)
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<UserType[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<UserType | null>(null);

  // Duplicate customer detection (typed phone/email matching an existing account)
  const [duplicateMatch, setDuplicateMatch] = useState<UserType | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Item search modal
  const [searchModal, setSearchModal] = useState<{ type: 'product' | 'service'; forIndex: number } | null>(null);

  // Order line items
  const [items, setItems] = useState<OrderLineItem[]>([]);

  // Order meta
  const [meta, setMeta] = useState({
    vendor_profile_id: '',
    payment_method: 'cash',
    payment_status: 'pending',
    order_status: 'pending',
    discount: '',
    shipping: '',
    tax: '',
    admin_notes: '',
    customer_notes: '',
  });

  // Customer details (manual / auto-filled from customer)
  const [customerInfo, setCustomerInfo] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
  });

  // Whether items/pricing may still be changed — false once any payment has been recorded
  // (the AR/revenue journal entries are already posted against the current total in that case).
  const canEditItemsAndPricing = isEditMode ? (loadedOrder?.can_edit_items_and_pricing ?? true) : true;
  const canEdit = isEditMode ? (loadedOrder?.can_be_edited ?? true) : true;

  // ── Load existing order (edit mode) ─────────────────────────────────────

  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;
    (async () => {
      setIsLoadingOrder(true);
      try {
        const res = await adminService.getOrder(orderId!);
        const order = res.data?.data as Order;
        if (cancelled || !order) return;

        setLoadedOrder(order);
        setCustomerInfo({
          customer_name: order.customer_name ?? '',
          customer_phone: order.customer_phone ?? '',
          customer_email: order.customer_email ?? '',
          customer_address: order.customer_address ?? '',
        });
        setMeta({
          vendor_profile_id: order.vendor_profile_id ? String(order.vendor_profile_id) : '',
          payment_method: order.payment_method ?? 'cash',
          payment_status: order.payment_status ?? 'pending',
          order_status: order.order_status ?? 'pending',
          discount: order.discount ? String(order.discount) : '',
          shipping: order.shipping ? String(order.shipping) : '',
          tax: order.tax ? String(order.tax) : '',
          admin_notes: order.admin_notes ?? '',
          customer_notes: order.customer_notes ?? '',
        });
        setItems((order.items ?? []).map((item: OrderItem) => ({
          id: generateId(),
          item_type: classifyItem(item),
          product_id: item.product_id ?? undefined,
          service_id: item.service_id ?? undefined,
          item_name: item.item_name,
          item_sku: item.item_sku ?? '',
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          notes: item.notes ?? '',
        })));
      } catch (err) {
        toast.error(getErrorMessage(err));
        router.push('/orders');
      } finally {
        if (!cancelled) setIsLoadingOrder(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, orderId]);

  // ── Customer search (create mode only) ──────────────────────────────────

  useEffect(() => {
    if (isEditMode) return;
    if (!customerSearch || customerSearch.length < 2) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setCustomerLoading(true);
      try {
        const res = await adminService.getCustomers({ search: customerSearch, per_page: 10 });
        const data = (res.data as { data?: unknown })?.data ?? res.data;
        setCustomerResults(Array.isArray(data) ? data : []);
        setShowCustomerDropdown(true);
      } catch {
        setCustomerResults([]);
      } finally {
        setCustomerLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [customerSearch, isEditMode]);

  // Warn if the typed phone/email for a NEW customer actually already belongs to an existing
  // account, so the admin doesn't unknowingly attach this order to someone else's customer
  // record — they can either use that existing customer or fix a typo. Only relevant in create
  // mode; editing an existing order doesn't re-link its customer_id.
  useEffect(() => {
    if (isEditMode) return;
    if (selectedCustomer) {
      setDuplicateMatch(null);
      return;
    }
    const phone = customerInfo.customer_phone.trim();
    const email = customerInfo.customer_email.trim().toLowerCase();
    if (!phone && !email) {
      setDuplicateMatch(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicate(true);
      try {
        const query = phone || email;
        const res = await adminService.getCustomers({ search: query, per_page: 10 });
        const data = (res.data as { data?: unknown })?.data ?? res.data;
        const results: UserType[] = Array.isArray(data) ? data : [];
        const match = results.find(c =>
          (phone && c.phone === phone) || (email && c.email?.toLowerCase() === email)
        );
        setDuplicateMatch(match ?? null);
      } catch {
        setDuplicateMatch(null);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [customerInfo.customer_phone, customerInfo.customer_email, selectedCustomer, isEditMode]);

  function useDuplicateCustomer() {
    if (!duplicateMatch) return;
    selectCustomer(duplicateMatch);
    setDuplicateMatch(null);
  }

  function selectCustomer(c: UserType) {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setShowCustomerDropdown(false);
    setCustomerInfo({
      customer_name: c.name,
      customer_phone: c.phone ?? '',
      customer_email: c.email,
      customer_address: '',
    });
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerInfo({ customer_name: '', customer_phone: '', customer_email: '', customer_address: '' });
  }

  // ── Line items ──────────────────────────────────────────────────────────

  // Custom items have nothing to search for, so they're added directly as an empty editable
  // row. Products and services are always added by searching the catalog first (see
  // openAddProduct/openAddService below) — there's no empty "product" row waiting to be filled in.
  function addCustomItem() {
    setItems(prev => [...prev, newLineItem('custom')]);
  }

  function openAddProduct() {
    setSearchModal({ type: 'product', forIndex: -1 });
  }

  function openAddService() {
    setSearchModal({ type: 'service', forIndex: -1 });
  }

  function openChangeItem(index: number, type: 'product' | 'service') {
    setSearchModal({ type, forIndex: index });
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function updateItem(id: string, field: keyof OrderLineItem, value: string | number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function handleProductSelected(item: Product | Service) {
    const modal = searchModal;
    if (!modal) return;

    const populated: Partial<OrderLineItem> = modal.type === 'product'
      ? (() => {
          const p = item as Product;
          return {
            item_type: 'product' as ItemType,
            product_id: p.id,
            service_id: undefined,
            item_name: p.name,
            item_sku: p.sku ?? '',
            unit_price: p.discount_price ?? p.price,
          };
        })()
      : (() => {
          const s = item as Service;
          return {
            item_type: 'service' as ItemType,
            service_id: s.id,
            product_id: undefined,
            item_name: s.name,
            item_sku: s.code ?? '',
            unit_price: s.discount_price ?? s.base_price,
          };
        })();

    if (modal.forIndex === -1) {
      // Adding a brand new line — append a fully-populated row directly.
      setItems(prev => [...prev, { ...newLineItem(modal.type), ...populated }]);
    } else {
      // Replacing what an existing line points to (the "Change" link on a row).
      setItems(prev => prev.map((li, idx) => (idx === modal.forIndex ? { ...li, ...populated } : li)));
    }
    setSearchModal(null);
  }

  // ── Totals ─────────────────────────────────────────────────────────────

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const discount = parseFloat(meta.discount || '0') || 0;
  const shipping = parseFloat(meta.shipping || '0') || 0;
  const tax      = parseFloat(meta.tax || '0') || 0;
  const total    = subtotal - discount + shipping + tax;

  // ── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (canEditItemsAndPricing) {
      if (items.length === 0) {
        toast.error('Add at least one item to the order');
        return;
      }
      if (items.some(i => !i.item_name.trim())) {
        toast.error('All items must have a name');
        return;
      }
    }
    if (!customerInfo.customer_name && !selectedCustomer) {
      toast.error('Please provide a customer name or select a customer');
      return;
    }
    if (duplicateMatch) {
      toast.error('This phone/email already belongs to an existing customer — use them or fix the typo before continuing.');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditMode) {
        const payload: Record<string, unknown> = {
          ...customerInfo,
          payment_method: meta.payment_method,
          admin_notes: meta.admin_notes || null,
          customer_notes: meta.customer_notes || null,
        };
        if (canEditItemsAndPricing) {
          payload.discount = discount || null;
          payload.shipping = shipping || null;
          payload.tax = tax || null;
          payload.items = items.map(i => ({
            item_type: i.item_type,
            product_id: i.product_id ?? null,
            service_id: i.service_id ?? null,
            item_name: i.item_name,
            item_sku: i.item_sku || null,
            quantity: i.quantity,
            unit_price: i.unit_price,
            notes: i.notes || null,
          }));
        }

        await adminService.updateOrder(orderId!, payload);
        toast.success('Order updated successfully');
        router.push(`/orders/${orderId}`);
        return;
      }

      const payload: Record<string, unknown> = {
        ...customerInfo,
        customer_id: selectedCustomer?.id ?? null,
        vendor_profile_id: meta.vendor_profile_id || null,
        payment_method: meta.payment_method,
        payment_status: meta.payment_status,
        order_status: meta.order_status,
        discount: discount || null,
        shipping: shipping || null,
        tax: tax || null,
        admin_notes: meta.admin_notes || null,
        customer_notes: meta.customer_notes || null,
        items: items.map(i => ({
          item_type: i.item_type,
          product_id: i.product_id ?? null,
          service_id: i.service_id ?? null,
          item_name: i.item_name,
          item_sku: i.item_sku || null,
          quantity: i.quantity,
          unit_price: i.unit_price,
          notes: i.notes || null,
        })),
      };

      const res = await adminService.createOrder(payload);
      const order = res.data?.data;
      toast.success('Manual order created successfully');
      if (order?.id) {
        router.push(`/orders/${order.id}`);
      } else {
        router.push('/orders');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoadingOrder) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-24">
          <LoadingSpinner size="lg" />
        </div>
      </AdminLayout>
    );
  }

  if (isEditMode && !canEdit) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Edit Order</h1>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Lock className="w-8 h-8 text-gray-400" />
              <p className="text-gray-700 font-medium">
                This order can no longer be edited because it is {loadedOrder?.order_status?.replace('_', ' ')}.
              </p>
              <Button onClick={() => router.push(`/orders/${orderId}`)}>Back to Order</Button>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? `Edit Order ${loadedOrder?.order_number ?? ''}` : 'Create Manual Order'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEditMode
                ? 'Update customer details, items, and pricing. Order/payment status are changed from the order page.'
                : 'Create an offline / walk-in order on behalf of a customer'}
            </p>
          </div>
        </div>

        {isEditMode && !canEditItemsAndPricing && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-center gap-2">
            <Lock className="w-4 h-4 flex-shrink-0" />
            Items and pricing are locked because a payment has already been recorded against this order.
            You can still update customer details, payment method, and notes.
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Customer section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="w-4 h-4" /> Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditMode ? (
                  <>
                    {loadedOrder?.customer_id && (
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        Linked to customer account &mdash; editing these fields only updates this order&apos;s details.
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Customer Name *"
                        value={customerInfo.customer_name}
                        onChange={e => setCustomerInfo(p => ({ ...p, customer_name: e.target.value }))}
                        placeholder="Full name"
                        required
                      />
                      <Input
                        label="Phone"
                        value={customerInfo.customer_phone}
                        onChange={e => setCustomerInfo(p => ({ ...p, customer_phone: e.target.value }))}
                        placeholder="+880..."
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={customerInfo.customer_email}
                        onChange={e => setCustomerInfo(p => ({ ...p, customer_email: e.target.value }))}
                        placeholder="email@example.com"
                      />
                    </div>
                  </>
                ) : selectedCustomer ? (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
                          <Badge variant="success">Existing Customer</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {selectedCustomer.email}
                          {selectedCustomer.phone && ` · ${selectedCustomer.phone}`}
                        </p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={clearCustomer}>
                      <X className="w-3.5 h-3.5 mr-1" /> Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Find Existing Customer
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        value={customerSearch}
                        onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
                        placeholder="Type a name, phone, or email to search..."
                        className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      {customerLoading && (
                        <LoadingSpinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />
                      )}
                    </div>

                    {showCustomerDropdown && (
                      <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto w-full">
                        {customerResults.length > 0 ? customerResults.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectCustomer(c)}
                            className="w-full text-left px-4 py-2.5 hover:bg-primary-50 border-b last:border-b-0 text-sm transition-colors"
                          >
                            <span className="font-medium text-gray-900">{c.name}</span>
                            <span className="text-gray-400 ml-2">{c.email}</span>
                            {c.phone && <span className="text-gray-400 ml-2">· {c.phone}</span>}
                          </button>
                        )) : !customerLoading && (
                          <p className="px-4 py-3 text-sm text-gray-500">
                            No match — fill in the details below to create a new customer.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 my-4">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <UserPlus className="w-3.5 h-3.5" /> or enter new customer details
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Customer Name *"
                        value={customerInfo.customer_name}
                        onChange={e => setCustomerInfo(p => ({ ...p, customer_name: e.target.value }))}
                        placeholder="Full name"
                        required={!selectedCustomer}
                      />
                      <Input
                        label="Phone"
                        value={customerInfo.customer_phone}
                        onChange={e => setCustomerInfo(p => ({ ...p, customer_phone: e.target.value }))}
                        placeholder="+880..."
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={customerInfo.customer_email}
                        onChange={e => setCustomerInfo(p => ({ ...p, customer_email: e.target.value }))}
                        placeholder="email@example.com"
                      />
                    </div>

                    {duplicateMatch ? (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-sm text-red-700">
                          <span className="font-semibold">Duplicate customer</span> — this phone/email already
                          belongs to <span className="font-medium">{duplicateMatch.name}</span>
                          {duplicateMatch.email && ` (${duplicateMatch.email})`}
                          {duplicateMatch.phone && ` · ${duplicateMatch.phone}`}.
                        </p>
                        <Button type="button" size="sm" className="mt-2" onClick={useDuplicateCustomer}>
                          Use {duplicateMatch.name} instead
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2">
                        {checkingDuplicate
                          ? 'Checking for an existing customer with this phone/email...'
                          : 'A customer account is created automatically from these details — no need to register them separately.'}
                      </p>
                    )}
                  </div>
                )}

                <Input
                  label="Delivery / Billing Address"
                  value={customerInfo.customer_address}
                  onChange={e => setCustomerInfo(p => ({ ...p, customer_address: e.target.value }))}
                  placeholder="Address for this order"
                />
              </CardContent>
            </Card>

            {/* Items section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="w-4 h-4" /> Order Items
                  </CardTitle>
                  {canEditItemsAndPricing && (
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={openAddProduct}>
                        <Search className="w-3.5 h-3.5 mr-1" /> Add Product
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={openAddService}>
                        <Search className="w-3.5 h-3.5 mr-1" /> Add Service
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={addCustomItem}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Custom Charge
                      </Button>
                    </div>
                  )}
                </div>
                {canEditItemsAndPricing && (
                  <p className="text-xs text-gray-500 mt-1">
                    &quot;Add Product&quot; and &quot;Add Service&quot; search your catalog (or create an instant product) — use &quot;Custom Charge&quot; only for one-off, non-catalog fees.
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {items.length === 0 && (
                  <p className="text-center text-gray-400 py-6 text-sm">No items yet — add a product, a service, or a custom charge.</p>
                )}

                {items.map((item, idx) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                    {/* Row 1: type badge + change link + remove */}
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={item.item_type === 'product' ? 'info' : item.item_type === 'service' ? 'success' : 'default'}
                        className="capitalize text-xs"
                      >
                        {item.item_type === 'custom' ? 'Custom Charge' : item.item_type}
                      </Badge>

                      {canEditItemsAndPricing && (item.item_type === 'product' || item.item_type === 'service') && (
                        <button
                          type="button"
                          onClick={() => openChangeItem(idx, item.item_type as 'product' | 'service')}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          <Search className="w-3 h-3" />
                          Change
                        </button>
                      )}

                      {canEditItemsAndPricing && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="ml-auto p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Row 2: name + sku */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <Input
                          label="Item Name *"
                          value={item.item_name}
                          onChange={e => updateItem(item.id, 'item_name', e.target.value)}
                          placeholder="Item name"
                          required
                          disabled={!canEditItemsAndPricing}
                        />
                      </div>
                      <Input
                        label="SKU / Code"
                        value={item.item_sku}
                        onChange={e => updateItem(item.id, 'item_sku', e.target.value)}
                        placeholder="Optional"
                        disabled={!canEditItemsAndPricing}
                      />
                    </div>

                    {/* Row 3: qty + price + total */}
                    <div className="grid grid-cols-3 gap-3 items-end">
                      <Input
                        label="Quantity *"
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        required
                        disabled={!canEditItemsAndPricing}
                      />
                      <Input
                        label="Unit Price (৳) *"
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unit_price}
                        onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        required
                        disabled={!canEditItemsAndPricing}
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Line Total</label>
                        <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </div>
                      </div>
                    </div>

                    {/* Row 4: notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item Notes</label>
                      <input
                        value={item.notes}
                        onChange={e => updateItem(item.id, 'notes', e.target.value)}
                        placeholder="Color, size, special instructions..."
                        disabled={!canEditItemsAndPricing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Notes section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                  <textarea
                    value={meta.admin_notes}
                    onChange={e => setMeta(p => ({ ...p, admin_notes: e.target.value }))}
                    rows={3}
                    placeholder="Internal notes (not visible to customer)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Notes</label>
                  <textarea
                    value={meta.customer_notes}
                    onChange={e => setMeta(p => ({ ...p, customer_notes: e.target.value }))}
                    rows={3}
                    placeholder="Notes for the customer"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Right column (sidebar) ── */}
          <div className="space-y-6">

            {/* Order summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Discount (৳)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={meta.discount}
                    onChange={e => setMeta(p => ({ ...p, discount: e.target.value }))}
                    placeholder="0"
                    disabled={!canEditItemsAndPricing}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Shipping (৳)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={meta.shipping}
                    onChange={e => setMeta(p => ({ ...p, shipping: e.target.value }))}
                    placeholder="0"
                    disabled={!canEditItemsAndPricing}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tax (৳)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={meta.tax}
                    onChange={e => setMeta(p => ({ ...p, tax: e.target.value }))}
                    placeholder="0"
                    disabled={!canEditItemsAndPricing}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>

                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-lg text-primary-600">{formatCurrency(total)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment & Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="w-4 h-4" /> Payment & Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="Payment Method *"
                  value={meta.payment_method}
                  onChange={e => setMeta(p => ({ ...p, payment_method: e.target.value }))}
                  options={PAYMENT_METHODS}
                />
                {isEditMode ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                      <Badge variant="default" className="capitalize">{meta.payment_status.replace('_', ' ')}</Badge>
                      <p className="text-xs text-gray-400 mt-1">Change from the order page (Record Payment / status actions).</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Order Status</label>
                      <Badge variant="default" className="capitalize">{meta.order_status.replace('_', ' ')}</Badge>
                      <p className="text-xs text-gray-400 mt-1">Change from the order page.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Select
                      label="Payment Status *"
                      value={meta.payment_status}
                      onChange={e => setMeta(p => ({ ...p, payment_status: e.target.value }))}
                      options={PAYMENT_STATUSES}
                    />
                    <Select
                      label="Order Status *"
                      value={meta.order_status}
                      onChange={e => setMeta(p => ({ ...p, order_status: e.target.value }))}
                      options={ORDER_STATUSES}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Delivery info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="w-4 h-4" /> Delivery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  Delivery address is collected in the Customer section above. Division / District / Area filters can be added once the order is saved.
                </p>
              </CardContent>
            </Card>

            {/* Actions */}
            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" /> {isEditMode ? 'Saving Changes...' : 'Creating Order...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" /> {isEditMode ? 'Save Changes' : 'Create Order'}
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.back()}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {/* Item search modal */}
      {searchModal && (
        <ItemSearchModal
          type={searchModal.type}
          onSelect={handleProductSelected}
          onClose={() => setSearchModal(null)}
        />
      )}
    </AdminLayout>
  );
}
