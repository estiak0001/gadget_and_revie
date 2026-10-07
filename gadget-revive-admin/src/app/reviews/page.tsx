'use client';

import React, { useEffect, useState } from 'react';
import { Search, Star, ThumbsUp, ThumbsDown, Eye, Trash2, CheckCircle, XCircle, Flag, MessageSquare, Package, ExternalLink, Copy, Monitor, X } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Modal, Badge, Pagination, LoadingSpinner, EmptyState, ErrorState, ConfirmModal } from '@/components/ui';
import { KpiTile, Panel } from '@/components/reports/shared';
import { formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

// The public storefront's own domain — used only to open its (unauthenticated, tokenless)
// general feedback kiosk page in a new tab, same convention as cms/pages/page.tsx.
const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';

interface Review {
  id: number; user: { id: number; name: string; avatar?: string } | null; vendor?: { id: number; business_name: string } | null;
  order?: { id: number; order_number: string } | null; product?: { id: number; name: string; image?: string } | null;
  rating: number; would_recommend?: boolean | null; review: string | null; status: string; vendor_response?: string; vendor_responded_at?: string;
  images?: string[]; created_at: string;
}

const REVIEW_TABS = [
  { value: 'order', label: 'Order & product reviews' },
  { value: 'general', label: 'Walk-in kiosk feedback' },
] as const;
type ReviewTab = (typeof REVIEW_TABS)[number]['value'];

const REVIEW_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'warning' }, { value: 'approved', label: 'Approved', color: 'success' },
  { value: 'rejected', label: 'Rejected', color: 'danger' }, { value: 'hidden', label: 'Hidden', color: 'danger' },
];

const SELECT = 'h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500';

