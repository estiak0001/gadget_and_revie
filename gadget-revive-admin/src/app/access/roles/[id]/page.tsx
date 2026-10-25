'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { LoadingSpinner, ErrorState } from '@/components/ui';
import { Role, Permission } from '@/types';
import adminService from '@/lib/adminService';
import { useAuthStore } from '@/store/auth';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';
import RoleForm from '@/components/access/RoleForm';

export default function EditRolePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roleId = Number(params.id);

  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const myPermissions = new Set(currentUser?.permissions ?? []);

  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // There's no GET /admin/roles/{id} — the roles list is short (a handful of tiers plus
    // whatever custom roles exist), so fetching it and finding this one is simpler than adding
    // a single-role endpoint just for this page.
    Promise.all([adminService.getRoles(), adminService.getPermissions()])
      .then(([rolesRes, permissionsRes]) => {
        const found = rolesRes.data.data.find((r: Role) => r.id === roleId);
        if (!found) {
          setNotFound(true);
        } else {
          setRole(found);
        }
        setPermissions(permissionsRes.data.data);
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [roleId]);

  return (
    <AdminLayout>
      <div className="mb-3">
        <Link href="/access/roles" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to roles
        </Link>
        {role && (
          <>
            <h1 className="mt-1 text-lg font-bold text-gray-900">
              Edit role — <span className="font-mono">{role.name}</span>
            </h1>
            <p className="text-xs text-gray-500">{role.users_count ?? 0} user{(role.users_count ?? 0) === 1 ? '' : 's'} currently have this role.</p>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading role..." /></div>
      ) : notFound || !role ? (
        <ErrorState title="Role not found" message="This role may have been deleted." onRetry={() => router.push('/access/roles')} />
      ) : (
        <RoleForm role={role} permissions={permissions} isSuperAdmin={isSuperAdmin} myPermissions={myPermissions} />
      )}
    </AdminLayout>
  );
}
