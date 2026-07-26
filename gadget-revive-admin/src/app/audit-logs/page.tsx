'use client';

import React, { useEffect, useState } from 'react';
import { Search, Download, Filter, RefreshCw, Clock } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Select,
  Badge, Pagination, LoadingSpinner, EmptyState, ErrorState,
} from '@/components/ui';
import { AuditLog, PaginatedResponse } from '@/types';
import { formatDateTime, getErrorMessage, downloadBlob } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (searchQuery) params.search = searchQuery;
      if (filterAction) params.action_type = filterAction;
      if (filterModel) params.resource_type = filterModel;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const response = await adminService.getAuditLogs(params);
      setLogs(response.data.data);
      setTotalPages(response.data.meta?.last_page || 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [currentPage, filterAction, filterModel]);

  const handleSearch = () => { setCurrentPage(1); fetchLogs(); };
  const handleClearFilters = () => { setFilterAction(''); setFilterModel(''); setSearchQuery(''); setStartDate(''); setEndDate(''); setCurrentPage(1); };

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {};
      if (filterAction) params.action_type = filterAction;
      if (filterModel) params.resource_type = filterModel;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const response = await adminService.exportAuditLogs(params);
      downloadBlob(new Blob([response.data]), `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('Audit logs exported');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const getActionBadge = (actionType: string) => {
    if (actionType.startsWith('create') || actionType === 'approve_vendor') return <Badge variant="success">{actionType.replace(/_/g, ' ')}</Badge>;
    if (actionType.startsWith('update') || actionType.startsWith('upload')) return <Badge variant="warning">{actionType.replace(/_/g, ' ')}</Badge>;
    if (actionType.startsWith('delete') || actionType.startsWith('reject') || actionType.startsWith('suspend')) return <Badge variant="danger">{actionType.replace(/_/g, ' ')}</Badge>;
    if (actionType === 'login') return <Badge variant="success">login</Badge>;
    if (actionType === 'logout') return <Badge variant="default">logout</Badge>;
    return <Badge variant="default">{actionType.replace(/_/g, ' ')}</Badge>;
  };

  const formatChanges = (log: AuditLog) => {
    const action = log.action_type || log.action || '';
    if (log.description) {
      return <p className="text-xs text-gray-600">{log.description}</p>;
    }
    if (action.startsWith('create') && log.new_values) {
      return (<div className="text-xs text-gray-600"><span className="font-medium">New: </span>{Object.entries(log.new_values).slice(0, 3).map(([k, v]) => (<span key={k} className="mr-2">{k}: <span className="text-green-600">{String(v)}</span></span>))}</div>);
    }
    if (action.startsWith('delete') && log.old_values) {
      return (<div className="text-xs text-gray-600"><span className="font-medium">Removed: </span>{Object.entries(log.old_values).slice(0, 3).map(([k, v]) => (<span key={k} className="mr-2">{k}: <span className="text-red-600">{String(v)}</span></span>))}</div>);
    }
    if (action.startsWith('update') && log.old_values && log.new_values) {
      return (<div className="text-xs text-gray-600">{Object.keys(log.new_values).slice(0, 2).map((k) => (<div key={k}>{k}: <span className="text-red-600">{String((log.old_values as Record<string, unknown>)[k])}</span>{' → '}<span className="text-green-600">{String((log.new_values as Record<string, unknown>)[k])}</span></div>))}</div>);
    }
    return null;
  };

  const modelTypes = ['User', 'VendorProfile', 'Division', 'District', 'Area', 'File', 'Order', 'CMSPage', 'Banner', 'FAQ', 'Setting', 'Role'];
  const actions = ['login', 'logout', 'update_division', 'update_district', 'update_user_status', 'approve_vendor', 'reject_vendor', 'suspend_vendor', 'upload_file'];

  if (error && logs.length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load audit logs" onRetry={fetchLogs} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><h1 className="page-title">Audit Logs</h1><p className="page-description">Track all system activities and changes</p></div>
        <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" />Export Logs</Button>
      </div>

      <Card className="mb-6"><CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" /><Input placeholder="Search by user, model..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="pl-10" /></div></div>
          <Select options={[{ value: '', label: 'All Actions' }, ...actions.map(a => ({ value: a, label: a.charAt(0).toUpperCase() + a.slice(1) }))]} value={filterAction} onChange={(e) => setFilterAction(e.target.value)} />
          <Select options={[{ value: '', label: 'All Models' }, ...modelTypes.map(m => ({ value: m, label: m }))]} value={filterModel} onChange={(e) => setFilterModel(e.target.value)} />
          <div className="flex gap-2"><Button onClick={handleSearch} className="flex-1"><Filter className="w-4 h-4 mr-2" />Apply</Button><Button variant="outline" onClick={handleClearFilters}><RefreshCw className="w-4 h-4" /></Button></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">From Date</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">To Date</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>
      </CardContent></Card>

      <Card>
        <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (<div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading logs..." /></div>
          ) : logs.length === 0 ? (<EmptyState icon={<Clock className="w-8 h-8 text-gray-400" />} title="No audit logs found" />
          ) : (
            <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 border-y"><tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Changes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr></thead><tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4"><p className="font-medium">{log.actor?.name || log.user?.name || `User #${log.actor_id || log.user_id}`}</p><p className="text-xs text-gray-500">{log.actor?.email || log.user?.email}</p></td>
                  <td className="px-6 py-4">{getActionBadge(log.action_type || log.action || '')}</td>
                  <td className="px-6 py-4"><p className="font-medium">{log.resource_type || log.model_type}</p>{(log.resource_id || log.model_id) && <p className="text-xs text-gray-500">ID: {log.resource_id || log.model_id}</p>}</td>
                  <td className="px-6 py-4 max-w-xs">{formatChanges(log)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{log.ip_address}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDateTime(log.created_at)}</td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && <div className="mt-6"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /></div>}
    </AdminLayout>
  );
}
