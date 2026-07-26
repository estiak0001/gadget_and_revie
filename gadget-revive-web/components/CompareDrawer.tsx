'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    XMarkIcon,
    ArrowsRightLeftIcon,
    ShoppingCartIcon,
    CheckCircleIcon,
    XCircleIcon,
    ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { useCompareStore } from '@/lib/stores/compare-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getStorageUrl } from '@/lib/api/config';
import toast from 'react-hot-toast';
import { Product } from '@/lib/types';

export default function CompareDrawer() {
    const { items, removeItem, clearCompare, isOpen, setOpen } = useCompareStore();
    const { addItem: addToCart } = useCartStore();
    const { isAuthenticated } = useAuthStore();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [narrow, setNarrow] = useState(false);

    // Routes that already own the bottom edge (dashboard dock, checkout CTA,
    // auth flows). Hiding the compare bar on these avoids stacking two fixed
    // bars at z-50/z-40 and covering each other's tap targets. The items
    // remain in the store — the bar reappears on product/listing pages.
    const hideOnRoute =
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/checkout');

    useEffect(() => { setMounted(true); }, []);

    // Track viewport width while the modal is open so the table's minWidth
    // reflects the current breakpoint (rotation, window resize, etc.).
    useEffect(() => {
        if (!modalOpen) return;
        const check = () => setNarrow(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [modalOpen]);

    // While the fixed compare bar is visible, reserve document space at the
    // bottom so the last product-card row / footer isn't clipped behind it.
    // Cleanup restores the original paddingBottom on unmount or when the list
    // empties / the route hides the bar.
    useEffect(() => {
        if (!mounted || items.length === 0 || hideOnRoute) return;
        const previous = document.body.style.paddingBottom;
        document.body.style.paddingBottom =
            'calc(72px + env(safe-area-inset-bottom, 0px))';
        return () => {
            document.body.style.paddingBottom = previous;
        };
    }, [mounted, items.length, hideOnRoute]);

    if (!mounted) return null;
    if (items.length === 0) return null;
    if (hideOnRoute) return null;

    const handleAddToCart = async (product: Product) => {
        if (!isAuthenticated) { toast.error('Please login to add items to cart'); return; }
        if (product.stock_qty <= 0) { toast.error('This product is out of stock'); return; }
        try {
            await addToCart('product', product.id, 1);
            toast.success(`${product.name} added to cart!`);
        } catch {
            toast.error('Failed to add to cart');
        }
    };

    // Gather all spec keys across compared products
    const allSpecKeys = Array.from(
        new Set(items.flatMap((p) => Object.keys(p.specifications || {})))
    );

    const compareRows: { label: string; values: (string | number | boolean | null)[] }[] = [
        { label: 'Price', values: items.map((p) => `৳${p.discount_price || p.price}`) },
        { label: 'Original Price', values: items.map((p) => p.discount_price ? `৳${p.price}` : '—') },
        { label: 'Discount', values: items.map((p) => p.discount_price ? `${Math.round(((p.price - p.discount_price) / p.price) * 100)}% OFF` : '—') },
        { label: 'Stock', values: items.map((p) => p.stock_qty > 0 ? `${p.stock_qty} units` : 'Out of Stock') },
        { label: 'SKU', values: items.map((p) => p.sku || '—') },
        { label: 'Brand', values: items.map((p) => p.brand_name || p.brand || '—') },
        { label: 'Warranty', values: items.map((p) => (p as any).warranty_period || '—') },
        { label: 'Category', values: items.map((p) => p.category?.name || '—') },
        ...allSpecKeys.map((key) => ({
            label: key,
            values: items.map((p) => p.specifications?.[key] != null ? String(p.specifications[key]) : '—'),
        })),
    ];

    return (
        <>
            {/* Sticky Compare Bar */}
            <div
                className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                <div className="bg-gradient-to-r from-ink to-ink text-white shadow-lg">
                    <div className="max-w-[1800px] mx-auto px-2.5 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Left: items — icon badge on mobile, full label on ≥sm */}
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                                <div className="relative flex-shrink-0 sm:hidden">
                                    <ArrowsRightLeftIcon className="h-5 w-5 text-violet-400" />
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-violet-500 text-[10px] font-bold text-white flex items-center justify-center">
                                        {items.length}
                                    </span>
                                </div>
                                <ArrowsRightLeftIcon className="h-5 w-5 text-violet-400 flex-shrink-0 hidden sm:block" />
                                <span className="hidden sm:inline text-sm font-semibold text-gray-300 flex-shrink-0">
                                    Compare {items.length}/4
                                </span>
                                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none min-w-0">
                                    {items.map((p) => (
                                        <div
                                            key={p.id}
                                            className="flex items-center gap-1 sm:gap-1.5 bg-white/10 rounded-lg pl-1 pr-0.5 sm:px-2.5 py-0.5 sm:py-1.5 flex-shrink-0"
                                        >
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md overflow-hidden bg-white/20 flex-shrink-0">
                                                <img
                                                    src={getStorageUrl(p.image)}
                                                    alt={p.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.png'; }}
                                                />
                                            </div>
                                            <span className="hidden sm:inline text-xs text-white font-medium max-w-[90px] truncate">{p.name}</span>
                                            {/* 32×32 tap target on mobile; visual X stays 14px */}
                                            <button
                                                onClick={() => removeItem(p.id)}
                                                className="w-8 h-8 sm:w-auto sm:h-auto sm:ml-1 sm:p-0.5 flex items-center justify-center text-gray-300 hover:text-white active:text-white flex-shrink-0 transition-colors"
                                                aria-label={`Remove ${p.name} from compare`}
                                            >
                                                <XMarkIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {/* Empty slots — desktop only */}
                                    {Array.from({ length: 4 - items.length }).map((_, i) => (
                                        <div
                                            key={`empty-${i}`}
                                            className="hidden sm:flex w-24 h-[38px] rounded-lg border-2 border-white/20 border-dashed items-center justify-center flex-shrink-0"
                                        >
                                            <span className="text-xs text-white/30">+ Add</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: actions */}
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                <button
                                    onClick={() => setModalOpen(true)}
                                    disabled={items.length < 2}
                                    className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 h-9 sm:h-auto sm:py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
                                    aria-label="Open comparison"
                                >
                                    <ArrowsRightLeftIcon className="h-4 w-4 sm:hidden" />
                                    <span className="hidden sm:inline">Compare Now</span>
                                    <span className="sm:hidden">Compare</span>
                                </button>
                                <button
                                    onClick={clearCompare}
                                    className="w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-2 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 rounded-xl text-sm transition-colors"
                                    aria-label="Clear compare list"
                                >
                                    <span className="hidden sm:inline">Clear</span>
                                    <XMarkIcon className="h-4 w-4 sm:hidden" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comparison Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-[60] flex items-stretch sm:items-start justify-center sm:overflow-y-auto">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/60"
                        onClick={() => setModalOpen(false)}
                    />

                    {/* Modal — full-screen on mobile, centered card on ≥sm */}
                    <div className="relative z-10 bg-white sm:rounded-xl shadow-lg w-full sm:max-w-6xl sm:mx-4 sm:my-6 flex flex-col h-full sm:h-auto sm:max-h-[95vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <ArrowsRightLeftIcon className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600 flex-shrink-0" />
                                <h2 className="text-sm sm:text-xl font-bold text-gray-900 truncate">Product Comparison</h2>
                                <span className="text-xs sm:text-sm text-gray-500 flex-shrink-0">({items.length})</span>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
                                aria-label="Close comparison"
                            >
                                <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {/* Per-column width shrinks on mobile so two cards
                                fit without ridiculous horizontal scrolling. */}
                            <table
                                className="w-full"
                                style={{
                                    minWidth: narrow
                                        ? `${items.length * 140 + 110}px`
                                        : `${items.length * 220 + 180}px`,
                                }}
                            >
                                {/* Product headers */}
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50">
                                        <th className="text-left p-2 sm:p-5 text-[11px] sm:text-sm font-semibold text-gray-500 w-[96px] sm:w-44 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                                            Product
                                        </th>
                                        {items.map((p) => (
                                            <th key={p.id} className="p-2 sm:p-5 text-center align-top">
                                                <div className="flex flex-col items-center gap-2 sm:gap-3">
                                                    <button
                                                        onClick={() => removeItem(p.id)}
                                                        className="self-end text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Remove from compare"
                                                        aria-label={`Remove ${p.name}`}
                                                    >
                                                        <XMarkIcon className="h-4 w-4" />
                                                    </button>
                                                    <Link href={`/products/${p.slug}`} onClick={() => setModalOpen(false)}>
                                                        <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg sm:rounded-xl overflow-hidden bg-gray-100 border border-gray-200 mx-auto hover:shadow-md transition-shadow">
                                                            <img
                                                                src={getStorageUrl(p.image)}
                                                                alt={p.name}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.png'; }}
                                                            />
                                                        </div>
                                                    </Link>
                                                    <Link
                                                        href={`/products/${p.slug}`}
                                                        onClick={() => setModalOpen(false)}
                                                        className="text-[11px] sm:text-sm font-bold text-gray-900 hover:text-violet-600 text-center line-clamp-2 leading-tight transition-colors"
                                                    >
                                                        {p.name}
                                                    </Link>
                                                    <div className="text-sm sm:text-xl font-bold text-gray-900">
                                                        ৳{p.discount_price || p.price}
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddToCart(p)}
                                                        disabled={p.stock_qty <= 0}
                                                        className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-semibold transition-all w-full ${p.stock_qty > 0
                                                                ? 'bg-ink text-white hover:bg-ink/90 hover:shadow-lg'
                                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <ShoppingCartIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                        <span className="whitespace-nowrap">{p.stock_qty > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
                                                    </button>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                {/* Comparison rows */}
                                <tbody>
                                    {compareRows.map((row, rowIdx) => {
                                        const allSame = row.values.every((v) => v === row.values[0]);
                                        return (
                                            <tr
                                                key={row.label}
                                                className={`border-b border-gray-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                                            >
                                                <td className="p-2 sm:p-4 text-[11px] sm:text-sm font-semibold text-gray-600 sticky left-0 bg-inherit border-r border-gray-200 z-10 w-[96px] sm:w-44">
                                                    {row.label}
                                                </td>
                                                {row.values.map((val, idx) => {
                                                    const isBest = !allSame && row.label === 'Price'
                                                        ? val === row.values.reduce((min, v) => (String(v) < String(min) ? v : min))
                                                        : false;
                                                    return (
                                                        <td
                                                            key={idx}
                                                            className={`p-2 sm:p-4 text-[11px] sm:text-sm text-center transition-colors ${isBest ? 'text-green-700 font-bold' : 'text-gray-700'
                                                                }`}
                                                        >
                                                            {val === 'Out of Stock' ? (
                                                                <span className="flex items-center justify-center gap-1 text-red-500">
                                                                    <XCircleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                                                                    <span>{val}</span>
                                                                </span>
                                                            ) : val === 'In Stock' || (typeof val === 'string' && val.includes('units')) ? (
                                                                <span className="flex items-center justify-center gap-1 text-green-600">
                                                                    <CheckCircleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                                                                    <span>{val}</span>
                                                                </span>
                                                            ) : (
                                                                String(val)
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div
                            className="bg-white border-t border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 flex-shrink-0"
                            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
                        >
                            <button
                                onClick={() => { clearCompare(); setModalOpen(false); }}
                                className="text-xs sm:text-sm text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                            >
                                <XMarkIcon className="h-4 w-4" />
                                <span>Clear All</span>
                            </button>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-4 sm:px-5 py-2 bg-ink text-white font-semibold rounded-xl hover:bg-ink/90 transition-colors text-xs sm:text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
