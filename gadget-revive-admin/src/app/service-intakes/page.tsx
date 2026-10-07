'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Eye, Edit2, Trash2, Printer, RefreshCw, X, ClipboardCheck, ArrowRightCircle,
  Link2, Download, BadgeDollarSign, History, ChevronRight, Check,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, Button, Input, Textarea, Select, SearchableSelect,
  Modal, Badge, LoadingSpinner, Pagination, EmptyState, ErrorState, ConfirmModal, HistoryModal, ActionsMenu,
} from '@/components/ui';
import { ServiceIntake, ServiceIntakeStatus, ServiceIntakeWorkStatus, ServiceProblemType, BranchLocation, User } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const STATUS_OPTIONS: { value: ServiceIntakeStatus; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
];

// Every status gets its own color -- no two statuses share a badge, so the lifecycle stage is
// readable from color alone at a glance down the list.
const STATUS_BADGE: Record<ServiceIntakeStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'teal'> = {
  received: 'info',        // blue -- just checked in
  in_progress: 'warning',  // amber -- actively being worked on
  ready: 'purple',         // ready for pickup / awaiting customer decision
  converted: 'success',    // green -- became a paid order
  delivered: 'teal',       // completed repair handed back to the customer
  returned: 'default',     // gray -- handed back without conversion (declined/unrepairable)
  cancelled: 'danger',     // red -- intake called off
};

// Terminal statuses, same as ServiceIntake::isLocked() on the backend -- the device has already
// left one way or another, so status/work-status can no longer be changed from here.
const isIntakeLocked = (status: ServiceIntakeStatus) => status === 'cancelled' || status === 'returned';

const WORK_STATUS_OPTIONS: { value: ServiceIntakeWorkStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'wait_for_feedback', label: 'Wait for Feedback' },
  { value: 'done', label: 'Done' },
];

const WORK_STATUS_BADGE: Record<ServiceIntakeWorkStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'default',
  in_progress: 'warning',
  wait_for_feedback: 'info',
  done: 'success',
};

// Pixel width for every `width` class this file actually passes to InlineCell -- needed to
// clamp the portaled popover's position (see below) before it ever paints, so it never visibly
// jumps after an initial too-far-right render.
const INLINE_CELL_WIDTH_PX: Record<string, number> = {
  'w-32': 128, 'w-40': 160, 'w-48': 192, 'w-56': 224, 'w-64': 256,
};

/**
 * One click-to-edit table cell. The collapsed display stays exactly as small as the rest of
 * the dense table; clicking it opens a properly-sized editor in a floating popover instead of
 * squeezing an input into the narrow column itself -- a single-line input for short fields
 * (name, phone, amounts), a multi-row textarea for prose (feedback, remarks, reasons). Saves
 * only via Enter (single-line) or the explicit check button; Escape or the X cancels. Fully
 * controlled from the parent (shared inlineEdit/inlineValue state) so only one cell across the
 * whole table is ever in edit mode at a time.
 *
 * The popover is rendered in a portal straight into <body>, positioned by measuring the
 * trigger cell -- the table's own wrapper needs overflow:hidden for its rounded corners, which
 * was silently clipping the popover for any cell near the right edge of the card (same fix as
 * SerialPickerDropdown in OrderForm.tsx). Positioning also clamps horizontally so it never
 * overflows past the right edge of the viewport either.
 */
function InlineCell({
  isEditing, value, onStartEdit, onChange, onSave, onCancel, display, type = 'text', multiline = false, width = 'w-48',
}: {
  isEditing: boolean;
  value: string;
  onStartEdit: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  display: React.ReactNode;
  type?: 'text' | 'number' | 'date';
  multiline?: boolean;
  width?: string;
}) {
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const widthPx = INLINE_CELL_WIDTH_PX[width] ?? 192;

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    let left = rect.left;
    if (left + widthPx > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - widthPx - margin);
    }
    setPopupPos({ top: rect.top + window.scrollY, left: left + window.scrollX });
  }, [widthPx]);

  useEffect(() => {
    if (!isEditing) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isEditing, updatePosition]);

  return (
    <div className="relative">
      <div
        ref={triggerRef}
        onClick={(e) => { if (!isEditing) { e.stopPropagation(); onStartEdit(); } }}
        className={isEditing ? '' : 'cursor-text hover:bg-primary-50 rounded px-0.5 -mx-0.5'}
        title={isEditing ? undefined : 'Click to edit'}
      >
        {display}
      </div>
      {isEditing && popupPos && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'absolute', top: popupPos.top, left: popupPos.left, width: widthPx }}
          className="z-[100] rounded-lg border border-primary-400 bg-white shadow-lg p-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {multiline ? (
            <textarea
              autoFocus
              rows={3}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs leading-normal focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') onCancel();
                // Enter inserts a newline here instead of saving -- use the check button.
              }}
            />
          ) : (
            <input
              autoFocus
              type={type}
              step={type === 'number' ? '0.01' : undefined}
              min={type === 'number' ? 0 : undefined}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') onSave();
                if (e.key === 'Escape') onCancel();
              }}
            />
          )}
          <div className="flex justify-end gap-1 mt-1">
            <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-gray-100 text-gray-500" title="Cancel">
              <X className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={onSave} className="p-1 rounded hover:bg-primary-50 text-primary-600" title="Save">
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface ConvertItemRow {
  id: number;
  item_name: string;
  quantity: number;
  include: boolean;
  unit_price: string;
}

const emptyConvertData = () => ({
  customer_id: '' as string | number,
  customer_name: '', customer_phone: '', customer_email: '', customer_address: '',
  payment_method: 'cash', payment_status: 'pending', order_status: 'in_progress',
  tax: '', shipping: '', discount: '', admin_notes: '',
});

const statusLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
const num = (v: unknown) => Number(v ?? 0) || 0;

// dd/mm/yyyy everywhere on this page, regardless of browser locale.
const formatDMY = (value?: string | null): string | null => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

/** "Days" column -- positive = days left until the estimate, negative = overdue, null = no estimate set. */
function formatDaysUntilEstimate(days?: number | null): { label: string; className: string } {
  if (days === null || days === undefined) return { label: '—', className: 'text-gray-400' };
  if (days > 0) return { label: `${days}d left`, className: 'text-gray-600' };
  if (days === 0) return { label: 'Due today', className: 'text-amber-600 font-medium' };
  return { label: `${Math.abs(days)}d overdue`, className: 'text-red-600 font-medium' };
}

// Pixel width for every `width` class this file actually passes to InlineCell -- needed to
// clamp the portaled popover's position (see below) before it ever paints, so it never visibly
// jumps after an initial too-far-right render.

