'use client';

import React, { useEffect, useState } from 'react';
import { Search, Star, ThumbsUp, ThumbsDown, Eye, Trash2, CheckCircle, XCircle, Flag, Sparkles, MessageSquare } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Modal,
  Badge, Pagination, LoadingSpinner, EmptyState, ErrorState, ConfirmModal,
} from '@/components/ui';
import { formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

interface Review {
  id: number; user: { id: number; name: string; avatar?: string }; vendor?: { id: number; business_name: string };
  order?: { id: number; order_number: string }; service?: { id: number; name: string };
  rating: number; title?: string; comment: string; pros?: string[]; cons?: string[];
  status: string; is_featured: boolean; vendor_reply?: string; vendor_replied_at?: string;
  images?: string[]; created_at: string;
}

const REVIEW_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'warning' }, { value: 'approved', label: 'Approved', color: 'success' },
  { value: 'rejected', label: 'Rejected', color: 'danger' }, { value: 'flagged', label: 'Flagged', color: 'danger' },
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

  const handleStatusChange = async (review: Review, status: string) => {
    try {
      await adminService.updateReviewStatus(review.id, status);
      toast.success('Review status updated');
      fetchReviews();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleToggleFeatured = async (review: Review) => {
    try {
      await adminService.updateReviewStatus(review.id, review.status, !review.is_featured);
      toast.success(review.is_featured ? 'Removed from featured' : 'Added to featured');
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
      <div className="page-header"><h1 className="page-title">Reviews & Ratings</h1><p className="page-description">Manage customer reviews</p></div>

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
              <Card key={review.id} className={`${review.is_featured ? 'ring-2 ring-yellow-400' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {review.user.avatar ? <img src={review.user.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-lg font-bold text-gray-600">{review.user.name.charAt(0)}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="font-medium">{review.user.name}</p>
                          {renderStars(review.rating)}
                          <Badge variant={statusConfig?.color as 'success' | 'warning' | 'danger' | 'default' || 'default'}>{statusConfig?.label}</Badge>
                          {review.is_featured && <Badge variant="warning"><Sparkles className="w-3 h-3 mr-1" />Featured</Badge>}
                        </div>
                        {review.vendor && <p className="text-sm text-gray-500 mt-0.5">Vendor: {review.vendor.business_name}</p>}
                        {review.service && <p className="text-sm text-primary">Service: {review.service.name}</p>}
                        {review.title && <p className="font-medium mt-2">{review.title}</p>}
                        <p className="text-gray-600 mt-1">{review.comment}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {review.pros?.map((pro, i) => (<Badge key={`pro-${i}`} variant="success" className="text-xs"><ThumbsUp className="w-3 h-3 mr-1" />{pro}</Badge>))}
                          {review.cons?.map((con, i) => (<Badge key={`con-${i}`} variant="danger" className="text-xs"><ThumbsDown className="w-3 h-3 mr-1" />{con}</Badge>))}
                        </div>
                        {review.vendor_reply && (
                          <div className="mt-3 bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-600 font-medium mb-1">Vendor Reply</p><p className="text-sm text-blue-800">{review.vendor_reply}</p><p className="text-xs text-blue-400 mt-1">{review.vendor_replied_at ? formatDateTime(review.vendor_replied_at) : ''}</p></div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">{formatDateTime(review.created_at)}{review.order && <> • Order: <span className="text-primary">{review.order.order_number}</span></>}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedReview(review); setIsViewModalOpen(true); }}><Eye className="w-4 h-4" /></Button>
                      {review.status === 'pending' && (<><Button variant="ghost" size="sm" onClick={() => handleStatusChange(review, 'approved')} title="Approve"><CheckCircle className="w-4 h-4 text-green-600" /></Button><Button variant="ghost" size="sm" onClick={() => handleStatusChange(review, 'rejected')} title="Reject"><XCircle className="w-4 h-4 text-red-600" /></Button></>)}
                      <Button variant="ghost" size="sm" onClick={() => handleStatusChange(review, 'flagged')} title="Flag"><Flag className="w-4 h-4 text-orange-500" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleFeatured(review)} title={review.is_featured ? 'Unfeature' : 'Feature'}><Sparkles className={`w-4 h-4 ${review.is_featured ? 'text-yellow-500' : 'text-gray-400'}`} /></Button>
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
              <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">{selectedReview.user.avatar ? <img src={selectedReview.user.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-gray-600">{selectedReview.user.name.charAt(0)}</span>}</div>
              <div><p className="text-lg font-semibold">{selectedReview.user.name}</p>{renderStars(selectedReview.rating)}<p className="text-sm text-gray-500 mt-1">{formatDateTime(selectedReview.created_at)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {selectedReview.vendor && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Vendor</p><p className="font-medium">{selectedReview.vendor.business_name}</p></div>}
              {selectedReview.service && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Service</p><p className="font-medium">{selectedReview.service.name}</p></div>}
              {selectedReview.order && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Order</p><p className="font-medium text-primary">{selectedReview.order.order_number}</p></div>}
              <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Status</p><Badge variant={REVIEW_STATUSES.find(s => s.value === selectedReview.status)?.color as 'success' | 'warning' | 'danger' | 'default'}>{selectedReview.status}</Badge></div>
            </div>
            {selectedReview.title && <h3 className="font-semibold text-lg">{selectedReview.title}</h3>}
            <p className="text-gray-600">{selectedReview.comment}</p>
            {(selectedReview.pros?.length || selectedReview.cons?.length) && (
              <div className="grid grid-cols-2 gap-4">
                {selectedReview.pros?.length ? <div><p className="text-sm font-medium text-green-700 mb-2">Pros</p>{selectedReview.pros.map((p, i) => (<div key={i} className="flex items-center gap-2 text-sm text-green-700 mb-1"><ThumbsUp className="w-3 h-3" />{p}</div>))}</div> : null}
                {selectedReview.cons?.length ? <div><p className="text-sm font-medium text-red-700 mb-2">Cons</p>{selectedReview.cons.map((c, i) => (<div key={i} className="flex items-center gap-2 text-sm text-red-700 mb-1"><ThumbsDown className="w-3 h-3" />{c}</div>))}</div> : null}
              </div>
            )}
            {selectedReview.images?.length ? <div><p className="text-sm font-medium mb-2">Photos</p><div className="flex gap-2 flex-wrap">{selectedReview.images.map((img, i) => (<img key={i} src={img} alt="" className="w-20 h-20 object-cover rounded-lg" />))}</div></div> : null}
          </div>
        )}
      </Modal>

      <ConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDelete} title="Delete Review" message="Are you sure you want to delete this review? This cannot be undone." variant="danger" />
    </AdminLayout>
  );
}
