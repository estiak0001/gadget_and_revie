'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Check, Settings, ArrowLeft, Edit2, Trash2, Users, ClipboardList, Wrench, BadgeDollarSign, StickyNote } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Input, Textarea, Select, Modal, Badge, LoadingSpinner } from '@/components/ui';
import { ServiceIntakeStatus, ServiceIntakeWorkStatus, ServiceProblemType, BranchLocation, Order, User, Supplier } from '@/types';
import { formatCurrency, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';

interface ItemForm {
  item_name: string;
  serial_number: string;
  problem_reported: string;
  problem_type_id: string;
  accessories: string;
  quantity: string;
  estimated_price: string;
}

interface IntakeForm {
  order_id: string;
  // Set only when the customer name/phone was picked from the existing-customer suggestions.
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  branch_location_id: string;
  received_by_name: string;
  status: ServiceIntakeStatus;
  work_status: ServiceIntakeWorkStatus;
  estimated_cost: string;
  amount: string;
  non_refundable_amount: string;
  non_refundable_reason: string;
  reference_name: string;
  commission_amount: string;
  expected_delivery_at: string;
  notes: string;
  admin_notes: string;
  customer_feedback: string;
  items: ItemForm[];
}

const STATUS_OPTIONS: { value: ServiceIntakeStatus; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
];

const WORK_STATUS_OPTIONS: { value: ServiceIntakeWorkStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'wait_for_feedback', label: 'Wait for Feedback' },
  { value: 'done', label: 'Done' },
];

const emptyItem = (): ItemForm => ({
  item_name: '', serial_number: '', problem_reported: '', problem_type_id: '', accessories: '', quantity: '1', estimated_price: '',
});

const emptyForm = (): IntakeForm => ({
  order_id: '',
  customer_id: '',
  customer_name: '', customer_phone: '', customer_email: '', customer_address: '',
  branch_location_id: '', received_by_name: '',
  status: 'received', work_status: 'pending',
  estimated_cost: '', amount: '', non_refundable_amount: '', non_refundable_reason: '',
  reference_name: '', commission_amount: '', expected_delivery_at: '',
  notes: '', admin_notes: '', customer_feedback: '', items: [emptyItem()],
});

const num = (v: unknown) => Number(v ?? 0) || 0;

