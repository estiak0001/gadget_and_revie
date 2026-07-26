# 🔐 Admin Panel Access Guide

## Quick Access

### Admin Panel URL
```
http://localhost:3000/admin
```

### Admin Login Credentials
```
Email: admin@gadgetrevive.com
Password: password
```

## What's Different?

### ✅ Admin Panel (Completely Isolated)
- **Route**: `/admin/*`
- **Theme**: Dark (Slate 900/950 background)
- **Layout**: Custom admin header & sidebar
- **No Website Components**: No TopBar, Header, or Footer from main site
- **Access**: Admin and Super Admin roles only

### ✅ Main Website
- **Route**: All other routes (`/`, `/products`, `/services`, etc.)
- **Theme**: Light (Gray 50 background)  
- **Layout**: TopBar, Header, Footer
- **Access**: Public and authenticated users

## Testing the Separation

1. **Visit Main Website**
   ```
   http://localhost:3000
   ```
   ✓ You should see: TopBar, Header, Footer

2. **Visit Admin Panel**
   ```
   http://localhost:3000/admin
   ```
   ✓ You should see: Only dark admin interface
   ✗ You should NOT see: TopBar, Header, Footer

3. **Admin Login**
   ```
   http://localhost:3000/admin/login
   ```
   ✓ Dark themed login page
   ✗ No website header/footer

## Database Seeding

Run this to create the admin user:

```bash
cd gadget-revive-api
php artisan db:seed --class=GadgetReviveSeeder
```

This creates:
- Super Admin user: `admin@gadgetrevive.com` / `password`
- All necessary roles, divisions, districts, categories

## Admin Panel Features

### 📊 Dashboard
- Statistics overview
- System alerts
- Quick actions
- Revenue charts

### 👥 Management Sections
- **Vendors**: Approve/reject vendor registrations
- **Customers**: Manage customer accounts
- **Orders**: Track and manage orders
- **Products**: Product inventory
- **Services**: Service catalog
- **CMS**: Pages, banners, FAQs
- **Tickets**: Support ticket system
- **Reports**: Analytics and insights
- **Settings**: System configuration

## File Structure

```
gadget-revive-web/
├── app/
│   ├── layout.tsx                    # Root layout (no header/footer for admin)
│   ├── admin/                        # Admin panel (ISOLATED)
│   │   ├── layout.tsx               # Dark admin layout
│   │   ├── page.tsx                 # Admin dashboard
│   │   └── login/page.tsx           # Admin login
│   └── [other routes]/               # Main website
├── components/
│   ├── ConditionalLayout.tsx        # Decides which layout to use
│   ├── admin/                        # Admin components (dark theme)
│   │   ├── AdminHeader.tsx
│   │   ├── AdminSidebar.tsx
│   │   └── ...
│   ├── TopBar.tsx                   # Main site only
│   ├── Header.tsx                   # Main site only
│   └── Footer.tsx                   # Main site only
└── lib/
    └── admin/                        # Admin utilities & config
```

## Key Implementation Details

### ConditionalLayout Component
Located at: `components/ConditionalLayout.tsx`

```tsx
// Checks if route starts with /admin
const isAdminRoute = pathname.startsWith('/admin');

// If admin route: return children only
// If website route: return children wrapped in TopBar/Header/Footer
```

### Admin Layout
Located at: `app/admin/layout.tsx`

- Checks authentication
- Validates admin role
- Shows AdminHeader & AdminSidebar
- Dark theme styling
- No website components

## Color Schemes

### Main Website
```css
Background: bg-gray-50
Cards: bg-white
Text: text-gray-900
Accent: orange-500 to red-600
```

### Admin Panel
```css
Background: bg-slate-950, bg-slate-900
Cards: bg-slate-800
Borders: border-slate-700
Text: text-white, text-slate-300
Accent: orange-500 to red-600 (gradients)
```

## Security Notes

1. **Role Checking**: Both client and server validate admin role
2. **Route Protection**: Admin routes redirect non-admins to home
3. **Session Management**: Uses Zustand store with token
4. **API Security**: All admin endpoints require admin role

## Troubleshooting

### Issue: Still seeing website header in admin
**Solution**: Clear browser cache and hard reload (Ctrl+Shift+R)

### Issue: Can't login to admin
**Check**:
1. Database seeded? Run: `php artisan db:seed`
2. Using correct email: `admin@gadgetrevive.com`
3. API running on port 8000?

### Issue: Redirected from admin to home
**Cause**: User doesn't have admin/super_admin role
**Solution**: Check user's role_id in database

## Next Steps

1. ✅ Admin panel separated
2. ✅ Dark theme implemented
3. ✅ Authentication guard in place
4. 🔄 Customize admin pages as needed
5. 🔄 Add more admin features
6. 🔄 Implement role-based permissions

## Support

For issues or questions:
- Check: `ADMIN_PANEL_GUIDE.md`
- Review: `components/admin/` for component usage
- API Docs: `docs/API_DOCUMENTATION.md`
