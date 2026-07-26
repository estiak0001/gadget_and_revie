'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useBranding, useSettingsStore } from '@/lib/branding';
import {
  LayoutDashboard,
  Users,
  Store,
  FileText,
  Settings,
  BarChart3,
  Shield,
  ClipboardList,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  MapPin,
  Tag,
  Wrench,
  Package,
  ShoppingCart,
  CreditCard,
  Star,
  Headphones,
  Bell,
  Building,
  TrendingDown,
  TrendingUp,
  Truck,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

interface NavItem {
  title: string;
  href?: string;
  icon: React.ReactNode;
  children?: { title: string; href: string }[];
  /** Any one of these permission names grants access to this item (and its children). Omit/empty = universal. */
  permissions?: string[];
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    section: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: <LayoutDashboard className="w-5 h-5" />,
      },
    ],
  },
  {
    section: 'Catalog',
    items: [
      {
        title: 'Categories',
        icon: <Tag className="w-5 h-5" />,
        permissions: ['manage_categories'],
        children: [
          { title: 'Service Categories', href: '/categories/services' },
          { title: 'Product Categories', href: '/categories/products' },
          { title: 'Product Brands', href: '/categories/brands' },
        ],
      },
      {
        title: 'Services',
        href: '/services',
        icon: <Wrench className="w-5 h-5" />,
        permissions: ['manage_services', 'create_services', 'edit_services', 'delete_services'],
      },
      {
        title: 'Products',
        href: '/products',
        icon: <Package className="w-5 h-5" />,
        permissions: ['manage_products', 'create_products', 'edit_products', 'delete_products', 'manage_inventory'],
      },
    ],
  },
  {
    section: 'Sales',
    items: [
      {
        title: 'Orders',
        href: '/orders',
        icon: <ShoppingCart className="w-5 h-5" />,
        permissions: ['view_orders', 'manage_orders', 'process_orders'],
      },
      {
        title: 'Service Intakes',
        href: '/service-intakes',
        icon: <ClipboardCheck className="w-5 h-5" />,
        permissions: ['view_orders', 'manage_orders', 'process_orders', 'view_service_intakes', 'manage_service_intakes'],
      },
      {
        title: 'Payments',
        href: '/payments',
        icon: <CreditCard className="w-5 h-5" />,
        permissions: ['view_orders', 'manage_orders', 'process_orders', 'view_payments', 'manage_payments'],
      },
      {
        title: 'Reviews',
        href: '/reviews',
        icon: <Star className="w-5 h-5" />,
        permissions: ['manage_reviews', 'respond_reviews'],
      },
    ],
  },
  {
    section: 'Procurement',
    items: [
      {
        title: 'Purchases',
        icon: <Truck className="w-5 h-5" />,
        permissions: ['manage_purchases', 'view_purchases', 'manage_suppliers'],
        children: [
          { title: 'All Purchase Orders', href: '/purchases' },
          { title: 'Create Purchase Order', href: '/purchases/create' },
          { title: 'Suppliers', href: '/suppliers' },
        ],
      },
    ],
  },
  {
    section: 'Finance',
    items: [
      {
        title: 'Investors',
        href: '/investors',
        icon: <TrendingUp className="w-5 h-5" />,
        permissions: ['manage_accounts', 'view_ledger', 'view_investors', 'manage_investors'],
      },
      {
        title: 'Expenses',
        icon: <TrendingDown className="w-5 h-5" />,
        permissions: ['manage_accounts', 'view_ledger'],
        children: [
          { title: 'All Expenses', href: '/expenses' },
          { title: 'Categories', href: '/expenses/categories' },
        ],
      },
      {
        title: 'Reports',
        icon: <BarChart3 className="w-5 h-5" />,
        permissions: ['view_reports', 'export_reports'],
        children: [
          { title: 'Revenue Report', href: '/reports/revenue' },
          { title: 'Sales Report', href: '/reports/sales' },
          { title: 'Vendor Report', href: '/reports/vendors' },
          { title: 'Customer Report', href: '/reports/customers' },
          { title: 'Catalog Report', href: '/reports/catalog' },
          { title: 'Review Report', href: '/reports/reviews' },
          { title: 'Ticket Report', href: '/reports/tickets' },
        ],
      },
      {
        title: 'Accounts',
        icon: <BookOpen className="w-5 h-5" />,
        permissions: ['manage_accounts', 'view_ledger'],
        children: [
          { title: 'Chart of Accounts', href: '/accounts' },
          { title: 'Journal Entries', href: '/accounts/journal' },
          { title: 'General Ledger', href: '/accounts/ledger' },
          { title: 'Order Flow', href: '/accounts/order-flow' },
          { title: 'Purchase Order Flow', href: '/accounts/purchase-flow' },
          { title: 'Pending Ledger Sync', href: '/accounts/pending' },
          { title: 'Trial Balance', href: '/accounts/trial-balance' },
          { title: 'Income Statement', href: '/accounts/income-statement' },
          { title: 'Balance Sheet', href: '/accounts/balance-sheet' },
          { title: 'Cash Position', href: '/accounts/cash-position' },
        ],
      },
    ],
  },
  {
    section: 'People',
    items: [
      {
        title: 'Users',
        href: '/users',
        icon: <Users className="w-5 h-5" />,
        permissions: ['manage_users', 'view_users'],
      },
      {
        title: 'Vendors',
        icon: <Store className="w-5 h-5" />,
        permissions: ['view_vendors', 'manage_vendors', 'approve_vendors'],
        children: [
          { title: 'All Vendors', href: '/vendors' },
          { title: 'Pending Approval', href: '/vendors/pending' },
        ],
      },
      {
        title: 'Vendor Portal',
        icon: <Building className="w-5 h-5" />,
        permissions: ['view_vendors', 'manage_vendors', 'approve_vendors'],
        children: [
          { title: 'Dashboard', href: '/vendor/dashboard' },
          { title: 'Orders', href: '/vendor/orders' },
          { title: 'Services', href: '/vendor/services' },
          { title: 'Payouts', href: '/vendor/payouts' },
        ],
      },
    ],
  },
  {
    section: 'Support',
    items: [
      {
        title: 'Tickets',
        href: '/tickets',
        icon: <Headphones className="w-5 h-5" />,
        permissions: ['manage_tickets', 'respond_tickets'],
      },
      {
        title: 'Notifications',
        href: '/notifications',
        icon: <Bell className="w-5 h-5" />,
        permissions: ['view_notifications'],
      },
    ],
  },
  {
    section: 'Content',
    items: [
      {
        title: 'CMS',
        icon: <FileText className="w-5 h-5" />,
        permissions: ['manage_cms', 'manage_banners', 'manage_faqs'],
        children: [
          { title: 'Homepage Settings', href: '/cms/homepage' },
          { title: 'About Page', href: '/cms/about' },
          { title: 'Data Recovery Page', href: '/cms/data-recovery' },
          { title: 'Banners', href: '/cms/banners' },
          { title: 'Branch Locations', href: '/cms/branch-locations' },
          { title: 'Pages', href: '/cms/pages' },
          { title: 'FAQs', href: '/cms/faqs' },
          { title: 'Contact Inquiries', href: '/cms/contact-inquiries' },
        ],
      },
      {
        title: 'Locations',
        icon: <MapPin className="w-5 h-5" />,
        permissions: ['manage_locations'],
        children: [
          { title: 'Divisions', href: '/locations/divisions' },
          { title: 'Districts', href: '/locations/districts' },
          { title: 'Areas', href: '/locations/areas' },
        ],
      },
    ],
  },
  {
    section: 'Administration',
    items: [
      {
        title: 'Access Control',
        icon: <Shield className="w-5 h-5" />,
        permissions: ['manage_roles'],
        children: [
          { title: 'Roles', href: '/access/roles' },
          { title: 'Permissions', href: '/access/permissions' },
        ],
      },
      {
        title: 'Audit Logs',
        href: '/audit-logs',
        icon: <ClipboardList className="w-5 h-5" />,
        permissions: ['view_audit_logs'],
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: <Settings className="w-5 h-5" />,
        permissions: ['manage_settings'],
      },
    ],
  },
];

