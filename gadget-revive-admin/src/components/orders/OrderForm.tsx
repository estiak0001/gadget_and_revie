'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, Search, Package, Wrench, FileText, User, MapPin, CreditCard, Save,
  CheckCircle2, X, Sparkles, Lock, ShieldAlert, ChevronDown, ChevronUp, Check, Pencil,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Select, SearchableSelect, Badge, LoadingSpinner, ConfirmModal,
} from '@/components/ui';
import { Product, Service, User as UserType, ProductCategory, Order, OrderItem } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import { useAuthStore } from '@/store/auth';
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
  /** What this line actually cost — defaults from the product's current cost when picked,
   * editable, and saved on the order itself so margin stays accurate to time of sale. */
  cost_price: number;
  /** The warranty promised to the customer for this sale — defaults from the product, editable. */
  warranty_value: number | null;
  warranty_unit: string | null;
  notes: string;
  /** Which specific in-stock unit(s) of the product are being sold — optional. */
  serials?: string[];
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
    cost_price: 0,
    warranty_value: null,
    warranty_unit: null,
    notes: '',
    serials: [],
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
  const [quickProductSerials, setQuickProductSerials] = useState<string[]>([]);
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
    // Admin endpoint, not the public storefront tree — an instant product needs to be filed
    // under any existing category, including ones currently hidden from the storefront.
    adminService.getAdminProductCategories({ parent_only: true }).then((res) => {
      const data = (res.data as { data?: unknown })?.data ?? res.data;
      setCategories(Array.isArray(data) ? data as ProductCategory[] : []);
    }).catch(() => setCategories([]));
  }, [type]);

  const openCreateMode = () => {
    setQuickProduct({ ...EMPTY_QUICK_PRODUCT, name: query });
    setQuickProductSerials([]);
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
        // The whole point of quick-creating here is the real stock isn't confirmed yet (often
        // literally 0) — leaving this at the create-product default of true would make it
        // permanently invisible to out-of-stock detection regardless of actual stock_qty.
        always_in_stock: false,
      });
      const created = res.data?.data as Product;

      const serials = quickProductSerials.map(s => s.trim()).filter(Boolean);
      if (serials.length > 0) {
        try {
          await adminService.addProductSerials(created.id, serials);
        } catch (err) {
          toast.error(`Product created, but recording serial numbers failed: ${getErrorMessage(err)}`);
        }
      }

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
            {(() => {
              const stockQty = parseInt(quickProduct.stock_qty, 10) || 0;
              return stockQty > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">Serial numbers (optional)</label>
                    <span className={`text-xs ${quickProductSerials.length > stockQty ? 'text-red-600' : 'text-gray-400'}`}>
                      {quickProductSerials.length} of {stockQty}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {quickProductSerials.map((value, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={value}
                          onChange={e => setQuickProductSerials(prev => prev.map((s, i) => (i === index ? e.target.value : s)))}
                          placeholder={`Serial #${index + 1}`}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <button
                          type="button"
                          onClick={() => setQuickProductSerials(prev => prev.filter((_, i) => i !== index))}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQuickProductSerials(prev => [...prev, ''])}
                      disabled={quickProductSerials.length >= stockQty}
                      className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add serial number
                    </button>
                  </div>
                </div>
              );
            })()}
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

// Multi-select searchable dropdown for picking which in-stock serial(s) of a product are being
// sold on a line item. SearchableSelect (used elsewhere for single-value pickers like category)
// doesn't support multiple selection, so this is a small purpose-built sibling rather than
// stretching that component's contract for every other call site.
interface SerialPickerDropdownProps {
  options: string[];
  selected: string[];
  max: number;
  disabled?: boolean;
  onToggle: (serial: string) => void;
}

function SerialPickerDropdown({ options, selected, max, disabled, onToggle }: SerialPickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Rendered in a portal (see below) so it always floats above every card on the page — the
  // item row it lives in uses overflow:hidden for its rounded corners, which was silently
  // clipping the popup and making it look like clicking the field did nothing.
  const [popupRect, setPopupRect] = useState<{ top: number; left: number; width: number; openUpward: boolean } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // A serial the admin already picked might be one they just typed in below (not yet part of
  // the fetched "available in stock" list) — union the two so it still shows up, checked, in
  // the full list rather than only appearing transiently at the moment it's added.
  const allOptions = Array.from(new Set([...options, ...selected]));
  const filtered = allOptions.filter((sn) => sn.toLowerCase().includes(query.toLowerCase()));
  const trimmedQuery = query.trim();
  const canAddNew = trimmedQuery.length > 0 && !allOptions.some((sn) => sn.toLowerCase() === trimmedQuery.toLowerCase());

  const handleAddNew = () => {
    onToggle(trimmedQuery);
    setQuery('');
  };

  const POPUP_HEIGHT_ESTIMATE = 300;

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < POPUP_HEIGHT_ESTIMATE && rect.top > spaceBelow;
    setPopupRect({
      top: openUpward ? rect.top + window.scrollY : rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      openUpward,
    });
  }, []);

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) updatePosition();
    setIsOpen((v) => !v);
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // The popup is portaled to <body>, so it's not a DOM descendant of containerRef — it
      // needs its own check, or clicking anything inside it would immediately close it.
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        popupRef.current && !popupRef.current.contains(target)
      ) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) searchInputRef.current?.focus();
  }, [isOpen]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (canAddNew) {
        handleAddNew();
      } else if (filtered.length === 1) {
        onToggle(filtered[0]);
        setQuery('');
      }
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggleOpen}
        disabled={disabled}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          disabled ? 'bg-gray-50 cursor-not-allowed text-gray-400' : 'bg-white hover:border-gray-400'
        } ${isOpen ? 'border-primary-500 ring-2 ring-primary-500' : 'border-gray-300'}`}
      >
        <span className={`truncate ${selected.length > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected.length > 0 ? selected.join(', ') : options.length > 0 ? 'Select serial number(s)...' : 'No recorded serials — type to add one...'}
        </span>
        <span className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-xs text-gray-400">{selected.length}/{max}</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && popupRect && typeof document !== 'undefined' && createPortal(
        <div
          ref={popupRef}
          style={{
            position: 'absolute',
            top: popupRect.top,
            left: popupRect.left,
            width: popupRect.width,
            transform: popupRect.openUpward ? 'translateY(-100%)' : undefined,
            marginTop: popupRect.openUpward ? -4 : 4,
          }}
          className="z-[100] rounded-lg border border-gray-200 bg-white shadow-xl"
        >
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search, or type a new serial number..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {canAddNew && (
              <button
                type="button"
                onClick={handleAddNew}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-primary-600 hover:bg-primary-50"
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Add &quot;{trimmedQuery}&quot; as new serial</span>
                <span className="ml-auto flex-shrink-0 text-xs text-gray-400">Enter ↵</span>
              </button>
            )}
            {filtered.length === 0 && !canAddNew ? (
              <div className="px-3 py-6 text-center text-sm text-gray-500">
                {allOptions.length === 0 ? 'No serial numbers recorded yet — type one above to add it.' : 'No matching serial numbers'}
              </div>
            ) : (
              filtered.map((sn) => {
                const checked = selected.includes(sn);
                return (
                  <button
                    key={sn}
                    type="button"
                    onClick={() => onToggle(sn)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-100 ${checked ? 'bg-primary-50 text-primary-700' : ''}`}
                  >
                    <span className="flex-1 text-left font-mono">{sn}</span>
                    {checked && <Check className="w-4 h-4 text-primary-600" />}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
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

  // Customer lookup (create mode only) — searches as the admin types into the Name/Phone
  // fields themselves rather than a separate search box, so there's only one place to type.
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
  // Selectable serial numbers per line item — in-stock units for that product, plus whatever
  // is already assigned to this exact item (those read back as 'sold' from the API, not
  // 'in_stock', so they wouldn't otherwise appear in the available list).
  const [serialOptions, setSerialOptions] = useState<Record<string, string[]>>({});
  // Each item row collapses to a single summary line; only one can be open for editing at a
  // time — opening another closes whichever was open, since this is a single id, not a set.
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  function toggleExpand(id: string) {
    setExpandedItemId((prev) => (prev === id ? null : id));
  }

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

  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  // The backend accepts the amend_paid_orders permission as an alternative to super_admin for
  // unlocking a paid order's items/pricing — mirror that here so a custom role granted just the
  // permission actually gets the "Unlock amendment" control, not only literal super_admins.
  const canAmendPaidOrders = isSuperAdmin || !!currentUser?.permissions?.includes('amend_paid_orders');

  // Once a payment has been recorded, items/pricing are normally locked (the AR/revenue journal
  // entries are already posted against the current total). A super_admin (or anyone granted
  // amend_paid_orders) can still choose to unlock and amend a paid order — the backend re-posts
  // revenue/COGS at the new total and restocks/re-decrements inventory accordingly.
  const [superAdminUnlocked, setSuperAdminUnlocked] = useState(false);
  const baseCanEditItemsAndPricing = isEditMode ? (loadedOrder?.can_edit_items_and_pricing ?? true) : true;
  const canSuperAdminAmend = isEditMode && !!loadedOrder?.requires_super_admin_to_amend && canAmendPaidOrders;
  const canEditItemsAndPricing = baseCanEditItemsAndPricing || (canSuperAdminAmend && superAdminUnlocked);
  const canEdit = isEditMode ? (loadedOrder?.can_be_edited ?? true) : true;

  // Optional, submitted alongside the item/pricing amendment above (same unlock, same Save click)
  // rather than as a separate action — fixes what was RECORDED as paid, not what was charged.
  const [correctedPaidAmount, setCorrectedPaidAmount] = useState('');
  const [paymentCorrectionReason, setPaymentCorrectionReason] = useState('');
  // Once the admin writes their own reason, stop overwriting it with the auto-generated default
  // (the amount itself always stays live-synced — see the effect below).
  const [reasonManuallyEdited, setReasonManuallyEdited] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

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
        setCorrectedPaidAmount(order.paid_amount != null ? String(order.paid_amount) : '');
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
          cost_price: Number(item.cost_price ?? 0),
          warranty_value: item.warranty_value ?? null,
          warranty_unit: item.warranty_unit ?? null,
          notes: item.notes ?? '',
          serials: (item.serials ?? []).map(s => s.serial_number),
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

  // Lazily loads the pickable serial list for any product line item that doesn't have one
  // yet — covers both a freshly-added line and the items seeded from an existing order above.
  useEffect(() => {
    items.forEach((item) => {
      if (item.item_type === 'product' && item.product_id && !(item.id in serialOptions)) {
        adminService.getProductSerials(item.product_id)
          .then((res) => {
            const available = (res.data?.data || []).map((s) => s.serial_number);
            const preselected = item.serials ?? [];
            const merged = Array.from(new Set([...preselected, ...available]));
            setSerialOptions((prev) => ({ ...prev, [item.id]: merged }));
          })
          .catch(() => setSerialOptions((prev) => ({ ...prev, [item.id]: item.serials ?? [] })));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function toggleSerial(itemId: string, serial: string) {
    setItems((prev) => prev.map((i) => {
      if (i.id !== itemId) return i;
      const current = i.serials ?? [];
      if (current.includes(serial)) {
        return { ...i, serials: current.filter((s) => s !== serial) };
      }
      if (current.length >= i.quantity) {
        toast.error(`Only ${i.quantity} unit(s) needed for this line — deselect one first.`);
        return i;
      }
      return { ...i, serials: [...current, serial] };
    }));
  }

  // ── Customer search (create mode only) — driven by whatever's typed into Name or Phone,
  // instead of a separate search box. Once a result is picked, selectedCustomer is set and
  // this stops searching until "Change" clears it again. ──────────────────────────────────

  const customerQuery = customerInfo.customer_name.trim() || customerInfo.customer_phone.trim();

  useEffect(() => {
    if (isEditMode || selectedCustomer) return;
    if (!customerQuery || customerQuery.length < 2) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setCustomerLoading(true);
      try {
        const res = await adminService.getCustomers({ search: customerQuery, per_page: 10 });
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
  }, [customerQuery, isEditMode, selectedCustomer]);

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
    setCustomerInfo({ customer_name: '', customer_phone: '', customer_email: '', customer_address: '' });
  }

  // Name and phone are both optional — nothing blocks saving. If the admin left name blank:
  // a phone number alone means the name is genuinely unknown rather than empty, and nothing
  // at all means this is a walk-in sale with no info to record.
  function resolveCustomerName(): string {
    const name = customerInfo.customer_name.trim();
    if (name) return name;
    return customerInfo.customer_phone.trim() ? 'Unknown' : 'Walk-in Customer';
  }

  // ── Line items ──────────────────────────────────────────────────────────

  // Custom items have nothing to search for, so they're added directly as an empty editable
  // row. Products and services are always added by searching the catalog first (see
  // openAddProduct/openAddService below) — there's no empty "product" row waiting to be filled in.
  function addCustomItem() {
    const item = newLineItem('custom');
    setItems(prev => [...prev, item]);
    setExpandedItemId(item.id);
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

  function updateItem(id: string, field: keyof OrderLineItem, value: string | number | null) {
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
            cost_price: p.current_cost ?? 0,
            warranty_value: p.warranty_value ?? null,
            warranty_unit: p.warranty_unit ?? null,
            serials: [],
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
      // Adding a brand new line — append a fully-populated row directly, expanded so its
      // qty/serials/warranty can be reviewed right away.
      const newItem = { ...newLineItem(modal.type), ...populated };
      setItems(prev => [...prev, newItem]);
      setExpandedItemId(newItem.id);
    } else {
      // Replacing what an existing line points to (the "Change" link on a row) — the product
      // changed, so any previously-fetched serial options no longer apply to this line.
      const replacedId = items[modal.forIndex]?.id;
      if (replacedId) {
        setSerialOptions(prev => {
          const next = { ...prev };
          delete next[replacedId];
          return next;
        });
      }
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

  // Auto-suggests correcting the recorded payment to match whenever this edit drops the total
  // below what's already been paid — the customer is now owed the difference, and "Correct
  // Payment Amount" is exactly the mechanism that reflects that (it reverses/reposts the
  // Cash-account entry too, not just the order's own paid_amount field). Deliberately never
  // auto-suggests the other direction (total going up) — that would fabricate a payment that was
  // never actually collected; a legitimate "still owes more" balance is handled via the normal
  // Record Payment flow on the order page instead.
  //
  // The amount always stays live-synced to whatever the total currently is — add, remove, or
  // edit any item (or the discount) and this recalculates immediately, every time, with no way
  // to "stick" a stale value. A manual override the admin types is only ever respected until the
  // next item/discount change, at which point it resyncs — it's a last-second tweak right before
  // Save, not a standing decision to stop following the total. The reason text is the one
  // exception: once the admin writes their own, it's left alone rather than silently replaced.
  useEffect(() => {
    if (!canSuperAdminAmend || !superAdminUnlocked) return;
    const paidAmount = Number(loadedOrder?.paid_amount ?? 0);
    if (total < paidAmount - 0.004) {
      setCorrectedPaidAmount(total.toFixed(2));
      if (!reasonManuallyEdited) {
        setPaymentCorrectionReason('Order total reduced after payment — correcting recorded payment to match, refunding the difference.');
      }
    } else {
      setCorrectedPaidAmount('');
      if (!reasonManuallyEdited) {
        setPaymentCorrectionReason('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, canSuperAdminAmend, superAdminUnlocked, loadedOrder?.paid_amount, reasonManuallyEdited]);

  // ── Submit ─────────────────────────────────────────────────────────────

  const paymentAmountChanged = canSuperAdminAmend && superAdminUnlocked
    && correctedPaidAmount !== ''
    && parseFloat(correctedPaidAmount) !== Number(loadedOrder?.paid_amount ?? 0);

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
    if (duplicateMatch) {
      toast.error('This phone/email already belongs to an existing customer — use them or fix the typo before continuing.');
      return;
    }

    if (paymentAmountChanged) {
      if (isNaN(parseFloat(correctedPaidAmount)) || parseFloat(correctedPaidAmount) < 0) {
        toast.error('Enter a valid corrected payment amount');
        return;
      }
      if (!paymentCorrectionReason.trim()) {
        toast.error('Enter a reason for the payment amount correction');
        return;
      }
    }

    // Every save — creating a new order or saving edits, with or without a payment correction
    // riding along — goes through one review-and-confirm step rather than committing immediately.
    // This also means an Enter keypress in a field can never silently save on its own: at worst
    // it opens this modal, which still needs an explicit click to actually do anything.
    setShowSaveConfirm(true);
  }

  async function performSave() {
    setShowSaveConfirm(false);
    setIsSaving(true);
    try {
      if (isEditMode) {
        const payload: Record<string, unknown> = {
          ...customerInfo,
          customer_name: resolveCustomerName(),
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
            cost_price: i.cost_price,
            warranty_value: i.warranty_value,
            warranty_unit: i.warranty_unit,
            notes: i.notes || null,
            serials: i.serials && i.serials.length > 0 ? i.serials : undefined,
          }));
        }

        await adminService.updateOrder(orderId!, payload);

        if (paymentAmountChanged) {
          try {
            await adminService.correctOrderPayment(orderId!, {
              corrected_paid_amount: parseFloat(correctedPaidAmount),
              reason: paymentCorrectionReason.trim(),
            });
            toast.success('Order updated and payment amount corrected.');
          } catch (err) {
            toast.error(`Order updated, but the payment correction failed: ${getErrorMessage(err)}`);
            router.push(`/orders/${orderId}`);
            return;
          }
        } else {
          toast.success('Order updated successfully');
        }
        router.push(`/orders/${orderId}`);
        return;
      }

      const payload: Record<string, unknown> = {
        ...customerInfo,
        customer_name: resolveCustomerName(),
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
          cost_price: i.cost_price,
          warranty_value: i.warranty_value,
          warranty_unit: i.warranty_unit,
          notes: i.notes || null,
          serials: i.serials && i.serials.length > 0 ? i.serials : undefined,
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

  if (isEditMode && !canEdit && !canSuperAdminAmend) {
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
      <div className="space-y-4">
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

        {isEditMode && !canEditItemsAndPricing && !canSuperAdminAmend && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-center gap-2">
            <Lock className="w-4 h-4 flex-shrink-0" />
            Items and pricing are locked because a payment has already been recorded against this order.
            You can still update customer details, payment method, and notes.
          </div>
        )}

        {isEditMode && canSuperAdminAmend && !superAdminUnlocked && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 flex-shrink-0" />
              Items and pricing are locked because a payment has already been recorded against this order.
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSuperAdminUnlocked(true)} leftIcon={<ShieldAlert className="w-4 h-4" />}>
              Unlock amendment
            </Button>
          </div>
        )}

        {isEditMode && canSuperAdminAmend && superAdminUnlocked && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              This order has already been paid. Saving will restock/re-decrement inventory and re-post
              accounting entries for the new total. If the new total is less than what&apos;s already
              been paid, a refund will be owed to the customer.
            </span>
          </div>
        )}

        {isEditMode && canSuperAdminAmend && superAdminUnlocked && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2">
            <p className="text-sm font-medium text-indigo-900">Correct Payment Amount (optional)</p>
            <p className="text-xs text-indigo-700">
              Only fill this in if what was actually <em>recorded as paid</em> was also wrong (e.g.
              staff typed the wrong cash amount) — separate from the item/pricing change above. Leave
              the amount unchanged to skip this.
            </p>
            {correctedPaidAmount !== '' && (
              <p className="text-xs text-indigo-600 bg-indigo-100 rounded-md px-2 py-1.5">
                Auto-calculated: the current total (৳{total.toFixed(2)}) is less than what&apos;s already
                been paid, so this stays synced to match as you add, remove, or edit items — type a
                different amount below to override just before saving.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Correct amount actually received</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={correctedPaidAmount}
                  onChange={(e) => setCorrectedPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reason (required if changed)</label>
                <input
                  type="text"
                  value={paymentCorrectionReason}
                  onChange={(e) => { setPaymentCorrectionReason(e.target.value); setReasonManuallyEdited(true); }}
                  placeholder="e.g. Staff recorded the wrong cash amount"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          // Enter in a plain input/select would otherwise trigger the browser's native
          // "submit the nearest form" behavior, saving before anyone meant to — block it there
          // (a real Save still always routes through the confirm-before-save modal above).
          // Textareas are exempt so Enter still inserts a newline while typing notes.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Customer section */}
            <Card className="bg-sky-50/60 border-sky-100">
              <CardHeader className="border-sky-100">
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
                        label="Customer Name"
                        value={customerInfo.customer_name}
                        onChange={e => setCustomerInfo(p => ({ ...p, customer_name: e.target.value }))}
                        placeholder="Full name (optional)"
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
                    {/* Name and Phone double as the search box — typing either searches existing
                        customers (dropdown below); picking a result fills everything in, and
                        just leaving typed text creates a new customer on save. One place to
                        type, instead of a separate search box above these same two fields. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Customer Name"
                        value={customerInfo.customer_name}
                        onChange={e => setCustomerInfo(p => ({ ...p, customer_name: e.target.value }))}
                        placeholder="Search or type a new name..."
                      />
                      <Input
                        label="Phone"
                        value={customerInfo.customer_phone}
                        onChange={e => setCustomerInfo(p => ({ ...p, customer_phone: e.target.value }))}
                        placeholder="Search or type a new phone..."
                      />
                    </div>

                    {showCustomerDropdown && (
                      <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto w-full">
                        {customerLoading ? (
                          <p className="px-4 py-3 text-sm text-gray-400">Searching...</p>
                        ) : customerResults.length > 0 ? customerResults.map(c => (
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
                        )) : (
                          <p className="px-4 py-3 text-sm text-gray-500">No match — this will create a new customer.</p>
                        )}
                      </div>
                    )}

                    <Input
                      label="Email"
                      type="email"
                      className="mt-3"
                      value={customerInfo.customer_email}
                      onChange={e => setCustomerInfo(p => ({ ...p, customer_email: e.target.value }))}
                      placeholder="email@example.com (optional)"
                    />

                    {duplicateMatch ? (
                      <div className="mt-2.5 rounded-lg border border-red-200 bg-red-50 p-2.5">
                        <p className="text-xs text-red-700">
                          <span className="font-semibold">Duplicate</span> — this phone/email already belongs to{' '}
                          <span className="font-medium">{duplicateMatch.name}</span>.
                        </p>
                        <Button type="button" size="sm" className="mt-1.5" onClick={useDuplicateCustomer}>
                          Use {duplicateMatch.name} instead
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2">
                        {checkingDuplicate
                          ? 'Checking for an existing customer with this phone/email...'
                          : 'Both are optional — leave blank for a walk-in sale, or search above to reuse an existing customer.'}
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
            <Card className="bg-violet-50/60 border-violet-100">
              <CardHeader className="border-violet-100">
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
              <CardContent className="space-y-2.5">
                {items.length === 0 && (
                  <p className="text-center text-gray-400 py-6 text-sm">No items yet — add a product, a service, or a custom charge.</p>
                )}

                {items.map((item, idx) => {
                  const accent = item.item_type === 'product' ? 'border-l-blue-300' : item.item_type === 'service' ? 'border-l-emerald-300' : 'border-l-gray-300';
                  const margin = (item.unit_price - item.cost_price) * item.quantity;
                  const isExpanded = expandedItemId === item.id;
                  return (
                  <div key={item.id} className={`border border-gray-200 border-l-4 ${accent} rounded-lg bg-white overflow-hidden`}>
                    {/* Header strip: collapsed shows one summary line; expanded shows editable
                        name/sku + change. Only one item can be expanded at a time. Clicking
                        anywhere on the collapsed row opens it — not just the pencil icon. */}
                    <div
                      onClick={() => { if (!isExpanded) toggleExpand(item.id); }}
                      className={`flex items-center gap-2 px-3 py-2 ${isExpanded ? 'bg-gray-50 border-b border-gray-100' : 'cursor-pointer hover:bg-gray-50'}`}
                    >
                      <Badge
                        variant={item.item_type === 'product' ? 'info' : item.item_type === 'service' ? 'success' : 'default'}
                        className="capitalize text-[10px] flex-shrink-0"
                      >
                        {item.item_type === 'custom' ? 'Custom' : item.item_type}
                      </Badge>

                      {isExpanded ? (
                        <>
                          <input
                            value={item.item_name}
                            onChange={e => updateItem(item.id, 'item_name', e.target.value)}
                            placeholder="Item name"
                            required
                            autoFocus
                            disabled={!canEditItemsAndPricing}
                            className="flex-1 min-w-0 bg-transparent text-sm font-medium text-gray-900 focus:outline-none disabled:text-gray-500 placeholder:font-normal placeholder:text-gray-400"
                          />
                          <input
                            value={item.item_sku}
                            onChange={e => updateItem(item.id, 'item_sku', e.target.value)}
                            placeholder="SKU"
                            disabled={!canEditItemsAndPricing}
                            className="w-20 flex-shrink-0 bg-transparent text-xs text-gray-500 text-right focus:outline-none disabled:text-gray-400"
                          />
                          {canEditItemsAndPricing && (item.item_type === 'product' || item.item_type === 'service') && (
                            <button
                              type="button"
                              onClick={() => openChangeItem(idx, item.item_type as 'product' | 'service')}
                              title="Change item"
                              className="flex-shrink-0 text-primary-500 hover:text-primary-700"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900">
                            {item.item_name || <span className="font-normal text-gray-400">Unnamed item</span>}
                          </span>
                          {item.item_sku && (
                            <span className="hidden sm:inline text-xs text-gray-400 flex-shrink-0">{item.item_sku}</span>
                          )}
                          <span className="hidden sm:inline text-xs text-gray-500 flex-shrink-0">
                            {item.quantity} &times; {formatCurrency(item.unit_price)}
                          </span>
                          {item.item_type === 'product' && item.warranty_value ? (
                            <Badge variant="default" className="text-[10px] flex-shrink-0 hidden md:inline-flex">
                              {item.warranty_value} {item.warranty_unit}
                            </Badge>
                          ) : null}
                          <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                            {formatCurrency(item.unit_price * item.quantity)}
                          </span>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                        title={isExpanded ? 'Collapse' : canEditItemsAndPricing ? 'Edit item' : 'View item'}
                        className="flex-shrink-0 text-gray-400 hover:text-primary-600"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-3.5 h-3.5" />}
                      </button>
                      {canEditItemsAndPricing && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                          title="Remove item"
                          className="flex-shrink-0 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                    <div className="p-3 space-y-2.5">
                      {/* Pricing row: qty + price + cost + total */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                        <Input
                          label="Qty *"
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
                        <Input
                          label="Cost (৳)"
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.cost_price}
                          onChange={e => updateItem(item.id, 'cost_price', parseFloat(e.target.value) || 0)}
                          disabled={!canEditItemsAndPricing}
                        />
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Line Total</label>
                          <div className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700">
                            {formatCurrency(item.unit_price * item.quantity)}
                          </div>
                        </div>
                      </div>

                      {/* Warranty + margin — soft amber panel, product lines only */}
                      {item.item_type === 'product' && (
                        <div className="flex items-center gap-3 bg-amber-50/70 border border-amber-100 rounded-lg px-3 py-2">
                          <span className="text-xs font-medium text-amber-800 flex-shrink-0">Warranty</span>
                          <input
                            type="number"
                            min={0}
                            value={item.warranty_value ?? ''}
                            onChange={e => updateItem(item.id, 'warranty_value', e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="—"
                            disabled={!canEditItemsAndPricing}
                            className="w-14 px-2 py-1 border border-amber-200 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:bg-gray-50"
                          />
                          <select
                            value={item.warranty_unit ?? ''}
                            onChange={e => updateItem(item.id, 'warranty_unit', e.target.value || null)}
                            disabled={!canEditItemsAndPricing}
                            className="px-2 py-1 border border-amber-200 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:bg-gray-50"
                          >
                            <option value="">No warranty</option>
                            <option value="day">Day(s)</option>
                            <option value="week">Week(s)</option>
                            <option value="month">Month(s)</option>
                            <option value="year">Year(s)</option>
                          </select>
                          <span className={`ml-auto text-xs font-medium ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            Margin {formatCurrency(margin)}
                          </span>
                        </div>
                      )}

                      {/* Serial picker — soft slate panel, shown once the serial list has loaded
                          (even empty, since a new one can be typed in directly). */}
                      {item.item_type === 'product' && item.product_id && serialOptions[item.id] !== undefined && (
                        <div className="bg-slate-50/70 border border-slate-100 rounded-lg px-3 py-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1.5">Serial Number(s)</label>
                          <SerialPickerDropdown
                            options={serialOptions[item.id]}
                            selected={item.serials ?? []}
                            max={item.quantity}
                            disabled={!canEditItemsAndPricing}
                            onToggle={(sn) => toggleSerial(item.id, sn)}
                          />
                        </div>
                      )}

                      <input
                        value={item.notes}
                        onChange={e => updateItem(item.id, 'notes', e.target.value)}
                        placeholder="Notes — color, size, special instructions..."
                        disabled={!canEditItemsAndPricing}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-400 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
                    )}
                  </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Notes section */}
            <Card className="bg-rose-50/60 border-rose-100">
              <CardHeader className="border-rose-100">
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
          <div className="space-y-4">

            {/* Order summary */}
            <Card className="bg-emerald-50/60 border-emerald-100">
              <CardHeader className="border-emerald-100">
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
            <Card className="bg-indigo-50/60 border-indigo-100">
              <CardHeader className="border-indigo-100">
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
            <Card className="bg-cyan-50/60 border-cyan-100">
              <CardHeader className="border-cyan-100">
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

      {/* Every save — new order or edit, with or without a riding payment correction — gets one
          short review-and-confirm step rather than committing the instant Save is triggered. */}
      <ConfirmModal
        isOpen={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onConfirm={performSave}
        title={paymentAmountChanged ? 'Also correct the recorded payment?' : isEditMode ? 'Save these changes?' : 'Create this order?'}
        message={
          paymentAmountChanged
            ? `Saving this order change will also correct the recorded payment from ${formatCurrency(Number(loadedOrder?.paid_amount ?? 0))} to ${formatCurrency(parseFloat(correctedPaidAmount) || 0)} (reason: "${paymentCorrectionReason.trim()}"). Both changes will be saved together. Continue?`
            : `${items.length} item${items.length !== 1 ? 's' : ''} · Subtotal ${formatCurrency(subtotal)}${discount > 0 ? ` · Discount ${formatCurrency(discount)}` : ''} · Total ${formatCurrency(total)}${
                isEditMode ? '' : ` for ${selectedCustomer?.name || resolveCustomerName()}`
              }.`
        }
        confirmLabel={paymentAmountChanged ? 'Yes, save both' : isEditMode ? 'Save Changes' : 'Create Order'}
        variant="warning"
        isLoading={isSaving}
      />
    </AdminLayout>
  );
}
