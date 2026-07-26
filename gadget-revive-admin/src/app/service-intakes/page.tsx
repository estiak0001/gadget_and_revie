'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Eye, Edit2, Trash2, Printer, RefreshCw, X, ClipboardCheck, ArrowRightCircle,
  Link2, Download, BadgeDollarSign,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, Button, Input, Textarea, Select, SearchableSelect,
  Modal, Badge, LoadingSpinner, Pagination, EmptyState, ErrorState, ConfirmModal,
} from '@/components/ui';
import { ServiceIntake, ServiceIntakeStatus, BranchLocation, Order } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

interface ItemForm {
  item_name: string;
  serial_number: string;
  problem_reported: string;
  accessories: string;
  quantity: string;
  estimated_price: string;
}

interface IntakeForm {
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  branch_location_id: string;
  status: ServiceIntakeStatus;
  estimated_cost: string;
  expected_delivery_at: string;
  notes: string;
  admin_notes: string;
  items: ItemForm[];
}

const STATUS_OPTIONS: { value: ServiceIntakeStatus; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE: Record<ServiceIntakeStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  received: 'info',
  in_progress: 'warning',
  ready: 'info',
  converted: 'success',
  delivered: 'success',
  cancelled: 'danger',
};

const emptyItem = (): ItemForm => ({
  item_name: '', serial_number: '', problem_reported: '', accessories: '', quantity: '1', estimated_price: '',
});

const emptyForm = (): IntakeForm => ({
  order_id: '',
  customer_name: '', customer_phone: '', customer_email: '', customer_address: '',
  branch_location_id: '', status: 'received', estimated_cost: '', expected_delivery_at: '',
  notes: '', admin_notes: '', items: [emptyItem()],
});

const statusLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
const num = (v: unknown) => Number(v ?? 0) || 0;