const allNavItems: NavItem[] = navigation.flatMap((group) => group.items);

// admin/super_admin tiers always hold every permission (see RoleSeeder/AdminTierSeeder) — treat
// them as universal here too, so the menu never hides behind a permission list that hasn't
// finished loading yet.
const hasMenuAccess = (perms: string[] | undefined, role: string | undefined, userPermissions: string[] | undefined): boolean => {
  if (!perms || perms.length === 0) return true;
  if (role === 'admin' || role === 'super_admin') return true;
  return (userPermissions ?? []).some((p) => perms.includes(p));
};

/**
 * Used by AdminLayout's route guard — finds the nav item that owns `pathname` (its own href, one
 * of its children's hrefs, or a sub-page beneath either) and checks menu access for it. Paths that
 * don't match any known nav item (Dashboard, /login, dynamic sub-pages not yet added to the
 * sidebar, etc.) default to allowed — this check is a UX convenience only; the real boundary is
 * the API's `permission:` middleware.
 */
export function canAccessPath(pathname: string, role: string | undefined, userPermissions: string[] | undefined): boolean {
  const matchesHref = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const item = allNavItems.find((navItem) => {
    if (navItem.children) {
      return navItem.children.some((child) => matchesHref(child.href));
    }
    return navItem.href ? matchesHref(navItem.href) : false;
  });

  if (!item) return true;
  return hasMenuAccess(item.permissions, role, userPermissions);
}

