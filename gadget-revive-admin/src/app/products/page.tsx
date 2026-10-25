'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Eye,
  EyeOff,
  Package,
  AlertTriangle,
  LayoutGrid,
  LayoutList,
  Star,
  Filter,
  Download,
  BarChart3,
  TrendingDown,
  Box,
  RefreshCw,
  History,
  MoreHorizontal,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Modal,
  Badge,
  LoadingSpinner,
  Pagination,
  ConfirmModal,
  ErrorState,
  HistoryModal,
} from '@/components/ui';
import { Product, ProductCategory, ProductBrand, PaginatedResponse } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

type ViewMode = 'table' | 'grid';

const ASSET_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.gadgetandrevive.com/api').replace(/\/api$/, '');

function getImageUrl(image?: string): string {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  return `${ASSET_BASE_URL}/storage/${image.replace(/^\//, '')}`;
}

type ProductTab = 'all' | 'active' | 'inactive' | 'draft' | 'bulk-upload' | 'low-stock' | 'out-of-stock';
const VALID_PRODUCT_TABS: ProductTab[] = ['all', 'active', 'inactive', 'draft', 'bulk-upload', 'low-stock', 'out-of-stock'];

// Read once, synchronously, as the very first render's initial state (via useState's lazy
// initializer) rather than in a useEffect after mount. Doing this in an effect meant the list
// always fetched once for the default "All"/page 1/no-batch filters *before* the restored
// values took effect, and that stale fetch could still resolve after the corrected one --
// whichever response landed last silently won, which is exactly why the tab pill/page number
// could look right while the rows shown were still unfiltered. A lazy initializer means there
// is only ever one initial value, so only one initial fetch.
function getInitialProductTab(): ProductTab {
  if (typeof window === 'undefined') return 'all';
  try {
    if (new URLSearchParams(window.location.search).get('source') === 'bulk_import') return 'bulk-upload';
    const stored = sessionStorage.getItem('products_list_tab');
    if (stored && VALID_PRODUCT_TABS.includes(stored as ProductTab)) return stored as ProductTab;
  } catch { /* sessionStorage unavailable -- fall through to the default */ }
  return 'all';
}

function getInitialProductPage(): number {
  if (typeof window === 'undefined') return 1;
  try {
    // A fresh "Review this batch in Products" deep-link always starts at page 1 of that batch.
    if (new URLSearchParams(window.location.search).get('source') === 'bulk_import') return 1;
    const stored = sessionStorage.getItem('products_list_page');
    if (stored && /^\d+$/.test(stored)) {
      const n = Number(stored);
      if (n > 1) return n;
    }
  } catch { /* ignore */ }
  return 1;
}

function getInitialProductBatch(): string {
  if (typeof window === 'undefined') return '';
  try {
    return new URLSearchParams(window.location.search).get('bulk_upload_batch') ?? '';
  } catch {
    return '';
  }
}

