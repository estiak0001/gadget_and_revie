# Gadget Revibe Admin Panel

A comprehensive admin panel built with Next.js 14 for managing the Gadget Revibe multi-tenant repair services marketplace.

## Features

### Dashboard
- Overview statistics (orders, revenue, users, vendors)
- Revenue and order trends charts
- Pending items summary
- Recent orders list

### User Management
- View all users with search and filters
- Filter by role (admin, customer, vendor)
- Filter by status (active, suspended, pending)
- View user details
- Suspend/activate users

### Vendor Management
- View all vendors with status filters
- Approve/reject vendor applications
- Dedicated pending approvals page
- Suspend/activate vendors
- View vendor profiles

### CMS Management
- **Pages**: Create and manage static pages (About, Terms, Privacy, etc.)
- **Banners**: Manage promotional banners with scheduling
- **FAQs**: Manage frequently asked questions by category

### Reports
- **Sales Report**: Revenue trends, top services, payment methods
- **Vendor Report**: Vendor growth, location distribution, top performers
- **Customer Report**: Customer growth, segments, top customers

### Access Control (RBAC)
- **Roles**: Create and manage roles with permission assignment
- **Permissions**: View all system permissions by module

### Settings
- Grouped settings management (General, Email, Payment, etc.)
- Toggle switches for boolean settings
- Real-time change tracking

### Audit Logs
- Track all system activities
- Filter by action, model type, date range
- View change details (old/new values)

## Tech Stack

- **Framework**: Next.js 14.2.0 (App Router)
- **Language**: TypeScript 5.3.3
- **Styling**: Tailwind CSS 3.4.1
- **State Management**: Zustand 4.5.0
- **Forms**: react-hook-form 7.50.0 + Zod validation
- **HTTP Client**: Axios 1.6.7
- **Charts**: Recharts 2.12.0
- **Icons**: Lucide React 0.330.0

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gadget-revibe-admin
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your API URL:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Mode

The admin panel includes demo data fallbacks. If the API is not available, the UI will still work with sample data for testing purposes.

**Demo Login Credentials:**
- Email: `admin@gadgetrevibe.com`
- Password: `password`

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── access/             # RBAC pages
│   │   ├── roles/
│   │   └── permissions/
│   ├── audit-logs/         # Audit logs page
│   ├── cms/                # CMS management
│   │   ├── pages/
│   │   ├── banners/
│   │   └── faqs/
│   ├── dashboard/          # Main dashboard
│   ├── login/              # Login page
│   ├── reports/            # Reports section
│   │   ├── sales/
│   │   ├── vendors/
│   │   └── customers/
│   ├── settings/           # Settings page
│   ├── users/              # User management
│   └── vendors/            # Vendor management
│       └── pending/
├── components/
│   ├── layout/             # Layout components
│   │   ├── AdminLayout.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   └── ui/                 # UI components
│       ├── Badge.tsx
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── DataTable.tsx
│       ├── Input.tsx
│       ├── LoadingSpinner.tsx
│       ├── Modal.tsx
│       ├── Pagination.tsx
│       ├── Select.tsx
│       └── Textarea.tsx
├── lib/
│   ├── api.ts              # Axios client setup
│   └── utils.ts            # Utility functions
├── store/
│   └── auth.ts             # Zustand auth store
└── types/
    └── index.ts            # TypeScript interfaces
```

## API Integration

The admin panel integrates with the Gadget Revibe Laravel API. Key endpoints:

### Authentication
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout
- `GET /auth/user` - Get current user

### Admin Endpoints
- `GET /admin/dashboard` - Dashboard stats
- `GET /admin/users` - List users
- `GET /admin/vendors` - List vendors
- `PUT /admin/vendors/{id}/approve` - Approve vendor
- `GET /admin/cms/pages` - List CMS pages
- `GET /admin/cms/banners` - List banners
- `GET /admin/cms/faqs` - List FAQs
- `GET /admin/reports/sales` - Sales report
- `GET /admin/reports/vendors` - Vendor report
- `GET /admin/reports/customers` - Customer report
- `GET /admin/roles` - List roles
- `GET /admin/permissions` - List permissions
- `GET /admin/settings` - List settings
- `GET /admin/audit-logs` - List audit logs

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000/api` |

## License

This project is private and proprietary.
