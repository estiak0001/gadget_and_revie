'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '@/lib/stores/cart-store';
import { getStorageUrl } from '@/lib/api/config';
import Link from 'next/link';

interface CartProps {
  open: boolean;
  onClose: () => void;
}

export default function Cart({ open, onClose }: CartProps) {
  const { cart, removeItem, updateQuantity, getTotalPrice } = useCartStore();

  const items = cart?.items || [];
  const total = getTotalPrice();

  // Don't render the Dialog at all when closed — prevents any hydration or re-render flash
  if (!open) return null;

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-ink/80 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-4 sm:pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col bg-gradient-to-b from-gray-50 to-white shadow-lg">
                    <div className="flex-1 overflow-y-auto">
                      {/* Header with gradient */}
                      <div className="bg-gradient-to-r from-ink to-ink px-6 py-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <Dialog.Title className="text-2xl font-bold text-white">
                              🛒 Shopping Cart
                            </Dialog.Title>
                            <p className="mt-1 text-sm text-gray-200">
                              {items.length} {items.length === 1 ? 'item' : 'items'}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="relative -m-2 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                            onClick={onClose}
                          >
                            <XMarkIcon className="h-7 w-7" />
                          </button>
                        </div>
                      </div>

                      {/* Cart Items */}
                      <div className="px-6 py-6">
                        <div className="flow-root">
                          {items.length === 0 ? (
                            <div className="text-center py-8">
                              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <span className="text-2xl">🛍️</span>
                              </div>
                              <p className="text-gray-600 text-lg mb-2">Your cart is empty</p>
                              <p className="text-gray-400 text-sm mb-6">Add some items to get started!</p>
                              <Link
                                href="/products"
                                className="inline-flex items-center justify-center bg-gradient-to-r from-ink to-ink text-white px-8 py-3 rounded-xl hover:from-ink hover:to-black font-medium shadow-lg shadow-gray-500/30 transition-all"
                                onClick={onClose}
                              >
                                Start Shopping
                              </Link>
                            </div>
                          ) : (
                            <ul role="list" className="space-y-4">
                              {items.map((item) => {
                                const itemData = item.item_type === 'product' ? item.product : item.service;
                                const itemName = itemData?.name || 'Unknown Item';
                                const itemImage = item.product?.image
                                  ? getStorageUrl(item.product.image)
                                  : (item.service?.image
                                    ? getStorageUrl(item.service.image)
                                    : '/images/placeholder.jpg');

                                return (
                                  <li key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
                                    <div className="flex gap-4">
                                      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 border-gray-100">
                                        <img
                                          src={itemImage}
                                          alt={itemName}
                                          className="h-full w-full object-cover object-center"
                                        />
                                      </div>

                                      <div className="flex flex-1 flex-col">
                                        <div className="flex-1">
                                          <div className="flex justify-between">
                                            <h3 className="text-base font-semibold text-gray-900 leading-tight">
                                              {itemName}
                                            </h3>
                                            <button
                                              type="button"
                                              onClick={() => removeItem(item.id)}
                                              className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                              title="Remove item"
                                            >
                                              <TrashIcon className="h-5 w-5" />
                                            </button>
                                          </div>
                                          <div className="mt-1 flex items-center gap-2">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 capitalize">
                                              {item.item_type === 'service' ? '🔧 Service' : '📦 Product'}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <label htmlFor={`quantity-${item.id}`} className="text-sm text-gray-600 font-medium">
                                              Qty:
                                            </label>
                                            <select
                                              id={`quantity-${item.id}`}
                                              value={item.quantity}
                                              onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                                              className="rounded-lg border-2 border-gray-200 px-3 py-1 text-sm font-semibold text-gray-700 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 bg-white"
                                            >
                                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                                <option key={num} value={num}>
                                                  {num}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <p className="text-lg font-bold text-gray-900">
                                            ৳{((item.unit_price || item.price || 0) * item.quantity).toFixed(2)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>

                    {items.length > 0 && (
                      <div className="border-t-2 border-gray-100 bg-white px-6 py-6">
                        {/* Subtotal Section */}
                        <div className="bg-gradient-to-r from-gray-100 to-red-50 rounded-xl p-4 mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-600 font-medium">Subtotal</span>
                            <span className="text-2xl font-bold text-gray-900">৳{(total || 0).toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <span>✓</span> Free pickup & delivery in Dhaka
                          </p>
                        </div>

                        {/* Checkout Button */}
                        <Link
                          href="/checkout"
                          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-ink to-ink px-6 py-4 text-base font-bold text-white shadow-lg shadow-gray-500/30 hover:shadow-md hover:shadow-gray-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all w-full mb-4"
                          onClick={onClose}
                        >
                          <span>Proceed to Checkout</span>
                          <span>→</span>
                        </Link>

                        {/* Continue Shopping */}
                        <button
                          type="button"
                          className="w-full text-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2"
                          onClick={onClose}
                        >
                          ← Continue Shopping
                        </button>

                        {/* Trust Badges */}
                        <div className="mt-6 pt-6 border-t border-gray-100">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-2xl mb-1">🔒</div>
                              <p className="text-xs text-gray-600 font-medium">Secure Payment</p>
                            </div>
                            <div>
                              <div className="text-2xl mb-1">🚚</div>
                              <p className="text-xs text-gray-600 font-medium">Fast Delivery</p>
                            </div>
                            <div>
                              <div className="text-2xl mb-1">✓</div>
                              <p className="text-xs text-gray-600 font-medium">Quality Parts</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}