// Same lazy-initializer-from-sessionStorage pattern as tab/page/batch above, for the rest of
// the filter bar (search/category/brand/status/stock) -- previously only tab/page/batch
// survived leaving this page (e.g. opening a bulk-uploaded product to review/activate it,
// then clicking back), so every other filter silently reset to empty on return.
function getInitialProductFilter(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function ProductsPageContent() {
  const router = useRouter();

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState(() => getInitialProductFilter('products_list_search'));
  const [filterCategory, setFilterCategory] = useState(() => getInitialProductFilter('products_list_category'));
  const [filterBrand, setFilterBrand] = useState(() => getInitialProductFilter('products_list_brand'));
  const [filterStatus, setFilterStatus] = useState(() => getInitialProductFilter('products_list_status'));
  const [filterStock, setFilterStock] = useState(() => getInitialProductFilter('products_list_stock'));
  const [currentPage, setCurrentPage] = useState(getInitialProductPage);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [perPage, setPerPage] = useState(15);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showFilters, setShowFilters] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk selection (table view) — most useful right after a bulk upload, to clear out rows
  // that turned out unwanted, but works from any tab.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // True once the admin explicitly expands past "everything on this page" to every product
  // matching the current filters, across all pages — see handleSelectAllMatching().
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const selectAllCheckboxRef = React.useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ProductTab>(getInitialProductTab);
  const [togglingFeaturedId, setTogglingFeaturedId] = useState<number | null>(null);
  // Restored on first load -- either from the URL (arriving via "Review this batch in
  // Products" straight after a bulk upload) or, failing that, from sessionStorage (coming
  // back after editing a product) -- see getInitialProductTab/Page/Batch above. Narrows the
  // Bulk Upload tab down to just one spreadsheet's rows.
  const [filterBatch, setFilterBatch] = useState(getInitialProductBatch);

  // Featured products modal
  const [isFeaturedModalOpen, setIsFeaturedModalOpen] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [isFeaturedLoading, setIsFeaturedLoading] = useState(false);

  // True counts across the whole catalog, independent of whichever tab/filter is currently
  // applied to the list below — deriving these from `products` (the current page's already
  // server-filtered results) is what made every count wrong the moment you left the "All" tab.
  const [stats, setStats] = useState({
    total: 0, active: 0, inactive: 0, draft: 0, bulkUpload: 0, lowStock: 0, outOfStock: 0,
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminService.getProductStats();
      const d = res.data.data;
      setStats({
        total: d.total, active: d.active, inactive: d.inactive, draft: d.draft,
        bulkUpload: d.bulk_import ?? 0, lowStock: d.low_stock, outOfStock: d.out_of_stock,
      });
    } catch (err) {
      console.error('Error fetching product stats:', err);
    }
  }, []);

  // activeTab/currentPage/filterBatch are all seeded synchronously by their useState lazy
  // initializers above (getInitialProductTab/Page/Batch) -- no restore-on-mount effect here on
  // purpose. An effect would run *after* the first render/fetch, so the list would fetch once
  // for the default "All"/page 1/no-batch filters and then again for the restored ones; with
  // no request sequencing, whichever response resolved last silently won, which is how this
  // broke the first time around (tab pill/page number looked right, rows didn't match). A
  // lazy initializer means there's only ever one initial value, so only one initial fetch.

  // Remember the current tab/page/filters across navigation (editing a product and coming
  // back) -- every filter the bar above can set, not just tab/page, so returning to this page
  // (e.g. after opening a Bulk Upload row to activate it) shows the same narrowed-down list
  // instead of silently resetting to "everything".
  useEffect(() => {
    try {
      sessionStorage.setItem('products_list_tab', activeTab);
      sessionStorage.setItem('products_list_page', String(currentPage));
      sessionStorage.setItem('products_list_search', searchQuery);
      sessionStorage.setItem('products_list_category', filterCategory);
      sessionStorage.setItem('products_list_brand', filterBrand);
      sessionStorage.setItem('products_list_status', filterStatus);
      sessionStorage.setItem('products_list_stock', filterStock);
    } catch { /* ignore */ }
  }, [activeTab, currentPage, searchQuery, filterCategory, filterBrand, filterStatus, filterStock]);

  // Shared by the list fetch and "select all N matching" bulk-delete, so a select-all can
  // never target a different set of rows than what's actually on screen.
  const buildFilterParams = useCallback((): Record<string, string | number> => {
    const params: Record<string, string | number> = {};
    if (searchQuery) params.search = searchQuery;
    if (filterCategory) params.category_id = filterCategory;
    if (filterBrand) params.brand_id = filterBrand;
    if (filterStatus) params.is_active = filterStatus === 'active' ? 'true' : 'false';
    if (filterStock) params.stock_status = filterStock;
    if (activeTab === 'active') params.is_active = 'true';
    if (activeTab === 'inactive') params.is_active = 'false';
    if (activeTab === 'draft') params.is_draft = 'true';
    if (activeTab === 'bulk-upload') {
      params.source = 'bulk_import';
      if (filterBatch) params.bulk_upload_batch = filterBatch;
    }
    if (activeTab === 'low-stock') params.stock_status = 'low';
    if (activeTab === 'out-of-stock') params.stock_status = 'out';
    return params;
  }, [searchQuery, filterCategory, filterBrand, filterStatus, filterStock, activeTab, filterBatch]);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = {
        ...buildFilterParams(),
        page: currentPage,
        per_page: perPage,
      };

      const response = await adminService.getProducts(params);
      setProducts(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
      setTotalProducts(response.data.meta?.total || response.data.data.length);
    } catch (err) {
      console.error('Error fetching products:', err);
      toast.error(getErrorMessage(err));
      setError(true);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, perPage, buildFilterParams]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await adminService.getProductCategories();
      setCategories(response.data.data || response.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setCategories([]);
    }
  }, []);

  const fetchBrands = useCallback(async () => {
    try {
      const response = await adminService.getProductBrands({ per_page: 200 });
      setBrands(response.data.data?.data || []);
    } catch (err) {
      console.error('Error fetching brands:', err);
      setBrands([]);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, [fetchCategories, fetchBrands]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Whenever the visible row set changes (tab/page/filter/refetch), any prior selection no
  // longer necessarily matches what's on screen — clear it rather than risk deleting rows the
  // admin can no longer see.
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  }, [products]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      const allSelected = products.length > 0 && selectedIds.size === products.length;
      selectAllCheckboxRef.current.indeterminate = !selectAllMatching && selectedIds.size > 0 && !allSelected;
    }
  }, [selectedIds, products, selectAllMatching]);

  const toggleSelectAll = () => {
    setSelectAllMatching(false);
    setSelectedIds((prev) =>
      prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))
    );
  };

  const toggleSelectOne = (id: number) => {
    // Unchecking a single row while "all N matching" is active falls back to a normal,
    // page-only selection (starting from everything on this page) rather than trying to
    // express "all matching, except this one" — simpler to reason about and to delete safely.
    setSelectAllMatching(false);
    setSelectedIds((prev) => {
      const next = new Set(prev.size === 0 ? products.map((p) => p.id) : prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Expands the selection from "everything on this page" to every product matching the
  // current tab/search/filters, across all pages — reuses buildFilterParams() so it can never
  // target a different set of rows than what's actually being viewed.
  const handleSelectAllMatching = () => {
    setSelectAllMatching(true);
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const res = selectAllMatching
        ? await adminService.bulkDeleteProductsMatching(buildFilterParams())
        : await adminService.bulkDeleteProducts(Array.from(selectedIds));
      toast.success(res.data.data?.deleted ? `${res.data.data.deleted} product(s) deleted` : 'Products deleted');
      setIsBulkDeleteModalOpen(false);
      setSelectedIds(new Set());
      setSelectAllMatching(false);
      fetchProducts();
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchProducts();
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      await adminService.toggleProductStatus(product.id);
      toast.success(`Product ${product.is_active ? 'deactivated' : 'activated'}`);
      fetchProducts();
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleToggleFeatured = async (product: Product) => {
    setTogglingFeaturedId(product.id);
    // Optimistic update in the list for a snappy toggle.
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_featured: !p.is_featured } : p))
    );
    try {
      await adminService.toggleProductFeatured(product.id);
      toast.success(product.is_featured ? 'Removed from featured' : 'Marked as featured');
      if (isFeaturedModalOpen) {
        fetchFeaturedProducts();
      }
    } catch (err) {
      // Revert on failure
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_featured: product.is_featured } : p))
      );
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingFeaturedId(null);
    }
  };

  const fetchFeaturedProducts = useCallback(async () => {
    setIsFeaturedLoading(true);
    try {
      const response = await adminService.getProducts({ is_featured: 'true', per_page: 100 });
      setFeaturedProducts(response.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setFeaturedProducts([]);
    } finally {
      setIsFeaturedLoading(false);
    }
  }, []);

  const openFeaturedModal = () => {
    setIsFeaturedModalOpen(true);
    fetchFeaturedProducts();
  };

  const handleRemoveFeatured = async (product: Product) => {
    setTogglingFeaturedId(product.id);
    try {
      await adminService.toggleProductFeatured(product.id);
      toast.success('Removed from featured');
      setFeaturedProducts((prev) => prev.filter((p) => p.id !== product.id));
      // Keep the main list in sync if the product is visible there.
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_featured: false } : p))
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingFeaturedId(null);
    }
  };

  const openViewModal = (product: Product) => {
    setSelectedProduct(product);
    setIsViewModalOpen(true);
  };

  const openDeleteModal = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    setIsDeleting(true);
    try {
      await adminService.deleteProduct(selectedProduct.id);
      toast.success('Product deleted successfully');
      setIsDeleteModalOpen(false);
      fetchProducts();
      fetchStats();
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await adminService.exportReport('inventory', 'csv');
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const getStockBadge = (product: Product) => {
    if (product.stock_qty === 0) {
      return <Badge variant="danger">Out of Stock</Badge>;
    }
    if (product.stock_qty <= (product.low_stock_threshold || 5)) {
      return <Badge variant="warning">Low Stock</Badge>;
    }
    return <Badge variant="success">In Stock</Badge>;
  };

  const tabCounts = {
    all: stats.total,
    active: stats.active,
    inactive: stats.inactive,
    draft: stats.draft,
    'bulk-upload': stats.bulkUpload,
    'low-stock': stats.lowStock,
    'out-of-stock': stats.outOfStock,
  };

  if (error && products.length === 0) {
    return (
      <AdminLayout>
        <ErrorState
          title="Failed to load products"
          message="Could not fetch products data. Please try again."
          onRetry={fetchProducts}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Products</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{tabCounts.all} total</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={openFeaturedModal}>
            <Star className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            Featured Products
          </Button>
          <Link href="/products/create">
            <Button size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('all'); setCurrentPage(1); }}>
          <CardContent className="p-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Total Products</p>
                <p className="text-base font-bold tabular-nums">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('active'); setCurrentPage(1); }}>
          <CardContent className="p-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Active</p>
                <p className="text-base font-bold tabular-nums">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('low-stock'); setCurrentPage(1); }}>
          <CardContent className="p-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Low Stock</p>
                <p className="text-base font-bold tabular-nums">{stats.lowStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('out-of-stock'); setCurrentPage(1); }}>
          <CardContent className="p-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Box className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Out of Stock</p>
                <p className="text-base font-bold tabular-nums">{stats.outOfStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert Banner */}
      {stats.lowStock > 0 && activeTab === 'all' && (
        <Card className="mb-4 border-yellow-200 bg-yellow-50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Low Stock Alert</p>
                  <p className="text-sm text-yellow-700">
                    {stats.lowStock} product(s) are running low on stock. {stats.outOfStock > 0 && `${stats.outOfStock} out of stock.`}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setActiveTab('low-stock'); setCurrentPage(1); }}>
                View Items
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs + Search + Filters */}
      <Card className="mb-4">
        <CardContent className="p-0">
          {/* Tabs — colored pills with live counts */}
          <div className="flex gap-1.5 overflow-x-auto px-2.5 pt-2.5 pb-2 border-b border-gray-100">
            {(['all', 'active', 'inactive', 'draft', 'bulk-upload', 'low-stock', 'out-of-stock'] as const).map((tab) => {
              const on = activeTab === tab;
              const tone: Record<string, [string, string]> = {
                all: ['bg-slate-800 text-white border-slate-800', 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'],
                active: ['bg-emerald-600 text-white border-emerald-600', 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'],
                inactive: ['bg-slate-600 text-white border-slate-600', 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'],
                draft: ['bg-amber-500 text-white border-amber-500', 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'],
                'bulk-upload': ['bg-sky-600 text-white border-sky-600', 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'],
                'low-stock': ['bg-yellow-500 text-white border-yellow-500', 'bg-white text-yellow-700 border-yellow-200 hover:bg-yellow-50'],
                'out-of-stock': ['bg-rose-600 text-white border-rose-600', 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'],
              };
              const label = tab === 'all' ? 'All' : tab === 'low-stock' ? 'Low Stock' : tab === 'out-of-stock' ? 'Out of Stock' : tab === 'bulk-upload' ? 'Bulk Upload' : tab.charAt(0).toUpperCase() + tab.slice(1);
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setActiveTab(tab); setCurrentPage(1); if (tab !== 'bulk-upload') setFilterBatch(''); }}
                  title={
                    tab === 'draft'
                      ? 'Instant products created from Orders/Purchases that still need full details'
                      : tab === 'bulk-upload'
                      ? 'Products created via the Excel bulk-upload tool'
                      : undefined
                  }
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${on ? tone[tab][0] : tone[tab][1]}`}
                >
                  {label}
                  <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${on ? 'bg-white/25' : 'bg-gray-100 text-gray-600'}`}>{tabCounts[tab]}</span>
                </button>
              );
            })}
          </div>
          {activeTab === 'bulk-upload' && filterBatch && (
            <div className="flex items-center justify-between gap-3 px-4 py-2 bg-sky-50 border-b border-sky-100 text-sm text-sky-800">
              <span>Showing only the batch uploaded just now ({filterBatch})</span>
              <button
                type="button"
                className="font-medium underline hover:no-underline"
                onClick={() => { setFilterBatch(''); setCurrentPage(1); }}
              >
                Show all Bulk Upload products
              </button>
            </div>
          )}

          {/* Search & View Controls */}
          <div className="p-2.5">
            <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <Input
                  placeholder="Search products by name, SKU..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  Filters
                </Button>
                <div className="flex border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 ${viewMode === 'table' ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 ${viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchProducts} title="Refresh">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t">
                <Select
                  className="h-8 text-xs"
                  options={[
                    { value: '', label: 'All Categories' },
                    ...categories.map((cat) => ({
                      value: cat.id,
                      label: cat.name,
                    })),
                  ]}
                  value={filterCategory}
                  onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
                />
                <Select
                  className="h-8 text-xs"
                  options={[
                    { value: '', label: 'All Brands' },
                    ...brands.map((brand) => ({
                      value: brand.id,
                      label: brand.name,
                    })),
                  ]}
                  value={filterBrand}
                  onChange={(e) => { setFilterBrand(e.target.value); setCurrentPage(1); }}
                />
                <Select
                  className="h-8 text-xs"
                  options={[
                    { value: '', label: 'All Stock Levels' },
                    { value: 'in', label: 'In Stock' },
                    { value: 'low', label: 'Low Stock' },
                    { value: 'out', label: 'Out of Stock' },
                  ]}
                  value={filterStock}
                  onChange={(e) => { setFilterStock(e.target.value); setCurrentPage(1); }}
                />
                <Select
                  className="h-8 text-xs"
                  options={[
                    { value: '', label: 'All Status' },
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Selection Toolbar */}
      {selectedIds.size > 0 && viewMode === 'table' && (
        <Card className="mb-4 border-red-200 bg-red-50/60">
          <CardContent className="p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-red-800">
                {selectAllMatching ? `All ${totalProducts} matching selected` : `${selectedIds.size} selected`}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); setSelectAllMatching(false); }}>
                  Clear
                </Button>
                <Button variant="danger" size="sm" onClick={() => setIsBulkDeleteModalOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete {selectAllMatching ? `All ${totalProducts}` : 'Selected'}
                </Button>
              </div>
            </div>
            {/* Only offered once every row on the current page is checked and there's more
                than one page to expand into. */}
            {!selectAllMatching && selectedIds.size === products.length && totalProducts > products.length && (
              <p className="text-sm text-red-700">
                All {products.length} products on this page are selected.{' '}
                <button type="button" className="font-medium underline hover:no-underline" onClick={handleSelectAllMatching}>
                  Select all {totalProducts} products matching this view instead
                </button>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Products List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading products..." />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No products found</h3>
          <p className="text-gray-500 mb-4">
            {activeTab !== 'all' ? `No ${activeTab.replace('-', ' ')} products found.` : 'Start adding products to your catalog.'}
          </p>
          <Link href="/products/create">
            <Button>Add Product</Button>
          </Link>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {/* table-fixed + explicit column widths — without this, one long product name
                  stretches its column (and drags every other column's text onto a second line
                  with it, since the browser's default auto-layout sizes columns to content). */}
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="w-9 px-3 py-2">
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        checked={products.length > 0 && selectedIds.size === products.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                        aria-label="Select all products on this page"
                      />
                    </th>
                    <th className="w-[30%] px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                    <th className="w-[10%] px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Brand</th>
                    <th className="w-[11%] px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="w-[12%] px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                    <th className="w-[13%] px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                    <th className="w-[17%] px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    {/* Just wide enough for the trigger icon — the revealed action set is a
                        floating popover (see below), not part of the row's normal flow, so it
                        never needs dedicated column space of its own. */}
                    <th className="w-[7%] px-3 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className={`group hover:bg-gray-50/70 transition-colors ${selectedIds.has(product.id) ? 'bg-red-50/40' : ''}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleSelectOne(product.id)}
                          className="rounded border-gray-300"
                          aria-label={`Select ${product.name}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-50 rounded-xl ring-1 ring-gray-200/70 flex items-center justify-center overflow-hidden shrink-0">
                            {product.image ? (
                              <img
                                src={getImageUrl(product.image)}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.removeAttribute('style');
                                }}
                              />
                            ) : null}
                            <Package
                              className="w-5 h-5 text-gray-300"
                              style={product.image ? { display: 'none' } : undefined}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate" title={product.name}>{product.name}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className="inline-block rounded bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-500 ring-1 ring-gray-200/70 truncate max-w-full"
                                title={product.sku}
                              >
                                {product.sku}
                              </span>
                              {product.is_featured && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 shrink-0">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  Featured
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 truncate text-sm text-gray-600" title={product.brand_details?.name || product.brand_name || product.brand || undefined}>
                        {product.brand_details?.name || product.brand_name || product.brand || '-'}
                      </td>
                      <td className="px-3 py-2 truncate">
                        <Badge variant="default">{product.category?.name || '-'}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        <p className="font-semibold text-gray-900">{formatCurrency(product.discount_price || product.price)}</p>
                        {product.discount_price && product.discount_price < product.price && (
                          <p className="text-xs text-gray-400 line-through">{formatCurrency(product.price)}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {getStockBadge(product)}
                        <span className="text-xs text-gray-400 ml-1.5 tabular-nums">({product.stock_qty})</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={product.is_active ? 'success' : 'danger'}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {product.is_draft && (
                            <span title="Instant product — needs full details">
                              <Badge variant="warning">Draft</Badge>
                            </span>
                          )}
                          {product.source === 'bulk_import' && (
                            <span title="Created via Excel bulk upload">
                              <Badge variant="info">Bulk Upload</Badge>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {/* The trigger icon is all this cell ever reserves space for — no
                            dedicated column width for the action set. Hovering the ROW reveals a
                            floating popover that overlays on top of it, backdrop-blurred so it
                            stays legible over whatever it covers. `group` is set on the <tr>. */}
                        <div className="relative inline-flex">
                          <button type="button" className="p-1.5 rounded-md text-gray-300 group-hover:text-gray-500 transition-colors" aria-label="Actions">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          <div
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center divide-x divide-gray-200
                                       rounded-lg bg-white/90 backdrop-blur-md shadow-lg ring-1 ring-gray-200
                                       opacity-0 invisible scale-95 pointer-events-none origin-right
                                       group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:pointer-events-auto
                                       transition-all duration-200 ease-out"
                          >
                            {[
                                {
                                  key: 'edit',
                                  label: 'Edit',
                                  title: 'Edit',
                                  icon: <Edit2 className="w-4 h-4" />,
                                  onClick: () => router.push(`/products/${product.id}/edit`),
                                  className: 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
                                },
                                {
                                  key: 'view',
                                  label: 'View',
                                  title: 'View Details',
                                  icon: <Eye className="w-4 h-4" />,
                                  onClick: () => openViewModal(product),
                                  className: 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
                                },
                                {
                                  key: 'history',
                                  label: 'History',
                                  title: 'View History',
                                  icon: <History className="w-4 h-4" />,
                                  onClick: () => setHistoryProduct(product),
                                  className: 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
                                },
                                {
                                  key: 'feature',
                                  label: product.is_featured ? 'Unfeature' : 'Feature',
                                  title: product.is_featured ? 'Remove from Featured' : 'Mark as Featured',
                                  icon: <Star className={`w-4 h-4 ${product.is_featured ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} />,
                                  onClick: () => handleToggleFeatured(product),
                                  disabled: togglingFeaturedId === product.id,
                                  className: 'hover:bg-gray-100',
                                },
                                {
                                  key: 'toggle-status',
                                  label: product.is_active ? 'Hide' : 'Show',
                                  title: product.is_active ? 'Hide from Storefront' : 'Show on Storefront',
                                  icon: product.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
                                  onClick: () => handleToggleStatus(product),
                                  className: 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
                                },
                                // Delete is intentionally not here — it now lives inside the
                                // View Details modal instead, so removing a product always goes
                                // through a deliberate "open details, then delete" step rather
                                // than being a one-click icon in this quick-actions strip.
                              ].map((action) => (
                                <button
                                  key={action.key}
                                  type="button"
                                  onClick={action.onClick}
                                  disabled={action.disabled}
                                  title={action.title}
                                  className={`flex flex-col items-center gap-0.5 px-1.5 py-1 min-w-[40px] transition-colors disabled:opacity-50 ${action.className}`}
                                >
                                  {action.icon}
                                  <span className="text-[10px] leading-none whitespace-nowrap">{action.label}</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
              {/* Product Image Area */}
              <div className="relative h-32 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                {product.image ? (
                  <img
                    src={getImageUrl(product.image)}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <Package className="w-16 h-16 text-gray-300" />
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handleToggleFeatured(product)}
                    disabled={togglingFeaturedId === product.id}
                    title={product.is_featured ? 'Remove from featured' : 'Mark as featured'}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                  >
                    <Star className={`w-4 h-4 ${product.is_featured ? 'fill-amber-400 text-amber-400' : 'text-gray-700'}`} />
                  </button>
                  <button
                    onClick={() => handleToggleStatus(product)}
                    title={product.is_active ? 'Hide from storefront' : 'Show on storefront'}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                  >
                    {product.is_active
                      ? <Eye className="w-4 h-4 text-gray-700" />
                      : <EyeOff className="w-4 h-4 text-red-500" />}
                  </button>
                  <button
                    onClick={() => openViewModal(product)}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-gray-700" />
                  </button>
                  <button
                    onClick={() => setHistoryProduct(product)}
                    title="View History"
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                  >
                    <History className="w-4 h-4 text-gray-700" />
                  </button>
                  <Link href={`/products/${product.id}/edit`}>
                    <button className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors">
                      <Edit2 className="w-4 h-4 text-gray-700" />
                    </button>
                  </Link>
                  <button
                    onClick={() => openDeleteModal(product)}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {product.is_featured && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                      <Star className="w-3 h-3 fill-amber-400" />
                      Featured
                    </span>
                  )}
                  {product.discount_price && product.discount_price < product.price && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                      {Math.round(((product.price - product.discount_price) / product.price) * 100)}% OFF
                    </span>
                  )}
                </div>
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                  <Badge variant={product.is_active ? 'success' : 'danger'} className="text-[10px]">
                    {product.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {product.is_draft && (
                    <span title="Instant product — needs full details">
                      <Badge variant="warning" className="text-[10px]">Draft</Badge>
                    </span>
                  )}
                  {product.source === 'bulk_import' && (
                    <span title="Created via Excel bulk upload">
                      <Badge variant="info" className="text-[10px]">Bulk Upload</Badge>
                    </span>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <CardContent className="p-4">
                <div className="mb-2">
                  <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
                  <h3 className="font-semibold text-gray-900 truncate mt-0.5">{product.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{product.category?.name || 'Uncategorized'}</p>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(product.discount_price || product.price)}
                    </span>
                    {product.discount_price && product.discount_price < product.price && (
                      <span className="text-xs text-gray-400 line-through ml-1">
                        {formatCurrency(product.price)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {getStockBadge(product)}
                    <span className="text-gray-500">({product.stock_qty})</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing page {currentPage} of {totalPages} ({totalProducts} products)
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Product Details" size="lg">
        {selectedProduct && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                {selectedProduct.image ? (
                  <img
                    src={getImageUrl(selectedProduct.image)}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.removeAttribute('style');
                    }}
                  />
                ) : null}
                <Package
                  className="w-12 h-12 text-gray-400"
                  style={selectedProduct.image ? { display: 'none' } : undefined}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold">{selectedProduct.name}</h3>
                <p className="text-sm text-gray-500 font-mono mt-1">{selectedProduct.sku}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="default">{selectedProduct.category?.name || 'Uncategorized'}</Badge>
                  <Badge variant={selectedProduct.is_active ? 'success' : 'danger'}>
                    {selectedProduct.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {selectedProduct.is_featured && (
                    <Badge variant="warning" className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Featured
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Price</p>
                <p className="font-bold text-lg">{formatCurrency(selectedProduct.discount_price || selectedProduct.price)}</p>
                {selectedProduct.discount_price && selectedProduct.discount_price < selectedProduct.price && (
                  <p className="text-xs text-gray-400 line-through">{formatCurrency(selectedProduct.price)}</p>
                )}
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Stock</p>
                <p className="font-bold text-lg">{selectedProduct.stock_qty}</p>
                {getStockBadge(selectedProduct)}
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Low Stock Alert</p>
                <p className="font-bold text-lg">{selectedProduct.low_stock_threshold || 5}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Vendor</p>
                <p className="font-bold text-sm">{selectedProduct.vendor?.business_name || `Vendor #${selectedProduct.vendor_profile_id}`}</p>
              </div>
            </div>

            {selectedProduct.description && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Description</p>
                <div
                  className="rich-content text-gray-700"
                  dangerouslySetInnerHTML={{ __html: selectedProduct.description }}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => {
                  setIsViewModalOpen(false);
                  openDeleteModal(selectedProduct);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Link href={`/products/${selectedProduct.id}/edit`}>
                <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>

      {/* Featured Products Modal */}
      <Modal
        isOpen={isFeaturedModalOpen}
        onClose={() => setIsFeaturedModalOpen(false)}
        title="Featured Products"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            These products are shown in the featured section of the store. Remove any to take them off.
          </p>

          {isFeaturedLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading featured products..." />
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No featured products yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Use the star icon in the product list to feature a product.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
              {featuredProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-3 py-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                    {product.image ? (
                      <img
                        src={getImageUrl(product.image)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.removeAttribute('style');
                        }}
                      />
                    ) : null}
                    <Package
                      className="w-6 h-6 text-gray-400"
                      style={product.image ? { display: 'none' } : undefined}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
                  </div>
                  <p className="font-medium text-sm whitespace-nowrap">
                    {formatCurrency(product.discount_price || product.price)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveFeatured(product)}
                    disabled={togglingFeaturedId === product.id}
                  >
                    <Star className="w-4 h-4 mr-1 fill-amber-400 text-amber-400" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${selectedProduct?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Product"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Products"
        message={
          selectAllMatching
            ? `Are you sure you want to delete all ${totalProducts} products matching the current filters? This action cannot be undone.`
            : `Are you sure you want to delete ${selectedIds.size} product(s)? This action cannot be undone.`
        }
        confirmLabel={selectAllMatching ? `Delete All ${totalProducts}` : `Delete ${selectedIds.size} Product(s)`}
        variant="danger"
        isLoading={isBulkDeleting}
      />

      {historyProduct && (
        <HistoryModal
          isOpen={!!historyProduct}
          onClose={() => setHistoryProduct(null)}
          resourceType="Product"
          resourceId={historyProduct.id}
          resourceLabel={historyProduct.name}
          createdBy={historyProduct.creator}
          createdAt={historyProduct.created_at}
          updatedAt={historyProduct.updated_at}
        />
      )}
    </AdminLayout>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<AdminLayout><div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" text="Loading..." /></div></AdminLayout>}>
      <ProductsPageContent />
    </Suspense>
  );
}
