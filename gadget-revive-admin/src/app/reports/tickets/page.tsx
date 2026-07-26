'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Headphones, AlertCircle, CheckCircle2, Clock, Flame } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, LoadingSpinner,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface TicketReport {
  summary: {
    total_tickets: number;
    open_tickets: number;
    closed_tickets: number;
    urgent_tickets: number;
    high_priority_tickets: number;
    avg_resolution_hours: number;
  };
  trend: { date: string; count: number }[];
  by_priority: { priority: string; count: number }[];
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
};

const fmtDate = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};
const today = new Date();
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(today.getDate() - 29);

export default function TicketReportPage() {
  const [report, setReport] = useState<TicketReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(fmtDate(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(fmtDate(today));

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await adminService.getTicketReport({ start_date: startDate, end_date: endDate });
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

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Ticket Report</h1>
          <p className="page-description">Support ticket volume, priority, and resolution time</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Headphones className="w-5 h-5 text-blue-600" /></div>
                  <div><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold">{report.summary.total_tickets}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center"><AlertCircle className="w-5 h-5 text-yellow-600" /></div>
                  <div><p className="text-xs text-gray-500">Open</p><p className="text-lg font-bold">{report.summary.open_tickets}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
                  <div><p className="text-xs text-gray-500">Closed</p><p className="text-lg font-bold">{report.summary.closed_tickets}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><Flame className="w-5 h-5 text-red-600" /></div>
                  <div><p className="text-xs text-gray-500">Urgent</p><p className="text-lg font-bold">{report.summary.urgent_tickets}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-purple-600" /></div>
                  <div><p className="text-xs text-gray-500">Avg. Resolution</p><p className="text-lg font-bold">{report.summary.avg_resolution_hours}h</p></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Tickets Over Time</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="Tickets" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>By Priority</CardTitle></CardHeader>
              <CardContent>
                {report.by_priority.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-16">No tickets in this period.</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={report.by_priority}
                          dataKey="count"
                          nameKey="priority"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ priority, percent }) => `${priority} ${(percent * 100).toFixed(0)}%`}
                        >
                          {report.by_priority.map((entry, index) => (
                            <Cell key={index} fill={PRIORITY_COLORS[entry.priority] ?? '#9ca3af'} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