export default function ReviewsPage() {
  const [activeTab, setActiveTab] = useState<ReviewTab>('order');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);

  // Collect In-Store Feedback: for a walk-in customer at the counter — look up their order by
  // number, then either open the feedback page on this screen or copy the link, no SMS needed.
  const [feedbackOrderNumber, setFeedbackOrderNumber] = useState('');
  const [feedbackLookupLoading, setFeedbackLookupLoading] = useState(false);
  const [feedbackLink, setFeedbackLink] = useState<{ order_number: string; url: string; already_submitted: boolean } | null>(null);

  const fetchReviews = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage, kind: activeTab };
      if (searchQuery) params.search = searchQuery;
      if (filterStatus) params.status = filterStatus;
      if (filterRating) params.rating = filterRating;
      const response = await adminService.getReviews(params);
      setReviews(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, [currentPage, filterStatus, filterRating, activeTab]);
  const handleSearch = () => { setCurrentPage(1); fetchReviews(); };
  const handleTabChange = (tab: ReviewTab) => { setActiveTab(tab); setCurrentPage(1); };

  const handleFeedbackLookup = async () => {
    const orderNumber = feedbackOrderNumber.trim();
    if (!orderNumber) return;
    setFeedbackLookupLoading(true);
    setFeedbackLink(null);
    try {
      const found = await adminService.getOrders({ search: orderNumber, per_page: 1 });
      const order = found.data.data[0];
      if (!order) {
        toast.error(`No order found matching "${orderNumber}"`);
        return;
      }
      const link = await adminService.getOrderFeedbackLink(order.id);
      setFeedbackLink(link.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setFeedbackLookupLoading(false);
    }
  };

  const handleOpenFeedbackOnThisScreen = () => {
    if (feedbackLink) window.open(feedbackLink.url, '_blank');
  };

  const handleCopyFeedbackLink = async () => {
    if (!feedbackLink) return;
    try {
      await navigator.clipboard.writeText(feedbackLink.url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy — select and copy the link manually');
    }
  };

  const handleStatusChange = async (review: Review, status: string) => {
    try {
      await adminService.updateReviewStatus(review.id, status);
      toast.success(status === 'approved' ? 'Review approved — now visible on the storefront' : 'Review status updated');
      fetchReviews();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!selectedReview) return;
    try {
      await adminService.deleteReview(selectedReview.id);
      toast.success('Review deleted');
      setIsDeleteModalOpen(false);
      fetchReviews();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const renderStars = (rating: number, size = 'h-3.5 w-3.5') => (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${size} ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  const positive = reviews.filter(r => r.rating >= 4).length;
  const neutral = reviews.filter(r => r.rating === 3).length;
  const negative = reviews.filter(r => r.rating <= 2).length;
  const pending = reviews.filter(r => r.status === 'pending').length;
  const filtered = !!searchQuery || !!filterStatus || !!filterRating;
  const guestLabel = activeTab === 'general' ? 'Walk-in customer' : 'Guest customer';

  if (error && reviews.length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load reviews" onRetry={fetchReviews} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Reviews & ratings</h1>
          <span className="text-[11px] text-gray-500">Approve feedback so it appears on the storefront</span>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          {REVIEW_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === tab.value ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Walk-in collection: look up an order, then hand the customer this screen */}
      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-amber-700" />
            <p className="text-sm font-semibold text-gray-900">Walk-in feedback at the counter</p>
            <span className="text-[11px] text-gray-500">Look up their order, then hand them this screen — no phone number needed.</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.open(`${WEB_URL}/feedback`, '_blank')} className="whitespace-nowrap">
            <Monitor className="mr-1.5 h-3.5 w-3.5" />
            Open kiosk
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={feedbackOrderNumber}
              onChange={(e) => setFeedbackOrderNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFeedbackLookup()}
              placeholder="Order number, e.g. ORD-20260824-ABCDEF"
              className="h-8 w-full rounded-lg border border-gray-300 bg-white pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button size="sm" onClick={handleFeedbackLookup} isLoading={feedbackLookupLoading} className="whitespace-nowrap">
            <Search className="mr-1.5 h-3.5 w-3.5" />
            Find order
          </Button>
        </div>
        {feedbackLink && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                Order #{feedbackLink.order_number}
                {feedbackLink.already_submitted && <span className="ml-2"><Badge variant="warning" className="text-[11px]">Already submitted</Badge></span>}
              </p>
              <p className="truncate text-[11px] text-gray-500" title={feedbackLink.url}>{feedbackLink.url}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleOpenFeedbackOnThisScreen} className="whitespace-nowrap">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open here
              </Button>
              <Button size="sm" variant="outline" onClick={handleCopyFeedbackLink} className="whitespace-nowrap">
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy link
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <KpiTile label="Average rating" value={avgRating} tone="amber" icon={<Star className="h-4 w-4 opacity-60" />} sub={`${reviews.length} on this page`} />
        <KpiTile label="Positive" value={String(positive)} tone="emerald" icon={<ThumbsUp className="h-4 w-4 opacity-60" />} sub="4–5 stars" />
        <KpiTile label="Neutral" value={String(neutral)} tone="sky" icon={<MessageSquare className="h-4 w-4 opacity-60" />} sub="3 stars" />
        <KpiTile label="Negative" value={String(negative)} tone="rose" icon={<ThumbsDown className="h-4 w-4 opacity-60" />} sub="1–2 stars" />
        <KpiTile label="Pending" value={String(pending)} tone="orange" icon={<Flag className="h-4 w-4 opacity-60" />} sub="Waiting for approval" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search review text or customer…"
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select className={SELECT} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
          <option value="">All statuses</option>
          {REVIEW_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className={SELECT} value={filterRating} onChange={(e) => { setFilterRating(e.target.value); setCurrentPage(1); }}>
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((r) => <option key={r} value={String(r)}>{r} star{r === 1 ? '' : 's'}</option>)}
        </select>
        <Button size="sm" onClick={handleSearch} className="whitespace-nowrap">Search</Button>
        {filtered && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setFilterStatus(''); setFilterRating(''); setCurrentPage(1); }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading reviews..." /></div>
      ) : reviews.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
          <EmptyState
            icon={<Star className="h-8 w-8 text-gray-400" />}
            title={filtered ? 'No reviews match these filters' : activeTab === 'general' ? 'No walk-in kiosk feedback yet' : 'No reviews yet'}
          />
        </div>
      ) : (
        <Panel title={activeTab === 'general' ? 'Walk-in kiosk feedback' : 'Order & product reviews'} hint={`${reviews.length} on this page`}>
          <ul className="divide-y divide-gray-100">
            {reviews.map((review) => {
              const statusConfig = REVIEW_STATUSES.find(s => s.value === review.status);
              return (
                <li key={review.id} className="flex items-start gap-3 px-4 py-3 hover:bg-indigo-50/30">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200">
                    {review.user?.avatar
                      ? <img src={review.user.avatar} alt="" className="h-full w-full object-cover" />
                      : <span className="text-xs font-bold text-gray-600">{(review.user?.name ?? 'G').charAt(0)}</span>}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <p className="text-sm font-semibold text-gray-900">{review.user?.name ?? guestLabel}</p>
                      {renderStars(review.rating)}
                      <Badge variant={statusConfig?.color as 'success' | 'warning' | 'danger' | 'default' || 'default'} className="text-[11px]">{statusConfig?.label ?? review.status}</Badge>
                      {review.would_recommend !== null && review.would_recommend !== undefined && (
                        <Badge variant={review.would_recommend ? 'success' : 'danger'} className="text-[11px]">
                          {review.would_recommend ? 'Would recommend' : "Wouldn't recommend"}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-gray-500">
                      {review.vendor && <span>Vendor: {review.vendor.business_name}</span>}
                      {review.product && <span className="inline-flex items-center gap-1 text-indigo-600"><Package className="h-3 w-3" />{review.product.name}</span>}
                      <span>{formatDateTime(review.created_at)}</span>
                      {review.order && <span>Order <span className="font-semibold text-indigo-600">{review.order.order_number}</span></span>}
                    </div>

                    {review.review && <p className="mt-1.5 line-clamp-2 text-sm text-gray-700">{review.review}</p>}

                    {review.vendor_response && (
                      <div className="mt-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-sky-700">Vendor reply{review.vendor_responded_at ? ` · ${formatDateTime(review.vendor_responded_at)}` : ''}</p>
                        <p className="text-xs text-sky-900">{review.vendor_response}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-0.5">
                    <Button variant="ghost" size="sm" title="View" onClick={() => { setSelectedReview(review); setIsViewModalOpen(true); }}><Eye className="h-3.5 w-3.5" /></Button>
                    {review.status === 'pending' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleStatusChange(review, 'approved')} title="Approve"><CheckCircle className="h-3.5 w-3.5 text-emerald-600" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleStatusChange(review, 'rejected')} title="Reject"><XCircle className="h-3.5 w-3.5 text-rose-600" /></Button>
                      </>
                    )}
                    {review.status !== 'hidden' && (
                      <Button variant="ghost" size="sm" onClick={() => handleStatusChange(review, 'hidden')} title="Hide"><Flag className="h-3.5 w-3.5 text-orange-500" /></Button>
                    )}
                    <Button variant="ghost" size="sm" title="Delete" onClick={() => { setSelectedReview(review); setIsDeleteModalOpen(true); }}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {totalPages > 1 && <div className="mt-3 flex justify-end"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /></div>}

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Review details" size="lg">
        {selectedReview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-200">
                {selectedReview.user?.avatar ? <img src={selectedReview.user.avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-lg font-bold text-gray-600">{(selectedReview.user?.name ?? 'G').charAt(0)}</span>}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedReview.user?.name ?? guestLabel}</p>
                {renderStars(selectedReview.rating, 'h-4 w-4')}
                <p className="text-xs text-gray-500">{formatDateTime(selectedReview.created_at)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {selectedReview.vendor && <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[11px] text-gray-500">Vendor</p><p className="text-sm font-semibold">{selectedReview.vendor.business_name}</p></div>}
              {selectedReview.product && <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[11px] text-gray-500">Product</p><p className="text-sm font-semibold">{selectedReview.product.name}</p></div>}
              {selectedReview.order && <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[11px] text-gray-500">Order</p><p className="text-sm font-semibold text-indigo-600">{selectedReview.order.order_number}</p></div>}
              {selectedReview.would_recommend !== null && selectedReview.would_recommend !== undefined && (
                <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[11px] text-gray-500">Would recommend</p><p className="text-sm font-semibold">{selectedReview.would_recommend ? 'Yes' : 'No'}</p></div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              Status <Badge variant={REVIEW_STATUSES.find(s => s.value === selectedReview.status)?.color as 'success' | 'warning' | 'danger' | 'default'} className="text-[11px]">{selectedReview.status}</Badge>
            </div>
            {selectedReview.review && <p className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700">{selectedReview.review}</p>}
            {selectedReview.images?.length ? (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Photos</p>
                <div className="flex flex-wrap gap-2">{selectedReview.images.map((img, i) => (<img key={i} src={img} alt="" className="h-20 w-20 rounded-lg object-cover" />))}</div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDelete} title="Delete review" message="Are you sure you want to delete this review? This cannot be undone." variant="danger" />
    </AdminLayout>
  );
}
