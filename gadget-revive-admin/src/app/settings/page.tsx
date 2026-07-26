'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Globe, Mail, CreditCard, Bell, Shield, Server, AlertCircle, DollarSign, Share2, Search as SearchIcon, Building2, ToggleLeft, Upload, X } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea,
  Badge, LoadingSpinner, ErrorState,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const ASSET_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '');

function resolveAssetUrl(value: string): string {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return value;
  return `${ASSET_BASE_URL}/storage/${value.replace(/^storage\//, '')}`;
}

function isImageKey(key: string): boolean {
  return /_(logo|favicon|icon|image)$/.test(key);
}

interface SettingsData {
  general?: Record<string, string>;
  contact?: Record<string, string>;
  email?: Record<string, string>;
  payment?: Record<string, string>;
  business?: Record<string, string>;
  features?: Record<string, string>;
  seo?: Record<string, string>;
  social?: Record<string, string>;
}

const SETTING_GROUPS = [
  { key: 'general', label: 'General', icon: Globe, color: 'text-blue-600 bg-blue-100' },
  { key: 'contact', label: 'Contact', icon: Building2, color: 'text-indigo-600 bg-indigo-100' },
  { key: 'email', label: 'Email', icon: Mail, color: 'text-green-600 bg-green-100' },
  { key: 'payment', label: 'Payment', icon: CreditCard, color: 'text-purple-600 bg-purple-100' },
  { key: 'business', label: 'Business', icon: DollarSign, color: 'text-emerald-600 bg-emerald-100' },
  { key: 'features', label: 'Features', icon: ToggleLeft, color: 'text-amber-600 bg-amber-100' },
  { key: 'seo', label: 'SEO', icon: SearchIcon, color: 'text-pink-600 bg-pink-100' },
  { key: 'social', label: 'Social Media', icon: Share2, color: 'text-blue-600 bg-blue-100' },
];

