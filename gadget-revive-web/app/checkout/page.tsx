'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cartService, guestCartService, orderService, locationService } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useCartStore, getOrCreateSessionId } from '@/lib/stores/cart-store';
import { VendorCart, Division, District, Area, CheckoutRequest } from '@/lib/types';
import {
  ShoppingCartIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  TruckIcon,
  MapPinIcon,
  UserIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { fetchCart } = useCartStore();

  const [vendorCarts, setVendorCarts] = useState<VendorCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ numbers: string[]; isGuest: boolean }>({
    numbers: [],
    isGuest: false,
  });

  // Location data
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  // Form fields
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerAddress, setCustomerAddress] = useState('');
  const [divisionId, setDivisionId] = useState<number>(0);
  const [districtId, setDistrictId] = useState<number>(0);
  const [areaId, setAreaId] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [customerNotes, setCustomerNotes] = useState('');

  useEffect(() => {
    loadData();
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [divs] = await Promise.all([locationService.getDivisions()]);
      setDivisions(divs);

      if (isAuthenticated) {
        const carts = await cartService.getVendorCarts();
        setVendorCarts(carts);
      } else {
        const sessionId = getOrCreateSessionId();
        if (sessionId) {
          const carts = await guestCartService.getVendorCarts(sessionId);
          setVendorCarts(carts);
        }
      }
    } catch (error) {
      toast.error('Failed to load checkout data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (divisionId) {
      locationService.getDistricts(divisionId).then(setDistricts).catch(() => setDistricts([]));
      setDistrictId(0);
      setAreaId(0);
      setAreas([]);
    }
  }, [divisionId]);

  useEffect(() => {
    if (districtId) {
      locationService.getAreas(districtId).then(setAreas).catch(() => setAreas([]));
      setAreaId(0);
    }
  }, [districtId]);

  const grandTotal = vendorCarts.reduce((t, c) => t + c.total, 0);

  const handlePlaceOrders = async () => {
    if (!customerName || !customerPhone || !customerAddress || !divisionId || !districtId) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (vendorCarts.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setSubmitting(true);
    const orderNumbers: string[] = [];

    try {
      if (isAuthenticated) {
        // Authenticated checkout
        for (const cart of vendorCarts) {
          const orderData: CheckoutRequest = {
            cart_id: cart.id,
            payment_method: paymentMethod as any,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail || undefined,
            customer_address: customerAddress,
            division_id: divisionId,
            district_id: districtId,
            area_id: areaId || undefined,
            customer_notes: customerNotes || undefined,
          };
          const order = await orderService.placeOrder(orderData);
          orderNumbers.push(order.order_number || `#${order.id}`);
        }
        setOrderSuccess({ numbers: orderNumbers, isGuest: false });
        await fetchCart(true);
      } else {
        // Guest checkout
        const sessionId = getOrCreateSessionId();
        for (const cart of vendorCarts) {
          const order = await guestCartService.placeOrder(sessionId, cart.id, {
            payment_method: paymentMethod,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail || undefined,
            customer_address: customerAddress,
            division_id: divisionId,
            district_id: districtId,
            area_id: areaId || undefined,
            customer_notes: customerNotes || undefined,
          });
          orderNumbers.push(order.order_number || `#${order.id}`);
        }
        setOrderSuccess({ numbers: orderNumbers, isGuest: true });
        await fetchCart(false);
      }
      toast.success('All orders placed successfully!');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-ink border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Order success screen
  if (orderSuccess.numbers.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Order Placed!</h1>
          <p className="text-gray-600 mb-6">Your order(s) have been placed successfully.</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">Order Numbers:</p>
            {orderSuccess.numbers.map((num, i) => (
              <p key={i} className="font-bold text-gray-900 text-lg">{num}</p>
            ))}
          </div>

          {/* Guest-specific: save order numbers prompt */}
          {orderSuccess.isGuest && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-1">Save your order number!</p>
                  <p className="text-xs text-amber-700">
                    Since you checked out as a guest, please save your order number and the phone number you used.
                    You can track your order anytime on the <strong>Track Order</strong> page.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500 mb-6">
            {paymentMethod === 'bkash' && 'Please complete your bKash payment. Check your order details for payment instructions.'}
            {paymentMethod === 'cash' && 'You will pay cash on delivery.'}
            {paymentMethod === 'bank_transfer' && 'Please transfer to the bank account shown in your order details.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard" className="flex-1 px-6 py-3 bg-gradient-to-r from-ink to-ink text-white font-semibold rounded-xl hover:shadow-lg transition-all text-center">
                View Orders
              </Link>
            ) : (
              <Link href={`/orders/track?order=${orderSuccess.numbers[0]}`} className="flex-1 px-6 py-3 bg-gradient-to-r from-ink to-ink text-white font-semibold rounded-xl hover:shadow-lg transition-all text-center">
                Track Order
              </Link>
            )}
            <Link href="/products" className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all text-center">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (vendorCarts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingCartIcon className="mx-auto h-16 w-16 text-gray-300 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
          <p className="text-gray-600 mb-6">Add some products to your cart before checking out.</p>
          <Link href="/products" className="px-6 py-3 bg-gradient-to-r from-ink to-ink text-white font-semibold rounded-xl hover:shadow-lg transition-all">
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-600 mt-1">Complete your purchase</p>
          {!isAuthenticated && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2 w-fit">
              <InformationCircleIcon className="h-4 w-4 flex-shrink-0" />
              <span>
                Checking out as guest.{' '}
                <Link href="/auth/login" className="font-semibold underline">
                  Login
                </Link>{' '}
                to save your order history.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <UserIcon className="h-6 w-6 text-gray-800 mr-2" />Contact Information
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none" placeholder="Your full name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none" placeholder="01XXXXXXXXX" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email {!isAuthenticated && <span className="text-gray-500">(used to track your order)</span>}</label>
                  <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none" placeholder="your@email.com" />
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <MapPinIcon className="h-6 w-6 text-gray-800 mr-2" />Delivery Address
              </h2>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division *</label>
                  <select value={divisionId} onChange={(e) => setDivisionId(Number(e.target.value))} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none">
                    <option value={0}>Select Division</option>
                    {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District *</label>
                  <select value={districtId} onChange={(e) => setDistrictId(Number(e.target.value))} disabled={!divisionId} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none disabled:bg-gray-100">
                    <option value={0}>Select District</option>
                    {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                  <select value={areaId} onChange={(e) => setAreaId(Number(e.target.value))} disabled={!districtId} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none disabled:bg-gray-100">
                    <option value={0}>Select Area</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Address *</label>
                <textarea value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none" placeholder="House/Road/Block, Area details..." />
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <CreditCardIcon className="h-6 w-6 text-gray-800 mr-2" />Payment Method
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { value: 'bkash', label: 'bKash', desc: 'Mobile banking', icon: '📱' },
                  { value: 'cash', label: 'Cash on Delivery', desc: 'Pay when you receive', icon: '💵' },
                  { value: 'bank_transfer', label: 'Bank Transfer', desc: 'Direct bank transfer', icon: '🏦' },
                ].map((method) => (
                  <button key={method.value} onClick={() => setPaymentMethod(method.value)} className={`p-4 rounded-xl border-2 text-left transition-all ${paymentMethod === method.value ? 'border-ink bg-gray-100' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="text-2xl mb-2 block">{method.icon}</span>
                    <p className="font-semibold text-gray-900">{method.label}</p>
                    <p className="text-sm text-gray-600">{method.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Notes (Optional)</h2>
              <textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ink focus:border-ink outline-none" placeholder="Any special instructions for your order..." />
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>

              {vendorCarts.map((cart, ci) => (
                <div key={cart.id} className={`${ci > 0 ? 'mt-4 pt-4 border-t border-gray-200' : ''}`}>
                  <p className="text-sm font-semibold text-gray-900 mb-3">{cart.vendor.business_name}</p>
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-start mb-3">
                      <div className="flex-1 pr-2">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">
                          {item.product?.name || item.service?.name || 'Item'}
                        </p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity} × ৳{item.unit_price || item.price}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">৳{item.total_price || item.subtotal || ((item.unit_price || item.price || 0) * item.quantity)}</p>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">৳{cart.total}</span>
                  </div>
                </div>
              ))}

              <div className="mt-4 pt-4 border-t-2 border-gray-200">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Shipping</span>
                  <span className="text-green-600 font-medium">Free</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-gray-900">৳{grandTotal}</span>
                </div>
              </div>

              <button onClick={handlePlaceOrders} disabled={submitting} className={`w-full mt-6 px-6 py-4 font-bold text-lg rounded-xl transition-all ${submitting ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-ink to-ink text-white hover:shadow-md hover:scale-105'}`}>
                {submitting ? 'Processing...' : `Place Order • ৳${grandTotal}`}
              </button>

              {/* Trust badges */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <ShieldCheckIcon className="h-5 w-5 text-green-500 mr-2" />Secure checkout
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <TruckIcon className="h-5 w-5 text-green-500 mr-2" />Fast delivery
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}