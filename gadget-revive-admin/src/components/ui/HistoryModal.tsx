'use client';

import React, { useEffect, useState } from 'react';
import { UserCircle2, Clock } from 'lucide-react';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { AuditLog } from '@/types';
import { formatDateTime } from '@/lib/utils';
import adminService from '@/lib/adminService';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceType: string; // e.g. 'Order', 'Product', 'Service', 'Expense', 'PurchaseOrder'
  resourceId: number;
  resourceLabel?: string; // e.g. "Order #ORD-123"
  createdBy?: { id: number; name: string } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

// Turns 'create_manual_order' / 'update_order_status' into "Create manual order" / "Update order status"
function humanizeAction(action: string): string {
  const s = action.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen, onClose, resourceType, resourceId, resourceLabel, createdBy, createdAt, updatedAt,
}) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    adminService
      .getAuditLogs({ resource_type: resourceType, resource_id: resourceId, per_page: 50 })
      .then((res) => setLogs(res.data.data || []))
      .catch(() => setLogs([]))
      .finally(() => setIsLoading(false));
  }, [isOpen, resourceType, resourceId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={resourceLabel ? `History — ${resourceLabel}` : 'History'} size="lg">
      <div className="space-y-4">
        {(createdBy || createdAt) && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <UserCircle2 className="w-8 h-8 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                Created by {createdBy?.name || 'Unknown'}
              </p>
              {createdAt && <p className="text-xs text-gray-500">{formatDateTime(createdAt)}</p>}
              {updatedAt && updatedAt !== createdAt && (
                <p className="text-xs text-gray-400 mt-0.5">Last updated {formatDateTime(updatedAt)}</p>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No activity recorded yet.</p>
        ) : (
          <ol className="relative border-l border-gray-200 ml-2 space-y-5">
            {logs.map((log) => (
              <li key={log.id} className="ml-4">
                <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-gray-900 border-2 border-white" />
                <p className="text-sm font-medium text-gray-900">{humanizeAction(log.action_type)}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <UserCircle2 className="w-3.5 h-3.5" />
                  {log.actor?.name || 'System'}
                  <span className="mx-1">•</span>
                  <Clock className="w-3.5 h-3.5" />
                  {formatDateTime(log.created_at)}
                </p>
                {log.description && (
                  <p className="text-xs text-gray-600 mt-1">{log.description}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
};

export default HistoryModal;
