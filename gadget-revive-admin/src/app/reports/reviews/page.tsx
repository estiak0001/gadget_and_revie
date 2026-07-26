'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Star, MessageSquare, AlertTriangle, ThumbsUp } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, LoadingSpinner,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface VendorRatingRow {
  id: number;
  business_name: string;
  average_rating: number;
  total_reviews: number;
}

interface ReviewReport {
  summary: {
    total_reviews: number;
    average_rating: number;
    rating_distribution: Record<'5' | '4' | '3' | '2' | '1', number>;
  };
  trend: { date: string; count: number; avg_rating: number }[];
  top_rated_vendors: VendorRatingRow[];
  attention_needed: VendorRatingRow[];
}

const fmtDate = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};
const today = new Date();
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(today.getDate() - 29);

export default function ReviewReportPage() {
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(fmtDate(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(fmtDate(today));

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await adminService.getReviewReport({ start_date: startDate, end_date: endDate });
      setReport(response.data.data || response.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const distributionData = report
    ? ([5, 4, 3, 2, 1] as const).map((star) => ({
        stars: `${star}★`,
        count: report.summary.rating_distribution[String(star) as '5' | '4' | '3' | '2' | '1'] ?? 0,
      }))
    : [];

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Review Report</h1>
          <p className="page-description">Customer satisfaction and vendor ratings</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button onClick={fetchReport}>
              <Calendar className="w-4 h-4 mr-2" />
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading report..." />
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Reviews</p>
                    <p className="text-2xl font-bold">{report.summary.total_reviews.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Average Rating</p>
                    <p className="text-2xl font-bold flex items-center gap-1">
                      {report.summary.average_rating}
                      <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Star className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Reviews Over Time</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="Reviews" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Rating Distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="stars" width={40} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vendor rating tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ThumbsUp className="w-4 h-4 text-green-600" /> Top Rated Vendors</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {report.top_rated_vendors.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No rated vendors yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {report.top_rated_vendors.map((v) => (
                      <li key={v.id} className="flex items-center justify-between px-6 py-3">
                        <span className="font-medium text-gray-900">{v.business_name}</span>
                        <span className="flex items-center gap-1 text-sm text-gray-600">
                          {v.average_rating} <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-gray-400">({v.total_reviews})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" /> Needs Attention</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {report.attention_needed.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No vendors currently need attention.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {report.attention_needed.map((v) => (
                      <li key={v.id} className="flex items-center justify-between px-6 py-3">
                        <span className="font-medium text-gray-900">{v.business_name}</span>
                        <span className="flex items-center gap-1 text-sm text-red-600">
                          {v.average_rating} <Star className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                          <span className="text-gray-400">({v.total_reviews})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
