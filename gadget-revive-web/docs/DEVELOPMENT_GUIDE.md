# Development Guide - Gadget Revive Next.js App

## 🎯 Quick Start for Developers

### Prerequisites
- Node.js 18+ installed
- Laravel API running on `http://localhost:8000`
- Basic knowledge of Next.js, React, and TypeScript

### Initial Setup

1. **Install Dependencies**
```bash
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

3. **Start Development Server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📚 Architecture Overview

### API Layer (`lib/api/`)
All API calls are centralized in service files:
- Each service file handles one resource (auth, products, vendors, etc.)
- Uses axios with interceptors for automatic token injection
- Error handling is standardized across all requests

**Example API Call:**
```typescript
import { productService } from '@/lib/api';

// Get products with filters
const products = await productService.getAll({
  category_id: 1,
  search: 'battery',
  per_page: 20
});
```

### State Management (`lib/stores/`)
Using Zustand for global state:
- `auth-store.ts` - User authentication and profile
- `cart-store.ts` - Shopping cart state
- `ticket-store.ts` - Support tickets (to be implemented)

**Example Store Usage:**
```typescript
import { useAuthStore } from '@/lib/stores/auth-store';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuthStore();
  
  if (!isAuthenticated) {
    return <div>Please login</div>;
  }
  
  return <div>Welcome {user?.name}</div>;
}
```

### Type Safety (`lib/types.ts`)
All API responses are typed. Always import and use these types:

```typescript
import { Product, Order, VendorProfile } from '@/lib/types';

const handleProduct = (product: Product) => {
  console.log(product.name, product.price);
};
```

## 🛠 Development Workflow

### Creating a New Page

1. **Create the page file**
```typescript
// app/my-feature/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { myService } from '@/lib/api';

export default function MyFeaturePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const result = await myService.getAll();
      setData(result);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <div>Loading...</div>;
  
  return <div>My Feature</div>;
}
```

### Adding a New API Endpoint

1. **Define types in `lib/types.ts`**
```typescript
export interface MyResource {
  id: number;
  name: string;
  // ... other fields
}
```

2. **Create service in `lib/api/my-resource.ts`**
```typescript
import apiClient from './config';
import { MyResource, PaginatedResponse } from '../types';

