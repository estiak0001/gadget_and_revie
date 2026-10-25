'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, Shield, Search, Users, Lock, X } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { Button, Modal, LoadingSpinner, EmptyState } from '@/components/ui';
import { Role } from '@/types';
import adminService from '@/lib/adminService';
import { useAuthStore } from '@/store/auth';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';
import { isProtectedRole } from '@/components/access/RoleForm';

export default function RolesPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const myPermissions = useMemo(() => new Set(currentUser?.permissions ?? []), [currentUser]);
  const canGrant = (permissionName: string) => isSuperAdmin || myPermissions.has(permissionName);

  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const rolesRes = await adminService.getRoles();
      setRoles(rolesRes.data.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setRoles([]);
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

  const openDeleteModal = (role: Role) => {
    setSelectedRole(role);
    setIsDeleteModalOpen(true);
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

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Roles</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {roles.length} role{roles.length === 1 ? '' : 's'}
          </span>
        </div>
        <Button size="sm" onClick={() => router.push('/access/roles/create')} leftIcon={<Plus className="h-3.5 w-3.5" />}>
          Create role
        </Button>
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
                  const grantableHere = perms.filter((p) => canGrant(p.name)).length;
                  return (
                    <tr key={role.id} className={`${i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-indigo-50/40`}>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-gray-900">{role.name}</span>
                          {isProtectedRole(role) && (
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
                          <Button variant="ghost" size="sm" title="Edit" onClick={() => router.push(`/access/roles/${role.id}`)}><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" title={isProtectedRole(role) ? 'Built-in tiers cannot be deleted' : 'Delete'} onClick={() => openDeleteModal(role)} disabled={isProtectedRole(role)}>
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

      {/* Delete Modal — a quick yes/no confirm, unlike edit/create this doesn't need a dedicated page. */}
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