// Format setting key to readable label
const formatLabel = (key: string): string => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Determine input type based on key name and value
const getInputType = (key: string, value: string): 'text' | 'email' | 'number' | 'textarea' | 'boolean' | 'url' | 'json' => {
  if (key.includes('enabled') || key.includes('mode') || value === 'true' || value === 'false') {
    return 'boolean';
  }
  if (key.includes('email')) return 'email';
  if (key.includes('url')) return 'url';
  if (key.includes('description') || key.includes('keywords') || key.includes('details')) return 'textarea';
  if (key.includes('rate') || key.includes('amount') || key.includes('hours') || key.includes('days')) return 'number';
  if (value.startsWith('{') || value.startsWith('[')) return 'json';
  return 'text';
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeGroup, setActiveGroup] = useState('general');
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const response = await adminService.getSettings();
      const data = response.data?.data || response.data;
      setSettings(data as SettingsData);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setError(true);
      setSettings({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const hasUnsavedChanges = Object.keys(editedValues).length > 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await adminService.updateSettings(editedValues);
      toast.success('Settings saved successfully');
      setEditedValues({});
      fetchSettings();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => { setEditedValues({}); };

  const currentGroupSettings = settings[activeGroup as keyof SettingsData] || {};
  const getValue = (key: string, originalValue: string) => 
    editedValues[key] !== undefined ? editedValues[key] : originalValue;

  const renderSettingInput = (key: string, value: string) => {
    const currentValue = getValue(key, value);
    const isEdited = editedValues[key] !== undefined;
    const inputType = getInputType(key, value);

    const inputClasses = `w-full border rounded-lg p-2.5 ${isEdited ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'}`;

    if (isImageKey(key)) {
      return (
        <ImageUploadField
          currentValue={currentValue}
          isEdited={isEdited}
          isFavicon={key.endsWith('_favicon')}
          onChange={(val) => handleValueChange(key, val)}
        />
      );
    }

    switch (inputType) {
      case 'boolean':
        const boolValue = currentValue === 'true' || currentValue === '1';
        return (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleValueChange(key, boolValue ? 'false' : 'true')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                boolValue ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  boolValue ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-600">{boolValue ? 'Enabled' : 'Disabled'}</span>
            {isEdited && <Badge variant="warning" className="text-xs">Modified</Badge>}
          </div>
        );
      
      case 'textarea':
        return (
          <div>
            <textarea
              className={inputClasses + ' h-24 resize-none'}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
      
      case 'json':
        return (
          <div>
            <textarea
              className={inputClasses + ' h-32 resize-none font-mono text-xs'}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
              placeholder="Valid JSON format"
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
      
      case 'number':
        return (
          <div>
            <Input
              type="number"
              className={isEdited ? 'border-yellow-400 bg-yellow-50' : ''}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
      
      case 'email':
        return (
          <div>
            <Input
              type="email"
              className={isEdited ? 'border-yellow-400 bg-yellow-50' : ''}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
      
      case 'url':
        return (
          <div>
            <Input
              type="url"
              className={isEdited ? 'border-yellow-400 bg-yellow-50' : ''}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
              placeholder="https://..."
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
      
      default:
        return (
          <div>
            <Input
              type="text"
              className={isEdited ? 'border-yellow-400 bg-yellow-50' : ''}
              value={currentValue}
              onChange={(e) => handleValueChange(key, e.target.value)}
            />
            {isEdited && <span className="text-xs text-yellow-600 mt-1 block">Modified</span>}
          </div>
        );
    }
  };

  if (error && Object.keys(settings).length === 0) {
    return (<AdminLayout><ErrorState title="Failed to load settings" onRetry={fetchSettings} /></AdminLayout>);
  }

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><h1 className="page-title">Settings</h1><p className="page-description">Manage application configuration</p></div>
        {hasUnsavedChanges && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-yellow-600"><AlertCircle className="w-4 h-4" /><span className="text-sm">{Object.keys(editedValues).length} unsaved change(s)</span></div>
            <Button variant="outline" onClick={handleReset}><RefreshCw className="w-4 h-4 mr-2" />Reset</Button>
            <Button onClick={handleSave} isLoading={isSaving}><Save className="w-4 h-4 mr-2" />Save Changes</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {SETTING_GROUPS.map(group => {
                  const Icon = group.icon;
                  const groupData = settings[group.key as keyof SettingsData] || {};
                  const count = Object.keys(groupData).length;
                  return (
                    <button key={group.key} onClick={() => setActiveGroup(group.key)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${activeGroup === group.key ? 'bg-primary-100 text-primary-600' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${group.color}`}><Icon className="w-4 h-4" /></div>
                      <div className="flex-1"><p className="text-sm font-medium">{group.label}</p></div>
                      <Badge variant="default" className="text-xs">{count}</Badge>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                {(() => { const G = SETTING_GROUPS.find(g => g.key === activeGroup); const GI = G!.icon; return (<div className={`w-10 h-10 rounded-lg flex items-center justify-center ${G!.color}`}><GI className="w-5 h-5" /></div>); })()}
                <CardTitle>{SETTING_GROUPS.find(g => g.key === activeGroup)?.label} Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-48"><LoadingSpinner size="lg" text="Loading settings..." /></div>
              ) : Object.keys(currentGroupSettings).length === 0 ? (
                <div className="text-center py-12"><SettingsIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No settings available in this group</p></div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(currentGroupSettings).map(([key, value]) => (
                    <div key={key} className="border-b pb-5 last:border-0">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="md:w-1/3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">{formatLabel(key)}</label>
                          <p className="text-xs text-gray-400 font-mono">{key}</p>
                        </div>
                        <div className="md:w-2/3">{renderSettingInput(key, value)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

interface ImageUploadFieldProps {
  currentValue: string;
  isEdited: boolean;
  isFavicon?: boolean;
  onChange: (value: string) => void;
}

function ImageUploadField({ currentValue, isEdited, isFavicon, onChange }: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrl = currentValue ? resolveAssetUrl(currentValue) : '';
  const accept = isFavicon ? 'image/x-icon,image/png,image/svg+xml' : 'image/png,image/jpeg,image/svg+xml,image/webp';

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const response = await adminService.uploadFile(file);
      const path = response.data?.data?.path as string | undefined;
      if (!path) throw new Error('Upload did not return a path');
      onChange(path);
      toast.success('Uploaded. Save changes to apply.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-4 p-3 border rounded-lg ${isEdited ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300 bg-gray-50'}`}>
        {previewUrl ? (
          <div className={`flex items-center justify-center bg-white border border-gray-200 rounded-md overflow-hidden ${isFavicon ? 'h-12 w-12' : 'h-16 w-28'}`}>
            <img src={previewUrl} alt="preview" className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div className={`flex items-center justify-center bg-white border border-dashed border-gray-300 rounded-md text-gray-400 text-xs ${isFavicon ? 'h-12 w-12' : 'h-16 w-28'}`}>
            No image
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate" title={currentValue}>{currentValue || 'No value set'}</p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            {currentValue && (
              <Button type="button" variant="outline" onClick={() => onChange('')} disabled={uploading}>
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
            {isEdited && <Badge variant="warning" className="text-xs">Modified</Badge>}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      <Input
        type="text"
        className={isEdited ? 'border-yellow-400 bg-yellow-50' : ''}
        value={currentValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste a path / URL (e.g. /images/logo.png)"
      />
    </div>
  );
}
