# RepairTech Pro - Modern Repair Service E-Commerce Application

This is a modern, comprehensive repair service and e-commerce application built with Next.js 15, React 19, TypeScript, and Tailwind CSS.

## Features

### 🛠️ Core Services
- **Mobile Device Repair** - Professional smartphone and tablet repair services
- **Data Recovery** - Advanced data recovery from damaged storage devices
- **E-Commerce Store** - Quality replacement parts and accessories

### 👤 User Experience
- **User Authentication** - Secure login/register system
- **User Dashboard** - Personal account management and order tracking
- **Shopping Cart** - Add products and services with quantity management
- **Support Tickets** - Comprehensive ticket management system

### 🎨 Modern Design
- **Responsive Design** - Mobile-first approach with Tailwind CSS
- **Modern UI Components** - Clean, professional interface
- **Accessibility** - WCAG compliant design patterns

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand with persistence
- **Icons**: Heroicons
- **Forms**: React Hook Form with Zod validation
- **Notifications**: React Hot Toast

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** and navigate to `http://localhost:3001` (or the port shown in terminal)

## Project Structure

```
├── app/                    # Next.js 15 App Router
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # User dashboard
│   ├── services/          # Service pages
│   ├── products/          # Product catalog
│   ├── data-recovery/     # Data recovery services
│   ├── support/           # Support ticket system
│   └── layout.tsx         # Root layout
├── components/            # Reusable components
│   ├── Header.tsx         # Navigation header
│   ├── Footer.tsx         # Footer component
│   └── Cart.tsx           # Shopping cart sidebar
├── lib/                   # Utilities and stores
│   ├── stores/            # Zustand state stores
│   ├── types.ts           # TypeScript definitions
│   └── data.ts            # Sample data
└── public/                # Static assets
```

## Key Features Implemented

### 1. Service Management
- Browse repair services by category
- Service booking with cart integration
- Service details with pricing and duration

### 2. Product Catalog
- Product filtering and search
- Category-based navigation
- Grid and list view modes
- Stock management

### 3. User Dashboard
- Order history and tracking
- Service requests management
- Support ticket creation and tracking
- Profile management

### 4. Shopping Cart
- Add products and services
- Quantity management
- Persistent cart state
- Responsive cart sidebar

### 5. Support System
- Create support tickets with categories
- Priority levels (Low, Medium, High, Urgent)
- Device information for repair tickets
- Ticket status tracking

### 6. Authentication
- User registration and login
- Persistent authentication state
- Protected routes
- Profile management

## Pages Overview

- **Homepage** (`/`) - Hero section, services overview, testimonials
- **Services** (`/services`) - All repair services with filtering
- **Data Recovery** (`/data-recovery`) - Specialized data recovery services
- **Products** (`/products`) - E-commerce catalog with search and filters
- **Dashboard** (`/dashboard`) - User account management
- **Support** (`/support/new`) - Create support tickets
- **Authentication** (`/auth/login`) - Login and registration
- **Contact** (`/contact`) - Contact information and form
- **Checkout** (`/checkout`) - Order completion (placeholder)

## State Management

The application uses Zustand for state management with the following stores:

- **Auth Store** - User authentication and profile data
- **Cart Store** - Shopping cart items and operations
- **Ticket Store** - Support ticket management

All stores include persistence to localStorage for a seamless user experience.

## Responsive Design

The application is fully responsive with:
- Mobile-first design approach
- Adaptive navigation (hamburger menu on mobile)
- Responsive grids and layouts
- Touch-friendly interface elements

## Development

### Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server

### Environment Setup

No environment variables are required for basic functionality. The application uses mock data and local storage for demonstration purposes.

## Future Enhancements

- Payment integration (Stripe/PayPal)
- Real-time chat support
- Repair status tracking with notifications
- Admin dashboard for managing orders/tickets
- Email notifications
- Advanced search with filters
- Review and rating system
- Multi-language support
