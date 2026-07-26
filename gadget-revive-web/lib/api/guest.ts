import apiClient from './config';
import { Cart, CartItem } from '../types';

// ============================================================
// Guest Cart API Service
// Works via session_id header (UUID stored in localStorage)
// ============================================================

export const guestCartService = {
    /**
     * Get guest carts from API (server-side session cart)
     */
    getCart: async (sessionId: string): Promise<Cart> => {
        const response = await apiClient.get('/guest/cart', {
            headers: { 'X-Guest-Session-Id': sessionId },
        });
        const data = response.data.data;
        // Merge multi-vendor carts into single cart structure
        if (Array.isArray(data)) {
            const items: CartItem[] = [];
            let total = 0;
            data.forEach((cart: any) => {
                if (cart.items) items.push(...cart.items);
                total += cart.subtotal || cart.total || 0;
            });
            if (total === 0 && items.length > 0) {
                total = items.reduce((sum, item) => {
                    const price = item.unit_price || item.price || 0;
                    return sum + price * item.quantity;
                }, 0);
            }
            return { id: data[0]?.id || 0, items, total };
        }
        const items = data?.items || [];
        const total = data?.subtotal || data?.total || 0;
        return { id: data?.id || 0, items, total };
    },

    /**
     * Add item to guest cart (server-side session cart)
     */
    addItem: async (
        sessionId: string,
        data: { item_type: 'product' | 'service'; item_id: number; quantity: number; notes?: string }
    ): Promise<Cart> => {
        const payload: Record<string, any> = {
            session_id: sessionId,
            item_type: data.item_type,
            quantity: data.quantity,
            notes: data.notes,
        };
        if (data.item_type === 'product') {
            payload.product_id = data.item_id;
        } else {
            payload.service_id = data.item_id;
        }
        await apiClient.post('/guest/cart/items', payload);
        return guestCartService.getCart(sessionId);
    },

    /**
     * Update guest cart item
     */
    updateItem: async (
        sessionId: string,
        itemId: number,
        data: { quantity: number; notes?: string }
    ): Promise<Cart> => {
        await apiClient.put(`/guest/cart/items/${itemId}`, {
            session_id: sessionId,
            ...data,
        });
        return guestCartService.getCart(sessionId);
    },

    /**
     * Remove item from guest cart
     */
    removeItem: async (sessionId: string, itemId: number): Promise<void> => {
        await apiClient.delete(`/guest/cart/items/${itemId}`, {
            headers: { 'X-Guest-Session-Id': sessionId },
        });
    },

    /**
     * Clear guest cart
     */
    clearCart: async (sessionId: string): Promise<void> => {
        await apiClient.delete('/guest/cart', {
            headers: { 'X-Guest-Session-Id': sessionId },
        });
    },

    /**
     * Get vendor-grouped carts (for checkout)
     */
    getVendorCarts: async (sessionId: string): Promise<any[]> => {
        const response = await apiClient.get('/guest/cart', {
            headers: { 'X-Guest-Session-Id': sessionId },
        });
        const data = response.data.data;
        if (Array.isArray(data)) {
            return data.map((cart: any) => {
                const items = cart.items || [];
                const computedTotal = items.reduce((sum: number, item: any) => {
                    const price = item.unit_price || item.price || 0;
                    return sum + price * (item.quantity || 1);
                }, 0);
                return {
                    id: cart.id,
                    vendor: {
                        id: cart.vendor_profile_id || cart.vendor?.id,
                        business_name:
                            cart.vendor?.business_name ||
                            cart.vendor_profile?.business_name ||
                            'Gadget Revive Store',
                    },
                    items,
                    total: cart.subtotal || cart.total || computedTotal,
                };
            });
        }
        return [];
    },

    /**
     * Place guest order
     */
    placeOrder: async (
        sessionId: string,
        cartId: number,
        orderData: {
            payment_method: string;
            customer_name: string;
            customer_phone: string;
            customer_email?: string;
            customer_address: string;
            division_id: number;
            district_id: number;
            area_id?: number;
            customer_notes?: string;
        }
    ): Promise<any> => {
        const response = await apiClient.post('/guest/orders', {
            session_id: sessionId,
            cart_id: cartId,
            ...orderData,
        });
        const result = response.data.data;
        return result.order || result;
    },

    /**
     * Place a guest service booking (no cart involved — direct service order).
     */
    placeServiceOrder: async (
        orderData: {
            service_id: number;
            vendor_profile_id?: number;
            payment_method: string;
            customer_name: string;
            customer_phone: string;
            customer_email?: string;
            customer_address: string;
            division_id: number;
            district_id: number;
            area_id?: number;
            customer_notes?: string;
            session_id?: string;
        }
    ): Promise<any> => {
        const response = await apiClient.post('/guest/orders/service', orderData);
        const result = response.data.data;
        return result.order || result;
    },

    /**
     * Track a guest order by order number + phone
     */
    trackOrder: async (orderNumber: string, customerPhone: string): Promise<any> => {
        const response = await apiClient.get(`/guest/orders/track/${orderNumber}`, {
            params: { customer_phone: customerPhone },
        });
        return response.data.data;
    },

    /**
     * Get session orders
     */
    getSessionOrders: async (sessionId: string): Promise<any[]> => {
        const response = await apiClient.get('/guest/orders/session', {
            headers: { 'X-Guest-Session-Id': sessionId },
        });
        return response.data.data || [];
    },

    /**
     * Merge guest cart into user cart after login
     */
    mergeCartAfterLogin: async (sessionId: string): Promise<void> => {
        await apiClient.post('/guest/cart/merge', { session_id: sessionId });
    },
};
