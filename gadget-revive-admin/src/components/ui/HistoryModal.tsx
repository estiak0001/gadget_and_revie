'use client';

import React, { useEffect, useState } from 'react';
import { UserCircle2, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { AuditLog } from '@/types';
import { formatDateTime, formatCurrency } from '@/lib/utils';
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

// Fields that are noise in a before/after diff — identifiers, timestamps, and relation blobs that
// either never meaningfully change or are already covered by dedicated handling (e.g. 'items').
const DIFF_IGNORE_KEYS = new Set([
  'id', 'created_at', 'updated_at', 'deleted_at', 'order_id', 'purchase_order_id',
  'created_by', 'customer_id', 'vendor_profile_id', 'items', 'is_payment_ledger_synced',
]);

// Fields whose value reads better as currency than a bare number.
const MONEY_KEYS = new Set([
  'subtotal', 'discount', 'shipping', 'tax', 'total', 'paid_amount', 'unit_price', 'unit_cost',
  'total_price', 'total_cost', 'amount', 'estimated_cost', 'received_qty', 'quantity',
  'outstanding_receivable', 'refund_amount',
]);

function formatFieldLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  // Laravel's decimal casts (subtotal, total, discount, etc.) serialize as numeric strings, not
  // JSON numbers — so this can't just check typeof === 'number'.
  const numeric = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)) ? Number(value) : null);
  if (numeric !== null && MONEY_KEYS.has(key) && key !== 'quantity' && key !== 'received_qty') {
    return formatCurrency(numeric);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

interface ScalarChange {
  key: string;
  oldValue: unknown;
  newValue: unknown;
}

function computeScalarChanges(oldValues: Record<string, unknown>, newValues: Record<string, unknown>): ScalarChange[] {
  const changes: ScalarChange[] = [];
  const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  keys.forEach((key) => {
    if (DIFF_IGNORE_KEYS.has(key)) return;
    const oldValue = oldValues[key];
    const newValue = newValues[key];
    if (typeof oldValue === 'object' || typeof newValue === 'object') return; // arrays/objects handled elsewhere
    if (String(oldValue ?? '') === String(newValue ?? '')) return;
    changes.push({ key, oldValue, newValue });
  });
  return changes;
}

interface LineItem {
  item_name?: string;
  name?: string;
  quantity?: number;
  unit_price?: number | string;
  unit_cost?: number | string;
  total_price?: number | string;
}

function itemSignature(item: LineItem): string {
  const name = item.item_name ?? item.name ?? 'Item';
  const price = item.unit_price ?? item.unit_cost ?? '';
  return `${name}|${item.quantity ?? ''}|${price}`;
}

function itemLabel(item: LineItem): string {
  const name = item.item_name ?? item.name ?? 'Item';
  const price = item.unit_price ?? item.unit_cost;
  const qty = item.quantity != null ? ` ×${item.quantity}` : '';
  const priceStr = price != null && price !== '' ? ` (${formatCurrency(Number(price))})` : '';
  return `${name}${qty}${priceStr}`;
}

/** Diffs two line-item arrays (order/purchase-order items) into added/removed/unchanged buckets. */
function diffItems(oldItems: LineItem[], newItems: LineItem[]) {
  const oldSigs = new Set(oldItems.map(itemSignature));
  const newSigs = new Set(newItems.map(itemSignature));
  const removed = oldItems.filter((i) => !newSigs.has(itemSignature(i)));
  const added = newItems.filter((i) => !oldSigs.has(itemSignature(i)));
  return { added, removed };
}

function ChangeDetails({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const oldValues = log.old_values ?? {};
  const newValues = log.new_values ?? {};

  const scalarChanges = computeScalarChanges(oldValues, newValues);

  const oldItems = Array.isArray(oldValues.items) ? (oldValues.items as LineItem[]) : [];
  const newItems = Array.isArray(newValues.items) ? (newValues.items as LineItem[]) : [];
  const itemChanges = (oldItems.length > 0 || newItems.length > 0) ? diffItems(oldItems, newItems) : null;
  const hasItemChanges = !!itemChanges && (itemChanges.added.length > 0 || itemChanges.removed.length > 0);

  if (scalarChanges.length === 0 && !hasItemChanges) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {expanded ? 'Hide changes' : 'View changes'}
      </button>
      {expanded && (
        <div className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2 text-xs">
          {scalarChanges.length > 0 && (
            <table className="w-full">
              <tbody>
                {scalarChanges.map(({ key, oldValue, newValue }) => (
                  <tr key={key}>
                    <td className="text-gray-500 pr-2 py-0.5 align-top whitespace-nowrap">{formatFieldLabel(key)}</td>
                    <td className="text-red-600 line-through pr-2 py-0.5 align-top">{formatFieldValue(key, oldValue)}</td>
                    <td className="text-green-700 font-medium py-0.5 align-top">{formatFieldValue(key, newValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {hasItemChanges && itemChanges && (
            <div className="space-y-1 pt-1 border-t border-gray-200">
              {itemChanges.removed.map((item, i) => (
                <p key={`rm-${i}`} className="text-red-600 line-through">− {itemLabel(item)}</p>
              ))}
              {itemChanges.added.map((item, i) => (
                <p key={`add-${i}`} className="text-green-700 font-medium">+ {itemLabel(item)}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
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
                {/* Only worth a diff when there's a real "before" state — a create action's
                    old_values is always null, and diffing against {} would just show every
                    field as "new" noise instead of anything meaningful. */}
                {log.old_values && log.new_values && <ChangeDetails log={log} />}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
};

export default HistoryModal;
