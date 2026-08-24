'use client';

import React, { useEffect, useState } from 'react';
import { Search, Star, ThumbsUp, ThumbsDown, Eye, Trash2, CheckCircle, XCircle, Flag, MessageSquare, Package, ExternalLink, Copy, Monitor } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Modal,
  Badge, Pagination, LoadingSpinner, EmptyState, ErrorState, ConfirmModal,
} from '@/components/ui';
import { formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

// The public storefront's own domain — used only to open its (unauthenticated, tokenless)
// general feedback kiosk page in a new tab, same convention as cms/pages/page.tsx.
const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';

interface Review {
  id: number; user: { id: number; name: string; avatar?: string } | null; vendor?: { id: number; business_name: string } | null;
  order?: { id: number; order_number: string } | null; product?: { id: number; name: string; image?: string } | null;
  rating: number; review: string | null; status: string; vendor_response?: string; vendor_responded_at?: string;
  images?: string[]; created_at: string;
}

const REVIEW_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'warning' }, { value: 'approved', label: 'Approved', color: 'success' },
  { value: 'rejected', label: 'Rejected', color: 'danger' }, { value: 'hidden', label: 'Hidden', color: 'danger' },
];

export default function ReviewsPage() {
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
      const params: Record<string, string | number> = { page: currentPage };
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

  useEffect(() => { fetchReviews(); }, [currentPage, filterStatus, filterRating]);
  const handleSearch = () => { setCurrentPage(1); fetchReviews(); };

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

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">{Array.from({ length: 5 }).map((_, i) => (<Star key={i} className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />))}</div>
  );

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  const positive = reviews.filter(r => r.rating >= 4).length;
  const neutral = reviews.filter(r => r.rating === 3).length;
  const negative = reviews.filter(r => r.rating <= 2).length;
  const pending = reviews.filter(r => r.status === 'pending').length;

  if (error && reviews.length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load reviews" onRetry={fetchReviews} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="page-header"><h1 className="page-title">Reviews & Ratings</h1><p className="page-description">Approve customer feedback so it appears on the storefront</p></div>

      <Card className="mb-6 border-yellow-200 bg-yellow-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Monitor className="w-4 h-4" />Collect Feedback From a Walk-in Customer</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-gray-600 mb-3">Look up their order, then hand them this screen to leave feedback on the spot — no phone number needed.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Order number, e.g. ORD-20260824-ABCDEF"
              value={feedbackOrderNumber}
              onChange={(e) => setFeedbackOrderNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFeedbackLookup()}
              className="flex-1"
            />
            <Button onClick={handleFeedbackLookup} isLoading={feedbackLookupLoading}>
              <Search className="w-4 h-4 mr-2" />
              Find Order
            </Button>
          </div>
          {feedbackLink && (
            <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <p className="text-sm font-medium text-gray-900">Order #{feedbackLink.order_number}</p>
                {feedbackLink.already_submitted && <Badge variant="warning">Already submitted feedback</Badge>}
              </div>
              <p className="text-xs text-gray-500 break-all mb-3">{feedbackLink.url}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleOpenFeedbackOnThisScreen}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Open on This Screen
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopyFeedbackLink}>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Link
                </Button>
              </div>
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-yellow-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Or leave a tablet running at the counter</p>
              <p className="text-xs text-gray-500">A dedicated, order-less link any walk-in customer can use on their own — set it to full screen once and leave it running.</p>
            </div>
            <Button variant="outline" onClick={() => window.open(`${WEB_URL}/feedback`, '_blank')} className="whitespace-nowrap">
              <Monitor className="w-4 h-4 mr-2" />
              Open General Feedback Kiosk
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center"><Star className="w-5 h-5 text-yellow-600" /></div><div><p className="text-xs text-gray-500">Avg Rating</p><p className="text-xl font-bold">{avgRating}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><ThumbsUp className="w-5 h-5 text-green-600" /></div><div><p className="text-xs text-gray-500">Positive</p><p className="text-xl font-bold">{positive}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><MessageSquare className="w-5 h-5 text-gray-600" /></div><div><p className="text-xs text-gray-500">Neutral</p><p className="text-xl font-bold">{neutral}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><ThumbsDown className="w-5 h-5 text-red-600" /></div><div><p className="text-xs text-gray-500">Negative</p><p className="text-xl font-bold">{negative}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><Flag className="w-5 h-5 text-orange-600" /></div><div><p className="text-xs text-gray-500">Pending</p><p className="text-xl font-bold">{pending}</p></div></div></CardContent></Card>
      </div>

      <Card className="mb-6"><CardContent className="p-4"><div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" /><Input placeholder="Search reviews..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="pl-10" /></div>
        <Select options={[{ value: '', label: 'All Status' }, ...REVIEW_STATUSES.map(s => ({ value: s.value, label: s.label }))]} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} />
        <Select options={[{ value: '', label: 'All Ratings' }, { value: '5', label: '5 Stars' }, { value: '4', label: '4 Stars' }, { value: '3', label: '3 Stars' }, { value: '2', label: '2 Stars' }, { value: '1', label: '1 Star' }]} value={filterRating} onChange={(e) => setFilterRating(e.target.value)} />
        <Button onClick={handleSearch}>Search</Button>
      </div></CardContent></Card>

      {isLoading ? (<div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading reviews..." /></div>
      ) : reviews.length === 0 ? (<EmptyState icon={<Star className="w-8 h-8 text-gray-400" />} title="No reviews found" />
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const statusConfig = REVIEW_STATUSES.find(s => s.value === review.status);
            return (
              <Card key={review.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {review.user?.avatar ? <img src={review.user.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-lg font-bold text-gray-600">{(review.user?.name ?? 'G').charAt(0)}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="font-medium">{review.user?.name ?? 'Guest customer'}</p>
                          {renderStars(review.rating)}
                          <Badge variant={statusConfig?.color as 'success' | 'warning' | 'danger' | 'default' || 'default'}>{statusConfig?.label}</Badge>
                        </div>
                        {review.vendor && <p className="text-sm text-gray-500 mt-0.5">Vendor: {review.vendor.business_name}</p>}
                        {review.product && (
                          <p className="text-sm text-primary flex items-center gap-1 mt-0.5"><Package className="w-3.5 h-3.5" />{review.product.name}</p>
                        )}
                        {review.review && <p className="text-gray-600 mt-1">{review.review}</p>}
                        {review.vendor_response && (
                          <div className="mt-3 bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-600 font-medium mb-1">Vendor Reply</p><p className="text-sm text-blue-800">{review.vendor_response}</p><p className="text-xs text-blue-400 mt-1">{review.vendor_responded_at ? formatDateTime(review.vendor_responded_at) : ''}</p></div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">{formatDateTime(review.created_at)}{review.order && <> • Order: <span className="text-primary">{review.order.order_number}</span></>}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedReview(review); setIsViewModalOpen(true); }}><Eye className="w-4 h-4" /></Button>
                      {review.status === 'pending' && (<><Button variant="ghost" size="sm" onClick={() => handleStatusChange(review, 'approved')} title="Approve"><CheckCircle className="w-4 h-4 text-green-600" /></Button><Button variant="ghost" size="sm" onClick={() => handleStatusChange(review, 'rejected')} title="Reject"><XCircle className="w-4 h-4 text-red-600" /></Button></>)}
                      {review.status !== 'hidden' && (<Button variant="ghost" size="sm" onClick={() => handleStatusChange(review, 'hidden')} title="Hide"><Flag className="w-4 h-4 text-orange-500" /></Button>)}
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedReview(review); setIsDeleteModalOpen(true); }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && <div className="mt-6"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /></div>}

      {/* View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Review Details" size="lg">
        {selectedReview && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">{selectedReview.user?.avatar ? <img src={selectedReview.user.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-gray-600">{(selectedReview.user?.name ?? 'G').charAt(0)}</span>}</div>
              <div><p className="text-lg font-semibold">{selectedReview.user?.name ?? 'Guest customer'}</p>{renderStars(selectedReview.rating)}<p className="text-sm text-gray-500 mt-1">{formatDateTime(selectedReview.created_at)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {selectedReview.vendor && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Vendor</p><p className="font-medium">{selectedReview.vendor.business_name}</p></div>}
              {selectedReview.product && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Product</p><p className="font-medium">{selectedReview.product.name}</p></div>}
              {selectedReview.order && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Order</p><p className="font-medium text-primary">{selectedReview.order.order_number}</p></div>}
              <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Status</p><Badge variant={REVIEW_STATUSES.find(s => s.value === selectedReview.status)?.color as 'success' | 'warning' | 'danger' | 'default'}>{selectedReview.status}</Badge></div>
            </div>
            {selectedReview.review && <p className="text-gray-600">{selectedReview.review}</p>}
            {selectedReview.images?.length ? <div><p className="text-sm font-medium mb-2">Photos</p><div className="flex gap-2 flex-wrap">{selectedReview.images.map((img, i) => (<img key={i} src={img} alt="" className="w-20 h-20 object-cover rounded-lg" />))}</div></div> : null}
          </div>
        )}
      </Modal>

      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDelete} title="Delete Review" message="Are you sure you want to delete this review? This cannot be undone." variant="danger" />
    </AdminLayout>
  );
}
