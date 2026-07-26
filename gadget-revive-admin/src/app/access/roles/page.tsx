'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Shield, Search, Users } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  Modal,
  LoadingSpinner,
} from '@/components/ui';
import { Role, Permission } from '@/types';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

interface RoleFormData {
  name: string;
  description: string;
  permissions: number[];
}

// Quick-fill presets for the Create Role form — pick one to pre-check a sensible starting set
// of permissions instead of ticking every box by hand. Matched against permission *names*.
const ROLE_PRESETS: { label: string; description: string; permissionNames: string[] }[] = [
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
    description: 'Every permission in the system — equivalent to Admin.',
    permissionNames: [],
  },
];

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    description: '',
    permissions: [],
  });

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

  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, permission) => {
    const module = permission.module || 'General';
    if (!acc[module]) {
      acc[module] = [];
    }
    acc[module].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const openCreateModal = () => {
    setSelectedRole(null);
    setFormData({
      name: '',
      description: '',
      permissions: [],
    });
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
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const togglePermission = (permissionId: number) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((id) => id !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const applyPreset = (preset: (typeof ROLE_PRESETS)[number]) => {
    if (preset.permissionNames.length === 0) {
      setFormData((prev) => ({ ...prev, permissions: permissions.map((p) => p.id) }));
      return;
    }
    const ids = permissions
      .filter((p) => preset.permissionNames.includes(p.name))
      .map((p) => p.id);
    setFormData((prev) => ({ ...prev, permissions: ids }));
  };

  const toggleModulePermissions = (module: string) => {
    const modulePermissionIds = groupedPermissions[module].map((p) => p.id);
    const allSelected = modulePermissionIds.every((id) => formData.permissions.includes(id));

    setFormData((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((id) => !modulePermissionIds.includes(id))
        : [...new Set([...prev.permissions, ...modulePermissionIds])],
    }));
  };

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Roles</h1>
          <p className="page-description">Manage user roles and permissions</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading roles..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredRoles.map((role) => (
            <Card key={role.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{role.name}</CardTitle>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Users className="w-3 h-3" />
                        {role.users_count} users
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(role)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteModal(role)}
                      disabled={role.name === 'Super Admin'}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{role.description}</p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions?.slice(0, 5).map((permission) => (
                    <Badge key={permission.id} variant="default" className="text-xs">
                      {permission.name}
                    </Badge>
                  ))}
                  {role.permissions && role.permissions.length > 5 && (
                    <Badge variant="default" className="text-xs">
                      +{role.permissions.length - 5} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedRole ? 'Edit Role' : 'Create Role'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role Name
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter role name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter role description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Presets
            </label>
            <p className="text-xs text-gray-500 mb-3">Pick a starting point, then fine-tune the checkboxes below.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {ROLE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="text-left rounded-lg border border-gray-200 px-3 py-2 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">{preset.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Permissions
            </label>
            <p className="text-xs text-gray-500 mb-3">Grouped by admin menu section — checking a section here is what lets this role see and use that menu.</p>
            <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4">
              {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
                <div key={module} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`module-${module}`}
                      checked={modulePermissions.every((p) =>
                        formData.permissions.includes(p.id)
                      )}
                      onChange={() => toggleModulePermissions(module)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label
                      htmlFor={`module-${module}`}
                      className="font-medium text-gray-900"
                    >
                      {module}
                    </label>
                  </div>
                  <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modulePermissions.map((permission) => (
                      <label
                        key={permission.id}
                        className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(permission.id)}
                          onChange={() => togglePermission(permission.id)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        {permission.description || permission.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {selectedRole ? 'Update Role' : 'Create Role'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Role"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete the role &quot;{selectedRole?.name}&quot;?
            This action cannot be undone.
          </p>
          {selectedRole && selectedRole.users_count && selectedRole.users_count > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Warning: {selectedRole.users_count} user(s) currently have this role assigned.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete Role
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
