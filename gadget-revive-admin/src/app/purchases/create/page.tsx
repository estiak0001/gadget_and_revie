'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Search, Package, FileText, Save, Sparkles } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, SearchableSelect, LoadingSpinner,
} from '@/components/ui';
import { Product, ProductCategory, Supplier } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseLineItem {
  id: string;
  product_id?: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_cost: number;
  /** The supplier's warranty on this specific batch — independent of the product's own warranty. */
  warranty_value?: number | null;
  warranty_unit?: string | null;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

// Flattens a parent -> children -> grandchildren category tree into a depth-indented,
// search-friendly option list (top-level categories first, each immediately followed by
// its own children, rather than one flat alphabetical/sort_order list with no hierarchy).
function flattenCategoryTree(categories: ProductCategory[], depth = 0): { value: string; label: string }[] {
  // Regular spaces collapse in rendered HTML — NBSPs repeated per depth actually show as indent.
  const indent = '    '.repeat(depth);
  return categories.flatMap((cat) => [
    { value: String(cat.id), label: `${indent}${depth > 0 ? '↳ ' : ''}${cat.name}` },
    ...(cat.children?.length ? flattenCategoryTree(cat.children, depth + 1) : []),
  ]);
}

function newLineItem(): PurchaseLineItem {
  return {
    id: generateId(), product_name: '', product_sku: '', quantity: 1, unit_cost: 0,
    warranty_value: null, warranty_unit: null,
  };
}

// ─── Product search modal ───────────────────────────────────────────────────

interface ProductSearchModalProps {
  onSelect: (product: Product) => void;
  onClose: () => void;
}

const EMPTY_QUICK_PRODUCT = { name: '', category_id: '', price: '', sku: '', stock_qty: '0' };

function ProductSearchModal({ onSelect, onClose }: ProductSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Instant/draft product creation — for suppliers bringing in items not yet in the catalog.
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [quickProduct, setQuickProduct] = useState(EMPTY_QUICK_PRODUCT);
  const [isCreating, setIsCreating] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await adminService.getProducts({ search: q, per_page: 20 });
      const data = (res.data as { data?: unknown })?.data ?? res.data;
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { search(''); }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 350);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    // Admin endpoint, not the public storefront tree — an instant product needs to be filed
    // under any existing category, including ones currently hidden from the storefront.
    adminService.getAdminProductCategories({ parent_only: true }).then((res) => {
      const data = (res.data as { data?: unknown })?.data ?? res.data;
      setCategories(Array.isArray(data) ? data as ProductCategory[] : []);
    }).catch(() => setCategories([]));
  }, []);

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
        // The whole point of quick-creating here is the real stock isn't confirmed yet (often
        // literally 0) — leaving this at the create-product default of true would make it
        // permanently invisible to out-of-stock detection regardless of actual stock_qty.
        always_in_stock: false,
      });
      const created = res.data?.data as Product;
      toast.success(`"${created.name}" created as a draft product and added to the purchase order.`);
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
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">
            {mode === 'create' ? 'Create Instant Product' : 'Search Products'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {mode === 'search' ? (
          <>
            <div className="p-4 border-b space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                type="button"
                onClick={openCreateMode}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <Sparkles className="w-4 h-4" />
                Can&apos;t find it? Create an instant product
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-2">
              {loading && (
                <div className="flex justify-center py-8"><LoadingSpinner size="sm" /></div>
              )}
              {!loading && results.length === 0 && (
                <p className="text-center text-gray-500 py-8 text-sm">No results found</p>
              )}
              {!loading && results.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {results.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => onSelect(product)}
                      className="text-left rounded-lg border border-gray-200 px-4 py-3 hover:border-primary-300 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
                          <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                          <p className="text-xs text-gray-500">Stock: {product.stock_qty}</p>
                        </div>
                        <span className="text-sm font-semibold text-primary-600 whitespace-nowrap">
                          {formatCurrency(product.discount_price ?? product.price)}
                        </span>
                      </div>
                    </button>
                  ))}
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
                Create &amp; Add to Purchase Order
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function CreatePurchaseOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string | number>('');

  const [items, setItems] = useState<PurchaseLineItem[]>([]);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const [expectedDate, setExpectedDate] = useState('');
  const [tax, setTax] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [notes, setNotes] = useState('');

  // Set when arriving via "Create Purchase Order" from an order that needs stock sourced —
  // links the two so the order shows "Awaiting stock via PO #X" once this is saved.
  const [linkedOrderId, setLinkedOrderId] = useState<number | null>(null);

  useEffect(() => {
    adminService.getSuppliers({ per_page: 1000, is_active: 'true' })
      .then((res) => {
        const payload = res.data?.data as unknown;
        const list = Array.isArray(payload) ? payload : (payload as { data?: Supplier[] })?.data;
        setSuppliers(Array.isArray(list) ? (list as Supplier[]) : []);
      })
      .catch(() => setSuppliers([]));
  }, []);

  // Pre-fill from an order's "Create Purchase Order" action — either a single line
  // (?order_id=&product_id=&quantity=, from the per-item truck icon) or several at once
  // (?order_id=&items=[{"product_id":..,"quantity":..}, ...], from the order-level bulk action).
  useEffect(() => {
    const orderIdParam = searchParams.get('order_id');
    const productIdParam = searchParams.get('product_id');
    const quantityParam = searchParams.get('quantity');
    const itemsParam = searchParams.get('items');
    if (orderIdParam) setLinkedOrderId(Number(orderIdParam));

    const toFetch: { productId: number; quantity: number }[] = [];
    if (itemsParam) {
      try {
        const parsed = JSON.parse(itemsParam) as { product_id: number; quantity: number }[];
        parsed.forEach((p) => {
          if (p.product_id) toFetch.push({ productId: p.product_id, quantity: Math.max(1, p.quantity || 1) });
        });
      } catch {
        // Malformed param — ignore rather than crash the page.
      }
    } else if (productIdParam) {
      toFetch.push({ productId: Number(productIdParam), quantity: quantityParam ? Math.max(1, parseInt(quantityParam)) : 1 });
    }
    if (toFetch.length === 0) return;

    Promise.all(toFetch.map(({ productId }) => adminService.getProduct(productId).then((res) => res.data?.data).catch(() => null)))
      .then((products) => {
        setItems((prev) => {
          const next = [...prev];
          products.forEach((product, idx) => {
            if (!product) return;
            if (next.some((i) => i.product_id === product.id)) return;
            next.push({
              ...newLineItem(),
              product_id: product.id,
              product_name: product.name,
              product_sku: product.sku,
              unit_cost: product.current_cost ?? product.discount_price ?? product.price,
              quantity: toFetch[idx].quantity,
            });
          });
          return next;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addProduct(product: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) => (i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          ...newLineItem(),
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          unit_cost: product.discount_price ?? product.price,
        },
      ];
    });
    setSearchModalOpen(false);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: 'quantity' | 'unit_cost' | 'warranty_value' | 'warranty_unit', value: number | string | null) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  const taxNum = parseFloat(tax || '0') || 0;
  const shippingNum = parseFloat(shippingCost || '0') || 0;
  const total = subtotal + taxNum + shippingNum;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    if (items.length === 0) {
      toast.error('Add at least one product to the purchase order');
      return;
    }
    if (items.some((i) => !i.product_id || i.quantity < 1)) {
      toast.error('Each line item needs a product and a quantity of at least 1');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        supplier_id: Number(supplierId),
        order_id: linkedOrderId,
        expected_date: expectedDate || null,
        notes: notes.trim() || null,
        tax: taxNum || null,
        shipping_cost: shippingNum || null,
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
          warranty_value: i.warranty_value || null,
          warranty_unit: i.warranty_unit || null,
        })),
      };

      const res = await adminService.createPurchase(payload);
      const po = res.data?.data;
      toast.success('Purchase order created successfully');
      if (po?.id) {
        router.push(`/purchases/${po.id}`);
      } else {
        router.push('/purchases');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Purchase Order</h1>
            <p className="text-sm text-gray-500 mt-0.5">Record a new stock procurement order from a supplier</p>
          </div>
        </div>

        {linkedOrderId && (
          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <Package className="w-4 h-4 flex-shrink-0" />
            Sourcing stock for Order #{linkedOrderId} — this PO will link back to it once saved.
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Supplier</CardTitle>
              </CardHeader>
              <CardContent>
                <SearchableSelect
                  label="Supplier *"
                  required
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder="Select a supplier..."
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="w-4 h-4" /> Order Items
                  </CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSearchModalOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-center text-gray-400 py-6 text-sm">No items yet. Add a product to begin.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left">
                          <th className="pb-2 pr-4 font-semibold text-gray-600">Product</th>
                          <th className="pb-2 pr-4 font-semibold text-gray-600 w-28">Qty</th>
                          <th className="pb-2 pr-4 font-semibold text-gray-600 w-36">Unit Cost (৳)</th>
                          <th className="pb-2 pr-4 font-semibold text-gray-600 w-40">Warranty</th>
                          <th className="pb-2 pr-4 font-semibold text-gray-600 text-right">Line Total</th>
                          <th className="pb-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 pr-4">
                              <p className="font-medium text-gray-900">{item.product_name}</p>
                              <p className="text-xs text-gray-500">{item.product_sku}</p>
                            </td>
                            <td className="py-2 pr-4">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </td>
                            <td className="py-2 pr-4">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.unit_cost}
                                onChange={(e) => updateItem(item.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                                className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.warranty_value ?? ''}
                                  onChange={(e) => updateItem(item.id, 'warranty_value', e.target.value ? parseInt(e.target.value) : null)}
                                  placeholder="—"
                                  className="w-14 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <select
                                  value={item.warranty_unit ?? ''}
                                  onChange={(e) => updateItem(item.id, 'warranty_unit', e.target.value || null)}
                                  className="flex-1 px-1.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="">Unit</option>
                                  <option value="day">Day(s)</option>
                                  <option value="week">Week(s)</option>
                                  <option value="month">Month(s)</option>
                                  <option value="year">Year(s)</option>
                                </select>
                              </div>
                            </td>
                            <td className="py-2 pr-4 text-right font-medium">
                              {formatCurrency(item.quantity * item.unit_cost)}
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional notes about this purchase order"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </CardContent>
            </Card>
          </div>

          {/* ── Right column (sidebar) ── */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  label="Expected Date"
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />

                <div className="flex justify-between text-sm pt-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tax (৳)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Shipping (৳)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-lg text-primary-600">{formatCurrency(total)}</span>
                </div>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" isLoading={isSaving}>
              <Save className="w-4 h-4 mr-2" /> Create Purchase Order
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

      {searchModalOpen && (
        <ProductSearchModal onSelect={addProduct} onClose={() => setSearchModalOpen(false)} />
      )}
    </AdminLayout>
  );
}

export default function CreatePurchaseOrderPage() {
  return (
    <Suspense fallback={<AdminLayout><div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" text="Loading..." /></div></AdminLayout>}>
      <CreatePurchaseOrderContent />
    </Suspense>
  );
}
