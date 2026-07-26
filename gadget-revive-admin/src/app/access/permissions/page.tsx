'use client';

import React, { useEffect, useState } from 'react';
import { Search, Shield, Layers } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Badge,
  LoadingSpinner,
} from '@/components/ui';
import { Permission } from '@/types';
import adminService from '@/lib/adminService';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';

interface GroupedPermissions {
  [module: string]: Permission[];
}

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

  // Filter permissions
  const filteredPermissions = permissions.filter(
    (permission) =>
      (permission.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        permission.description?.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (!selectedModule || permission.module === selectedModule)
  );

  // Group permissions by module
  const groupedPermissions: GroupedPermissions = filteredPermissions.reduce(
    (acc, permission) => {
      const module = permission.module || 'General';
      if (!acc[module]) {
        acc[module] = [];
      }
      acc[module].push(permission);
      return acc;
    },
    {} as GroupedPermissions
  );

  // Get all modules for filter
  const modules = [...new Set(permissions.map((p) => p.module || 'General'))];

  const moduleColors: Record<string, string> = {
    Users: 'bg-blue-100 text-blue-700',
    Vendors: 'bg-green-100 text-green-700',
    Orders: 'bg-yellow-100 text-yellow-700',
    CMS: 'bg-purple-100 text-purple-700',
    Reports: 'bg-pink-100 text-pink-700',
    Settings: 'bg-gray-100 text-gray-700',
    'Access Control': 'bg-red-100 text-red-700',
    Audit: 'bg-indigo-100 text-indigo-700',
  };

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">Permissions</h1>
        <p className="page-description">
          View all system permissions organized by module
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search permissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedModule(null)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedModule === null
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {modules.map((module) => (
                <button
                  key={module}
                  onClick={() => setSelectedModule(module)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedModule === module
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {module}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading permissions..." />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
            <Card key={module}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      moduleColors[module] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{module}</CardTitle>
                    <p className="text-sm text-gray-500">
                      {modulePermissions.length} permission(s)
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {modulePermissions.map((permission) => (
                    <div
                      key={permission.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border">
                        <Shield className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          {permission.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {permission.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {Object.keys(groupedPermissions).length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No permissions found</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Summary Card */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{permissions.length}</span> total permissions
              across <span className="font-medium">{modules.length}</span> modules
            </div>
            <div className="flex flex-wrap gap-2">
              {modules.map((module) => {
                const count = permissions.filter((p) => p.module === module).length;
                return (
                  <Badge
                    key={module}
                    variant="default"
                    className={moduleColors[module]}
                  >
                    {module}: {count}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
