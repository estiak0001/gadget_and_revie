'use client';

import React, { useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, LoadingSpinner } from '@/components/ui';
import adminService from '@/lib/adminService';
import { SmsLog } from '@/types';

/** Shared between Settings > SMS and the SMS Center page — every send, whatever the purpose,
 *  lands in the same log, so the same table works for "did this connection just work" and
 *  "did this campaign actually go out". */
export default function SmsLogTable({ purpose }: { purpose?: string }) {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await adminService.getSmsLogs({ per_page: 10, ...(purpose ? { purpose } : {}) });
      const payload = res.data?.data as unknown;
      const list = Array.isArray(payload) ? payload : (payload as { data?: SmsLog[] })?.data;
      setLogs(Array.isArray(list) ? list : []);
    } catch {
      // silent — the log is a debugging aid, not critical path
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [purpose]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><History className="w-4 h-4" />Recent SMS Log</CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchLogs} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>Refresh</Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No SMS sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Connection</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Provider Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-700 whitespace-nowrap">{log.phone}</td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{log.connection?.name || '—'}</td>
                    <td className="px-4 py-2.5"><Badge variant="default" className="text-xs">{log.purpose.replace('_', ' ')}</Badge></td>
                    <td className="px-4 py-2.5"><Badge variant={log.status === 'sent' ? 'success' : 'danger'} className="text-xs">{log.status}</Badge></td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-[16rem] truncate" title={log.message}>{log.message}</td>
                    {/* Full, unclipped provider response — this is what actually explains a
                        "failed" row (e.g. Alpha SMS's {"error":405,...}), so it's shown in full
                        with wrapping rather than truncated behind a hover tooltip. */}
                    <td className={`px-4 py-2.5 max-w-sm whitespace-pre-wrap break-words font-mono text-xs ${log.status === 'sent' ? 'text-gray-500' : 'text-red-600'}`}>
                      {log.response || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