export const myResourceService = {
  getAll: async (): Promise<PaginatedResponse<MyResource>> => {
    const response = await apiClient.get<PaginatedResponse<MyResource>>('/my-resources');
    return response.data;
  },
  
  getById: async (id: number): Promise<MyResource> => {
    const response = await apiClient.get<MyResource>(`/my-resources/${id}`);
    return response.data;
  },
  
  create: async (data: Partial<MyResource>): Promise<MyResource> => {
    const response = await apiClient.post<MyResource>('/my-resources', data);
    return response.data;
  },
};
```

3. **Export from `lib/api/index.ts`**
```typescript
export { myResourceService } from './my-resource';
```

### Creating Reusable Components

Components should be placed in `/components` directory:

```typescript
// components/MyComponent.tsx
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export default function MyComponent({ title, onAction }: MyComponentProps) {
  return (
    <div>
      <h2>{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  );
}
```

## 🔐 Authentication & Authorization

### Protecting Routes

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
    
    // Check role
    if (user?.role.name !== 'admin') {
      router.push('/');
      return;
    }
  }, [isAuthenticated, user, router]);
  
  // Your protected content
  return <div>Admin Content</div>;
}
```

### Making Authenticated API Calls

Token is automatically added to requests by the axios interceptor. Just call the API:

```typescript
const profile = await authService.getProfile(); // Token added automatically
```

## 🎨 Styling Guidelines

Using Tailwind CSS v4:

### Common Patterns

**Buttons:**
```tsx
<button className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all shadow-lg hover:shadow-xl">
  Click Me
</button>
```

**Cards:**
```tsx
<div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
  {/* Content */}
</div>
```

**Form Inputs:**
```tsx
<input 
  type="text"
  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
  placeholder="Enter text"
/>
```

## 📝 Common Tasks

### 1. Display Paginated Data

```typescript
const [data, setData] = useState<PaginatedResponse<Product> | null>(null);
const [page, setPage] = useState(1);

const loadData = async () => {
  const result = await productService.getAll({ page, per_page: 20 });
  setData(result);
};

// In JSX:
{data?.data.map(item => (
  <div key={item.id}>{item.name}</div>
))}

{/* Pagination */}
<div>
  <button 
    onClick={() => setPage(page - 1)}
    disabled={!data?.links.prev}
  >
    Previous
  </button>
  <span>Page {data?.meta.current_page} of {data?.meta.last_page}</span>
  <button 
    onClick={() => setPage(page + 1)}
    disabled={!data?.links.next}
  >
    Next
  </button>
</div>
```

### 2. Handle Forms with Validation

```typescript
import { useState } from 'react';
import toast from 'react-hot-toast';

const [formData, setFormData] = useState({
  name: '',
  email: '',
});

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    await myService.create(formData);
    toast.success('Success!');
  } catch (error: any) {
    if (error.response?.data?.errors) {
      // Display validation errors
      const errors = error.response.data.errors;
      Object.keys(errors).forEach((key) => {
        errors[key].forEach((msg: string) => toast.error(msg));
      });
    } else {
      toast.error('An error occurred');
    }
  }
};
```

### 3. Use Location Selector

```typescript
import LocationSelector from '@/components/LocationSelector';

const [location, setLocation] = useState({
  division_id: 0,
  district_id: 0,
  area_id: 0,
});

<LocationSelector
  divisionId={location.division_id}
  districtId={location.district_id}
  areaId={location.area_id}
  onDivisionChange={(id) => setLocation({ ...location, division_id: id })}
  onDistrictChange={(id) => setLocation({ ...location, district_id: id })}
  onAreaChange={(id) => setLocation({ ...location, area_id: id })}
  required
/>
```

### 4. Display Status Badges

```typescript
import StatusBadge from '@/components/StatusBadge';

<StatusBadge status="pending" type="order" />
<StatusBadge status="approved" type="vendor" />
<StatusBadge status="paid" type="payment" />
```

## 🐛 Debugging Tips

### 1. Check Network Requests
Open DevTools → Network tab to see all API calls

### 2. Inspect State
```typescript
const authState = useAuthStore.getState();
console.log('Auth State:', authState);
```

### 3. API Errors
All API errors are logged to console. Check for:
- Response status codes
- Error messages
- Validation errors

### 4. Common Issues

**Issue: "Unauthenticated" errors**
- Check if token is in localStorage: `localStorage.getItem('auth_token')`
- Verify token is not expired
- Try logging in again

**Issue: CORS errors**
- Ensure Laravel API has proper CORS configuration
- Check API URL in `.env.local`

**Issue: Data not updating**
- Check if API call is successful
- Verify state is being updated
- Use React DevTools to inspect component state

## 📦 Building for Production

```bash
# Create production build
npm run build

# Start production server
npm start
```

### Environment Variables for Production
```env
NEXT_PUBLIC_API_URL=https://api.gadgetrevive.com/api
```

## 🧪 Testing (To be implemented)

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📖 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Zustand Guide](https://github.com/pmndrs/zustand)
- [Axios Documentation](https://axios-http.com/)
- API Documentation: `/docs/API_DOCUMENTATION.md`

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Test thoroughly
4. Commit: `git commit -m "Add my feature"`
5. Push: `git push origin feature/my-feature`
6. Create a Pull Request

## 💡 Best Practices

1. **Always use TypeScript types** - No `any` unless absolutely necessary
2. **Handle loading states** - Show spinners while fetching data
3. **Handle errors gracefully** - Display user-friendly error messages
4. **Use environment variables** - Never hardcode API URLs
5. **Keep components small** - Break down large components
6. **Comment complex logic** - Help future developers understand
7. **Test edge cases** - Empty states, errors, loading states
8. **Follow naming conventions** - Use descriptive, consistent names
9. **Clean up effects** - Always cleanup in useEffect when needed
10. **Optimize performance** - Use memo, useMemo, useCallback when appropriate

---

**Happy Coding! 🚀**