export default function ServiceIntakesPage() {
  const [intakes, setIntakes] = useState<ServiceIntake[]>([]);
  const [branches, setBranches] = useState<BranchLocation[]>([]);
  const [serviceOrders, setServiceOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<ServiceIntake | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<IntakeForm>(emptyForm());

  const [convertData, setConvertData] = useState({
    payment_method: 'cash', payment_status: 'pending', order_status: 'in_progress',
  });

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
      if (searchQuery) params.search = searchQuery;
      if (filterStatus) params.status = filterStatus;
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

  const fetchServiceOrders = async () => {
    try {
      const res = await adminService.getOrders({ per_page: 100 });
      const body = res.data as unknown as { data?: Order[] };
      const list = Array.isArray(body.data) ? body.data : [];
      // Prefer orders that include a service line item; fall back to all.
      const serviceOnes = list.filter((o) => o.items?.some((it) => it.item_type === 'service'));
      setServiceOrders(serviceOnes.length > 0 ? serviceOnes : list);
    } catch {
      setServiceOrders([]);
    }
  };

  useEffect(() => { fetchBranches(); fetchServiceOrders(); }, []);
  useEffect(() => { fetchIntakes(); }, [currentPage, filterStatus]);

  const orderOptions = serviceOrders.map((o) => ({
    value: o.id,
    label: `${o.order_number} — ${o.customer_name ?? 'Customer'}${o.customer_phone ? ' (' + o.customer_phone + ')' : ''}`,
  }));

  const linkOrder = (orderId: string | number) => {
    const id = String(orderId);
    const order = serviceOrders.find((o) => String(o.id) === id);
    setForm((prev) => ({
      ...prev,
      order_id: id,
      customer_name: order?.customer_name || prev.customer_name,
      customer_phone: order?.customer_phone || prev.customer_phone,
      customer_email: order?.customer_email || prev.customer_email,
      customer_address: order?.customer_address || prev.customer_address,
    }));
  };

  const handleSearch = () => { setCurrentPage(1); fetchIntakes(); };

  // ── Form helpers ──────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setIsFormOpen(true);
  };

  const openEdit = (intake: ServiceIntake) => {
    setEditingId(intake.id);
    setForm({
      order_id: intake.order_id ? String(intake.order_id) : '',
      customer_name: intake.customer_name ?? '',
      customer_phone: intake.customer_phone ?? '',
      customer_email: intake.customer_email ?? '',
      customer_address: intake.customer_address ?? '',
      branch_location_id: intake.branch_location_id ? String(intake.branch_location_id) : '',
      status: intake.status,
      estimated_cost: intake.estimated_cost != null ? String(intake.estimated_cost) : '',
      expected_delivery_at: intake.expected_delivery_at ? intake.expected_delivery_at.slice(0, 10) : '',
      notes: intake.notes ?? '',
      admin_notes: intake.admin_notes ?? '',
      items: (intake.items && intake.items.length > 0)
        ? intake.items.map((i) => ({
            item_name: i.item_name ?? '',
            serial_number: i.serial_number ?? '',
            problem_reported: i.problem_reported ?? '',
            accessories: i.accessories ?? '',
            quantity: String(i.quantity ?? 1),
            estimated_price: i.estimated_price != null ? String(i.estimated_price) : '',
          }))
        : [emptyItem()],
    });
    setIsFormOpen(true);
  };

  const setField = <K extends keyof IntakeForm>(key: K, value: IntakeForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setItemField = (idx: number, key: keyof ItemForm, value: string) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)),
    }));

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  const removeItem = (idx: number) =>
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const itemsTotal = form.items.reduce(
    (sum, it) => sum + num(it.estimated_price) * (num(it.quantity) || 1), 0,
  );

  const handleSave = async () => {
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      toast.error('Customer name and phone are required.');
      return;
    }
    if (form.items.length === 0 || form.items.some((i) => !i.item_name.trim())) {
      toast.error('Each item needs a name.');
      return;
    }
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        order_id: form.order_id ? Number(form.order_id) : null,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email || null,
        customer_address: form.customer_address || null,
        branch_location_id: form.branch_location_id ? Number(form.branch_location_id) : null,
        status: form.status,
        estimated_cost: form.estimated_cost ? num(form.estimated_cost) : null,
        expected_delivery_at: form.expected_delivery_at || null,
        notes: form.notes || null,
        admin_notes: form.admin_notes || null,
        items: form.items.map((i) => ({
          item_name: i.item_name,
          serial_number: i.serial_number || null,
          problem_reported: i.problem_reported || null,
          accessories: i.accessories || null,
          quantity: num(i.quantity) || 1,
          estimated_price: i.estimated_price ? num(i.estimated_price) : null,
        })),
      };
      if (editingId) {
        await adminService.updateServiceIntake(editingId, payload);
        toast.success('Service intake updated.');
      } else {
        await adminService.createServiceIntake(payload);
        toast.success('Service intake created.');
      }
      setIsFormOpen(false);
      fetchIntakes();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
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

  const handleStatusChange = async (intake: ServiceIntake, status: string) => {
    try {
      await adminService.updateServiceIntakeStatus(intake.id, status);
      toast.success('Status updated.');
      setSelected((prev) => (prev ? { ...prev, status: status as ServiceIntakeStatus } : prev));
      fetchIntakes();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const openConvert = (intake: ServiceIntake) => {
    setSelected(intake);
    setConvertData({ payment_method: 'cash', payment_status: 'pending', order_status: 'in_progress' });
    setIsConvertOpen(true);
  };

  const handleConvert = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      await adminService.convertServiceIntake(selected.id, convertData);
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
      <div className="space-y-6">
        <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-title">Service Intakes</h1>
            <p className="page-description">Receive a device, issue a receipt, then convert it into a service order</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> New Intake
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Search by receipt no, name or phone…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="outline" onClick={handleSearch}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              <Select
                className="md:w-56"
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                placeholder="All statuses"
                options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS, { value: 'converted', label: 'Converted' }]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-gray-500 uppercase text-xs tracking-wide">
                      <th className="px-4 py-3">Receipt No</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3">Received</th>
                      <th className="px-4 py-3">Est. Cost</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {intakes.map((intake) => (
                      <tr key={intake.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                          {intake.receipt_number}
                          {intake.order_id && (
                            <span className="flex items-center gap-1 text-[11px] font-sans font-normal text-blue-600 mt-0.5">
                              <Link2 className="w-3 h-3" /> {intake.order?.order_number ?? `Order #${intake.order_id}`}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{intake.customer_name}</div>
                          <div className="text-gray-500 text-xs">{intake.customer_phone}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {intake.items?.[0]?.item_name ?? '—'}
                          {(intake.items?.length ?? 0) > 1 && (
                            <span className="text-gray-400"> +{(intake.items!.length - 1)} more</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {intake.received_at ? new Date(intake.received_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {intake.estimated_cost ? formatCurrency(num(intake.estimated_cost)) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE[intake.status]}>{statusLabel(intake.status)}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button title="View" onClick={() => openView(intake)} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button title="Preview & print receipt" onClick={() => handlePreviewReceipt(intake)} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
                              <Printer className="w-4 h-4" />
                            </button>
                            {!intake.order_id && intake.status !== 'cancelled' && (
                              <button title="Edit" onClick={() => openEdit(intake)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {!intake.order_id && intake.status !== 'cancelled' && (
                              <button title="Convert to order" onClick={() => openConvert(intake)} className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg">
                                <ArrowRightCircle className="w-4 h-4" />
                              </button>
                            )}
                            {!intake.order_id && (
                              <button title="Delete" onClick={() => { setSelected(intake); setIsDeleteOpen(true); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingId ? 'Edit Service Intake' : 'New Service Intake'} size="xl">
        <div className="space-y-5">
          {/* Link to an existing service order (customer ordered online, then came in) */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <SearchableSelect
              label="Link to Service Order (optional)"
              value={form.order_id}
              onChange={(v) => linkOrder(v)}
              placeholder="Search order number / customer…"
              options={[{ value: '', label: '— Walk-in (no prior order) —' }, ...orderOptions]}
            />
            <p className="mt-1 text-xs text-gray-500">
              Linking pulls in the customer&apos;s details. The price is confirmed later, after the device is inspected.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Customer</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Name *" value={form.customer_name} onChange={(e) => setField('customer_name', e.target.value)} />
              <Input label="Phone *" value={form.customer_phone} onChange={(e) => setField('customer_phone', e.target.value)} />
              <Input label="Email" type="email" value={form.customer_email} onChange={(e) => setField('customer_email', e.target.value)} />
              <Input label="Address" value={form.customer_address} onChange={(e) => setField('customer_address', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              label="Branch / Location"
              value={form.branch_location_id}
              onChange={(e) => setField('branch_location_id', e.target.value)}
              placeholder="Select branch"
              options={[{ value: '', label: '— None —' }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setField('status', e.target.value as ServiceIntakeStatus)}
              options={STATUS_OPTIONS}
            />
            <Input label="Expected Delivery" type="date" value={form.expected_delivery_at} onChange={(e) => setField('expected_delivery_at', e.target.value)} />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Received Items</h3>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" /> Add item
              </Button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500">Item #{idx + 1}</span>
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input placeholder="Item / device name *" value={item.item_name} onChange={(e) => setItemField(idx, 'item_name', e.target.value)} />
                    <Input placeholder="Serial number" value={item.serial_number} onChange={(e) => setItemField(idx, 'serial_number', e.target.value)} />
                  </div>
                  <div className="mt-3">
                    <Textarea placeholder="Problem reported" rows={2} value={item.problem_reported} onChange={(e) => setItemField(idx, 'problem_reported', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <Input placeholder="Accessories" value={item.accessories} onChange={(e) => setItemField(idx, 'accessories', e.target.value)} />
                    <Input type="number" min={1} placeholder="Qty" value={item.quantity} onChange={(e) => setItemField(idx, 'quantity', e.target.value)} />
                    <Input type="number" min={0} step="0.01" placeholder="Est. price (BDT)" value={item.estimated_price} onChange={(e) => setItemField(idx, 'estimated_price', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
            {itemsTotal > 0 && (
              <p className="text-right text-sm text-gray-600 mt-2">
                Items estimate: <span className="font-semibold text-gray-900">{formatCurrency(itemsTotal)}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Overall Estimated Cost (optional)" type="number" min={0} step="0.01" value={form.estimated_cost} onChange={(e) => setField('estimated_cost', e.target.value)} />
          </div>
          <Textarea label="Notes (shown on receipt)" rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          <Textarea label="Internal admin notes" rows={2} value={form.admin_notes} onChange={(e) => setField('admin_notes', e.target.value)} />

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : editingId ? 'Update Intake' : 'Create Intake'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── View Modal ── */}
      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title="Service Intake" size="lg">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono font-bold text-lg text-gray-900">{selected.receipt_number}</p>
                <Badge variant={STATUS_BADGE[selected.status]}>{statusLabel(selected.status)}</Badge>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <Button variant="outline" size="sm" onClick={() => handlePreviewReceipt(selected)}>
                  <Printer className="w-4 h-4 mr-1" /> Preview & Print Receipt
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownload(selected)} title="Download receipt PDF">
                  <Download className="w-4 h-4" />
                </Button>
                {selected.order_id && selected.status !== 'cancelled' && (
                  <Button size="sm" onClick={() => openConfirmPrice(selected)}>
                    <BadgeDollarSign className="w-4 h-4 mr-1" /> Confirm Price
                  </Button>
                )}
                {selected.order_id && (
                  <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(selected.order_id as number, selected.order?.order_number)}>
                    <Download className="w-4 h-4 mr-1" /> Invoice
                  </Button>
                )}
                {!selected.order_id && selected.status !== 'cancelled' && (
                  <Button size="sm" onClick={() => openConvert(selected)}>
                    <ArrowRightCircle className="w-4 h-4 mr-1" /> Convert
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Customer</p>
                <p className="font-semibold text-sm">{selected.customer_name}</p>
                <p className="text-xs text-gray-500">{selected.customer_phone}</p>
                {selected.customer_email && <p className="text-xs text-gray-500">{selected.customer_email}</p>}
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Received / Expected</p>
                <p className="font-semibold text-sm">{selected.received_at ? new Date(selected.received_at).toLocaleDateString() : '—'}</p>
                <p className="text-xs text-gray-500">
                  Delivery: {selected.expected_delivery_at ? new Date(selected.expected_delivery_at).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Items</p>
              <div className="space-y-2">
                {(selected.items ?? []).map((it, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-900">{it.item_name}</span>
                      <span className="text-sm text-gray-600">Qty: {it.quantity}</span>
                    </div>
                    {it.serial_number && <p className="text-xs text-gray-500 font-mono">SL: {it.serial_number}</p>}
                    {it.problem_reported && <p className="text-xs text-gray-600 mt-1"><span className="font-medium">Problem:</span> {it.problem_reported}</p>}
                    {it.estimated_price != null && num(it.estimated_price) > 0 && (
                      <p className="text-xs text-gray-700 mt-1">Est: {formatCurrency(num(it.estimated_price))}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selected.notes && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Notes</p>
                <p className="text-sm text-gray-700">{selected.notes}</p>
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
            {selected.status !== 'cancelled' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Update status:</span>
                <Select
                  className="w-48"
                  value={selected.status}
                  onChange={(e) => handleStatusChange(selected, e.target.value)}
                  options={STATUS_OPTIONS}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Convert Modal ── */}
      <Modal isOpen={isConvertOpen} onClose={() => setIsConvertOpen(false)} title="Convert to Service Order" size="md">
        {selected && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This creates a service order from receipt <span className="font-mono font-semibold">{selected.receipt_number}</span>,
              carrying over the items and their estimated prices.
            </p>
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
