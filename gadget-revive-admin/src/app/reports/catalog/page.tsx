'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Package, Wrench, AlertTriangle } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Select, Badge, LoadingSpinner,
} from '@/components/ui';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface TopItem {
  id: number;
  name: string;
  sku?: string;
  order_count: number;
  total_quantity: number;
  total_revenue: number;
}

interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  stock_qty: number;
  low_stock_threshold: number;
  vendor_profile?: { id: number; business_name: string } | null;
}

interface CatalogReport {
  top_services?: TopItem[];
  top_products?: TopItem[];
  low_stock_products?: LowStockProduct[];
}

const fmtDate = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};
const today = new Date();
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(today.getDate() - 29);

export default function CatalogReportPage() {
  const [report, setReport] = useState<CatalogReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(fmtDate(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(fmtDate(today));
  const [type, setType] = useState<'all' | 'product' | 'service'>('all');

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await adminService.getCatalogReport({ start_date: startDate, end_date: endDate, type });
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

  const productChartData = (report?.top_products || []).slice(0, 10).map(p => ({ name: p.name, revenue: p.total_revenue }));
  const serviceChartData = (report?.top_services || []).slice(0, 10).map(s => ({ name: s.name, revenue: s.total_revenue }));

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Catalog Report</h1>
          <p className="page-description">Top-performing products &amp; services, and low-stock alerts</p>
        </div>
      </div>

      {/* Filters */}
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
            <div className="w-40">
              <Select
                label="Type"
                value={type}
                onChange={(e) => setType(e.target.value as 'all' | 'product' | 'service')}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'product', label: 'Products' },
                  { value: 'service', label: 'Services' },
                ]}
              />
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
          {(productChartData.length > 0 || serviceChartData.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {productChartData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-4 h-4" /> Top Products by Revenue</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {serviceChartData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="w-4 h-4" /> Top Services by Revenue</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={serviceChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {report.top_products && report.top_products.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Top Products</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty Sold</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {report.top_products.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">{p.name}</p>
                            {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
                          </td>
                          <td className="px-6 py-4 text-gray-500">{p.order_count}</td>
                          <td className="px-6 py-4 text-gray-500">{p.total_quantity}</td>
                          <td className="px-6 py-4 font-medium">{formatCurrency(p.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {report.top_services && report.top_services.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Top Services</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {report.top_services.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{s.name}</td>
                          <td className="px-6 py-4 text-gray-500">{s.order_count}</td>
                          <td className="px-6 py-4 text-gray-500">{s.total_quantity}</td>
                          <td className="px-6 py-4 font-medium">{formatCurrency(s.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {report.low_stock_products && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock Products
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {report.low_stock_products.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No products are currently low on stock.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threshold</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {report.low_stock_products.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <p className="font-medium text-gray-900">{p.name}</p>
                              <p className="text-xs text-gray-400">{p.sku}</p>
                            </td>
                            <td className="px-6 py-4 text-gray-500">{p.vendor_profile?.business_name ?? 'In-house'}</td>
                            <td className="px-6 py-4">
                              <Badge variant={p.stock_qty === 0 ? 'danger' : 'warning'}>{p.stock_qty}</Badge>
                            </td>
                            <td className="px-6 py-4 text-gray-500">{p.low_stock_threshold}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </AdminLayout>
  );
}