export default function ServiceIntakesPage() {
  const router = useRouter();
  const [intakes, setIntakes] = useState<ServiceIntake[]>([]);
  const [branches, setBranches] = useState<BranchLocation[]>([]);
  const [problemTypes, setProblemTypes] = useState<ServiceProblemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWorkStatus, setFilterWorkStatus] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Rows expanded to show full-detail fields (serial no., problem, eng name, feedback, remark,
  // etc.) that don't get their own column — each row toggles independently.
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const toggleExpanded = (id: number) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Inline cell editing directly in the table -- which single cell (if any) is being edited
  // right now, and its in-progress text. Only one cell across the whole table at a time.
  const [inlineEdit, setInlineEdit] = useState<{ id: number; field: string } | null>(null);
  const [inlineValue, setInlineValue] = useState('');

  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<ServiceIntake | null>(null);
  const [historyIntake, setHistoryIntake] = useState<ServiceIntake | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Manage-problem-types modal (add / rename / delete the dropdown options themselves).
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isSavingType, setIsSavingType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [deletingTypeId, setDeletingTypeId] = useState<number | null>(null);

  const [customers, setCustomers] = useState<User[]>([]);
  const [convertData, setConvertData] = useState(emptyConvertData());
  const [convertItems, setConvertItems] = useState<ConvertItemRow[]>([]);
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new');

  // Confirm-price modal state (for intakes linked to an existing order)
  const [priceItems, setPriceItems] = useState<{ id: number; item_name: string; quantity: number; final_price: string }[]>([]);
  const [priceExtras, setPriceExtras] = useState({
    tax: '', shipping: '', discount: '', payment_method: 'cash', payment_status: 'pending', order_status: 'awaiting_payment',
  });

  const fetchIntakes = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page: currentPage };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterStatus) params.status = filterStatus;
      if (filterWorkStatus) params.work_status = filterWorkStatus;
      if (filterBranchId) params.branch_location_id = filterBranchId;
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      const res = await adminService.getServiceIntakes(params);
      const body = res.data as unknown as { data: ServiceIntake[]; meta?: { last_page?: number } };
      setIntakes(Array.isArray(body.data) ? body.data : []);
      setTotalPages(body.meta?.last_page || 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setIntakes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await adminService.getBranchLocations({ per_page: 200 });
      const body = res.data as unknown as { data?: { data?: BranchLocation[] } | BranchLocation[] };
      const list = Array.isArray(body.data) ? body.data : (body.data?.data ?? []);
      setBranches(Array.isArray(list) ? list : []);
    } catch {
      setBranches([]);
    }
  };


  const fetchCustomers = async () => {
    try {
      const res = await adminService.getCustomers({ per_page: 200 });
      const body = res.data as unknown as { data?: User[] };
      setCustomers(Array.isArray(body.data) ? body.data : []);
    } catch {
      setCustomers([]);
    }
  };

  const fetchProblemTypes = async () => {
    try {
      const res = await adminService.getServiceProblemTypes();
      const body = res.data as unknown as { data?: ServiceProblemType[] };
      setProblemTypes(Array.isArray(body.data) ? body.data : []);
    } catch {
      setProblemTypes([]);
    }
  };

  useEffect(() => { fetchBranches(); fetchCustomers(); fetchProblemTypes(); }, []);

  // Live search -- fetch 400ms after typing stops, not on every keystroke. The Input itself
  // stays bound to searchQuery for instant visual feedback; only the actual API call waits.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Single source of truth for loading the list -- every filter or page change re-fetches
  // through here, so fetchIntakes always reads the state that's actually current (never a
  // stale currentPage from calling it directly right after setCurrentPage in the same tick).
  useEffect(() => {
    fetchIntakes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch, filterStatus, filterWorkStatus, filterBranchId, dateFrom, dateTo]);

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: `${c.name}${c.phone ? ' — ' + c.phone : c.email ? ' — ' + c.email : ''}`,
  }));






  // Enter / clicking the search icon skips the debounce wait instead of calling fetchIntakes
  // directly -- letting the effect above do the actual fetch means it always runs against
  // fresh state (setCurrentPage(1) here takes effect before the effect re-runs).
  const handleSearch = () => { setCurrentPage(1); setDebouncedSearch(searchQuery); };

  const clearFilters = () => {
    setSearchQuery(''); setDebouncedSearch('');
    setFilterStatus(''); setFilterWorkStatus(''); setFilterBranchId('');
    setDateFrom(''); setDateTo('');
    setCurrentPage(1);
  };






  // ── Problem types (manageable dropdown options: add / rename / remove) ──
  const handleAddType = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    setIsSavingType(true);
    try {
      await adminService.createServiceProblemType(name);
      setNewTypeName('');
      fetchProblemTypes();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSavingType(false);
    }
  };

  const startRenameType = (type: ServiceProblemType) => {
    setEditingTypeId(type.id);
    setEditingTypeName(type.name);
  };

  const handleRenameType = async () => {
    if (!editingTypeId || !editingTypeName.trim()) return;
    setIsSavingType(true);
    try {
      await adminService.updateServiceProblemType(editingTypeId, { name: editingTypeName.trim() });
      setEditingTypeId(null);
      setEditingTypeName('');
      fetchProblemTypes();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSavingType(false);
    }
  };

  const handleDeleteType = async (type: ServiceProblemType) => {
    setDeletingTypeId(type.id);
    try {
      await adminService.deleteServiceProblemType(type.id);
      toast.success('Problem type removed.');
      fetchProblemTypes();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingTypeId(null);
    }
  };


  // ── Actions ───────────────────────────────────
  const openView = async (intake: ServiceIntake) => {
    setSelected(intake);
    setIsViewOpen(true);
    try {
      const res = await adminService.getServiceIntake(intake.id);
      setSelected(res.data.data);
    } catch { /* keep list snapshot */ }
  };

  const handleDownload = async (intake: ServiceIntake) => {
    try {
      const res = await adminService.downloadServiceReceipt(intake.id);
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Service-Receipt-${intake.receipt_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Receipt downloaded.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Opens the PDF in a new tab via a blob URL. The tab must open synchronously
  // in the click handler; opening it after the `await` below loses the
  // user-gesture context and the browser blocks the popup. Navigating the tab
  // straight to a blob: URL also triggers a download in some browsers instead
  // of the inline viewer, so we write a minimal page with an <embed> instead —
  // that reliably renders the browser's native PDF viewer.
  const handlePreviewReceipt = async (intake: ServiceIntake) => {
    const newTab = window.open('', '_blank');
    try {
      const res = await adminService.downloadServiceReceipt(intake.id);
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      if (newTab) {
        newTab.document.write(
          `<!DOCTYPE html><html><head><title>Receipt-${intake.receipt_number}</title></head>` +
          `<body style="margin:0"><embed src="${url}" type="application/pdf" width="100%" height="100%" style="border:none;position:fixed;inset:0" /></body></html>`
        );
        newTab.document.close();
      } else {
        toast.error('Please allow pop-ups to preview the receipt.');
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      newTab?.close();
      toast.error(getErrorMessage(err));
    }
  };

  // Swaps just the one changed row into local state from the server's response -- never a
  // full fetchIntakes(), which would flip isLoading and blank the whole table out to a
  // spinner for every single-field save. The list itself hasn't changed shape (no row
  // added/removed/reordered), so nothing else needs to re-fetch.
  const patchIntakeInList = (updated: ServiceIntake) =>
    setIntakes((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));

  const handleStatusChange = async (intake: ServiceIntake, status: string) => {
    try {
      const res = await adminService.updateServiceIntakeStatus(intake.id, status);
      toast.success('Status updated.');
      setSelected((prev) => (prev ? { ...prev, status: status as ServiceIntakeStatus } : prev));
      patchIntakeInList(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleWorkStatusChange = async (intake: ServiceIntake, workStatus: string) => {
    try {
      const res = await adminService.updateServiceIntakeWorkStatus(intake.id, workStatus);
      toast.success('Work status updated.');
      setSelected((prev) => (prev ? { ...prev, work_status: workStatus as ServiceIntakeWorkStatus } : prev));
      patchIntakeInList(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // ── Inline table-cell editing ─────────────────
  // The update endpoint validates a full intake (customer_name/phone + items are required), so
  // editing a single cell still has to resend everything else exactly as it already is on the
  // row, with just that one field overridden.
  const buildIntakeUpdatePayload = (intake: ServiceIntake, patch: Record<string, unknown>): Record<string, unknown> => ({
    order_id: intake.order_id ?? null,
    customer_id: intake.customer_id ?? null,
    customer_name: intake.customer_name,
    customer_phone: intake.customer_phone,
    customer_email: intake.customer_email ?? null,
    customer_address: intake.customer_address ?? null,
    branch_location_id: intake.branch_location_id ?? null,
    status: intake.status,
    work_status: intake.work_status ?? 'pending',
    estimated_cost: intake.estimated_cost != null ? num(intake.estimated_cost) : null,
    amount: intake.amount != null ? num(intake.amount) : null,
    non_refundable_amount: intake.non_refundable_amount != null ? num(intake.non_refundable_amount) : null,
    non_refundable_reason: intake.non_refundable_reason ?? null,
    reference_name: intake.reference_name ?? null,
    commission_amount: intake.commission_amount != null ? num(intake.commission_amount) : null,
    expected_delivery_at: intake.expected_delivery_at ? intake.expected_delivery_at.slice(0, 10) : null,
    notes: intake.notes ?? null,
    admin_notes: intake.admin_notes ?? null,
    customer_feedback: intake.customer_feedback ?? null,
    items: (intake.items ?? []).map((i) => ({
      item_name: i.item_name,
      serial_number: i.serial_number ?? null,
      problem_reported: i.problem_reported ?? null,
      problem_type_id: i.problem_type_id ?? null,
      accessories: i.accessories ?? null,
      quantity: i.quantity ?? 1,
      estimated_price: i.estimated_price != null ? num(i.estimated_price) : null,
    })),
    ...patch,
  });

  const startInline = (intake: ServiceIntake, field: string, current: string) => {
    setInlineEdit({ id: intake.id, field });
    setInlineValue(current);
  };

  const cancelInline = () => setInlineEdit(null);

  // Guarded by the inlineEdit check so Enter (which blurs the input) and the blur event it
  // triggers can't both fire a save for the same edit.
  const commitInline = async (intake: ServiceIntake, field: string, patch: Record<string, unknown>) => {
    if (!inlineEdit || inlineEdit.id !== intake.id || inlineEdit.field !== field) return;
    setInlineEdit(null);
    try {
      const res = await adminService.updateServiceIntake(intake.id, buildIntakeUpdatePayload(intake, patch));
      patchIntakeInList(res.data.data);
    } catch (err) {
      // Nothing was ever optimistically changed locally, so the cell already shows the
      // pre-edit value again on its own -- just surface why it didn't save.
      toast.error(getErrorMessage(err));
    }
  };

  const openConvert = (intake: ServiceIntake) => {
    setSelected(intake);
    setCustomerMode(intake.customer_id ? 'existing' : 'new');
    setConvertData({
      ...emptyConvertData(),
      customer_id: intake.customer_id ? String(intake.customer_id) : '',
      customer_name: intake.customer_name ?? '',
      customer_phone: intake.customer_phone ?? '',
      customer_email: intake.customer_email ?? '',
      customer_address: intake.customer_address ?? '',
    });
    // Every item defaults to included — admin unchecks the ones being handed back to the
    // customer as-is instead of becoming an order line.
    setConvertItems(
      (intake.items ?? []).map((it) => ({
        id: it.id as number,
        item_name: it.item_name,
        quantity: it.quantity ?? 1,
        include: true,
        unit_price: it.estimated_price != null ? String(it.estimated_price) : '',
      })),
    );
    setIsConvertOpen(true);
  };

  const convertIncludedItems = convertItems.filter((it) => it.include);
  const convertSubtotal = convertIncludedItems.reduce((s, it) => s + num(it.unit_price) * (it.quantity || 1), 0);
  const convertTotal = convertSubtotal + num(convertData.tax) + num(convertData.shipping) - num(convertData.discount);

  const setConvertItem = (idx: number, patch: Partial<ConvertItemRow>) =>
    setConvertItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const handleConvert = async () => {
    if (!selected) return;
    if (convertIncludedItems.length === 0) {
      toast.error('Include at least one item to convert to an order.');
      return;
    }
    if (convertIncludedItems.some((it) => it.unit_price === '')) {
      toast.error('Enter a price for every included item.');
      return;
    }
    if (customerMode === 'existing' && !convertData.customer_id) {
      toast.error('Pick an existing customer, or switch to "New customer".');
      return;
    }
    if (customerMode === 'new' && (!convertData.customer_name.trim() || !convertData.customer_phone.trim())) {
      toast.error('New customer needs a name and phone number.');
      return;
    }
    setIsSaving(true);
    try {
      await adminService.convertServiceIntake(selected.id, {
        customer_id: customerMode === 'existing' ? Number(convertData.customer_id) : null,
        customer_name: convertData.customer_name || undefined,
        customer_phone: convertData.customer_phone || undefined,
        customer_email: convertData.customer_email || undefined,
        customer_address: convertData.customer_address || undefined,
        payment_method: convertData.payment_method,
        payment_status: convertData.payment_status,
        order_status: convertData.order_status,
        tax: convertData.tax ? num(convertData.tax) : undefined,
        shipping: convertData.shipping ? num(convertData.shipping) : undefined,
        discount: convertData.discount ? num(convertData.discount) : undefined,
        admin_notes: convertData.admin_notes || undefined,
        items: convertItems.map((it) => ({
          id: it.id,
          include: it.include,
          unit_price: it.include ? num(it.unit_price) : null,
        })),
      });
      toast.success('Converted to a service order.');
      setIsConvertOpen(false);
      setIsViewOpen(false);
      fetchIntakes();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const openConfirmPrice = (intake: ServiceIntake) => {
    setSelected(intake);
    setPriceItems(
      (intake.items ?? []).map((it) => ({
        id: it.id as number,
        item_name: it.item_name,
        quantity: it.quantity ?? 1,
        final_price: it.estimated_price != null ? String(it.estimated_price) : '',
      })),
    );
    setPriceExtras({ tax: '', shipping: '', discount: '', payment_method: 'cash', payment_status: 'pending', order_status: 'awaiting_payment' });
    setIsPriceOpen(true);
  };

  const priceTotal = priceItems.reduce((s, it) => s + num(it.final_price) * (it.quantity || 1), 0)
    + num(priceExtras.tax) + num(priceExtras.shipping) - num(priceExtras.discount);

  const handleConfirmPrice = async () => {
    if (!selected) return;
    if (priceItems.some((it) => it.final_price === '' )) {
      toast.error('Enter a final price for every item.');
      return;
    }
    setIsSaving(true);
    try {
      await adminService.confirmServiceIntakePrice(selected.id, {
        items: priceItems.map((it) => ({ id: it.id, final_price: num(it.final_price), quantity: it.quantity })),
        tax: priceExtras.tax ? num(priceExtras.tax) : 0,
        shipping: priceExtras.shipping ? num(priceExtras.shipping) : 0,
        discount: priceExtras.discount ? num(priceExtras.discount) : 0,
        payment_method: priceExtras.payment_method,
        payment_status: priceExtras.payment_status,
        order_status: priceExtras.order_status,
      });
      toast.success('Price confirmed — order is ready for invoicing.');
      setIsPriceOpen(false);
      setIsViewOpen(false);
      fetchIntakes();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadInvoice = async (orderId: number, orderNumber?: string) => {
    try {
      const res = await adminService.downloadInvoice(orderId);
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${orderNumber ?? orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      await adminService.deleteServiceIntake(selected.id);
      toast.success('Service intake deleted.');
      setIsDeleteOpen(false);
      setSelected(null);
      fetchIntakes();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900">Service Intakes</h1>
            <p className="text-xs text-gray-500">Receive a device, issue a receipt, then convert it into a service order</p>
          </div>
          <Button size="sm" onClick={() => router.push('/service-intakes/create')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Intake
          </Button>
        </div>

        {/* Filters — one compact card */}
        <div className="rounded-xl border border-gray-200 bg-white p-2.5 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
              <Input
                placeholder="Receipt no., name, phone or serial number…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button size="sm" variant="outline" onClick={handleSearch}>Search</Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
            <Select
              className="h-8 text-xs"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS, { value: 'converted', label: 'Converted' }]}
            />
            <Select
              className="h-8 text-xs"
              value={filterWorkStatus}
              onChange={(e) => { setFilterWorkStatus(e.target.value); setCurrentPage(1); }}
              options={[{ value: '', label: 'All work status' }, ...WORK_STATUS_OPTIONS]}
            />
            <Select
              className="h-8 text-xs"
              value={filterBranchId}
              onChange={(e) => { setFilterBranchId(e.target.value); setCurrentPage(1); }}
              options={[{ value: '', label: 'All branches' }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
            />
            <Input type="date" className="h-8 text-xs" title="Received from" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} />
            <Input type="date" className="h-8 text-xs" title="Received to" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} />
            <Button size="sm" variant="ghost" onClick={clearFilters} title="Clear all filters">
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          </div>
        </div>

        {/* Table — same 16-column layout as before */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 flex justify-center"><LoadingSpinner /></div>
            ) : error ? (
              <div className="py-12"><ErrorState onRetry={fetchIntakes} /></div>
            ) : intakes.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  icon={<ClipboardCheck className="w-10 h-10" />}
                  title="No service intakes yet"
                  description="Create an intake when a customer drops off a device for service."
                />
              </div>
            ) : (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-[10px] table-fixed border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-gray-600 uppercase tracking-wide">
                      <th className="border border-gray-100 w-6 px-1 py-1.5"></th>
                      <th className="border border-gray-100 w-[8%] px-1.5 py-1.5">Receipt</th>
                      <th className="border border-gray-100 w-[7%] px-1.5 py-1.5">Customer</th>
                      <th className="border border-gray-100 w-[6%] px-1.5 py-1.5">Mobile</th>
                      <th className="border border-gray-100 w-[13%] px-1.5 py-1.5">Items</th>
                      <th className="border border-gray-100 w-[9%] px-1.5 py-1.5">Problem</th>
                      <th className="border border-gray-100 w-[6%] px-1.5 py-1.5">Type</th>
                      <th className="border border-gray-100 w-[4%] px-1.5 py-1.5">Recv. By</th>
                      <th className="border border-gray-100 w-[6%] px-1.5 py-1.5">Status</th>
                      <th className="border border-gray-100 w-[10%] px-1.5 py-1.5">Feedback</th>
                      <th className="border border-gray-100 w-[7%] px-1.5 py-1.5">Non-Ref.</th>
                      <th className="border border-gray-100 w-[6%] px-1.5 py-1.5">Work</th>
                      <th className="border border-gray-100 w-[9%] px-1.5 py-1.5">Amount</th>
                      <th className="border border-gray-100 w-[4%] px-1.5 py-1.5">Remark</th>
                      <th className="border border-gray-100 w-[3%] px-1.5 py-1.5">Days</th>
                      <th className="border border-gray-100 w-[96px] px-1 py-1.5 text-right">Act.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intakes.map((intake) => {
                      const firstItem = intake.items?.[0];
                      const extraItems = (intake.items?.length ?? 0) - 1;
                      const days = formatDaysUntilEstimate(intake.days_until_estimate);
                      const isExpanded = expandedIds.has(intake.id);
                      // Collapsed: single line + ellipsis, so the whole 16-column row fits one
                      // screen with no side scroll. Expanded (row click): the same cells switch
                      // to full wrapped text instead -- nothing moves to a separate panel.
                      const textCls = isExpanded ? 'whitespace-pre-wrap break-words align-top' : 'truncate';
                      return (
                        <tr
                          key={intake.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            // A stray click elsewhere while a cell's editor popover is open just
                            // closes that popover (without saving) instead of also toggling the row.
                            if (inlineEdit) { setInlineEdit(null); return; }
                            toggleExpanded(intake.id);
                          }}
                        >
                          <td className="border border-gray-100 px-1 py-1 text-center align-top">
                            <ChevronRight className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </td>
                          <td className="border border-gray-100 px-1.5 py-1 align-top">
                            {/* The receipt number is an identifier, not prose -- it never truncates. */}
                            <div className="font-mono font-semibold text-gray-900 whitespace-nowrap">{intake.receipt_number}</div>
                            <div className={`text-gray-600 ${textCls}`}>
                              {formatDMY(intake.received_at) ?? '—'}
                            </div>
                            {intake.order_id && (
                              <span className="flex items-center gap-1 text-gray-600 mt-0.5">
                                <Link2 className="w-2.5 h-2.5 text-blue-600" /> <span className="text-blue-600">{intake.order?.order_number ?? `Order #${intake.order_id}`}</span>
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-100 px-1.5 py-1 align-top">
                            <InlineCell
                              isEditing={inlineEdit?.id === intake.id && inlineEdit.field === 'customer_name'}
                              value={inlineValue}
                              onStartEdit={() => startInline(intake, 'customer_name', intake.customer_name ?? '')}
                              onChange={setInlineValue}
                              onSave={() => commitInline(intake, 'customer_name', { customer_name: inlineValue.trim() || intake.customer_name })}
                              onCancel={cancelInline}
                              width="w-56"
                              display={<div className={`font-medium text-gray-900 ${textCls}`}>{intake.customer_name}</div>}
                            />
                          </td>
                          <td className="border border-gray-100 px-1.5 py-1 align-top">
                            <InlineCell
                              isEditing={inlineEdit?.id === intake.id && inlineEdit.field === 'customer_phone'}
                              value={inlineValue}
                              onStartEdit={() => startInline(intake, 'customer_phone', intake.customer_phone ?? '')}
                              onChange={setInlineValue}
                              onSave={() => commitInline(intake, 'customer_phone', { customer_phone: inlineValue.trim() || intake.customer_phone })}
                              onCancel={cancelInline}
                              width="w-40"
                              display={<div className={`text-gray-700 ${textCls}`}>{intake.customer_phone}</div>}
                            />
                          </td>
                          <td className="border border-gray-100 px-1.5 py-1 align-top">
                            <div className={`text-gray-700 ${textCls}`}>
                              {isExpanded
                                ? (intake.items ?? []).map((i) => i.item_name).join(', ') || '—'
                                : <>{firstItem?.item_name ?? '—'}{extraItems > 0 && <span className="text-gray-500"> +{extraItems}</span>}</>}
                            </div>
                            <div className={`text-gray-600 font-mono ${textCls}`}>
                              {isExpanded
                                ? (intake.items ?? []).map((i) => i.serial_number).filter(Boolean).join(', ') || '—'
                                : (firstItem?.serial_number ?? '—')}
                            </div>
                          </td>
                          <td className={`border border-gray-100 px-1.5 py-1 text-gray-700 ${textCls}`}>
                            {isExpanded
                              ? (intake.items ?? []).map((i) => i.problem_reported).filter(Boolean).join('; ') || '—'
                              : (firstItem?.problem_reported ?? '—')}
                          </td>
                          <td className={`border border-gray-100 px-1.5 py-1 text-gray-700 ${textCls}`}>
                            {isExpanded
                              ? (intake.items ?? []).map((i) => i.problem_type?.name).filter(Boolean).join(', ') || '—'
                              : (firstItem?.problem_type?.name ?? '—')}
                          </td>
                          <td className={`border border-gray-100 px-1.5 py-1 text-gray-800 ${textCls}`}>{intake.received_by_name ?? '—'}</td>
                          <td className="border border-gray-100 px-1.5 py-1 align-top" onClick={(e) => e.stopPropagation()}>
                            {inlineEdit?.id === intake.id && inlineEdit.field === 'status' ? (
                              <select
                                autoFocus
                                className="w-full rounded border border-primary-400 bg-white px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary-500"
                                value={intake.status}
                                onChange={(e) => { handleStatusChange(intake, e.target.value); setInlineEdit(null); }}
                                onBlur={() => setInlineEdit(null)}
                              >
                                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <span onClick={() => setInlineEdit({ id: intake.id, field: 'status' })} title="Click to change">
                                <Badge variant={STATUS_BADGE[intake.status]} className="text-[10px] px-1.5 py-0 cursor-pointer">{statusLabel(intake.status)}</Badge>
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-100 px-1.5 py-1 align-top">
                            <InlineCell
                              isEditing={inlineEdit?.id === intake.id && inlineEdit.field === 'customer_feedback'}
                              value={inlineValue}
                              onStartEdit={() => startInline(intake, 'customer_feedback', intake.customer_feedback ?? '')}
                              onChange={setInlineValue}
                              onSave={() => commitInline(intake, 'customer_feedback', { customer_feedback: inlineValue.trim() || null })}
                              onCancel={cancelInline}
                              multiline
                              width="w-64"
                              display={<div className={`text-gray-700 ${textCls}`}>{intake.customer_feedback ?? '—'}</div>}
                            />
                          </td>
                          <td className="border border-gray-100 px-1.5 py-1 align-top">
                            <InlineCell
                              isEditing={inlineEdit?.id === intake.id && inlineEdit.field === 'non_refundable_amount'}
                              value={inlineValue}
                              type="number"
                              onStartEdit={() => startInline(intake, 'non_refundable_amount', intake.non_refundable_amount != null ? String(intake.non_refundable_amount) : '')}
                              onChange={setInlineValue}
                              onSave={() => commitInline(intake, 'non_refundable_amount', { non_refundable_amount: inlineValue ? num(inlineValue) : null })}
                              onCancel={cancelInline}
                              width="w-32"
                              display={intake.non_refundable_amount
                                ? <span className="font-medium text-red-700 whitespace-nowrap">{formatCurrency(num(intake.non_refundable_amount))}</span>
                                : <span className="text-gray-500">Set amount</span>}
                            />
                            <InlineCell
                              isEditing={inlineEdit?.id === intake.id && inlineEdit.field === 'non_refundable_reason'}
                              value={inlineValue}
                              onStartEdit={() => startInline(intake, 'non_refundable_reason', intake.non_refundable_reason ?? '')}
                              onChange={setInlineValue}
                              onSave={() => commitInline(intake, 'non_refundable_reason', { non_refundable_reason: inlineValue.trim() || null })}
                              onCancel={cancelInline}
                              multiline
                              width="w-56"
                              display={<div className={`text-gray-600 ${isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>{intake.non_refundable_reason || (intake.non_refundable_amount ? 'Add reason' : '—')}</div>}
                            />
                          </td>
                          <td className="border border-gray-100 px-1.5 py-1 align-top" onClick={(e) => e.stopPropagation()}>
                            {inlineEdit?.id === intake.id && inlineEdit.field === 'work_status' ? (
                              <select
                                autoFocus
                                className="w-full rounded border border-primary-400 bg-white px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary-500"
                                value={intake.work_status ?? 'pending'}
                                onChange={(e) => { handleWorkStatusChange(intake, e.target.value); setInlineEdit(null); }}
                                onBlur={() => setInlineEdit(null)}
                              >
                                {WORK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <span onClick={() => setInlineEdit({ id: intake.id, field: 'work_status' })} title="Click to change">
                                <Badge variant={WORK_STATUS_BADGE[intake.work_status ?? 'pending']} className="text-[10px] px-1.5 py-0 cursor-pointer">
                                  {WORK_STATUS_OPTIONS.find((o) => o.value === intake.work_status)?.label ?? 'Pending'}
                                </Badge>
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-100 px-1.5 py-1 align-top">
                            <InlineCell
                              isEditing={inlineEdit?.id === intake.id && inlineEdit.field === 'amount'}
                              value={inlineValue}
                              type="number"
                              onStartEdit={() => startInline(intake, 'amount', intake.amount != null ? String(intake.amount) : '')}
                              onChange={setInlineValue}
                              onSave={() => commitInline(intake, 'amount', { amount: inlineValue ? num(inlineValue) : null })}
                              onCancel={cancelInline}
                              width="w-32"
                              display={<span className="font-medium text-gray-800 whitespace-nowrap">{intake.amount ? formatCurrency(num(intake.amount)) : 'Set amount'}</span>}
                            />
                            <InlineCell
                              isEditing={inlineEdit?.id === intake.id && inlineEdit.field === 'estimated_cost'}
                              value={inlineValue}
                              type="number"
                              onStartEdit={() => startInline(intake, 'estimated_cost', intake.estimated_cost != null ? String(intake.estimated_cost) : '')}
                              onChange={setInlineValue}
                              onSave={() => commitInline(intake, 'estimated_cost', { estimated_cost: inlineValue ? num(inlineValue) : null })}
                              onCancel={cancelInline}
                              width="w-32"
                              display={intake.estimated_cost
                                ? <span className="text-gray-500 break-words">Ask: {formatCurrency(num(intake.estimated_cost))}</span>
                                : <span className="text-gray-400">+ Ask</span>}
                            />
                            <InlineCell
                              isEditing={inlineEdit?.id === intake.id && inlineEdit.field === 'commission_amount'}
                              value={inlineValue}
                              type="number"
                              onStartEdit={() => startInline(intake, 'commission_amount', intake.commission_amount != null ? String(intake.commission_amount) : '')}
                              onChange={setInlineValue}
                              onSave={() => commitInline(intake, 'commission_amount', { commission_amount: inlineValue ? num(inlineValue) : null })}
                              onCancel={cancelInline}
                              width="w-32"
                              display={intake.commission_amount
                                ? <span className="text-amber-700 break-words">Comm: {formatCurrency(num(intake.commission_amount))}</span>
                                : <span className="text-gray-400">+ Comm</span>}
                            />
                          </td>
                          <td className="border border-gray-100 px-1.5 py-1 align-top">
                            <InlineCell
                              isEditing={inlineEdit?.id === intake.id && inlineEdit.field === 'admin_notes'}
                              value={inlineValue}
                              onStartEdit={() => startInline(intake, 'admin_notes', intake.admin_notes ?? '')}
                              onChange={setInlineValue}
                              onSave={() => commitInline(intake, 'admin_notes', { admin_notes: inlineValue.trim() || null })}
                              onCancel={cancelInline}
                              multiline
                              width="w-64"
                              display={<div className={`text-gray-700 ${textCls}`}>{intake.admin_notes ?? '—'}</div>}
                            />
                          </td>
                          <td className="border border-gray-100 px-1.5 py-1 align-top">
                            <InlineCell
                              isEditing={inlineEdit?.id === intake.id && inlineEdit.field === 'expected_delivery_at'}
                              value={inlineValue}
                              type="date"
                              onStartEdit={() => startInline(intake, 'expected_delivery_at', intake.expected_delivery_at ? intake.expected_delivery_at.slice(0, 10) : '')}
                              onChange={setInlineValue}
                              onSave={() => commitInline(intake, 'expected_delivery_at', { expected_delivery_at: inlineValue || null })}
                              onCancel={cancelInline}
                              width="w-40"
                              display={<span className={days.className}>{days.label}</span>}
                            />
                          </td>
                          <td className="border border-gray-100 px-1 py-1 text-right align-top whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-nowrap items-center justify-end gap-0.5">
                              <button type="button" onClick={() => openView(intake)} title="View details" className="p-0.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 flex-shrink-0">
                                <Eye className="w-3 h-3" />
                              </button>
                              <button type="button" onClick={() => handlePreviewReceipt(intake)} title="Preview & Print Receipt" className="p-0.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 flex-shrink-0">
                                <Printer className="w-3 h-3" />
                              </button>
                              {!intake.order_id && (
                                <button type="button" onClick={() => router.push(`/service-intakes/${intake.id}/edit`)} title="Edit" className="p-0.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 flex-shrink-0">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                              <ActionsMenu
                                items={[
                                  { label: 'View History', icon: <History className="w-4 h-4 text-gray-500" />, onClick: () => setHistoryIntake(intake) },
                                  ...(!intake.order_id && !isIntakeLocked(intake.status) ? [
                                    { label: 'Convert to Order', icon: <ArrowRightCircle className="w-4 h-4 text-gray-500" />, onClick: () => openConvert(intake) },
                                  ] : []),
                                  ...(!intake.order_id ? [
                                    { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => { setSelected(intake); setIsDeleteOpen(true); }, variant: 'danger' as const },
                                  ] : []),
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex justify-end">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>

      {/* ── Manage Problem Types Modal ── */}
      <Modal isOpen={isManageTypesOpen} onClose={() => setIsManageTypesOpen(false)} title="Problem Types" size="sm">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Recovery, Repair…"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
            />
            <Button onClick={handleAddType} disabled={isSavingType || !newTypeName.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {problemTypes.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No problem types yet — add one above.</p>
            ) : (
              problemTypes.map((type) => (
                <div key={type.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5">
                  {editingTypeId === type.id ? (
                    <>
                      <Input
                        className="flex-1"
                        value={editingTypeName}
                        onChange={(e) => setEditingTypeName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameType()}
                        autoFocus
                      />
                      <button
                        onClick={handleRenameType}
                        disabled={isSavingType || !editingTypeName.trim()}
                        className="text-green-600 hover:text-green-800 disabled:opacity-40"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setEditingTypeId(null); setEditingTypeName(''); }}
                        className="text-gray-400 hover:text-gray-600"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-800">{type.name}</span>
                      {(type.items_count ?? 0) > 0 && (
                        <span className="text-xs text-gray-400">{type.items_count} in use</span>
                      )}
                      <button
                        onClick={() => startRenameType(type)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Rename"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteType(type)}
                        disabled={deletingTypeId === type.id || (type.items_count ?? 0) > 0}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400"
                        title={(type.items_count ?? 0) > 0 ? 'Cannot remove: in use by existing items' : 'Remove'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => setIsManageTypesOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* ── View Modal ── */}
      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title="Service Intake" size="xl">
        {selected && (
          <div className="space-y-6">
            {/* Header: receipt + status + all receipt-level actions in one row */}
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-gray-100">
              <div>
                <p className="font-mono font-bold text-xl text-gray-900">{selected.receipt_number}</p>
                <div className="mt-1"><Badge variant={STATUS_BADGE[selected.status]}>{statusLabel(selected.status)}</Badge></div>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <Button variant="outline" size="sm" onClick={() => handlePreviewReceipt(selected)}>
                  <Printer className="w-4 h-4 mr-1" /> Preview & Print Receipt
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownload(selected)} title="Download receipt PDF">
                  <Download className="w-4 h-4" />
                </Button>
                {selected.order_id && !isIntakeLocked(selected.status) && (
                  <Button size="sm" onClick={() => openConfirmPrice(selected)}>
                    <BadgeDollarSign className="w-4 h-4 mr-1" /> Confirm Price
                  </Button>
                )}
                {selected.order_id && (
                  <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(selected.order_id as number, selected.order?.order_number)}>
                    <Download className="w-4 h-4 mr-1" /> Invoice
                  </Button>
                )}
                {!selected.order_id && !isIntakeLocked(selected.status) && (
                  <Button size="sm" onClick={() => openConvert(selected)}>
                    <ArrowRightCircle className="w-4 h-4 mr-1" /> Convert
                  </Button>
                )}
              </div>
            </div>

            {/* At-a-glance info tiles -- one consistent grid, all in the same style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
                <p className="font-semibold text-sm mt-1">{selected.customer_name}</p>
                <p className="text-xs text-gray-600">{selected.customer_phone}</p>
                {selected.customer_email && <p className="text-xs text-gray-600">{selected.customer_email}</p>}
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Received / Expected</p>
                <p className="font-semibold text-sm mt-1">{formatDMY(selected.received_at) ?? '—'}</p>
                <p className="text-xs text-gray-600">
                  Delivery: {formatDMY(selected.expected_delivery_at) ?? '—'}
                  {(() => {
                    const days = formatDaysUntilEstimate(selected.days_until_estimate);
                    return selected.expected_delivery_at ? <span className={`ml-1 ${days.className}`}>({days.label})</span> : null;
                  })()}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Received By</p>
                <p className="font-semibold text-sm mt-1">{selected.received_by_name || '—'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Work Status</p>
                <div className="mt-1">
                  <Badge variant={WORK_STATUS_BADGE[selected.work_status ?? 'pending']}>
                    {WORK_STATUS_OPTIONS.find((o) => o.value === selected.work_status)?.label ?? 'Pending'}
                  </Badge>
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Asking Amount</p>
                <p className="font-semibold text-sm mt-1">{selected.estimated_cost ? formatCurrency(num(selected.estimated_cost)) : '—'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Confirm Amount</p>
                <p className="font-semibold text-sm mt-1">{selected.amount ? formatCurrency(num(selected.amount)) : '—'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Non-Refundable</p>
                {selected.non_refundable_amount ? (
                  <>
                    <p className="font-semibold text-sm mt-1 text-red-700">{formatCurrency(num(selected.non_refundable_amount))}</p>
                    {selected.non_refundable_reason && <p className="text-xs text-gray-600">{selected.non_refundable_reason}</p>}
                  </>
                ) : <p className="font-semibold text-sm mt-1 text-gray-400">—</p>}
              </div>
              {(selected.reference_name || selected.commission_amount) && (
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg">
                  <p className="text-xs text-amber-700 uppercase tracking-wide">Reference & Commission</p>
                  <p className="font-semibold text-sm mt-1">{selected.reference_name || '—'}</p>
                  {selected.commission_amount ? (
                    <p className="text-xs text-gray-600">{formatCurrency(num(selected.commission_amount))} commission</p>
                  ) : null}
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Items ({(selected.items ?? []).length})</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(selected.items ?? []).map((it, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-medium text-gray-900">{it.item_name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {it.status === 'converted' && <Badge variant="success">Converted</Badge>}
                        {it.status === 'returned' && <Badge variant="default">Returned</Badge>}
                        <span className="text-xs text-gray-500 whitespace-nowrap">Qty: {it.quantity}</span>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      {it.serial_number && (
                        <p className="text-gray-500 font-mono col-span-2">SL: {it.serial_number}</p>
                      )}
                      {it.problem_type?.name && (
                        <p className="text-gray-600"><span className="font-medium text-gray-700">Type:</span> {it.problem_type.name}</p>
                      )}
                      {it.estimated_price != null && num(it.estimated_price) > 0 && (
                        <p className="text-gray-700 text-right"><span className="font-medium">Est:</span> {formatCurrency(num(it.estimated_price))}</p>
                      )}
                      {it.problem_reported && (
                        <p className="text-gray-600 col-span-2"><span className="font-medium text-gray-700">Problem:</span> {it.problem_reported}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback / notes -- grouped side by side now that the modal is wide enough */}
            {(selected.notes || selected.customer_feedback || selected.admin_notes) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selected.notes && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Notes</p>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{selected.notes}</p>
                  </div>
                )}
                {selected.customer_feedback && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">User Feedback</p>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{selected.customer_feedback}</p>
                  </div>
                )}
                {selected.admin_notes && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Remark</p>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{selected.admin_notes}</p>
                  </div>
                )}
              </div>
            )}

            {selected.order_id && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Link2 className="w-4 h-4" /> Linked to order
                  <span className="font-mono font-semibold">{selected.order?.order_number ?? `#${selected.order_id}`}</span>
                </span>
                <Link href={`/orders/${selected.order_id}`} className="font-semibold underline">View order →</Link>
              </div>
            )}
            {/* Editable at any status/stage -- including cancelled/returned, since a wrong
                status is exactly the kind of thing that needs correcting after the fact. */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Update status:</span>
                <Select
                  className="w-48"
                  value={selected.status}
                  onChange={(e) => handleStatusChange(selected, e.target.value)}
                  options={STATUS_OPTIONS}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Update work status:</span>
                <Select
                  className="w-48"
                  value={selected.work_status ?? 'pending'}
                  onChange={(e) => handleWorkStatusChange(selected, e.target.value)}
                  options={WORK_STATUS_OPTIONS}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {historyIntake && (
        <HistoryModal
          isOpen={!!historyIntake}
          onClose={() => setHistoryIntake(null)}
          resourceType="ServiceIntake"
          resourceId={historyIntake.id}
          resourceLabel={historyIntake.receipt_number}
          createdBy={historyIntake.creator}
          createdAt={historyIntake.created_at}
          updatedAt={historyIntake.updated_at}
        />
      )}

      {/* ── Convert Modal ── */}
      <Modal isOpen={isConvertOpen} onClose={() => setIsConvertOpen(false)} title="Convert to Service Order" size="lg">
        {selected && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600">
              This creates a service order from receipt <span className="font-mono font-semibold">{selected.receipt_number}</span>.
              Uncheck any item the customer is taking back instead of ordering — it&apos;s left off the order and marked returned.
            </p>

            {/* Items — per-item include/exclude + price */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Items</h3>
              <div className="space-y-2">
                {convertItems.map((it, idx) => (
                  <div
                    key={it.id}
                    className={`grid grid-cols-12 gap-2 items-center rounded-lg border p-2 ${
                      it.include ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="col-span-1 flex justify-center">
                      <input
                        type="checkbox"
                        checked={it.include}
                        onChange={(e) => setConvertItem(idx, { include: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-6">
                      <p className="text-sm font-medium text-gray-800">{it.item_name}</p>
                      <p className="text-xs text-gray-500">Qty: {it.quantity}</p>
                    </div>
                    <div className="col-span-5">
                      {it.include ? (
                        <Input
                          type="number" min={0} step="0.01" placeholder="Price (required)"
                          value={it.unit_price}
                          onChange={(e) => setConvertItem(idx, { unit_price: e.target.value })}
                        />
                      ) : (
                        <p className="text-xs text-gray-500 text-right pr-1">Returned to customer</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer — pick existing or create new */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Customer</h3>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setCustomerMode('existing')}
                    className={`px-3 py-1 ${customerMode === 'existing' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    Existing customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode('new')}
                    className={`px-3 py-1 ${customerMode === 'new' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    New customer
                  </button>
                </div>
              </div>

              {customerMode === 'existing' ? (
                <SearchableSelect
                  value={convertData.customer_id}
                  onChange={(v) => setConvertData((p) => ({ ...p, customer_id: v }))}
                  placeholder="Search customer by name / phone…"
                  options={customerOptions}
                  allowClear
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input placeholder="Name *" value={convertData.customer_name} onChange={(e) => setConvertData((p) => ({ ...p, customer_name: e.target.value }))} />
                  <Input placeholder="Phone *" value={convertData.customer_phone} onChange={(e) => setConvertData((p) => ({ ...p, customer_phone: e.target.value }))} />
                  <Input placeholder="Email" type="email" value={convertData.customer_email} onChange={(e) => setConvertData((p) => ({ ...p, customer_email: e.target.value }))} />
                  <Input placeholder="Address" value={convertData.customer_address} onChange={(e) => setConvertData((p) => ({ ...p, customer_address: e.target.value }))} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input label="Tax" type="number" min={0} step="0.01" value={convertData.tax} onChange={(e) => setConvertData((p) => ({ ...p, tax: e.target.value }))} />
              <Input label="Shipping" type="number" min={0} step="0.01" value={convertData.shipping} onChange={(e) => setConvertData((p) => ({ ...p, shipping: e.target.value }))} />
              <Input label="Discount" type="number" min={0} step="0.01" value={convertData.discount} onChange={(e) => setConvertData((p) => ({ ...p, discount: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select
                label="Payment Method"
                value={convertData.payment_method}
                onChange={(e) => setConvertData((p) => ({ ...p, payment_method: e.target.value }))}
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'bkash', label: 'bKash' },
                  { value: 'nagad', label: 'Nagad' },
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                ]}
              />
              <Select
                label="Payment Status"
                value={convertData.payment_status}
                onChange={(e) => setConvertData((p) => ({ ...p, payment_status: e.target.value }))}
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'awaiting_confirmation', label: 'Awaiting Confirmation' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'failed', label: 'Failed' },
                ]}
              />
              <Select
                label="Order Status"
                value={convertData.order_status}
                onChange={(e) => setConvertData((p) => ({ ...p, order_status: e.target.value }))}
                options={[
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'accepted', label: 'Accepted' },
                  { value: 'awaiting_payment', label: 'Awaiting Payment' },
                  { value: 'completed', label: 'Completed' },
                ]}
              />
            </div>

            <Textarea label="Admin notes (optional)" rows={2} value={convertData.admin_notes} onChange={(e) => setConvertData((p) => ({ ...p, admin_notes: e.target.value }))} />

            <div className="text-right text-sm">
              Order total: <span className="font-bold text-gray-900">{formatCurrency(convertTotal)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setIsConvertOpen(false)}>Cancel</Button>
              <Button onClick={handleConvert} disabled={isSaving}>
                <RefreshCw className="w-4 h-4 mr-1" /> {isSaving ? 'Converting…' : 'Convert to Order'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Confirm Price Modal (linked order) ── */}
      <Modal isOpen={isPriceOpen} onClose={() => setIsPriceOpen(false)} title="Confirm Price" size="lg">
        {selected && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Set the final price per item after inspection. This updates the linked order
              {selected.order?.order_number ? <span className="font-mono font-semibold"> {selected.order.order_number}</span> : ''} and
              moves it to <span className="font-medium">awaiting payment</span>, ready for the invoice.
            </p>

            <div className="space-y-2">
              {priceItems.map((it, idx) => (
                <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-7">
                    <p className="text-sm font-medium text-gray-800">{it.item_name}</p>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number" min={1} value={String(it.quantity)}
                      onChange={(e) => setPriceItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantity: Number(e.target.value) || 1 } : p))}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number" min={0} step="0.01" placeholder="Price"
                      value={it.final_price}
                      onChange={(e) => setPriceItems((prev) => prev.map((p, i) => i === idx ? { ...p, final_price: e.target.value } : p))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input label="Tax" type="number" min={0} step="0.01" value={priceExtras.tax} onChange={(e) => setPriceExtras((p) => ({ ...p, tax: e.target.value }))} />
              <Input label="Shipping" type="number" min={0} step="0.01" value={priceExtras.shipping} onChange={(e) => setPriceExtras((p) => ({ ...p, shipping: e.target.value }))} />
              <Input label="Discount" type="number" min={0} step="0.01" value={priceExtras.discount} onChange={(e) => setPriceExtras((p) => ({ ...p, discount: e.target.value }))} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Select label="Payment Method" value={priceExtras.payment_method} onChange={(e) => setPriceExtras((p) => ({ ...p, payment_method: e.target.value }))}
                options={[{ value: 'cash', label: 'Cash' }, { value: 'bkash', label: 'bKash' }, { value: 'nagad', label: 'Nagad' }, { value: 'bank_transfer', label: 'Bank Transfer' }]} />
              <Select label="Payment Status" value={priceExtras.payment_status} onChange={(e) => setPriceExtras((p) => ({ ...p, payment_status: e.target.value }))}
                options={[{ value: 'pending', label: 'Pending' }, { value: 'awaiting_confirmation', label: 'Awaiting Confirmation' }, { value: 'paid', label: 'Paid' }]} />
              <Select label="Order Status" value={priceExtras.order_status} onChange={(e) => setPriceExtras((p) => ({ ...p, order_status: e.target.value }))}
                options={[{ value: 'awaiting_payment', label: 'Awaiting Payment' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }]} />
            </div>

            <div className="text-right text-sm">
              Order total: <span className="font-bold text-gray-900">{formatCurrency(priceTotal)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setIsPriceOpen(false)}>Cancel</Button>
              <Button onClick={handleConfirmPrice} disabled={isSaving}>
                <BadgeDollarSign className="w-4 h-4 mr-1" /> {isSaving ? 'Saving…' : 'Confirm Price'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm ── */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Service Intake"
        message={`Delete receipt ${selected?.receipt_number}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isSaving}
      />
    </AdminLayout>
  );
}
