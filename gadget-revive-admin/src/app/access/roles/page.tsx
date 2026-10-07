'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Shield, Search, Users, Lock, X } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Input, Modal, LoadingSpinner, EmptyState } from '@/components/ui';
import { Role, Permission } from '@/types';
import adminService from '@/lib/adminService';
import { useAuthStore } from '@/store/auth';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

interface RoleFormData {
  name: string;
  description: string;
  permissions: number[];
}

// Built-in tiers the backend refuses to rename or delete (RoleController::$protectedRoles).
const PROTECTED_ROLES = ['admin', 'vendor', 'customer', 'staff', 'super_admin'];

// Quick-fill presets for the Create Role form — pick one to pre-check a sensible starting set
// of permissions instead of ticking every box by hand. Matched against permission *names*.
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

export default function RolesPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const myPermissions = useMemo(() => new Set(currentUser?.permissions ?? []), [currentUser]);

  // The backend refuses any grant containing a permission the actor doesn't hold (super_admin
  // holds everything), so the form only lets you tick what you could actually save.
  const canGrant = (permission: Permission) => isSuperAdmin || myPermissions.has(permission.name);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<RoleFormData>({ name: '', description: '', permissions: [] });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rolesRes, permissionsRes] = await Promise.all([
        adminService.getRoles(),
        adminService.getPermissions(),
      ]);
      setRoles(rolesRes.data.data);
      setPermissions(permissionsRes.data.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setRoles([]);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredRoles = roles.filter((role) => {
    const q = searchQuery.trim().toLowerCase();
    return !q || role.name.toLowerCase().includes(q) || role.description?.toLowerCase().includes(q);
  });

  const grantableCount = permissions.filter(canGrant).length;

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, permission) => {
    const module = permission.module || 'General';
    if (!acc[module]) acc[module] = [];
    acc[module].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const openCreateModal = () => {
    setSelectedRole(null);
    setFormData({ name: '', description: '', permissions: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions?.map((p) => p.id) || [],
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = (role: Role) => {
    setSelectedRole(role);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { ...formData };
      if (selectedRole) {
        await adminService.updateRole(selectedRole.id, payload);
      } else {
        await adminService.createRole(payload);
      }
      toast.success(selectedRole ? 'Role updated' : 'Role created');
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole) return;
    try {
      await adminService.deleteRole(selectedRole.id);
      toast.success('Role deleted');
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const togglePermission = (permission: Permission) => {
    if (!canGrant(permission)) return;
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission.id)
        ? prev.permissions.filter((id) => id !== permission.id)
        : [...prev.permissions, permission.id],
    }));
  };

  // Presets only ever tick permissions the signed-in admin holds, so applying one can't produce
  // a save the backend would refuse.
  const applyPreset = (preset: (typeof ROLE_PRESETS)[number]) => {
    const ids = permissions
      .filter((p) => canGrant(p) && (preset.permissionNames === null || preset.permissionNames.includes(p.name)))
      .map((p) => p.id);
    setFormData((prev) => ({ ...prev, permissions: ids }));
  };

  const toggleModulePermissions = (module: string) => {
    const grantable = groupedPermissions[module].filter(canGrant).map((p) => p.id);
    if (grantable.length === 0) return;
    const allSelected = grantable.every((id) => formData.permissions.includes(id));
    setFormData((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((id) => !grantable.includes(id))
        : [...new Set([...prev.permissions, ...grantable])],
    }));
  };

  const isProtected = (role: Role) => PROTECTED_ROLES.includes(role.name);

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Roles</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {roles.length} role{roles.length === 1 ? '' : 's'}
          </span>
        </div>
        <Button size="sm" onClick={openCreateModal} leftIcon={<Plus className="h-3.5 w-3.5" />}>Create role</Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roles by name or description…"
            className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {searchQuery && (
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} leftIcon={<X className="h-3.5 w-3.5" />}>Clear</Button>
        )}
        <p className="ml-auto text-[11px] text-gray-500">
          Tiers (admin, staff, vendor, customer) are built in and can&apos;t be renamed or deleted. Custom roles are yours to shape.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading roles..." /></div>
        ) : filteredRoles.length === 0 ? (
          <EmptyState icon={<Shield className="w-8 h-8 text-gray-400" />} title={searchQuery ? 'No roles match your search' : 'No roles yet'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Role</th>
                  <th className="px-3 py-2 text-right font-semibold">Users</th>
                  <th className="px-3 py-2 text-right font-semibold">Permissions</th>
                  <th className="px-3 py-2 text-left font-semibold">Grants</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRoles.map((role, i) => {
                  const perms = role.permissions ?? [];
                  const grantableHere = perms.filter(canGrant).length;
                  return (
                    <tr key={role.id} className={`${i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-gray-900">{role.name}</span>
                          {isProtected(role) && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-semibold text-slate-600">
                              <Lock className="h-2.5 w-2.5" /> Built-in
                            </span>
                          )}
                        </div>
                        {role.description && <p className="mt-0.5 max-w-md text-xs text-gray-500">{role.description}</p>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-gray-400" />{role.users_count ?? 0}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{perms.length}</td>
                      <td className="px-3 py-2">
                        <div className="flex max-w-xl flex-wrap gap-1">
                          {perms.slice(0, 6).map((p) => (
                            <span key={p.id} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-700">{p.name}</span>
                          ))}
                          {perms.length > 6 && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">+{perms.length - 6} more</span>}
                          {perms.length === 0 && <span className="text-xs text-gray-400">No permissions</span>}
                        </div>
                        {!isSuperAdmin && grantableHere < perms.length && (
                          <p className="mt-1 text-[10px] text-amber-700">You can edit {grantableHere} of these {perms.length}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="sm" title="Edit" onClick={() => openEditModal(role)}><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" title={isProtected(role) ? 'Built-in tiers cannot be deleted' : 'Delete'} onClick={() => openDeleteModal(role)} disabled={isProtected(role)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedRole ? `Edit role — ${selectedRole.name}` : 'Create role'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Role name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Shop Staff"
                required
                disabled={!!selectedRole && isProtected(selectedRole)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What this role is for"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Start from a preset</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ROLE_PRESETS.map((preset) => {
                const locked = preset.permissionNames === null && !isSuperAdmin;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={locked}
                    title={locked ? 'Only a super admin can grant every permission' : undefined}
                    onClick={() => applyPreset(preset)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <p className="text-sm font-semibold text-gray-900">{preset.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{locked ? 'Super admins only' : preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-700">
                Permissions <span className="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{formData.permissions.length} selected</span>
              </p>
              <p className="text-[11px] text-gray-500">
                {isSuperAdmin ? 'Super admin — every permission is available.' : `You can grant ${grantableCount} of ${permissions.length}. Greyed-out ones you don't hold yourself.`}
              </p>
            </div>
            <div className="grid max-h-[46vh] grid-cols-1 gap-3 overflow-y-auto rounded-lg border border-gray-200 bg-slate-50/50 p-3 md:grid-cols-2">
              {Object.entries(groupedPermissions).map(([module, modulePermissions]) => {
                const grantable = modulePermissions.filter(canGrant);
                const selectedHere = modulePermissions.filter((p) => formData.permissions.includes(p.id)).length;
                const allSelected = grantable.length > 0 && grantable.every((p) => formData.permissions.includes(p.id));
                return (
                  <div key={module} className="rounded-lg border border-gray-200 bg-white p-3">
                    <label className="mb-2 flex cursor-pointer items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          disabled={grantable.length === 0}
                          onChange={() => toggleModulePermissions(module)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-semibold text-gray-900">{module}</span>
                      </span>
                      <span className="text-[11px] tabular-nums text-gray-500">{selectedHere}/{modulePermissions.length}</span>
                    </label>
                    <div className="space-y-1 pl-6">
                      {modulePermissions.map((permission) => {
                        const allowed = canGrant(permission);
                        return (
                          <label
                            key={permission.id}
                            title={allowed ? permission.name : "You don't hold this permission yourself"}
                            className={`flex items-start gap-2 text-xs ${allowed ? 'cursor-pointer text-gray-700' : 'cursor-not-allowed text-gray-400'}`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permission.id)}
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
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>{selectedRole ? 'Save role' : 'Create role'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete role">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete the role <strong>{selectedRole?.name}</strong>? This cannot be undone.
          </p>
          {selectedRole && (selectedRole.users_count ?? 0) > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                {selectedRole.users_count} user(s) currently have this role and will lose its permissions.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete role</Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
