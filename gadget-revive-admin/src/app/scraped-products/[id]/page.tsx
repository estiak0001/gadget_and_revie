'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Save, ArrowRight, XCircle, Trash2, PackageSearch } from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card, CardHeader, CardTitle, CardContent,
  Button, Input, Textarea, Badge, SearchableSelect, LoadingSpinner, ErrorState, ConfirmModal,
} from '@/components/ui';
import { ScrapedProduct, ProductCategory, ProductBrand } from '@/types';
import { getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

const ASSET_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.gadgetandrevive.com/api').replace(/\/api$/, '');

function getImageUrl(image?: string | null): string {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  return `${ASSET_BASE_URL}/storage/${image.replace(/^\//, '')}`;
}

/** "Grandparent > Parent > Name" using the breadcrumb the API already computes server-side. */
function categoryLabel(category: ProductCategory): string {
  return category.breadcrumb?.length ? category.breadcrumb.map((b) => b.name).join(' > ') : category.name;
}

/** Turns the flat specifications map back into the plain "Group - Key: Value" editable text —
 *  same format the ingest endpoint's parser reads, so a round-trip edit never loses the grouping. */
function specsToText(specs?: Record<string, string> | null): string {
  if (!specs) return '';
  return Object.entries(specs)
    .map(([key, value]) => {
      const idx = key.indexOf(' - ');
      return idx === -1 ? `${key}: ${value}` : `${key.slice(idx + 3)}: ${value}`;
    })
    .join('\n');
}

export default function ScrapedProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [row, setRow] = useState<ScrapedProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<ProductBrand[]>([]);

  const [form, setForm] = useState({
    name: '', name_bn: '', sku: '', category_id: '', brand_id: '',
    price: '', discount_price: '', stock_qty: '', current_cost: '', unit: '',
    short_description: '', description: '', specifications: '',
    model: '', warranty_value: '', warranty_unit: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const [rowRes, catRes, brandRes] = await Promise.all([
        adminService.getScrapedProduct(id),
        adminService.getProductCategories(),
        adminService.getProductBrands({ per_page: 200 }),
      ]);
      const data = rowRes.data.data;
      setRow(data);
      setCategories((catRes.data as { data?: ProductCategory[] }).data || (catRes.data as unknown as ProductCategory[]) || []);
      setBrands((brandRes.data.data as unknown as { data: ProductBrand[] })?.data || []);
      setForm({
        name: data.name || '',
        name_bn: data.name_bn || '',
        sku: data.sku || '',
        category_id: data.category_id ? String(data.category_id) : '',
        brand_id: data.brand_id ? String(data.brand_id) : '',
        price: data.price != null ? String(data.price) : '',
        discount_price: data.discount_price != null ? String(data.discount_price) : '',
        stock_qty: data.stock_qty != null ? String(data.stock_qty) : '',
        current_cost: data.current_cost != null ? String(data.current_cost) : '',
        unit: data.unit || '',
        short_description: data.short_description || '',
        description: data.description || '',
        specifications: specsToText(data.specifications),
        model: data.model || '',
        warranty_value: data.warranty_value != null ? String(data.warranty_value) : '',
        warranty_unit: data.warranty_unit || '',
      });
    } catch (err) {
      console.error('Error fetching scraped product:', err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) fetchAll(); }, [id, fetchAll]);

  const setField = (field: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await adminService.updateScrapedProduct(id, {
        name: form.name,
        name_bn: form.name_bn || null,
        sku: form.sku || null,
        category_id: form.category_id || null,
        brand_id: form.brand_id || null,
        price: form.price === '' ? null : Number(form.price),
        discount_price: form.discount_price === '' ? null : Number(form.discount_price),
        stock_qty: form.stock_qty === '' ? null : Number(form.stock_qty),
        current_cost: form.current_cost === '' ? null : Number(form.current_cost),
        unit: form.unit || null,
        short_description: form.short_description || null,
        // Sent as raw HTML (already formatted) — the update endpoint stores description as-is,
        // only ingest() runs it through the plain-text-to-HTML parser.
        description: form.description || null,
        model: form.model || null,
        warranty_value: form.warranty_value === '' ? null : Number(form.warranty_value),
        warranty_unit: form.warranty_unit || null,
      });
      setRow(res.data.data);
      toast.success('Saved');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePromote = async () => {
    setIsPromoting(true);
    try {
      // Save first so the promotion uses whatever's currently in the form, not a stale snapshot.
      await handleSave();
      const res = await adminService.promoteScrapedProduct(id);
      toast.success('Promoted — created as a new Inactive product');
      router.push(`/products/${res.data.data.promoted_product_id}/edit`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsPromoting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await adminService.rejectScrapedProduct(id);
      toast.success('Rejected');
      router.push('/scraped-products');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsRejecting(false);
      setShowRejectModal(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await adminService.deleteScrapedProduct(id);
      toast.success('Deleted');
      router.push('/scraped-products');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" text="Loading..." /></div>
      </AdminLayout>
    );
  }

  if (error || !row) {
    return (
      <AdminLayout>
        <ErrorState title="Failed to load" message="Could not fetch this scraped product." onRetry={fetchAll} />
      </AdminLayout>
    );
  }

  const isPending = row.status === 'pending';
  const canPromote = isPending && !!form.category_id && Number(form.price) > 0;

  return (
    <AdminLayout>
      <div className="page-header flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/scraped-products">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="page-title">Review Scraped Product</h1>
            <p className="page-description">
              <Badge variant={row.status === 'pending' ? 'warning' : row.status === 'promoted' ? 'success' : 'danger'}>
                {row.status}
              </Badge>
            </p>
          </div>
        </div>
        {isPending && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSave} isLoading={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button variant="danger" onClick={() => setShowRejectModal(true)} disabled={isRejecting}>
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button onClick={handlePromote} isLoading={isPromoting} disabled={!canPromote} title={!canPromote ? 'Needs a mapped category and a price greater than 0' : undefined}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Promote to Products
            </Button>
          </div>
        )}
        {row.status !== 'promoted' && !isPending && (
          <Button variant="danger" onClick={() => setShowDeleteModal(true)} isLoading={isDeleting}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editable form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Name" value={form.name} onChange={(e) => setField('name', e.target.value)} disabled={!isPending} required />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Name (Bengali)" value={form.name_bn} onChange={(e) => setField('name_bn', e.target.value)} disabled={!isPending} />
                <Input label="SKU" value={form.sku} onChange={(e) => setField('sku', e.target.value)} disabled={!isPending} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SearchableSelect
                    label="Category"
                    required
                    placeholder={row.category_raw ? `Scraped as "${row.category_raw}" — map it` : 'Select category...'}
                    options={categories.map((c) => ({ value: c.id, label: categoryLabel(c) }))}
                    value={form.category_id}
                    onChange={(v) => setField('category_id', String(v))}
                    disabled={!isPending}
                    allowClear
                  />
                  {row.category_raw && (
                    <p className="text-xs text-gray-400 mt-1">Scraped category text: &quot;{row.category_raw}&quot;</p>
                  )}
                </div>
                <div>
                  <SearchableSelect
                    label="Brand"
                    placeholder="Select brand..."
                    options={brands.map((b) => ({ value: b.id, label: b.name }))}
                    value={form.brand_id}
                    onChange={(v) => setField('brand_id', String(v))}
                    disabled={!isPending}
                    allowClear
                  />
                  {row.brand_raw && <p className="text-xs text-gray-400 mt-1">Scraped brand text: &quot;{row.brand_raw}&quot;</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Price" type="number" value={form.price} onChange={(e) => setField('price', e.target.value)} disabled={!isPending} required />
                <Input label="Discount Price" type="number" value={form.discount_price} onChange={(e) => setField('discount_price', e.target.value)} disabled={!isPending} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Stock Quantity" type="number" value={form.stock_qty} onChange={(e) => setField('stock_qty', e.target.value)} disabled={!isPending} />
                <Input label="Current Cost" type="number" value={form.current_cost} onChange={(e) => setField('current_cost', e.target.value)} disabled={!isPending} />
                <Input label="Unit" value={form.unit} onChange={(e) => setField('unit', e.target.value)} placeholder="piece" disabled={!isPending} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Model" value={form.model} onChange={(e) => setField('model', e.target.value)} disabled={!isPending} />
                <Input label="Warranty Value" type="number" value={form.warranty_value} onChange={(e) => setField('warranty_value', e.target.value)} disabled={!isPending} />
                <Input label="Warranty Unit" value={form.warranty_unit} onChange={(e) => setField('warranty_unit', e.target.value)} placeholder="day/week/month/year" disabled={!isPending} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Description</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                rows={6}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                disabled={!isPending}
              />
              <p className="text-xs text-gray-400 mt-1">Already formatted as HTML from the scraped plain text — edit the HTML directly if needed.</p>
              <div className="mt-3">
                <Input label="Short Description" value={form.short_description} onChange={(e) => setField('short_description', e.target.value)} disabled={!isPending} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                rows={8}
                value={form.specifications}
                onChange={(e) => setField('specifications', e.target.value)}
                disabled
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Read-only preview of the parsed specs (one &quot;Key: Value&quot; per line) — edit the underlying
                values via the Products list once promoted.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Read-only source panel + images */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Source</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Site</span>
                <Badge variant="info">{row.source_site}</Badge>
              </div>
              {row.source_url && (
                <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline break-all">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  {row.source_url}
                </a>
              )}
              {row.stock_status_raw && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Stock (scraped)</span>
                  <span>{row.stock_status_raw}</span>
                </div>
              )}
              {row.batch && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Batch</span>
                  <span className="font-mono text-xs">{row.batch}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Submitted</span>
                <span>{new Date(row.created_at).toLocaleString()}</span>
              </div>
              {row.promoted_product_id && (
                <Link href={`/products/${row.promoted_product_id}/edit`} className="flex items-center gap-1 text-primary-600 hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View promoted product #{row.promoted_product_id}
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Images</CardTitle></CardHeader>
            <CardContent>
              {row.image ? (
                <img src={getImageUrl(row.image)} alt={row.name} className="w-full rounded-lg border border-gray-200 mb-3" />
              ) : (
                <div className="w-full h-32 bg-gray-50 rounded-lg border border-dashed border-gray-200 flex items-center justify-center mb-3">
                  <PackageSearch className="w-8 h-8 text-gray-300" />
                </div>
              )}
              {!!row.gallery?.length && (
                <div className="grid grid-cols-3 gap-2">
                  {row.gallery.map((img, i) => (
                    <img key={i} src={getImageUrl(img)} alt="" className="w-full aspect-square object-cover rounded border border-gray-200" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        title="Reject Scraped Product"
        message={`Reject "${row.name}"? It stays here for reference but won't be promotable.`}
        confirmLabel="Reject"
        variant="danger"
        isLoading={isRejecting}
      />
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Scraped Product"
        message={`Permanently delete "${row.name}" from the staging list? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
