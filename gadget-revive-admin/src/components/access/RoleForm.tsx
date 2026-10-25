'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown, ChevronRight, Search, Lock, Shield, Save, X,
  Maximize2, Minimize2, AlertTriangle,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { Role, Permission } from '@/types';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

// Matches the admin sidebar's own section order (Sidebar.tsx) top to bottom, so a group of
// permissions sits where an admin would expect to find the matching menu item — not alphabetical,
// which scatters e.g. "Orders" and "Reports" to opposite ends of the list. Anything not listed
// here (should never happen — resolveModule() on the backend covers every seeded permission)
// falls back to alphabetical at the end rather than disappearing.
const MODULE_ORDER = [
  'Notifications', 'Reports', 'Orders', 'Quotations', 'Service Intakes', 'Payments',
  'Reviews', 'Tickets', 'Products', 'Services', 'Categories', 'Purchases',
  'Accounts & Finance', 'Expenses', 'Investors', 'Users', 'Vendors', 'Content (CMS)',
  'Locations', 'Roles & Permissions', 'Audit Logs', 'Settings',
];

const PROTECTED_ROLES = ['admin', 'vendor', 'customer', 'staff', 'super_admin'];

const ROLE_PRESETS: { label: string; description: string; permissionNames: string[] | null }[] = [
  {
    label: 'Staff (Operations)',
    description: 'Day-to-day shop work — orders, products, services, reviews, tickets. No user/role/settings/money access.',
    permissionNames: [
      'view_orders', 'manage_orders', 'process_orders',
      'create_products', 'edit_products', 'manage_inventory',
      'create_services', 'edit_services',
      'respond_reviews', 'respond_tickets',
      'view_vendors', 'view_reports',
    ],
  },
  {
    label: 'Manager',
    description: 'Everything Staff has, plus deleting catalog items, vendor oversight, and purchases.',
    permissionNames: [
      'view_orders', 'manage_orders', 'process_orders',
      'create_products', 'edit_products', 'delete_products', 'manage_inventory',
      'create_services', 'edit_services', 'delete_services',
      'respond_reviews', 'manage_reviews', 'respond_tickets', 'manage_tickets',
      'manage_vendors', 'approve_vendors', 'view_vendors',
      'view_reports', 'export_reports',
      'view_purchases', 'manage_purchases', 'manage_suppliers',
    ],
  },
  {
    label: 'Read-Only',
    description: 'Can view most sections but cannot create, edit, or delete anything.',
    permissionNames: ['view_users', 'view_vendors', 'view_orders', 'view_reports', 'view_purchases', 'view_ledger', 'view_audit_logs'],
  },
  {
    label: 'Full Access',
    description: 'Every permission in the system — equivalent to Super Admin. Super admins only.',
    permissionNames: null,
  },
];