interface SidebarProps {
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const currentUser = useAuthStore((s) => s.user);
  const visibleNavigation = React.useMemo(
    () =>
      navigation
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => hasMenuAccess(item.permissions, currentUser?.role, currentUser?.permissions)),
        }))
        .filter((group) => group.items.length > 0),
    [currentUser?.role, currentUser?.permissions]
  );

  const branding = useBranding();
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Auto-expand parent menus when their child routes are active
  React.useEffect(() => {
    const activeParents = allNavItems
      .filter((item) => item.children?.some((child) => pathname === child.href))
      .map((item) => item.title);

    if (activeParents.length > 0) {
      setExpandedItems((prev) => {
        const newExpanded = [...new Set([...prev, ...activeParents])];
        return newExpanded;
      });
    }
  }, [pathname]);

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    // Exact match for single-level routes
    return pathname === href;
  };
  
  const isParentActive = (children?: { href: string }[]) => {
    if (!pathname) return false;
    return children?.some((child) => pathname === child.href);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar transition-all duration-300',
        // Mobile: slide the drawer in/out off-canvas.
        isOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: always visible, collapse width instead of hiding.
        'lg:translate-x-0',
        isOpen ? 'lg:w-64' : 'lg:w-20'
      )}
    >
      <div className="flex h-full flex-col overflow-hidden">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-gray-700">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 p-1">
              <Image
                src={branding.logoDark}
                alt={`${branding.name} Logo`}
                width={28}
                height={28}
                className="object-contain"
                style={{ width: 28, height: 28 }}
                unoptimized
              />
            </div>
            {isOpen && (
              <span className="text-white font-semibold text-lg truncate max-w-[10rem]">
                {branding.name}
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overscroll-contain py-4 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {visibleNavigation.map((group) => (
            <div key={group.section} className="mb-4 last:mb-0">
              {isOpen && (
                <p className="px-6 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {group.section}
                </p>
              )}
              <ul className="space-y-1 px-3">
                {group.items.map((item) => (
                  <li key={item.title}>
                    {item.children ? (
                      <>
                        <button
                          onClick={() => toggleExpand(item.title)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-gray-300 transition-colors',
                            'hover:bg-sidebar-hover hover:text-white',
                            isParentActive(item.children) && 'bg-sidebar-hover text-white'
                          )}
                        >
                          {item.icon}
                          {isOpen && (
                            <>
                              <span className="flex-1 text-left">{item.title}</span>
                              {expandedItems.includes(item.title) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </>
                          )}
                        </button>
                        {isOpen && expandedItems.includes(item.title) && (
                          <ul className="mt-1 space-y-1 pl-11">
                            {item.children.map((child) => (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  className={cn(
                                    'block rounded-lg px-3 py-2 text-sm transition-colors',
                                    isActive(child.href)
                                      ? 'bg-primary-600 text-white'
                                      : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
                                  )}
                                >
                                  {child.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href!}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                          isActive(item.href!)
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
                        )}
                      >
                        {item.icon}
                        {isOpen && <span>{item.title}</span>}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
