'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Search, Eye, Edit2, Trash2, Plus, Users as UsersIcon, UserCheck, UserX, Shield, KeyRound, Flame } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Select,
  Modal, Badge, LoadingSpinner, Pagination, EmptyState, ErrorState, ConfirmModal,
} from '@/components/ui';
import { User, Role, PaginatedResponse } from '@/types';
import { formatDate, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];
// Only a super_admin may create/edit/delete/reset-password on these — a regular admin can still
// freely manage 'staff' accounts, since staff is the restricted tier admins run day-to-day, not a
// peer/superior tier.
const PRIVILEGED_ROLES = ['admin', 'super_admin'];
// The 5 built-in tiers — never offered as a selectable "custom role" option (they're already in
// ROLE_OPTIONS); everything else in the Roles list is a custom role that can be picked directly.
const TIER_ROLE_NAMES = ['customer', 'vendor', 'staff', 'admin', 'super_admin'];

const USER_TABS = [
  { key: 'customers', label: 'Customers', roles: 'customer' },
  { key: 'staff', label: 'Staff & Admins', roles: 'staff,admin,super_admin' },
  { key: 'vendors', label: 'Vendors', roles: 'vendor' },
] as const;
type UserTabKey = (typeof USER_TABS)[number]['key'];

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<UserTabKey>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // All Spatie roles — the tier ones plus any custom roles created on the Roles page, combined
  // into a single flat dropdown wherever a user's role is picked (see roleSelectOptions below).
  const [allRoles, setAllRoles] = useState<Role[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isForceDeleteOpen, setIsForceDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', role: 'customer',
  });
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: 'customer', status: 'active' });
  const [newPassword, setNewPassword] = useState('');

  // Combined role dropdown: the tier options (filtered by privilege) plus any custom role
  // created on the Roles page — one flat list, one selection, no "additional roles".
  const roleSelectOptions = [
    ...(isSuperAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => !PRIVILEGED_ROLES.includes(r.value))),
    ...allRoles.filter((r) => !TIER_ROLE_NAMES.includes(r.name)).map((r) => ({ value: r.name, label: r.name })),
  ];

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const tab = USER_TABS.find((t) => t.key === activeTab)!;
      const params: Record<string, string | number> = { page: currentPage };
      // Inside the Staff & Admins tab, the role dropdown narrows further (e.g. just 'admin');
      // otherwise the tab itself defines which roles are in view.
      params.role = activeTab === 'staff' && filterRole ? filterRole : tab.roles;
      if (searchQuery) params.search = searchQuery;
      if (filterStatus) params.status = filterStatus;

      const response = await adminService.getUsers(params);
      const data = response.data?.data || response.data;
      if (Array.isArray(data)) {
        setUsers(data);
        setTotalPages(1);
      } else {
        setUsers(data.data);
        setTotalPages(data.meta?.last_page || 1);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error(getErrorMessage(err));
      setError(true);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, currentPage, searchQuery, filterRole, filterStatus]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    adminService.getRoles().then((res) => setAllRoles(res.data.data || [])).catch(() => setAllRoles([]));
  }, []);

  const handleTabChange = (tab: UserTabKey) => {
    setActiveTab(tab);
    setFilterRole('');
    setCurrentPage(1);
  };

  const handleSearch = () => { setCurrentPage(1); fetchUsers(); };

  const openCreateModal = () => {
    setSelectedUser(null);
    const defaultRole = activeTab === 'vendors' ? 'vendor' : activeTab === 'staff' ? 'staff' : 'customer';
    setFormData({ name: '', email: '', phone: '', password: '', role: defaultRole });
    setIsModalOpen(true);
  };

  const openViewModal = (user: User) => { setSelectedUser(user); setIsViewModalOpen(true); };

  // The user's actual single role — a custom role name if one's assigned, otherwise their tier
  // (rows from /admin/users always carry the {id,name}[] object shape for `roles`).
  const userRoleNames = (user: User | null): string[] =>
    (user?.roles ?? []).map((r) => (typeof r === 'string' ? r : r.name));
  const effectiveRole = (user: User): string => userRoleNames(user)[0] ?? user.role;

  const openStatusModal = (user: User) => {
    setSelectedUser(user);
    setNewStatus(user.status === 'active' ? 'suspended' : 'active');
    setStatusReason('');
    setIsStatusModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({ name: user.name, email: user.email, phone: user.phone || '', role: effectiveRole(user), status: user.status });
    setIsEditModalOpen(true);
  };

  const openResetPassword = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setIsResetPasswordOpen(true);
  };

  const openDelete = (user: User) => { setSelectedUser(user); setIsDeleteOpen(true); };
  const openForceDelete = (user: User) => { setSelectedUser(user); setIsForceDeleteOpen(true); };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      await adminService.updateUser(selectedUser.id, editForm);
      toast.success('User updated successfully');
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setIsSaving(true);
    try {
      await adminService.resetUserPassword(selectedUser.id, newPassword);
      toast.success(`Password reset for ${selectedUser.name}`);
      setIsResetPasswordOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setIsDeleting(true);
    try {
      await adminService.deleteUser(selectedUser.id);
      toast.success('User deleted');
      setIsDeleteOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleForceDelete = async () => {
    if (!selectedUser) return;
    setIsDeleting(true);
    try {
      await adminService.forceDeleteUser(selectedUser.id);
      toast.success('User permanently deleted');
      setIsForceDeleteOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await adminService.createUser(formData);
      toast.success('User created successfully');
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      await adminService.updateUserStatus(selectedUser.id, { status: newStatus, reason: statusReason });
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`);
      setIsStatusModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, 'success' | 'warning' | 'info' | 'default' | 'danger'> = {
      super_admin: 'danger', admin: 'info', staff: 'success', vendor: 'warning', customer: 'default',
    };
    return <Badge variant={colors[role] || 'default'}>{role.replace('_', ' ')}</Badge>;
  };

  if (error && users.length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load users" onRetry={fetchUsers} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-description">Manage all users and their access</p>
        </div>
        <Button onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Add User</Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {USER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="pl-10" />
            </div>
            {activeTab === 'staff' && (
              <Select
                options={[{ value: '', label: 'All Staff & Admins' }, ...ROLE_OPTIONS.filter((r) => ['staff', 'admin', 'super_admin'].includes(r.value))]}
                value={filterRole}
                onChange={(e) => { setFilterRole(e.target.value); setCurrentPage(1); }}
              />
            )}
            <Select options={[{ value: '', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'suspended', label: 'Suspended' }]} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{USER_TABS.find((t) => t.key === activeTab)?.label}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" text="Loading users..." /></div>
          ) : users.length === 0 ? (
            <EmptyState icon={<UsersIcon className="w-8 h-8 text-gray-400" />} title="No users found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                          {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4">{getRoleBadge(effectiveRole(user))}</td>
                      <td className="px-6 py-4">
                        <Badge variant={user.status === 'active' ? 'success' : user.status === 'suspended' ? 'danger' : 'default'}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(user.created_at)}</td>
                      <td className="px-6 py-4">
                        {(() => {
                          const isSelf = user.id === currentUser?.id;
                          // Any admin-tier viewer can manage a peer 'admin' row; only a super_admin
                          // can manage a super_admin row (matches the backend's own guard).
                          const canManage = isSuperAdmin || user.role !== 'super_admin';
                          return (
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" title="View" onClick={() => openViewModal(user)}><Eye className="w-4 h-4" /></Button>
                              {canManage && (
                                <>
                                  <Button variant="ghost" size="sm" title="Edit" onClick={() => openEditModal(user)}><Edit2 className="w-4 h-4 text-gray-500" /></Button>
                                  <Button variant="ghost" size="sm" title="Reset Password" onClick={() => openResetPassword(user)}><KeyRound className="w-4 h-4 text-blue-500" /></Button>
                                  <Button variant="ghost" size="sm" title={user.status === 'active' ? 'Suspend' : 'Activate'} onClick={() => openStatusModal(user)}>
                                    {user.status === 'active' ? <UserX className="w-4 h-4 text-red-500" /> : <UserCheck className="w-4 h-4 text-green-500" />}
                                  </Button>
                                  {!isSelf && (
                                    <Button variant="ghost" size="sm" title="Delete" onClick={() => openDelete(user)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                  )}
                                  {!isSelf && isSuperAdmin && (
                                    <Button variant="ghost" size="sm" title="Permanently delete" onClick={() => openForceDelete(user)}><Flame className="w-4 h-4 text-red-700" /></Button>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && <div className="mt-6"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /></div>}

      {/* Create User Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New User" size="lg">
        <form onSubmit={handleCreateUser}>
          {/* Avatar Preview */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-md">
              <span className="text-2xl font-bold text-white">
                {formData.name ? formData.name.charAt(0).toUpperCase() : <UsersIcon className="w-7 h-7 text-white/80" />}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{formData.name || 'New User'}</p>
              <p className="text-sm text-gray-500">{formData.email || 'user@example.com'}</p>
            </div>
          </div>

          {/* Personal Information Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <UsersIcon className="w-4 h-4" /> Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+880 1XXX-XXXXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                />
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            formData.password.length >= level * 3
                              ? formData.password.length >= 12
                                ? 'bg-green-500'
                                : formData.password.length >= 8
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs mt-1 ${
                      formData.password.length >= 12 ? 'text-green-600' : formData.password.length >= 8 ? 'text-yellow-600' : 'text-red-500'
                    }`}>
                      {formData.password.length >= 12 ? 'Strong password' : formData.password.length >= 8 ? 'Good password' : 'Too short — minimum 8 characters'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Access & Role Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Access & Role
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">User Role <span className="text-red-500">*</span></label>
                <Select
                  options={roleSelectOptions}
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <div className={`w-full px-4 py-2.5 rounded-lg border text-sm ${
                  formData.role === 'super_admin' || formData.role === 'admin'
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : formData.role === 'staff'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : formData.role === 'vendor'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                  {formData.role === 'super_admin' && '🔐 Full control — including managing other admins, roles, and permanent deletes'}
                  {formData.role === 'admin' && '🔐 Full access to admin panel and all settings'}
                  {formData.role === 'staff' && '🧑‍💼 Day-to-day operations: orders, products, services, reviews, tickets'}
                  {formData.role === 'vendor' && '🏪 Can manage their own shop, products & orders'}
                  {formData.role === 'customer' && '👤 Can browse, order, and manage their account'}
                  {!TIER_ROLE_NAMES.includes(formData.role) && `🛠️ Custom role — permissions are whatever's checked for "${formData.role}" on the Roles page`}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>
              <Plus className="w-4 h-4 mr-2" />Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* View User Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="User Details">
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center"><span className="text-2xl font-bold text-primary-600">{selectedUser.name.charAt(0)}</span></div>
              <div>
                <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div><p className="text-xs text-gray-500">Role</p>{getRoleBadge(effectiveRole(selectedUser))}</div>
              <div><p className="text-xs text-gray-500">Status</p><Badge variant={selectedUser.status === 'active' ? 'success' : 'danger'}>{selectedUser.status}</Badge></div>
              <div><p className="text-xs text-gray-500">Phone</p><p className="text-sm">{selectedUser.phone || '-'}</p></div>
              <div><p className="text-xs text-gray-500">Joined</p><p className="text-sm">{formatDate(selectedUser.created_at)}</p></div>
            </div>
          </div>
        )}
      </Modal>

      {/* Status Modal */}
      <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title={newStatus === 'active' ? 'Activate User' : 'Suspend User'}>
        <div className="space-y-4">
          <p className="text-gray-600">Are you sure you want to {newStatus === 'active' ? 'activate' : 'suspend'} <strong>{selectedUser?.name}</strong>?</p>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason (Optional)</label><Input value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="Reason for status change" /></div>
          <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>Cancel</Button><Button variant={newStatus === 'active' ? 'primary' : 'danger'} onClick={handleStatusUpdate} isLoading={isSaving}>{newStatus === 'active' ? 'Activate' : 'Suspend'}</Button></div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit User" size="md">
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Input
            label="Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <Select
            label="Role"
            options={roleSelectOptions}
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            disabled={selectedUser?.id === currentUser?.id}
          />
          <Select
            label="Status"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'suspended', label: 'Suspended' },
            ]}
            value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateUser} isLoading={isSaving}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={isResetPasswordOpen} onClose={() => setIsResetPasswordOpen(false)} title="Reset Password" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Set a new password for <strong>{selectedUser?.name}</strong>. They&apos;ll need to use it on their next login.
          </p>
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            minLength={8}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsResetPasswordOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} isLoading={isSaving}>Reset Password</Button>
          </div>
        </div>
      </Modal>

      {/* Soft Delete Confirm */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Delete "${selectedUser?.name}"? This is recoverable — the account is soft-deleted, not permanently erased.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Hard Delete Confirm */}
      <ConfirmModal
        isOpen={isForceDeleteOpen}
        onClose={() => setIsForceDeleteOpen(false)}
        onConfirm={handleForceDelete}
        title="Permanently Delete User"
        message={`Permanently delete "${selectedUser?.name}"? This CANNOT be undone — the account and its data will be erased completely.`}
        confirmLabel="Permanently Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
