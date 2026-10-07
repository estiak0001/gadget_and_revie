'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Shield, X } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import { LoadingSpinner, EmptyState } from '@/components/ui';
import { Permission } from '@/types';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

// Pure reference page: lists every permission the system knows about, grouped by the admin
// section it gates. Roles are where permissions get assigned (see Access → Roles).
export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  const fetchPermissions = async () => {
    setIsLoading(true);
    try {
      const response = await adminService.getPermissions();
      setPermissions(response.data.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const modules = useMemo(
    () => [...new Set(permissions.map((p) => p.module || 'General'))].sort(),
    [permissions]
  );

  const filteredPermissions = permissions.filter((permission) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q || permission.name.toLowerCase().includes(q) || permission.description?.toLowerCase().includes(q);
    const matchesModule = !selectedModule || (permission.module || 'General') === selectedModule;
    return matchesSearch && matchesModule;
  });

  const groupedPermissions = filteredPermissions.reduce((acc, permission) => {
    const module = permission.module || 'General';
    if (!acc[module]) acc[module] = [];
    acc[module].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    permissions.forEach((p) => {
      const m = p.module || 'General';
      counts[m] = (counts[m] ?? 0) + 1;
    });
    return counts;
  }, [permissions]);

  const hasFilters = !!searchQuery || !!selectedModule;

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-lg font-bold text-gray-900">Permissions</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {permissions.length} across {modules.length} sections
          </span>
        </div>
        <p className="text-[11px] text-gray-500">Read-only reference. Assign permissions to roles on the Roles page.</p>
      </div>

      <div className="mb-3 space-y-2.5 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by permission name or description…"
              className="h-8 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setSelectedModule(null); }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedModule(null)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
              selectedModule === null ? 'border-slate-700 bg-slate-700 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            All <span className="ml-1 opacity-70">{permissions.length}</span>
          </button>
          {modules.map((module) => (
            <button
              key={module}
              type="button"
              onClick={() => setSelectedModule(module)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                selectedModule === module ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {module} <span className="ml-1 opacity-70">{moduleCounts[module]}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading permissions..." /></div>
      ) : Object.keys(groupedPermissions).length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-dashed border-gray-300 bg-white">
          <EmptyState icon={<Shield className="w-8 h-8 text-gray-400" />} title="No permissions match these filters" />
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
            <section key={module} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <header className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-gray-900">{module}</h2>
                <span className="text-[11px] font-semibold text-gray-500">{modulePermissions.length} permission{modulePermissions.length === 1 ? '' : 's'}</span>
              </header>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-1.5 text-left font-semibold">Permission</th>
                    <th className="px-4 py-1.5 text-left font-semibold">What it allows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {modulePermissions.map((permission, i) => (
                    <tr key={permission.id} className={i % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                      <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs font-semibold text-gray-900">{permission.name}</td>
                      <td className="px-4 py-1.5 text-xs text-gray-600">{permission.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
