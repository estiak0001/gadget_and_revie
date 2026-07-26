'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { XMarkIcon, HeartIcon, ShoppingCartIcon, ArrowsRightLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { useWishlistStore } from '@/lib/stores/wishlist-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { useCompareStore } from '@/lib/stores/compare-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getStorageUrl } from '@/lib/api/config';
import toast from 'react-hot-toast';

interface WishlistDrawerProps {
    open: boolean;
    onClose: () => void;
}

export default function WishlistDrawer({ open, onClose }: WishlistDrawerProps) {
    const { items, removeItem, clearWishlist } = useWishlistStore();
    const { addItem: addToCart } = useCartStore();
    const { toggleItem: toggleCompare, isInCompare } = useCompareStore();
    const { isAuthenticated } = useAuthStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const handleAddToCart = async (productId: number, productName: string, inStock: boolean) => {
        if (!inStock) { toast.error('This product is out of stock'); return; }
        if (!isAuthenticated) { toast.error('Please login to add items to cart'); return; }
        try {
            await addToCart('product', productId, 1);
            toast.success(`${productName} added to cart!`);
        } catch {
            toast.error('Failed to add to cart');
        }
    };

    const handleToggleCompare = (product: any) => {
        const success = toggleCompare(product);
        if (!success) {
            toast.error('You can compare up to 4 products at a time');
        } else if (!isInCompare(product.id)) {
            toast.success('Added to compare');
        }
    };

    if (!mounted) return null;

    return (
        <>
            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Drawer */}
            <div
                className={`fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-md bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-rose-50 to-pink-50">
                    <div className="flex items-center space-x-2">
                        <HeartSolidIcon className="h-5 w-5 text-rose-500" />
                        <h2 className="text-lg font-bold text-gray-900">Wishlist</h2>
                        <span className="ml-2 px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-semibold rounded-full">
                            {items.length}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2">
                        {items.length > 0 && (
                            <button
                                onClick={clearWishlist}
                                className="text-xs text-gray-500 hover:text-rose-600 flex items-center space-x-1 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                            >
                                <TrashIcon className="h-3.5 w-3.5" />
                                <span>Clear all</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                                <HeartIcon className="h-10 w-10 text-rose-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Your wishlist is empty</h3>
                            <p className="text-sm text-gray-500 mb-6">Save products you love to find them later</p>
                            <Link
                                href="/products"
                                onClick={onClose}
                                className="px-5 py-2.5 bg-ink text-white text-sm font-semibold rounded-xl hover:bg-ink/90 transition-colors"
                            >
                                Browse Products
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {items.map((product) => {
                                const inCompare = isInCompare(product.id);
                                const inStock = product.is_in_stock ?? product.stock_qty > 0;
                                return (
                                    <div key={product.id} className="flex gap-3 p-4 hover:bg-gray-50 transition-colors group">
                                        {/* Image */}
                                        <Link href={`/products/${product.slug}`} onClick={onClose} className="flex-shrink-0">
                                            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                                                <img
                                                    src={getStorageUrl(product.image)}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.png'; }}
                                                />
                                            </div>
                                        </Link>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <Link href={`/products/${product.slug}`} onClick={onClose}>
                                                <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 hover:text-gray-600 transition-colors">
                                                    {product.name}
                                                </h4>
                                            </Link>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-base font-bold text-gray-900">
                                                    ৳{product.discount_price || product.price}
                                                </span>
                                                {product.discount_price && (
                                                    <span className="text-xs text-gray-400 line-through">৳{product.price}</span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-semibold ${inStock ? 'text-green-600' : 'text-red-500'}`}>
                                                {inStock ? 'In Stock' : 'Out of Stock'}
                                            </span>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 mt-2">
                                                <button
                                                    onClick={() => handleAddToCart(product.id, product.name, inStock)}
                                                    disabled={!inStock}
                                                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${inStock
                                                            ? 'bg-ink text-white hover:bg-ink/90'
                                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        }`}
                                                >
                                                    <ShoppingCartIcon className="h-3.5 w-3.5" />
                                                    <span>Add to Cart</span>
                                                </button>
                                                <button
                                                    onClick={() => handleToggleCompare(product)}
                                                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${inCompare
                                                            ? 'bg-violet-600 border-violet-600 text-white'
                                                            : 'border-gray-300 text-gray-600 hover:border-violet-500 hover:text-violet-600'
                                                        }`}
                                                >
                                                    <ArrowsRightLeftIcon className="h-3.5 w-3.5" />
                                                    <span>{inCompare ? 'Comparing' : 'Compare'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Remove */}
                                        <button
                                            onClick={() => removeItem(product.id)}
                                            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all self-start"
                                            title="Remove from wishlist"
                                        >
                                            <XMarkIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
                        <Link
                            href="/products"
                            onClick={onClose}
                            className="block w-full text-center py-3 bg-ink text-white font-semibold rounded-xl hover:bg-ink/90 transition-colors text-sm"
                        >
                            Continue Shopping
                        </Link>
                    </div>
                )}
            </div>
        </>
    );
}
