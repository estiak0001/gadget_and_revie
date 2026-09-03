'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Eye,
  Trash2,
  XCircle,
  CheckCircle2,
  PackageSearch,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  Button,
  Input,
  Badge,
  LoadingSpinner,
  Pagination,
  ConfirmModal,
  ErrorState,
  ActionsMenu,
} from '@/components/ui';
import { ScrapedProduct } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const ASSET_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.gadgetandrevive.com/api').replace(/\/api$/, '');

function getImageUrl(image?: string | null): string {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  return `${ASSET_BASE_URL}/storage/${image.replace(/^\//, '')}`;
}

const STATUS_TABS = ['pending', 'promoted', 'rejected'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default function ScrapedProductsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<ScrapedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const [stats, setStats] = useState({ pending: 0, promoted: 0, rejected: 0 });

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const selectAllCheckboxRef = React.useRef<HTMLInputElement>(null);
  const [isBulkRejectModalOpen, setIsBulkRejectModalOpen] = useState(false);
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);

  const [rowPendingAction, setRowPendingAction] = useState<ScrapedProduct | null>(null);
  const [rejectModalRow, setRejectModalRow] = useState<ScrapedProduct | null>(null);
  const [deleteModalRow, setDeleteModalRow] = useState<ScrapedProduct | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminService.getScrapedProductStats();
      setStats(res.data.data);
    } catch (err) {
      console.error('Error fetching scraped product stats:', err);
    }
  }, []);

  const fetchRows = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = {
        status: activeTab,
        page: currentPage,
        per_page: 20,
      };
      if (searchQuery) params.q = searchQuery;

      const res = await adminService.getScrapedProducts(params);
      setRows(res.data.data);
      setTotalPages(res.data.meta?.last_page || 1);
      setTotalRows(res.data.meta?.total || res.data.data.length);
    } catch (err) {
      console.error('Error fetching scraped products:', err);
      toast.error(getErrorMessage(err));
      setError(true);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, currentPage, searchQuery]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [rows]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      const allSelected = rows.length > 0 && selectedIds.size === rows.length;
      selectAllCheckboxRef.current.indeterminate = selectedIds.size > 0 && !allSelected;
    }
  }, [selectedIds, rows]);

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePromote = async (row: ScrapedProduct) => {
    setRowPendingAction(row);
    try {
      const res = await adminService.promoteScrapedProduct(row.id);
      toast.success(`Created as a new (Inactive) product — #${res.data.data.promoted_product_id}`);
      fetchRows();
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRowPendingAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModalRow) return;
    setRowPendingAction(rejectModalRow);
    try {
      await adminService.rejectScrapedProduct(rejectModalRow.id);
      toast.success('Rejected');
      setRejectModalRow(null);
      fetchRows();
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRowPendingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteModalRow) return;
    setRowPendingAction(deleteModalRow);
    try {
      await adminService.deleteScrapedProduct(deleteModalRow.id);
      toast.success('Deleted');
      setDeleteModalRow(null);
      fetchRows();
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRowPendingAction(null);
    }
  };

  const handleBulkReject = async () => {
    setIsBulkRejecting(true);
    try {
      const res = await adminService.bulkRejectScrapedProducts(Array.from(selectedIds));
      toast.success(`${res.data.data.rejected} rejected` + (res.data.data.skipped ? `, ${res.data.data.skipped} skipped` : ''));
      setIsBulkRejectModalOpen(false);
      setSelectedIds(new Set());
      fetchRows();
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsBulkRejecting(false);
    }
  };

  const tabCounts: Record<StatusTab, number> = stats;

  if (error && rows.length === 0) {
    return (
      <AdminLayout>
        <ErrorState title="Failed to load scraped products" message="Could not fetch the staging list. Please try again." onRetry={fetchRows} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Scraped Products</h1>
          <p className="page-description">
            Staged products submitted by a scraping script, waiting for review before they become real (Inactive) products.
          </p>
        </div>
        <Link href="/products/bulk-import">
          <Button variant="outline">Bulk Import from Excel instead</Button>
        </Link>
      </div>

      {/* Tabs + Search */}
      <Card className="mb-4">
        <CardContent className="p-0">
          <div className="flex border-b overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tabCounts[tab]}</span>
              </button>
            ))}
          </div>
          <div className="p-4">
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search by name, SKU, raw category/brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (setCurrentPage(1), fetchRows())}
                  className="pl-10"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={fetchRows} title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk toolbar — reject only applies to pending rows, so it's only offered on that tab. */}
      {selectedIds.size > 0 && activeTab === 'pending' && (
        <Card className="mb-4 border-red-200 bg-red-50/60">
          <CardContent className="p-3 flex items-center justify-between">
            <p className="text-sm font-medium text-red-800">{selectedIds.size} selected</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
              <Button variant="danger" size="sm" onClick={() => setIsBulkRejectModalOpen(true)}>
                <XCircle className="w-4 h-4 mr-1.5" />
                Reject Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <PackageSearch className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Nothing here</h3>
          <p className="text-gray-500">
            {activeTab === 'pending'
              ? 'Nothing staged yet — run the scraping script pointed at this admin\'s ingest endpoint to send products here.'
              : `No ${activeTab} rows.`}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    {activeTab === 'pending' && (
                      <th className="w-10 px-4 py-2">
                        <input
                          ref={selectAllCheckboxRef}
                          type="checkbox"
                          checked={rows.length > 0 && selectedIds.size === rows.length}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                          aria-label="Select all rows on this page"
                        />
                      </th>
                    )}
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map((row) => (
                    <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(row.id) ? 'bg-red-50/40' : ''}`}>
                      {activeTab === 'pending' && (
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelectOne(row.id)}
                            className="rounded border-gray-300"
                            aria-label={`Select ${row.name}`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                            {row.image ? (
                              <img src={getImageUrl(row.image)} alt={row.name} className="w-full h-full object-cover" />
                            ) : (
                              <PackageSearch className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-xs">{row.name}</p>
                            {row.batch && <p className="text-xs text-gray-400 truncate max-w-xs">Batch: {row.batch}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.category ? (
                          <Badge variant="default">{row.category.name}</Badge>
                        ) : (
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                            Unmapped: {row.category_raw || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{row.brand?.name || row.brand_raw || '-'}</td>
                      <td className="px-4 py-2.5">
                        {row.price != null ? (
                          <div>
                            <p className="font-medium">{formatCurrency(row.discount_price || row.price)}</p>
                            {row.discount_price != null && row.discount_price < row.price && (
                              <p className="text-xs text-gray-400 line-through">{formatCurrency(row.price)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{row.stock_status_raw || '-'}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="info">{row.source_site}</Badge>
                        {row.status === 'rejected' && row.reject_reason && (
                          <p className="text-xs text-gray-400 mt-1 max-w-[10rem] truncate" title={row.reject_reason}>{row.reject_reason}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {row.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => handlePromote(row)}
                              isLoading={rowPendingAction?.id === row.id}
                              disabled={!row.can_promote}
                              title={!row.can_promote ? 'Needs a mapped category and a price greater than 0' : undefined}
                            >
                              <ArrowRight className="w-4 h-4 mr-1" />
                              Promote
                            </Button>
                          )}
                          {row.status === 'promoted' && row.promoted_product_id && (
                            <Link href={`/products/${row.promoted_product_id}/edit`}>
                              <Button size="sm" variant="outline">
                                <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                                View Product
                              </Button>
                            </Link>
                          )}
                          <ActionsMenu
                            items={[
                              {
                                label: 'Review & Edit',
                                icon: <Eye className="w-4 h-4 text-gray-400" />,
                                onClick: () => router.push(`/scraped-products/${row.id}`),
                              },
                              ...(row.status === 'pending' ? [{
                                label: 'Reject',
                                icon: <XCircle className="w-4 h-4" />,
                                onClick: () => setRejectModalRow(row),
                                variant: 'danger' as const,
                              }] : []),
                              ...(row.status !== 'promoted' ? [{
                                label: 'Delete',
                                icon: <Trash2 className="w-4 h-4" />,
                                onClick: () => setDeleteModalRow(row),
                                variant: 'danger' as const,
                              }] : []),
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
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">Showing page {currentPage} of {totalPages} ({totalRows} rows)</div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      <ConfirmModal
        isOpen={!!rejectModalRow}
        onClose={() => setRejectModalRow(null)}
        onConfirm={handleReject}
        title="Reject Scraped Product"
        message={`Reject "${rejectModalRow?.name}"? It stays here for reference but won't be promotable.`}
        confirmLabel="Reject"
        variant="danger"
        isLoading={rowPendingAction?.id === rejectModalRow?.id}
      />

      <ConfirmModal
        isOpen={!!deleteModalRow}
        onClose={() => setDeleteModalRow(null)}
        onConfirm={handleDelete}
        title="Delete Scraped Product"
        message={`Permanently delete "${deleteModalRow?.name}" from the staging list? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={rowPendingAction?.id === deleteModalRow?.id}
      />

      <ConfirmModal
        isOpen={isBulkRejectModalOpen}
        onClose={() => setIsBulkRejectModalOpen(false)}
        onConfirm={handleBulkReject}
        title="Reject Selected"
        message={`Reject ${selectedIds.size} selected row(s)?`}
        confirmLabel={`Reject ${selectedIds.size}`}
        variant="danger"
        isLoading={isBulkRejecting}
      />
    </AdminLayout>
  );
}
