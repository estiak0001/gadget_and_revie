# Quick Reference - Gadget Revive

## 🚀 Quick Commands

```bash
# Development
npm run dev              # Start dev server on http://localhost:3000

# Building
npm run build           # Create production build
npm start               # Start production server

# Dependencies
npm install             # Install all dependencies
npm install <package>   # Install new package
```

## 🔐 Default Credentials

### Admin
```
Email: admin@gadgetrevive.com
Password: password
```

## 📡 API Endpoints Quick Reference

### Authentication
```typescript
import { authService } from '@/lib/api';

// Login
await authService.login({ email, password });

// Register
await authService.register({ name, email, phone, password, password_confirmation, role });

// Get Profile
await authService.getProfile();

// Logout
await authService.logout();
```

### Products
```typescript
import { productService } from '@/lib/api';

// Get all products
await productService.getAll({ search: 'battery', page: 1, per_page: 20 });

// Get product by ID
await productService.getById(1);

// Create product (vendor)
await productService.create({ name, price, ... });
```

### Orders
```typescript
import { orderService } from '@/lib/api';

// Checkout
await orderService.checkout({ vendor_profile_id, payment_method, ... });

// Get customer orders
await orderService.getMyOrders({ status: 'pending' });

// Get vendor orders
await orderService.getVendorOrders({ status: 'pending' });
```

### Locations
```typescript
import { locationService } from '@/lib/api';

// Get divisions
const divisions = await locationService.getDivisions();

// Get districts
const districts = await locationService.getDistricts(divisionId);

// Get areas
const areas = await locationService.getAreas(districtId);
```

## 🎨 Tailwind Utility Classes

### Gradients
```tsx
className="bg-gradient-to-r from-orange-500 to-red-500"
```

### Buttons
```tsx
className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all shadow-lg"
```

### Cards
```tsx
className="bg-white rounded-lg shadow-lg p-6"
```

### Input Fields
```tsx
className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
```

## 📦 Common Components

### Location Selector
```tsx
import LocationSelector from '@/components/LocationSelector';

<LocationSelector
  divisionId={divisionId}
  districtId={districtId}
  areaId={areaId}
  onDivisionChange={setDivisionId}
  onDistrictChange={setDistrictId}
  onAreaChange={setAreaId}
  required
/>
```

### Status Badge
```tsx
import StatusBadge from '@/components/StatusBadge';

<StatusBadge status="pending" type="order" />
<StatusBadge status="approved" type="vendor" />
```

## 🔄 State Management

### Auth Store
```typescript
import { useAuthStore } from '@/lib/stores/auth-store';

const { user, isAuthenticated, setAuth, logout } = useAuthStore();
```

### Cart Store
```typescript
import { useCartStore } from '@/lib/stores/cart-store';

const { cart, fetchCart, addItem, removeItem } = useCartStore();
```

## 🛡️ Route Protection

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function ProtectedPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    
    // Role check
    if (user?.role.name !== 'vendor') {
      router.push('/');
    }
  }, [isAuthenticated, user, router]);
  
  return <div>Protected Content</div>;
}
```

## 🎯 User Role Routing

```typescript
// After login
if (user.role.name === 'super_admin' || user.role.name === 'admin') {
  router.push('/admin');
} else if (user.role.name === 'vendor') {
  router.push('/vendor');
} else {
  router.push('/dashboard');
}
```

## 📝 Form Handling

```typescript
const [formData, setFormData] = useState({ name: '', email: '' });
const [loading, setLoading] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  
  try {
    await myService.create(formData);
    toast.success('Success!');
  } catch (error: any) {
    // Handle validation errors
    if (error.response?.data?.errors) {
      const errors = error.response.data.errors;
      Object.keys(errors).forEach((key) => {
        errors[key].forEach((msg: string) => toast.error(msg));
      });
    } else {
      toast.error(error.response?.data?.message || 'An error occurred');
    }
  } finally {
    setLoading(false);
  }
};
```

## 🔍 Search & Filter Pattern

```typescript
const [filters, setFilters] = useState({
  search: '',
  category_id: 0,
  page: 1,
  per_page: 20,
});

useEffect(() => {
  loadData();
}, [filters]);

const loadData = async () => {
  const data = await myService.getAll(filters);
  setData(data);
};

// Update filter
const handleSearch = (search: string) => {
  setFilters({ ...filters, search, page: 1 });
};
```

## 🎨 Status Colors

| Status | Color |
|--------|-------|
| Pending | Yellow |
| Confirmed | Blue |
| In Progress | Purple |
| Completed | Green |
| Cancelled | Red |
| Rejected | Red |
| Approved | Green |

## 📱 Responsive Design

```tsx
// Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Flex
<div className="flex flex-col md:flex-row gap-4">

// Hidden on mobile
<div className="hidden md:block">

// Mobile only
<div className="block md:hidden">
```

## 🚨 Error Handling

```typescript
try {
  const data = await apiCall();
  return data;
} catch (error: any) {
  // Validation errors
  if (error.response?.data?.errors) {
    // Handle each error
  }
  
  // General error
  const message = error.response?.data?.message || error.message || 'Error occurred';
  toast.error(message);
  
  throw error;
}
```

## 🔄 Loading States

```tsx
{loading ? (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin h-12 w-12 border-4 border-orange-500 border-t-transparent rounded-full"></div>
  </div>
) : (
  <div>Content</div>
)}
```

## 📊 Pagination

```tsx
{data?.links && (
  <div className="flex items-center justify-between mt-6">
    <button
      onClick={() => setPage(page - 1)}
      disabled={!data.links.prev}
      className="px-4 py-2 bg-gray-100 rounded-lg disabled:opacity-50"
    >
      Previous
    </button>
    
    <span className="text-gray-600">
      Page {data.meta.current_page} of {data.meta.last_page}
    </span>
    
    <button
      onClick={() => setPage(page + 1)}
      disabled={!data.links.next}
      className="px-4 py-2 bg-gray-100 rounded-lg disabled:opacity-50"
    >
      Next
    </button>
  </div>
)}
```

## 💡 Pro Tips

1. **Always check authentication** before making API calls
2. **Use TypeScript types** - they're your friends
3. **Handle errors gracefully** - show user-friendly messages
4. **Add loading states** - better UX
5. **Test with real API** - don't mock everything
6. **Use environment variables** - never hardcode
7. **Follow existing patterns** - consistency is key
8. **Check existing components** - don't reinvent the wheel

## 📚 Documentation Links

- [Full Implementation Status](./IMPLEMENTATION_STATUS.md)
- [Development Guide](./DEVELOPMENT_GUIDE.md)
- [Project Summary](./PROJECT_SUMMARY.md)
- [API Documentation](./docs/API_DOCUMENTATION.md)

---

**Keep this handy while developing!** 🚀
