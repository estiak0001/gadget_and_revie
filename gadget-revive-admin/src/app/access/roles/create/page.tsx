'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { LoadingSpinner } from '@/components/ui';
import { Permission } from '@/types';
import adminService from '@/lib/adminService';
import { useAuthStore } from '@/store/auth';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';
import RoleForm from '@/components/access/RoleForm';

export default function CreateRolePage() {
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const myPermissions = new Set(currentUser?.permissions ?? []);

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminService
      .getPermissions()
      .then((res) => setPermissions(res.data.data))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AdminLayout>
      <div className="mb-3">
        <Link href="/access/roles" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to roles
        </Link>
        <h1 className="mt-1 text-lg font-bold text-gray-900">Create role</h1>
        <p className="text-xs text-gray-500">Name it, pick a starting preset if you like, then choose exactly what it can do.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading permissions..." /></div>
      ) : (
        <RoleForm role={null} permissions={permissions} isSuperAdmin={isSuperAdmin} myPermissions={myPermissions} />
      )}
    </AdminLayout>
  );
}
