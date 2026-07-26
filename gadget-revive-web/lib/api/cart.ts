import apiClient from './config';
import { 
  Cart, 
  AddToCartRequest,
  CartItem,
  VendorCart 
} from '../types';

export const cartService = {
  /**
   * Get cart (authenticated)
   */
  getCart: async (): Promise<Cart> => {
    const response = await apiClient.get('/cart');
    const data = response.data.data;
    // API returns array of carts grouped by vendor - merge into single cart
    if (Array.isArray(data)) {
      const items: CartItem[] = [];
      let total = 0;
      data.forEach((cart: any) => {
        if (cart.items) {
          items.push(...cart.items);
        }
        total += cart.subtotal || cart.total || 0;
      });
      // Compute from items if API total is 0
      if (total === 0 && items.length > 0) {
        total = items.reduce((sum, item) => {
          const price = item.unit_price || item.price || 0;
          return sum + (price * item.quantity);
        }, 0);
      }
      return { id: data[0]?.id || 0, items, total };
    }
    const items = data?.items || [];
    let total = data?.subtotal || data?.total || 0;
    if (total === 0 && items.length > 0) {
      total = items.reduce((sum: number, item: any) => {
        const price = item.unit_price || item.price || 0;
        return sum + (price * (item.quantity || 1));
      }, 0);
    }
    return { id: data?.id || 0, items, total };
  },

  /**
   * Add item to cart (authenticated)
   */
  addItem: async (data: AddToCartRequest): Promise<Cart> => {
    // API expects product_id/service_id, not item_id
    const payload: Record<string, any> = {
      item_type: data.item_type,
      quantity: data.quantity,
      notes: data.notes,
    };
    if (data.item_type === 'product') {
      payload.product_id = data.item_id;
    } else {
      payload.service_id = data.item_id;
    }
    const response = await apiClient.post('/cart/items', payload);
    // After adding, re-fetch the full cart to get accurate totals
    return cartService.getCart();
  },

  /**
   * Update cart item (authenticated)
   */
  updateItem: async (id: number, data: { quantity: number; notes?: string }): Promise<Cart> => {
    const response = await apiClient.put(`/cart/items/${id}`, data);
    // Re-fetch the full cart to get accurate totals
    return cartService.getCart();
  },

  /**
   * Remove cart item (authenticated)
   */
  removeItem: async (id: number): Promise<void> => {
    await apiClient.delete(`/cart/items/${id}`);
  },

  /**
   * Clear cart (authenticated)
   */
  clearCart: async (): Promise<void> => {
    await apiClient.delete('/cart');
  },

  /**
   * Get vendor-grouped carts (for checkout)
   */
  getVendorCarts: async (): Promise<VendorCart[]> => {
    const response = await apiClient.get('/cart');
    const data = response.data.data;
    if (Array.isArray(data)) {
      return data.map((cart: any) => {
        const items = cart.items || [];
        const computedTotal = items.reduce((sum: number, item: any) => {
          const price = item.unit_price || item.price || 0;
          return sum + (price * (item.quantity || 1));
        }, 0);
        return {
          id: cart.id,
          vendor: {
            id: cart.vendor_profile_id || cart.vendor?.id,
            business_name: cart.vendor?.business_name || cart.vendor_profile?.business_name || 'Unknown Vendor',
          },
          items,
          total: cart.subtotal || cart.total || computedTotal,
        };
      });
    }
    if (data) {
      const items = data.items || [];
      const computedTotal = items.reduce((sum: number, item: any) => {
        const price = item.unit_price || item.price || 0;
        return sum + (price * (item.quantity || 1));
      }, 0);
      return [{ id: data.id, vendor: { id: data.vendor_profile_id, business_name: 'Vendor' }, items, total: data.subtotal || data.total || computedTotal }];
    }
    return [];
  },
};
