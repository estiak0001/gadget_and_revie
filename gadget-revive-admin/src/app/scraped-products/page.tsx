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
  Filter,
  Play,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  Button,
  Input,
  SearchableSelect,
  Badge,
  LoadingSpinner,
  Pagination,
  ConfirmModal,
  ErrorState,
  ActionsMenu,
} from '@/components/ui';
import { ScrapedProduct, ProductCategory, ProductBrand, ScrapeRun } from '@/types';
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

// What ingest() did the last time a (re-)scrape touched this row -- lets a re-scraped row read
// as "Updated"/"Synced" at a glance instead of looking identical to a brand-new one. Undefined
// for a row from before this was tracked, or one a human created by hand on the review page.
const INGEST_ACTION_BADGES: Record<string, { label: string; variant: 'default' | 'info' | 'warning' | 'success' }> = {
  created: { label: 'New', variant: 'default' },
  updated: { label: 'Updated', variant: 'info' },
  reactivated: { label: 'Reactivated', variant: 'warning' },
  synced_to_product: { label: 'Synced', variant: 'success' },
};

export default function ScrapedProductsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<ScrapedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<ProductBrand[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const [stats, setStats] = useState({ pending: 0, promoted: 0, rejected: 0 });

  // Bulk selection — "select all N matching" (see handleSelectAllMatching) works the same way
  // as the Products list: expand from "everything on this page" to every row matching the
  // current tab/search/category/brand filters, across all pages.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const selectAllCheckboxRef = React.useRef<HTMLInputElement>(null);
  const [isBulkRejectModalOpen, setIsBulkRejectModalOpen] = useState(false);
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);
  const [isBulkPromoteModalOpen, setIsBulkPromoteModalOpen] = useState(false);
  const [isBulkPromoting, setIsBulkPromoting] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [rowPendingAction, setRowPendingAction] = useState<ScrapedProduct | null>(null);
  const [rejectModalRow, setRejectModalRow] = useState<ScrapedProduct | null>(null);
  const [deleteModalRow, setDeleteModalRow] = useState<ScrapedProduct | null>(null);

  // "Run Scraper" trigger — only actually succeeds where this API process itself has an IP
  // Star Tech hasn't Cloudflare-blocked (i.e. run this locally, not against production — see
  // the hint rendered in the card below). activeRun is polled every 3s until its status moves
  // off 'running'; recentRuns is just the last few for visibility across page reloads.
  const [showRunPanel, setShowRunPanel] = useState(false);
  const [runCategoryUrl, setRunCategoryUrl] = useState('');
  const [runCategoryName, setRunCategoryName] = useState('');
  const [runTemplateCategory, setRunTemplateCategory] = useState('');
  const [runBrandFilter, setRunBrandFilter] = useState('');
  const [runProductLimit, setRunProductLimit] = useState('');
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [activeRun, setActiveRun] = useState<ScrapeRun | null>(null);
  const [recentRuns, setRecentRuns] = useState<ScrapeRun[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminService.getScrapedProductStats();
      setStats(res.data.data);
    } catch (err) {
      console.error('Error fetching scraped product stats:', err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminService.getProductCategories();
      setCategories((res.data as { data?: ProductCategory[] }).data || (res.data as unknown as ProductCategory[]) || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  const fetchBrands = useCallback(async () => {
    try {
      const res = await adminService.getProductBrands({ per_page: 200 });
      setBrands(res.data.data?.data || []);
    } catch (err) {
      console.error('Error fetching brands:', err);
    }
  }, []);

  // Shared by the list fetch and "select all matching" bulk-promote, so a select-all can never
  // target a different set of rows than what's actually on screen.
  const buildFilterParams = useCallback((): Record<string, string | number> => {
    const params: Record<string, string | number> = { status: activeTab };
    if (searchQuery) params.q = searchQuery;
    if (filterCategory) params.category_id = filterCategory;
    if (filterBrand) params.brand_id = filterBrand;
    return params;
  }, [activeTab, searchQuery, filterCategory, filterBrand]);

  const fetchRows = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = {
        ...buildFilterParams(),
        page: currentPage,
        per_page: 20,
      };

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
  }, [currentPage, buildFilterParams]);

  const fetchRecentRuns = useCallback(async () => {
    try {
      const res = await adminService.getScrapeRuns();
      setRecentRuns(res.data.data.slice(0, 5));
    } catch (err) {
      console.error('Error fetching scrape runs:', err);
    }
  }, []);

  const startRun = async () => {
    if (!runCategoryUrl.trim() || !runCategoryName.trim() || !runTemplateCategory) {
      toast.error('Category URL, category name, and a mapped category are all required.');
      return;
    }
    setIsStartingRun(true);
    try {
      const res = await adminService.runScrape({
        category_url: runCategoryUrl.trim(),
        category_name: runCategoryName.trim(),
        template_category: runTemplateCategory,
        brand_filter: runBrandFilter.trim() || undefined,
        product_limit: runProductLimit ? Number(runProductLimit) : undefined,
      });
      setActiveRun(res.data.data);
      toast.success('Scrape started — this only works when running locally (see the note above).');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsStartingRun(false);
    }
  };

  // Polls the one active run every 3s until it's no longer 'running', then refreshes everything
  // a completed/failed run could have changed (the staged list, stats, and the history panel).
  useEffect(() => {
    if (!activeRun || activeRun.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const res = await adminService.getScrapeRun(activeRun.id);
        const updated = res.data.data;
        setActiveRun(updated);
        if (updated.status !== 'running') {
          clearInterval(interval);
          fetchRecentRuns();
          fetchRows();
          fetchStats();
          if (updated.status === 'completed') {
            toast.success(
              `Scrape finished — ${updated.created_count ?? 0} created, ${updated.updated_count ?? 0} updated, ` +
                `${updated.synced_count ?? 0} synced, ${updated.skipped_count ?? 0} skipped, ${updated.failed_count ?? 0} failed.`
            );
          } else {
            toast.error(`Scrape failed${updated.error_message ? `: ${updated.error_message}` : ''}`);
          }
        }
      } catch (err) {
        console.error('Error polling scrape run:', err);
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.id, activeRun?.status]);

  useEffect(() => { fetchRecentRuns(); }, [fetchRecentRuns]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchCategories(); fetchBrands(); }, [fetchCategories, fetchBrands]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  }, [rows]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      const allSelected = rows.length > 0 && selectedIds.size === rows.length;
      selectAllCheckboxRef.current.indeterminate = !selectAllMatching && selectedIds.size > 0 && !allSelected;
    }
  }, [selectedIds, rows, selectAllMatching]);

  const toggleSelectAll = () => {
    setSelectAllMatching(false);
    setSelectedIds((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      // If "select all matching" was active, materialize it as "everything on this page"
      // before toggling off the specific row just unchecked — simpler to reason about than
      // trying to express "all matching, except this one." Otherwise (the common case) this
      // is a plain add/remove against whatever's already checked.
      const next = new Set(selectAllMatching ? rows.map((r) => r.id) : prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectAllMatching(false);
  };

  const handleSelectAllMatching = () => setSelectAllMatching(true);

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
      const res = selectAllMatching
        ? await adminService.bulkRejectScrapedProductsMatching(buildFilterParams())
        : await adminService.bulkRejectScrapedProducts(Array.from(selectedIds));
      toast.success(`${res.data.data.rejected} rejected` + (res.data.data.skipped ? `, ${res.data.data.skipped} skipped` : ''));
      setIsBulkRejectModalOpen(false);
      setSelectedIds(new Set());
      setSelectAllMatching(false);
      fetchRows();
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsBulkRejecting(false);
    }
  };

  const handleBulkPromote = async () => {
    setIsBulkPromoting(true);
    try {
      const res = selectAllMatching
        ? await adminService.bulkPromoteScrapedProductsMatching(buildFilterParams())
        : await adminService.bulkPromoteScrapedProducts(Array.from(selectedIds));
      const { promoted, skipped, errors } = res.data.data;
      toast.success(`${promoted} promoted` + (skipped ? `, ${skipped} skipped` : ''));
      if (errors?.length) {
        toast.error(
          `Skipped (needs review): ${errors.slice(0, 3).map((e) => `"${e.name}" — ${e.reason}`).join('; ')}` +
            (errors.length > 3 ? `, +${errors.length - 3} more` : ''),
          { duration: 8000 }
        );
      }
      setIsBulkPromoteModalOpen(false);
      setSelectedIds(new Set());
      setSelectAllMatching(false);
      fetchRows();
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsBulkPromoting(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const res = selectAllMatching
        ? await adminService.bulkDeleteScrapedProductsMatching(buildFilterParams())
        : await adminService.bulkDeleteScrapedProducts(Array.from(selectedIds));
      toast.success(`${res.data.data.deleted} deleted` + (res.data.data.skipped ? `, ${res.data.data.skipped} skipped` : ''));
      setIsBulkDeleteModalOpen(false);
      setSelectedIds(new Set());
      setSelectAllMatching(false);
      fetchRows();
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsBulkDeleting(false);
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowRunPanel(!showRunPanel)}>
            <Play className="w-4 h-4 mr-1.5" />
            Run Scraper
            {showRunPanel ? <ChevronUp className="w-4 h-4 ml-1.5" /> : <ChevronDown className="w-4 h-4 ml-1.5" />}
          </Button>
          <Link href="/products/bulk-import">
            <Button variant="outline">Bulk Import from Excel instead</Button>
          </Link>
        </div>
      </div>

      {/* Run Scraper — triggers scraper/run_scrape.py, which regenerates and runs the notebook's
          own code fresh (never a hand-duplicated copy of the scraping logic). Only succeeds where
          this API process itself has an IP Star Tech hasn't Cloudflare-blocked. */}
      {showRunPanel && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Only works when this admin and its API are running on a machine Star Tech hasn&apos;t
              Cloudflare-blocked — in practice, run this locally, not against the live production site.
            </p>

            {activeRun && (
              <div
                className={`flex items-center gap-2 text-sm rounded px-3 py-2 ${
                  activeRun.status === 'running'
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : activeRun.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {activeRun.status === 'running' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                {activeRun.status === 'completed' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {activeRun.status === 'failed' && <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>
                  {activeRun.status === 'running' && `Running — scraping "${activeRun.category_name}"...`}
                  {activeRun.status === 'completed' &&
                    `Done — ${activeRun.created_count ?? 0} created, ${activeRun.updated_count ?? 0} updated, ` +
                      `${activeRun.synced_count ?? 0} synced, ${activeRun.skipped_count ?? 0} skipped, ${activeRun.failed_count ?? 0} failed.`}
                  {activeRun.status === 'failed' && `Failed${activeRun.error_message ? `: ${activeRun.error_message}` : '.'}`}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category URL *</label>
                <Input
                  placeholder="https://www.startech.com.bd/component/processor"
                  value={runCategoryUrl}
                  onChange={(e) => setRunCategoryUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category Name (tag) *</label>
                <Input placeholder="processor" value={runCategoryName} onChange={(e) => setRunCategoryName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Maps to Category *</label>
                <SearchableSelect
                  placeholder="Select a real category"
                  searchPlaceholder="Search categories..."
                  options={categories.map((c) => ({ value: c.name, label: c.name }))}
                  value={runTemplateCategory}
                  onChange={(v) => setRunTemplateCategory(String(v))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Brand Filter (optional)</label>
                <Input placeholder="e.g. Samsung" value={runBrandFilter} onChange={(e) => setRunBrandFilter(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Limit (optional)</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 20"
                  value={runProductLimit}
                  onChange={(e) => setRunProductLimit(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={startRun} isLoading={isStartingRun} disabled={activeRun?.status === 'running'}>
                <Play className="w-4 h-4 mr-1.5" />
                Run
              </Button>
            </div>

            {recentRuns.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Recent runs</p>
                <div className="space-y-1.5">
                  {recentRuns.map((run) => (
                    <div key={run.id} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                      <span className="truncate flex-1">
                        {run.category_name} → {run.template_category}
                      </span>
                      <Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'info'}>
                        {run.status}
                      </Badge>
                      <span className="text-gray-400 whitespace-nowrap">
                        {run.created_count ?? 0}c / {run.updated_count ?? 0}u / {run.synced_count ?? 0}s / {run.failed_count ?? 0}f
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="w-4 h-4 mr-1" />
                Filters
              </Button>
              <Button variant="ghost" size="sm" onClick={fetchRows} title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t">
                <SearchableSelect
                  placeholder="All Categories"
                  searchPlaceholder="Search categories..."
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={filterCategory}
                  onChange={(v) => { setFilterCategory(String(v)); setCurrentPage(1); }}
                  allowClear
                />
                <SearchableSelect
                  placeholder="All Brands"
                  searchPlaceholder="Search brands..."
                  options={brands.map((b) => ({ value: b.id, label: b.name }))}
                  value={filterBrand}
                  onChange={(v) => { setFilterBrand(String(v)); setCurrentPage(1); }}
                  allowClear
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk toolbar — Promote/Reject only apply to pending rows; Delete works from either
          selectable tab (Pending or Rejected — never Promoted, see the checkbox column below). */}
      {selectedIds.size > 0 && activeTab !== 'promoted' && (
        <Card className="mb-4 border-red-200 bg-red-50/60">
          <CardContent className="p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-red-800">
                {selectAllMatching ? `All ${totalRows} matching selected` : `${selectedIds.size} selected`}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); setSelectAllMatching(false); }}>
                  Clear
                </Button>
                {activeTab === 'pending' && (
                  <Button variant="danger" size="sm" onClick={() => setIsBulkRejectModalOpen(true)}>
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Reject {selectAllMatching ? `All ${totalRows}` : 'Selected'}
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => setIsBulkDeleteModalOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete {selectAllMatching ? `All ${totalRows}` : 'Selected'}
                </Button>
                {activeTab === 'pending' && (
                  <Button size="sm" onClick={() => setIsBulkPromoteModalOpen(true)}>
                    <ArrowRight className="w-4 h-4 mr-1.5" />
                    Promote {selectAllMatching ? `All ${totalRows}` : 'Selected'}
                  </Button>
                )}
              </div>
            </div>
            {/* Only offered once every row on the current page is checked and there's more than
                one page to expand into — this is what makes "promote this whole brand/category,
                or everything" possible in one click instead of clicking through each page. */}
            {!selectAllMatching && selectedIds.size === rows.length && totalRows > rows.length && (
              <p className="text-sm text-red-700">
                All {rows.length} rows on this page are selected.{' '}
                <button type="button" className="font-medium underline hover:no-underline" onClick={handleSelectAllMatching}>
                  Select all {totalRows} matching this view instead
                </button>
              </p>
            )}
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
                    {activeTab !== 'promoted' && (
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
                      {activeTab !== 'promoted' && (
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
                        <div className="flex items-center gap-1">
                          <Badge variant="info">{row.source_site}</Badge>
                          {row.last_ingest_action && INGEST_ACTION_BADGES[row.last_ingest_action] && (
                            <Badge variant={INGEST_ACTION_BADGES[row.last_ingest_action].variant}>
                              {INGEST_ACTION_BADGES[row.last_ingest_action].label}
                            </Badge>
                          )}
                        </div>
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
        message={
          selectAllMatching
            ? `Reject all ${totalRows} rows matching the current filters?`
            : `Reject ${selectedIds.size} selected row(s)?`
        }
        confirmLabel={selectAllMatching ? `Reject All ${totalRows}` : `Reject ${selectedIds.size}`}
        variant="danger"
        isLoading={isBulkRejecting}
      />

      <ConfirmModal
        isOpen={isBulkPromoteModalOpen}
        onClose={() => setIsBulkPromoteModalOpen(false)}
        onConfirm={handleBulkPromote}
        title="Promote Selected to Products"
        message={
          selectAllMatching
            ? `Move all ${totalRows} rows matching the current filters into the live catalog? Each becomes a new Inactive product — any without a mapped category or price will be skipped and stay here for review.`
            : `Move ${selectedIds.size} selected row(s) into the live catalog? Each becomes a new Inactive product — any without a mapped category or price will be skipped and stay here for review.`
        }
        confirmLabel={selectAllMatching ? `Promote All ${totalRows}` : `Promote ${selectedIds.size}`}
        isLoading={isBulkPromoting}
      />

      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected"
        message={
          selectAllMatching
            ? `Permanently delete all ${totalRows} rows matching the current filters from the staging list? This cannot be undone.`
            : `Permanently delete ${selectedIds.size} selected row(s) from the staging list? This cannot be undone.`
        }
        confirmLabel={selectAllMatching ? `Delete All ${totalRows}` : `Delete ${selectedIds.size}`}
        variant="danger"
        isLoading={isBulkDeleting}
      />
    </AdminLayout>
  );
}
