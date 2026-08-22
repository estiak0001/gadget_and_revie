'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
  ActionsMenu,
} from '@/components/ui';
import { Product, ProductCategory, PaginatedResponse } from '@/types';
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

export default function ProductsPage() {
  const router = useRouter();

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStock, setFilterStock] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
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
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive' | 'draft' | 'low-stock' | 'out-of-stock'>('all');
  const [togglingFeaturedId, setTogglingFeaturedId] = useState<number | null>(null);

  // Featured products modal
  const [isFeaturedModalOpen, setIsFeaturedModalOpen] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [isFeaturedLoading, setIsFeaturedLoading] = useState(false);

  // True counts across the whole catalog, independent of whichever tab/filter is currently
  // applied to the list below — deriving these from `products` (the current page's already
  // server-filtered results) is what made every count wrong the moment you left the "All" tab.
  const [stats, setStats] = useState({
    total: 0, active: 0, inactive: 0, draft: 0, lowStock: 0, outOfStock: 0,
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminService.getProductStats();
      const d = res.data.data;
      setStats({
        total: d.total, active: d.active, inactive: d.inactive,
        draft: d.draft, lowStock: d.low_stock, outOfStock: d.out_of_stock,
      });
    } catch (err) {
      console.error('Error fetching product stats:', err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        per_page: perPage,
      };
      if (searchQuery) params.search = searchQuery;
      if (filterCategory) params.category_id = filterCategory;
      if (filterStatus) params.is_active = filterStatus === 'active' ? 'true' : 'false';
      if (filterStock) params.stock_status = filterStock;
      if (activeTab === 'active') params.is_active = 'true';
      if (activeTab === 'inactive') params.is_active = 'false';
      if (activeTab === 'draft') params.is_draft = 'true';
      if (activeTab === 'low-stock') params.stock_status = 'low';
      if (activeTab === 'out-of-stock') params.stock_status = 'out';

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
  }, [currentPage, perPage, searchQuery, filterCategory, filterStatus, filterStock, activeTab]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await adminService.getProductCategories();
      setCategories(response.data.data || response.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-description">Manage products and inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={openFeaturedModal}>
            <Star className="w-4 h-4 mr-2 text-amber-500" />
            Featured Products
          </Button>
          <Link href="/products/create">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('all'); setCurrentPage(1); }}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Products</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('active'); setCurrentPage(1); }}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Active</p>
                <p className="text-lg font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('low-stock'); setCurrentPage(1); }}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Low Stock</p>
                <p className="text-lg font-bold">{stats.lowStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveTab('out-of-stock'); setCurrentPage(1); }}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Box className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Out of Stock</p>
                <p className="text-lg font-bold">{stats.outOfStock}</p>
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
          {/* Tabs */}
          <div className="flex border-b overflow-x-auto">
            {(['all', 'active', 'inactive', 'draft', 'low-stock', 'out-of-stock'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                title={tab === 'draft' ? 'Instant products created from Orders/Purchases that still need full details' : undefined}
              >
                {tab === 'all' ? 'All' : tab === 'low-stock' ? 'Low Stock' : tab === 'out-of-stock' ? 'Out of Stock' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {tabCounts[tab]}
                </span>
              </button>
            ))}
          </div>

          {/* Search & View Controls */}
          <div className="p-4">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search products by name, SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="w-4 h-4 mr-1" />
                  Filters
                </Button>
                <div className="flex border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-2 ${viewMode === 'table' ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 ${viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchProducts} title="Refresh">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t">
                <Select
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
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
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
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{product.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {product.is_featured && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  Featured
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm text-gray-600">{product.sku}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="default">{product.category?.name || '-'}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-medium">{formatCurrency(product.discount_price || product.price)}</p>
                          {product.discount_price && product.discount_price < product.price && (
                            <p className="text-xs text-gray-400 line-through">{formatCurrency(product.price)}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {getStockBadge(product)}
                        <span className="text-sm text-gray-600 ml-2">({product.stock_qty})</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={product.is_active ? 'success' : 'danger'}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {product.is_draft && (
                            <span title="Instant product — needs full details">
                              <Badge variant="warning">Draft</Badge>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end">
                          <ActionsMenu
                            items={[
                              {
                                label: 'View Details',
                                icon: <Eye className="w-4 h-4 text-gray-400" />,
                                onClick: () => openViewModal(product),
                              },
                              {
                                label: 'Edit',
                                icon: <Edit2 className="w-4 h-4 text-gray-400" />,
                                onClick: () => router.push(`/products/${product.id}/edit`),
                              },
                              {
                                label: 'View History',
                                icon: <History className="w-4 h-4 text-gray-400" />,
                                onClick: () => setHistoryProduct(product),
                              },
                              {
                                label: product.is_featured ? 'Remove from Featured' : 'Mark as Featured',
                                icon: <Star className={`w-4 h-4 ${product.is_featured ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} />,
                                onClick: () => handleToggleFeatured(product),
                                disabled: togglingFeaturedId === product.id,
                              },
                              {
                                label: product.is_active ? 'Hide from Storefront' : 'Show on Storefront',
                                icon: product.is_active
                                  ? <EyeOff className="w-4 h-4 text-gray-400" />
                                  : <Eye className="w-4 h-4 text-gray-400" />,
                                onClick: () => handleToggleStatus(product),
                              },
                              {
                                label: 'Delete',
                                icon: <Trash2 className="w-4 h-4" />,
                                onClick: () => openDeleteModal(product),
                                variant: 'danger',
                              },
                            ]}
                          />
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