function moduleSort(a: string, b: string): number {
  const ia = MODULE_ORDER.indexOf(a);
  const ib = MODULE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export function isProtectedRole(role: Role): boolean {
  return PROTECTED_ROLES.includes(role.name);
}

interface RoleFormProps {
  role: Role | null; // null = create mode
  permissions: Permission[];
  isSuperAdmin: boolean;
  myPermissions: Set<string>;
}

export default function RoleForm({ role, permissions, isSuperAdmin, myPermissions }: RoleFormProps) {
  const router = useRouter();
  const canGrant = (permission: Permission) => isSuperAdmin || myPermissions.has(permission.name);
  const grantableCount = permissions.filter(canGrant).length;
  const protectedName = role ? isProtectedRole(role) : false;

  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<number[]>(role?.permissions?.map((p) => p.id) ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');

  const groupedPermissions = useMemo(() => {
    const acc: Record<string, Permission[]> = {};
    for (const p of permissions) {
      const mod = p.module || 'General';
      (acc[mod] ??= []).push(p);
    }
    return Object.fromEntries(Object.entries(acc).sort(([a], [b]) => moduleSort(a, b)));
  }, [permissions]);

  // Edit mode starts with only the groups that already have something checked expanded, so
  // opening an existing role shows "what it can do" at a glance instead of a 22-card wall of
  // checkboxes. Create mode starts fully expanded — there's nothing selected yet to summarize.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (!role) return new Set(Object.keys(groupedPermissions));
    const withSelection = Object.entries(groupedPermissions)
      .filter(([, perms]) => perms.some((p) => selected.includes(p.id)))
      .map(([mod]) => mod);
    return new Set(withSelection);
  });

  const query = search.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!query) return groupedPermissions;
    const out: Record<string, Permission[]> = {};
    for (const [mod, perms] of Object.entries(groupedPermissions)) {
      const matches = perms.filter(
        (p) => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)
      );
      if (matches.length) out[mod] = matches;
    }
    return out;
  }, [groupedPermissions, query]);

  const toggleGroupExpanded = (mod: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(mod) ? next.delete(mod) : next.add(mod);
      return next;
    });
  };

  const togglePermission = (permission: Permission) => {
    if (!canGrant(permission)) return;
    setSelected((prev) =>
      prev.includes(permission.id) ? prev.filter((id) => id !== permission.id) : [...prev, permission.id]
    );
  };

  const toggleGroupAll = (mod: string) => {
    const grantable = groupedPermissions[mod].filter(canGrant).map((p) => p.id);
    if (grantable.length === 0) return;
    const allSelected = grantable.every((id) => selected.includes(id));
    setSelected((prev) =>
      allSelected ? prev.filter((id) => !grantable.includes(id)) : [...new Set([...prev, ...grantable])]
    );
  };

  const applyPreset = (preset: (typeof ROLE_PRESETS)[number]) => {
    const ids = permissions
      .filter((p) => canGrant(p) && (preset.permissionNames === null || preset.permissionNames.includes(p.name)))
      .map((p) => p.id);
    setSelected(ids);
    setExpanded(new Set(Object.keys(groupedPermissions)));
  };

  const goBack = () => router.push('/access/roles');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { name, description, permissions: selected };
      if (role) {
        await adminService.updateRole(role.id, payload);
      } else {
        await adminService.createRole(payload);
      }
      toast.success(role ? 'Role updated' : 'Role created');
      goBack();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr] lg:items-start">
        {/* ── Identity + summary — sticky on desktop so it stays in view while the permission
            list scrolls. ── */}
        <div className="space-y-3 lg:sticky lg:top-[3.75rem]">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Shield className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-gray-900">Role details</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Role name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Shop Staff"
                  required
                  disabled={protectedName}
                />
                {protectedName && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                    <Lock className="h-3 w-3" /> Built-in tier — name can&apos;t be changed.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is for" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Selected</p>
              <p className="text-2xl font-bold tabular-nums text-indigo-900">{selected.length}</p>
            </div>
            <p className="mt-0.5 text-[11px] text-indigo-700/80">of {permissions.length} permissions</p>
            {!isSuperAdmin && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                You can only grant permissions you hold yourself — {grantableCount} of {permissions.length} are available to you; the rest are greyed out below.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold text-gray-900">Start from a preset</p>
            {role && <p className="mb-2 text-[11px] text-gray-500">Replaces the current selection below.</p>}
            <div className="space-y-1.5">
              {ROLE_PRESETS.map((preset) => {
                const locked = preset.permissionNames === null && !isSuperAdmin;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={locked}
                    title={locked ? 'Only a super admin can grant every permission' : undefined}
                    onClick={() => applyPreset(preset)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <p className="text-xs font-semibold text-gray-900">{preset.label}</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">{locked ? 'Super admins only' : preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Permissions — the whole page scrolls naturally, no nested scroll box. ── */}
        <div className="space-y-3">
          <div className="sticky top-[3.75rem] z-10 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search permissions by name or description…"
                className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(new Set(Object.keys(groupedPermissions)))} leftIcon={<Maximize2 className="h-3.5 w-3.5" />}>
              Expand all
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(new Set())} leftIcon={<Minimize2 className="h-3.5 w-3.5" />}>
              Collapse all
            </Button>
          </div>

          {Object.keys(visibleGroups).length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
              No permissions match &quot;{search}&quot;.
            </div>
          ) : (
            Object.entries(visibleGroups).map(([mod, modulePermissions]) => {
              const grantable = modulePermissions.filter(canGrant);
              const selectedHere = modulePermissions.filter((p) => selected.includes(p.id)).length;
              const allSelected = grantable.length > 0 && grantable.every((p) => selected.includes(p.id));
              const isOpen = query ? true : expanded.has(mod);
              return (
                <div key={mod} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleGroupExpanded(mod)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      <span className="text-sm font-semibold text-gray-900">{mod}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                          selectedHere > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {selectedHere}/{modulePermissions.length}
                      </span>
                    </span>
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className={`flex items-center gap-1.5 text-[11px] font-medium ${grantable.length === 0 ? 'cursor-not-allowed text-gray-300' : 'cursor-pointer text-gray-600'}`}
                    >
                      <input
                        type="checkbox"
                        checked={allSelected}
                        disabled={grantable.length === 0}
                        onChange={() => toggleGroupAll(mod)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Select all
                    </label>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-gray-100 p-4 sm:grid-cols-2">
                      {modulePermissions.map((permission) => {
                        const allowed = canGrant(permission);
                        return (
                          <label
                            key={permission.id}
                            title={allowed ? permission.name : "You don't hold this permission yourself"}
                            className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                              allowed ? 'cursor-pointer text-gray-700 hover:bg-gray-50' : 'cursor-not-allowed text-gray-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(permission.id)}
                              disabled={!allowed}
                              onChange={() => togglePermission(permission)}
                              className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>
                              {permission.description || permission.name}
                              <span className="block font-mono text-[10px] text-gray-400">{permission.name}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Sticky save bar — reachable from anywhere in a long permission list without scrolling back up. */}
      <div className="sticky bottom-3 z-20 mt-4 flex items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
        <Button type="button" variant="outline" onClick={goBack} leftIcon={<X className="h-3.5 w-3.5" />}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSaving} leftIcon={<Save className="h-3.5 w-3.5" />}>
          {role ? 'Save role' : 'Create role'}
        </Button>
      </div>
    </form>
  );
}