// Shared by the New and Edit service-intake pages -- one form, two entry points.
export default function ServiceIntakeFormPage({ intakeId }: { intakeId?: number }) {
  const router = useRouter();
  const isEdit = intakeId != null;
  const [loadingIntake, setLoadingIntake] = useState(isEdit);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
  const currentUser = useAuthStore((s) => s.user);

  const [form, setForm] = useState<IntakeForm>(emptyForm());
  const [branches, setBranches] = useState<BranchLocation[]>([]);
  const [serviceOrders, setServiceOrders] = useState<Order[]>([]);
  const [problemTypes, setProblemTypes] = useState<ServiceProblemType[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [previewReceiptNumber, setPreviewReceiptNumber] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Which customer field (if any) is currently showing existing-customer suggestions.
  const [customerSuggestField, setCustomerSuggestField] = useState<'name' | 'phone' | null>(null);
  const [orderLinkQuery, setOrderLinkQuery] = useState('');
  const [showOrderSuggestions, setShowOrderSuggestions] = useState(false);
  // Referrers are kept as suppliers, so the Referred by field can suggest them next time.
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [referrerFocus, setReferrerFocus] = useState(false);
  const [saveReferrer, setSaveReferrer] = useState(true);
  const [referrerPhone, setReferrerPhone] = useState('');

  // Manage-problem-types modal (add / rename / delete the dropdown options themselves).
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isSavingType, setIsSavingType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [deletingTypeId, setDeletingTypeId] = useState<number | null>(null);

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

  const fetchCustomers = async () => {
    try {
      const res = await adminService.getCustomers({ per_page: 200 });
      const body = res.data as unknown as { data?: User[] };
      setCustomers(Array.isArray(body.data) ? body.data : []);
    } catch {
      setCustomers([]);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await adminService.getSuppliers({ per_page: 200 });
      const body = res.data as unknown as { data?: Supplier[] };
      setSuppliers(Array.isArray(body.data) ? body.data : []);
    } catch {
      setSuppliers([]);
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

  useEffect(() => {
    fetchBranches();
    fetchServiceOrders();
    fetchCustomers();
    fetchProblemTypes();
    fetchSuppliers();
    if (!isEdit) {
      adminService.getNextReceiptNumber()
        .then((res) => setPreviewReceiptNumber(res.data.data.next_receipt_number))
        .catch(() => {}); // Just a preview -- silently skip it if this one call fails.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Edit: fill the form from the saved intake.
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await adminService.getServiceIntake(intakeId!);
        const intake = res.data.data;
        setReceiptNumber(intake.receipt_number ?? null);
        setForm({
          order_id: intake.order_id ? String(intake.order_id) : '',
          customer_id: intake.customer_id ? String(intake.customer_id) : '',
          customer_name: intake.customer_name ?? '',
          customer_phone: intake.customer_phone ?? '',
          customer_email: intake.customer_email ?? '',
          customer_address: intake.customer_address ?? '',
          branch_location_id: intake.branch_location_id ? String(intake.branch_location_id) : '',
          received_by_name: intake.received_by_name ?? '',
          status: intake.status,
          work_status: intake.work_status ?? 'pending',
          estimated_cost: intake.estimated_cost != null ? String(intake.estimated_cost) : '',
          amount: intake.amount != null ? String(intake.amount) : '',
          non_refundable_amount: intake.non_refundable_amount != null ? String(intake.non_refundable_amount) : '',
          non_refundable_reason: intake.non_refundable_reason ?? '',
          reference_name: intake.reference_name ?? '',
          commission_amount: intake.commission_amount != null ? String(intake.commission_amount) : '',
          expected_delivery_at: intake.expected_delivery_at ? intake.expected_delivery_at.slice(0, 10) : '',
          notes: intake.notes ?? '',
          admin_notes: intake.admin_notes ?? '',
          customer_feedback: intake.customer_feedback ?? '',
          items: (intake.items && intake.items.length > 0)
            ? intake.items.map((i) => ({
                item_name: i.item_name ?? '',
                serial_number: i.serial_number ?? '',
                problem_reported: i.problem_reported ?? '',
                problem_type_id: i.problem_type_id != null ? String(i.problem_type_id) : '',
                accessories: i.accessories ?? '',
                quantity: String(i.quantity ?? 1),
                estimated_price: i.estimated_price != null ? String(i.estimated_price) : '',
              }))
            : [emptyItem()],
        });
        setOrderLinkQuery(intake.order ? orderLinkLabel(intake.order) : '');
      } catch (err) {
        toast.error(getErrorMessage(err));
        router.push('/service-intakes');
      } finally {
        setLoadingIntake(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeId]);

  // Defaults applied once branches and the logged-in user are known: whoever's at the desk
  // receives the device, and a single branch needs no picking.
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      received_by_name: prev.received_by_name || currentUser?.name || '',
      branch_location_id: prev.branch_location_id || (branches.length === 1 ? String(branches[0].id) : ''),
    }));
  }, [currentUser, branches]);

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

  // Existing-customer suggestions while typing in the Name/Phone fields.
  const customerSuggestions = (() => {
    if (!customerSuggestField) return [];
    const query = (customerSuggestField === 'name' ? form.customer_name : form.customer_phone).trim().toLowerCase();
    if (query.length < 2) return [];
    return customers
      .filter((c) => (c.name || '').toLowerCase().includes(query) || (c.phone || '').toLowerCase().includes(query))
      .slice(0, 6);
  })();

  const selectCustomerSuggestion = (c: User) => {
    setForm((prev) => ({
      ...prev,
      customer_id: String(c.id),
      customer_name: c.name || prev.customer_name,
      customer_phone: c.phone || prev.customer_phone,
      customer_email: c.email || prev.customer_email,
    }));
    setCustomerSuggestField(null);
  };

  const orderLinkLabel = (o: Order) => `${o.order_number} — ${o.customer_name ?? 'Customer'}${o.customer_phone ? ' (' + o.customer_phone + ')' : ''}`;

  const linkOrder = (orderId: string | number) => {
    const id = String(orderId);
    const order = serviceOrders.find((o) => String(o.id) === id);
    setForm((prev) => ({
      ...prev,
      order_id: id,
      customer_id: order?.customer_id ? String(order.customer_id) : prev.customer_id,
      customer_name: order?.customer_name || prev.customer_name,
      customer_phone: order?.customer_phone || prev.customer_phone,
      customer_email: order?.customer_email || prev.customer_email,
      customer_address: order?.customer_address || prev.customer_address,
    }));
    if (order) setOrderLinkQuery(orderLinkLabel(order));
    setShowOrderSuggestions(false);
  };

  // Free-typed order search -- not finding anything just leaves it a walk-in.
  const orderLinkSuggestions = (() => {
    if (!showOrderSuggestions) return [];
    const query = orderLinkQuery.trim().toLowerCase();
    if (query.length < 1) return [];
    return serviceOrders
      .filter((o) =>
        o.order_number.toLowerCase().includes(query) ||
        (o.customer_name ?? '').toLowerCase().includes(query) ||
        (o.customer_phone ?? '').toLowerCase().includes(query))
      .slice(0, 8);
  })();

  const referrerName = form.reference_name.trim();
  const isNewReferrer = referrerName !== '' && !suppliers.some((sup) => sup.name.trim().toLowerCase() === referrerName.toLowerCase());
  const referrerSuggestions = (() => {
    const q = referrerName.toLowerCase();
    return suppliers
      .filter((sup) => q === '' || sup.name.toLowerCase().includes(q))
      .slice(0, 8);
  })();

  // ── Problem types ──
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
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email || null,
        customer_address: form.customer_address || null,
        branch_location_id: form.branch_location_id ? Number(form.branch_location_id) : null,
        // received_by_name is not sent -- it's fixed server-side to whoever is logged in.
        status: form.status,
        work_status: form.work_status,
        estimated_cost: form.estimated_cost ? num(form.estimated_cost) : null,
        amount: form.amount ? num(form.amount) : null,
        non_refundable_amount: form.non_refundable_amount ? num(form.non_refundable_amount) : null,
        non_refundable_reason: form.non_refundable_reason || null,
        reference_name: form.reference_name || null,
        commission_amount: form.commission_amount ? num(form.commission_amount) : null,
        expected_delivery_at: form.expected_delivery_at || null,
        notes: form.notes || null,
        admin_notes: form.admin_notes || null,
        customer_feedback: form.customer_feedback || null,
        items: form.items.map((i) => ({
          item_name: i.item_name,
          serial_number: i.serial_number || null,
          problem_reported: i.problem_reported || null,
          problem_type_id: i.problem_type_id ? Number(i.problem_type_id) : null,
          accessories: i.accessories || null,
          quantity: num(i.quantity) || 1,
          estimated_price: i.estimated_price ? num(i.estimated_price) : null,
        })),
      };
      if (isEdit) {
        await adminService.updateServiceIntake(intakeId!, payload);
        toast.success('Service intake updated.');
        router.push('/service-intakes');
        return;
      }
      await adminService.createServiceIntake(payload);
      if (referrerName && isNewReferrer && saveReferrer) {
        try {
          await adminService.createSupplier({ name: referrerName, phone: referrerPhone.trim() || null, is_active: true });
        } catch {
          toast.error('Intake saved, but the referrer could not be saved as a supplier.');
        }
      }
      toast.success('Service intake created.');
      router.push('/service-intakes');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const saveButtonLabel = isSaving ? 'Saving…' : isEdit ? 'Update Intake' : 'Create Intake';

  if (loadingIntake) {
    return (
      <AdminLayout>
        <div className="py-16 flex justify-center"><LoadingSpinner /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Compact header: title + preview + actions on one line */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push('/service-intakes')} title="Back to service intakes">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-bold text-gray-900 truncate">{isEdit ? 'Edit Service Intake' : 'New Service Intake'}</h1>
          {isEdit && receiptNumber && (
            <Badge variant="info" className="whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-sm font-bold">{receiptNumber}</Badge>
          )}
          {!isEdit && previewReceiptNumber && (
            <span title="Preview only -- assigned for real once this is saved">
              <Badge variant="info" className="whitespace-nowrap rounded-md border border-violet-300 bg-gradient-to-r from-violet-600 to-indigo-600 px-2.5 py-1 font-mono text-sm font-bold text-white shadow-sm">Next: {previewReceiptNumber}</Badge>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/service-intakes')}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>{saveButtonLabel}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Customer — blue */}
        <FormSection tone="blue" icon={Users} title="Customer" className="lg:col-span-2"
          right={
            <div className="relative w-full sm:w-72">
              <Input
                value={orderLinkQuery}
                onChange={(e) => {
                  setOrderLinkQuery(e.target.value);
                  if (form.order_id) setField('order_id', '');
                }}
                onFocus={() => setShowOrderSuggestions(true)}
                onBlur={() => setShowOrderSuggestions(false)}
                autoComplete="off"
                placeholder="Link existing order (optional)…"
                className="h-8 text-sm"
              />
              {showOrderSuggestions && orderLinkSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                  {orderLinkSuggestions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => linkOrder(o.id)}
                      className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-blue-50"
                    >
                      <span className="font-medium text-gray-900">{o.order_number}</span>
                      <span className="text-xs text-gray-500">{o.customer_name}{o.customer_phone ? ` — ${o.customer_phone}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            <div className="relative">
              <Input
                label="Name *"
                value={form.customer_name}
                onChange={(e) => { setField('customer_name', e.target.value); if (form.customer_id) setField('customer_id', ''); }}
                onFocus={() => setCustomerSuggestField('name')}
                onBlur={() => setCustomerSuggestField(null)}
                autoComplete="off"
                className="h-8 text-sm"
              />
              {customerSuggestField === 'name' && customerSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                  {customerSuggestions.map((c) => (
                    <button key={c.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selectCustomerSuggestion(c)}
                      className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-blue-50">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className="text-xs text-gray-500">{c.phone}{c.email ? ` — ${c.email}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <Input
                label="Phone *"
                value={form.customer_phone}
                onChange={(e) => { setField('customer_phone', e.target.value); if (form.customer_id) setField('customer_id', ''); }}
                onFocus={() => setCustomerSuggestField('phone')}
                onBlur={() => setCustomerSuggestField(null)}
                autoComplete="off"
                className="h-8 text-sm"
              />
              {customerSuggestField === 'phone' && customerSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                  {customerSuggestions.map((c) => (
                    <button key={c.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selectCustomerSuggestion(c)}
                      className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-blue-50">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className="text-xs text-gray-500">{c.phone}{c.email ? ` — ${c.email}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input label="Email" type="email" value={form.customer_email} onChange={(e) => setField('customer_email', e.target.value)} className="h-8 text-sm" />
            <Input label="Address" value={form.customer_address} onChange={(e) => setField('customer_address', e.target.value)} className="h-8 text-sm" />
          </div>
          {(form.customer_id || form.order_id) && (
            <p className="mt-1.5 text-xs text-blue-700 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {form.order_id ? 'Linked to an existing order — customer details pulled in.' : 'Linked to an existing customer record.'}
            </p>
          )}
        </FormSection>

        {/* Intake details — indigo */}
        <FormSection tone="indigo" icon={ClipboardList} title="Intake details">
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Branch"
              value={form.branch_location_id}
              onChange={(e) => setField('branch_location_id', e.target.value)}
              placeholder="Select branch"
              options={[{ value: '', label: '— None —' }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
              className="h-8 text-sm"
            />
            <Input
              label="Received by"
              value={form.received_by_name || currentUser?.name || '—'}
              disabled
              title="Set automatically to whoever is logged in creating this intake -- not editable."
              className="h-8 text-sm"
            />
            <Select label="Status" value={form.status}
              onChange={(e) => setField('status', e.target.value as ServiceIntakeStatus)}
              options={STATUS_OPTIONS} className="h-8 text-sm" />
            <Select label="Work status" value={form.work_status}
              onChange={(e) => setField('work_status', e.target.value as ServiceIntakeWorkStatus)}
              options={WORK_STATUS_OPTIONS} className="h-8 text-sm" />
            <div className="col-span-2">
              <Input label="Expected delivery" type="date" value={form.expected_delivery_at}
                onChange={(e) => setField('expected_delivery_at', e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </FormSection>

        {/* Received items — emerald, full width, one compact row per item */}
        <FormSection tone="emerald" icon={Wrench} title="Received items" className="lg:col-span-3"
          right={
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setIsManageTypesOpen(true)} title="Add, rename or remove problem types">
                <Settings className="w-3.5 h-3.5 mr-1" /> Problem types
              </Button>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add item
              </Button>
            </div>
          }
        >
          <div className="hidden md:grid grid-cols-12 gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            <span className="col-span-3">Item / device *</span>
            <span className="col-span-2">Serial no.</span>
            <span className="col-span-2">Problem type</span>
            <span className="col-span-3">Problem reported</span>
            <span className="col-span-1">Qty</span>
            <span className="col-span-1 text-right">Est. (BDT)</span>
          </div>
          <div className="space-y-1.5">
            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-lg border border-emerald-200 bg-white p-2">
                <div className="md:col-span-3 flex items-center gap-1.5">
                  <span className="hidden md:inline text-[11px] font-semibold text-emerald-600 w-4">{idx + 1}</span>
                  <Input placeholder="Item / device name *" value={item.item_name} onChange={(e) => setItemField(idx, 'item_name', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <Input placeholder="Serial number" value={item.serial_number} onChange={(e) => setItemField(idx, 'serial_number', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <Select
                    placeholder="Problem type"
                    value={item.problem_type_id}
                    onChange={(e) => setItemField(idx, 'problem_type_id', e.target.value)}
                    options={[{ value: '', label: '— None —' }, ...problemTypes.map((t) => ({ value: t.id, label: t.name }))]}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <Input placeholder="Problem reported" value={item.problem_reported} onChange={(e) => setItemField(idx, 'problem_reported', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="md:col-span-1">
                  <Input type="number" min={1} placeholder="Qty" value={item.quantity} onChange={(e) => setItemField(idx, 'quantity', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="md:col-span-1 flex items-center gap-1">
                  <Input type="number" min={0} step="0.01" placeholder="Est." value={item.estimated_price} onChange={(e) => setItemField(idx, 'estimated_price', e.target.value)} className="h-8 text-sm" />
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-600 shrink-0" title="Remove item">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="md:col-span-12">
                  <Input placeholder="Accessories (charger, bag, SIM…)" value={item.accessories} onChange={(e) => setItemField(idx, 'accessories', e.target.value)} className="h-7 text-xs" />
                </div>
              </div>
            ))}
          </div>
          {itemsTotal > 0 && (
            <p className="text-right text-sm text-gray-600 mt-2">
              Items estimate: <span className="font-semibold text-emerald-800">{formatCurrency(itemsTotal)}</span>
            </p>
          )}
        </FormSection>

        {/* Amounts — amber */}
        <FormSection tone="amber" icon={BadgeDollarSign} title="Amount & commission" className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* Price — the agreed numbers */}
            <div className="rounded-lg border border-amber-200 bg-white p-2.5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">Price</p>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Asking amount" type="number" min={0} step="0.01" value={form.estimated_cost} onChange={(e) => setField('estimated_cost', e.target.value)} placeholder="Before inspection" className="h-8 text-sm" />
                <Input label="Confirm amount" type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setField('amount', e.target.value)} placeholder="Final agreed" className="h-8 text-sm" />
              </div>
            </div>

            {/* Non-refundable — a big box, so the reason has room to be written */}
            <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/60 p-2.5 md:row-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Non-refundable</p>
              <Input label="Amount (part of the price above)" type="number" min={0} step="0.01" value={form.non_refundable_amount} onChange={(e) => setField('non_refundable_amount', e.target.value)} placeholder="0.00" className="h-8 text-sm bg-white" />
              <Textarea
                label="Reason"
                rows={6}
                value={form.non_refundable_reason}
                onChange={(e) => setField('non_refundable_reason', e.target.value)}
                placeholder="Why is this part non-refundable? e.g. Inspection / diagnostic fee already incurred, parts already ordered…"
                className="text-sm bg-white"
              />
            </div>

            {/* Referral & commission — only when a referrer is owed a cut */}
            <div className="rounded-lg border border-teal-200 bg-white p-2.5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-teal-700">Referral &amp; commission</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="relative">
                    <Input
                      label="Referred by"
                      value={form.reference_name}
                      onChange={(e) => setField('reference_name', e.target.value)}
                      onFocus={() => setReferrerFocus(true)}
                      onBlur={() => setReferrerFocus(false)}
                      autoComplete="off"
                      placeholder="Referrer name"
                      className="h-8 text-sm"
                    />
                    {referrerFocus && referrerSuggestions.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                        {referrerSuggestions.map((sup) => (
                          <button
                            key={sup.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setField('reference_name', sup.name); setReferrerPhone(sup.phone ?? ''); setReferrerFocus(false); }}
                            className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-teal-50"
                          >
                            <span className="font-medium text-gray-900">{sup.name}</span>
                            {sup.phone && <span className="text-xs text-gray-500">{sup.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {isNewReferrer && (
                    <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11px] text-teal-800">
                      <input
                        type="checkbox"
                        checked={saveReferrer}
                        onChange={(e) => setSaveReferrer(e.target.checked)}
                        className="rounded border-teal-300 text-teal-600"
                      />
                      Save as supplier so it&apos;s suggested next time
                    </label>
                  )}
                </div>
                <Input label="Referrer mobile" value={referrerPhone} onChange={(e) => setReferrerPhone(e.target.value)} placeholder="01XXXXXXXXX" className="h-8 text-sm" />
                <div className="col-span-2">
                  <Input label="Commission" type="number" min={0} step="0.01" value={form.commission_amount} onChange={(e) => setField('commission_amount', e.target.value)} placeholder="0.00" className="h-8 text-sm" />
                </div>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Notes — violet */}
        <FormSection tone="violet" icon={StickyNote} title="Notes">
          <div className="space-y-2">
            <Textarea placeholder="Notes (shown on receipt)" rows={1} value={form.notes} onChange={(e) => setField('notes', e.target.value)} className="text-sm" />
            <Textarea placeholder="User feedback" rows={1} value={form.customer_feedback} onChange={(e) => setField('customer_feedback', e.target.value)} className="text-sm" />
            <Textarea placeholder="Internal remark" rows={1} value={form.admin_notes} onChange={(e) => setField('admin_notes', e.target.value)} className="text-sm" />
          </div>
        </FormSection>
      </div>

      <div className="flex justify-end gap-2 mt-3">
        <Button variant="outline" size="sm" onClick={() => router.push('/service-intakes')}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>{saveButtonLabel}</Button>
      </div>

      {/* Manage Problem Types */}
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
                      <button onClick={handleRenameType} disabled={isSavingType || !editingTypeName.trim()} className="text-green-600 hover:text-green-800 disabled:opacity-40" title="Save">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditingTypeId(null); setEditingTypeName(''); }} className="text-gray-400 hover:text-gray-600" title="Cancel">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-800">{type.name}</span>
                      {(type.items_count ?? 0) > 0 && <span className="text-xs text-gray-400">{type.items_count} in use</span>}
                      <button onClick={() => { setEditingTypeId(type.id); setEditingTypeName(type.name); }} className="text-gray-400 hover:text-blue-600" title="Rename">
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
    </AdminLayout>
  );
}

const FORM_TONES = {
  blue: { card: 'border-blue-200 bg-blue-50/40', head: 'bg-blue-100/70 text-blue-900 border-blue-200', icon: 'text-blue-600' },
  indigo: { card: 'border-indigo-200 bg-indigo-50/40', head: 'bg-indigo-100/70 text-indigo-900 border-indigo-200', icon: 'text-indigo-600' },
  emerald: { card: 'border-emerald-200 bg-emerald-50/40', head: 'bg-emerald-100/70 text-emerald-900 border-emerald-200', icon: 'text-emerald-600' },
  amber: { card: 'border-amber-200 bg-amber-50/40', head: 'bg-amber-100/70 text-amber-900 border-amber-200', icon: 'text-amber-600' },
  violet: { card: 'border-violet-200 bg-violet-50/40', head: 'bg-violet-100/70 text-violet-900 border-violet-200', icon: 'text-violet-600' },
} as const;

// One colored, compact card per topic on the create page -- tone gives each section its own
// color so they read as separate blocks at a glance without needing extra spacing between them.
function FormSection({
  tone, icon: Icon, title, right, className, children,
}: {
  tone: keyof typeof FORM_TONES;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const t = FORM_TONES[tone];
  return (
    <section className={`rounded-xl border ${t.card} ${className ?? ''}`}>
      <header className={`flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b px-3 py-1.5 ${t.head}`}>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon className={`w-4 h-4 ${t.icon}`} /> {title}
        </h2>
        {right}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}
