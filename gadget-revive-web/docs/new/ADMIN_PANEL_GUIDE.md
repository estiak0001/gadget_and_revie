# Gadget Revive Admin Panel

## Overview

The Admin Panel is a **separate, isolated section** within the main Next.js application, designed specifically for administrators to manage the Gadget Revive platform. It features a distinct dark theme, professional UI components, and comprehensive management capabilities.

## Key Features

### 🎨 **Distinct Design**
- **Dark Theme**: Professional slate/dark UI separate from the main website
- **Modern Gradients**: Orange-to-red brand gradients for CTAs
- **Responsive Layout**: Optimized for desktop and tablet use
- **Professional Components**: Custom admin-specific UI components

### 🔐 **Security**
- Separate login at `/admin/login`
- Role-based access control (admin and super_admin only)
- Protected routes with authentication guards
- Session management via Zustand store

### 📊 **Dashboard Features**
- Real-time statistics cards
- System alerts and notifications
- Quick action shortcuts
- Revenue analytics
- Low stock monitoring
- Pending approval tracking

## Structure

```
app/admin/
├── layout.tsx                 # Admin-specific layout with dark theme
├── page.tsx                   # Main admin dashboard
├── login/
│   └── page.tsx              # Admin login page
├── vendors/
│   └── page.tsx              # Vendor management
├── customers/
│   └── page.tsx              # Customer management
├── orders/
│   └── page.tsx              # Order management
├── cms/
│   └── page.tsx              # CMS management
├── tickets/
│   └── page.tsx              # Support ticket management
├── reports/
│   └── page.tsx              # Analytics and reports
└── settings/
    └── page.tsx              # System settings

components/admin/
├── AdminHeader.tsx           # Top navigation bar
├── AdminSidebar.tsx          # Side navigation menu
├── AdminStats.tsx            # Statistics cards
├── AdminTable.tsx            # Data tables
├── AdminCard.tsx             # Content cards
└── index.ts                  # Component exports
```

## Admin Components

### AdminHeader
Top navigation with:
- Logo and branding
- Search functionality
- Quick actions (View Site, Notifications, Settings)
- User profile dropdown with logout

### AdminSidebar
Collapsible navigation menu with:
- Dashboard
- Vendors (with badge for pending)
- Customers
- Orders
- Products
- Services
- Reports
- CMS (expandable submenu)
- Support Tickets
- Notifications
- Audit Logs
- Settings

### AdminStatCard
Reusable stat cards with:
- Icon and title
- Value display
- Trend indicators (up/down)
- Color variants (orange, blue, green, purple, red)
- Optional change percentage

### AdminTable
Data table component with:
- Sortable columns
- Loading states
- Empty states
- Hover effects
- Custom cell rendering

### AdminCard
Content card wrapper with:
- Title and description
- Action buttons
- Consistent styling
- Dark theme

## Accessing the Admin Panel

### URL
```
http://localhost:3000/admin
```

### Login Credentials
Requires admin or super_admin role. Example:
```
Email: admin@gadgetrevive.com
Password: [your admin password]
```

### Flow
1. Visit `/admin`
2. Redirects to `/admin/login` if not authenticated
3. Enter admin credentials
4. System validates role (admin/super_admin)
5. Redirects to admin dashboard
6. Non-admin users are redirected to main site

## Theme Configuration

### Color Palette
```css
Background: slate-900, slate-950
Cards: slate-800
Borders: slate-700
Text: white, slate-300, slate-400
Accent: orange-500 to red-600 gradient
Success: green-500
Warning: orange-500
Error: red-500
Info: blue-500
```

### Typography
- Headers: Bold, white
- Body: slate-300
- Muted: slate-400, slate-500
- Labels: slate-300

## Development Guide

### Adding New Admin Pages

1. Create page in `app/admin/[feature]/page.tsx`:
```tsx
'use client';

import { AdminCard } from '@/components/admin';

export default function FeaturePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Feature Name</h1>
      
      <AdminCard title="Card Title">
        {/* Content */}
      </AdminCard>
    </div>
  );
}
```

2. Add route to sidebar in `components/admin/AdminSidebar.tsx`:
```tsx
const navigation = [
  // ... existing items
  { name: 'Feature Name', href: '/admin/feature', icon: IconName },
];
```

### Using Admin Components

```tsx
import { 
  AdminStatCard, 
  AdminStatsGrid, 
  AdminTable, 
  AdminCard 
} from '@/components/admin';

// Stats Grid
<AdminStatsGrid>
  <AdminStatCard
    title="Total Users"
    value={1234}
    icon={UsersIcon}
    change={12}
    trend="up"
    color="blue"
  />
</AdminStatsGrid>

// Data Table
<AdminTable
  columns={[
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
  ]}
  data={items}
  loading={false}
/>

// Content Card
<AdminCard 
  title="Card Title" 
  description="Description"
  actions={<button>Action</button>}
>
  Content here
</AdminCard>
```

## API Integration

Admin API calls are handled through `lib/api/admin.ts`:

```typescript
import { adminService } from '@/lib/api';

// Get dashboard stats
const stats = await adminService.getDashboardStats();

// Manage vendors
const vendors = await adminService.getPendingVendors();
await adminService.approveVendor(id);
await adminService.rejectVendor(id, reason);

// CMS Management
const pages = await adminService.getCmsPages();
await adminService.createCmsPage(data);
```

## Authentication Flow

```typescript
// Check if user is admin
useEffect(() => {
  if (isAuthenticated && user && user.role) {
    if (user.role.name !== 'admin' && user.role.name !== 'super_admin') {
      router.push('/'); // Redirect non-admins
    }
  }
}, [isAuthenticated, user]);
```

## Deployment Considerations

### Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Build
```bash
cd gadget-revive-web
npm run build
```

### Security
- Admin routes are client-side protected
- Backend API validates admin role on every request
- All admin API calls include authentication token
- CORS configured for admin domain

## Best Practices

1. **Always use admin components** for consistency
2. **Follow dark theme** - use slate colors
3. **Add loading states** for better UX
4. **Handle errors gracefully** with toast notifications
5. **Validate permissions** on both client and server
6. **Log admin actions** for audit trail
7. **Use TypeScript** for type safety
8. **Test on different screen sizes**

## Future Enhancements

- [ ] Real-time notifications
- [ ] Advanced analytics charts
- [ ] Export functionality
- [ ] Bulk actions
- [ ] Activity timeline
- [ ] Role management UI
- [ ] System health monitoring
- [ ] Email template editor
- [ ] Webhook management
- [ ] API key management

## Support

For issues or questions about the admin panel:
- Check API documentation in `docs/API_DOCUMENTATION.md`
- Review component source in `components/admin/`
- Check authentication store in `lib/stores/auth-store.ts`
