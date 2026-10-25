'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
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
  MessageSquare,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

/**
 * Sidebar sections are organised by what the business is doing, not by which module the code
 * lives in: sell → stock → buy → money → people → content → administer. Each child page can carry
 * its own permission list (matching the API gate on that page), so a role only sees the links it
 * can actually open. Parent permissions are the union of their children's.
 */
interface NavChild {
  title: string;
  href: string;
  permissions?: string[];
}

interface NavItem {
  title: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavChild[];
  /** Any one of these permission names grants access to this item (and its children). Omit/empty = universal. */
  permissions?: string[];
  /** Restricts the item to these tier roles (e.g. the vendor portal is an admin-only view). */
  roles?: string[];
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const ICON = 'h-4 w-4 flex-shrink-0';

const navigation: NavSection[] = [
  {
    section: 'Overview',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className={ICON} /> },
      {
        title: 'Notifications',
        href: '/notifications',
        icon: <Bell className={ICON} />,
        permissions: ['view_notifications', 'manage_notifications'],
      },
      {
        title: 'Reports',
        icon: <BarChart3 className={ICON} />,
        permissions: [
          'view_reports', 'export_reports', 'view_sales_reports', 'view_vendor_reports',
          'view_customer_reports', 'view_catalog_reports', 'view_review_reports', 'view_ticket_reports',
        ],
        children: [
          { title: 'Revenue', href: '/reports/revenue', permissions: ['view_reports', 'export_reports', 'view_sales_reports'] },
          { title: 'Sales', href: '/reports/sales', permissions: ['view_reports', 'export_reports', 'view_sales_reports'] },
          { title: 'Customers', href: '/reports/customers', permissions: ['view_reports', 'export_reports', 'view_customer_reports'] },
          { title: 'Catalog', href: '/reports/catalog', permissions: ['view_reports', 'export_reports', 'view_catalog_reports'] },
          { title: 'Reviews', href: '/reports/reviews', permissions: ['view_reports', 'export_reports', 'view_review_reports'] },
          { title: 'Tickets', href: '/reports/tickets', permissions: ['view_reports', 'export_reports', 'view_ticket_reports'] },
        ],
      },
    ],
  },
  {
    section: 'Sales',
    items: [
      {
        title: 'Orders',
        href: '/orders',
        icon: <ShoppingCart className={ICON} />,
        permissions: ['view_orders', 'manage_orders', 'process_orders'],
      },
      {
        title: 'Quotations',
        href: '/quotations',
        icon: <FileText className={ICON} />,
        permissions: ['view_quotations', 'manage_quotations'],
      },
      {
        title: 'Service intakes',
        href: '/service-intakes',
        icon: <ClipboardCheck className={ICON} />,
        permissions: ['view_orders', 'manage_orders', 'process_orders', 'view_service_intakes', 'manage_service_intakes'],
      },
      {
        title: 'Payments',
        href: '/payments',
        icon: <CreditCard className={ICON} />,
        permissions: ['view_orders', 'manage_orders', 'process_orders', 'view_payments', 'manage_payments'],
      },
      {
        title: 'Reviews',
        href: '/reviews',
        icon: <Star className={ICON} />,
        permissions: ['manage_reviews', 'respond_reviews'],
      },
      {
        title: 'Tickets',
        href: '/tickets',
        icon: <Headphones className={ICON} />,
        permissions: ['manage_tickets', 'respond_tickets'],
      },
    ],
  },
  {
    section: 'Catalog & buying',
    items: [
      {
        title: 'Products',
        icon: <Package className={ICON} />,
        permissions: ['manage_products', 'view_products', 'create_products', 'edit_products', 'delete_products', 'manage_inventory'],
        children: [
          { title: 'All products', href: '/products', permissions: ['manage_products', 'view_products', 'edit_products', 'delete_products', 'manage_inventory'] },
          { title: 'Add product', href: '/products/create', permissions: ['manage_products', 'create_products'] },
          { title: 'Bulk import', href: '/products/bulk-import', permissions: ['manage_products', 'create_products'] },
          { title: 'Scraped products', href: '/scraped-products', permissions: ['manage_products', 'view_products'] },
        ],
      },
      {
        title: 'Services',
        href: '/services',
        icon: <Wrench className={ICON} />,
        permissions: ['manage_services', 'view_services', 'create_services', 'edit_services', 'delete_services'],
      },
      {
        title: 'Categories',
        icon: <Tag className={ICON} />,
        permissions: ['manage_categories', 'view_categories'],
        children: [
          { title: 'Service categories', href: '/categories/services' },
          { title: 'Product categories', href: '/categories/products' },
          { title: 'Product brands', href: '/categories/brands' },
        ],
      },
      {
        title: 'Purchases',
        icon: <Truck className={ICON} />,
        permissions: ['manage_purchases', 'view_purchases', 'manage_suppliers', 'view_purchase_history'],
        children: [
          { title: 'All purchase orders', href: '/purchases', permissions: ['manage_purchases', 'view_purchases', 'manage_suppliers'] },
          { title: 'New purchase order', href: '/purchases/create', permissions: ['manage_purchases', 'view_purchases', 'manage_suppliers'] },
          { title: 'Purchase history', href: '/purchases/history', permissions: ['view_purchase_history', 'manage_purchases', 'view_purchases'] },
          { title: 'Suppliers', href: '/suppliers', permissions: ['manage_suppliers', 'manage_purchases', 'view_purchases'] },
        ],
      },
    ],
  },
  {
    section: 'Finance',
    items: [
      {
        title: 'Accounts',
        icon: <BookOpen className={ICON} />,
        permissions: ['manage_accounts', 'view_ledger', 'view_financial_statements', 'process_pending_ledger_items'],
        children: [
          { title: 'Chart of accounts', href: '/accounts' },
          { title: 'Journal entries', href: '/accounts/journal' },
          { title: 'General ledger', href: '/accounts/ledger' },
          { title: 'Pending ledger sync', href: '/accounts/pending', permissions: ['manage_accounts', 'process_pending_ledger_items'] },
          { title: 'Trial balance', href: '/accounts/trial-balance' },
          { title: 'Income statement', href: '/accounts/income-statement' },
          { title: 'Balance sheet', href: '/accounts/balance-sheet' },
          { title: 'Cash position', href: '/accounts/cash-position' },
          { title: 'Cash book', href: '/accounts/cash-book' },
          { title: 'Transfers', href: '/accounts/transfers', permissions: ['manage_accounts', 'manage_payment_methods'] },
          { title: 'Account reports', href: '/accounts/reports' },
          { title: 'Order flow guide', href: '/accounts/order-flow' },
          { title: 'Purchase flow guide', href: '/accounts/purchase-flow' },
        ],
      },
      {
        title: 'Expenses',
        icon: <TrendingDown className={ICON} />,
        permissions: ['manage_accounts', 'view_ledger', 'view_expenses', 'create_expenses', 'edit_expenses', 'delete_expenses'],
        children: [
          { title: 'All expenses', href: '/expenses' },
          { title: 'Expense categories', href: '/expenses/categories' },
        ],
      },
      {
        title: 'Investors',
        href: '/investors',
        icon: <TrendingUp className={ICON} />,
        permissions: ['manage_accounts', 'view_ledger', 'view_investors', 'manage_investors'],
      },
    ],
  },
  {
    section: 'People',
    items: [
      {
        title: 'Users',
        href: '/users',
        icon: <Users className={ICON} />,
        permissions: ['manage_users', 'view_users'],
      },
      {
        title: 'Vendors',
        icon: <Store className={ICON} />,
        permissions: ['view_vendors', 'manage_vendors', 'approve_vendors'],
        children: [
          { title: 'All vendors', href: '/vendors' },
          { title: 'Pending approval', href: '/vendors/pending' },
        ],
      },
      {
        title: 'Vendor portal',
        icon: <Building className={ICON} />,
        roles: ['admin', 'super_admin'],
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
    section: 'Content',
    items: [
      {
        title: 'CMS',
        icon: <Layers className={ICON} />,
        permissions: ['manage_cms', 'manage_banners', 'manage_faqs', 'manage_cms_pages', 'manage_branch_locations', 'manage_contact_inquiries', 'manage_settings'],
        children: [
          { title: 'Homepage', href: '/cms/homepage', permissions: ['manage_cms'] },
          { title: 'About page', href: '/cms/about', permissions: ['manage_cms'] },
          { title: 'Data recovery page', href: '/cms/data-recovery', permissions: ['manage_cms'] },
          { title: 'Pages', href: '/cms/pages', permissions: ['manage_cms', 'manage_cms_pages'] },
          { title: 'Brochure', href: '/cms/brochure', permissions: ['manage_cms', 'manage_settings'] },
          { title: 'Banners', href: '/cms/banners', permissions: ['manage_cms', 'manage_banners'] },
          { title: 'FAQs', href: '/cms/faqs', permissions: ['manage_cms', 'manage_faqs'] },
          { title: 'Branch locations', href: '/cms/branch-locations', permissions: ['manage_cms', 'manage_branch_locations'] },
          { title: 'Contact inquiries', href: '/cms/contact-inquiries', permissions: ['manage_cms', 'manage_contact_inquiries'] },
        ],
      },
      {
        title: 'Locations',
        icon: <MapPin className={ICON} />,
        permissions: ['manage_locations', 'manage_divisions', 'manage_districts', 'manage_areas'],
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
        title: 'Access control',
        icon: <Shield className={ICON} />,
        permissions: ['manage_roles'],
        children: [
          { title: 'Roles', href: '/access/roles' },
          { title: 'Permissions', href: '/access/permissions' },
        ],
      },
      {
        title: 'Audit logs',
        href: '/audit-logs',
        icon: <ClipboardList className={ICON} />,
        permissions: ['view_audit_logs'],
      },
      {
        title: 'SMS center',
        href: '/sms',
        icon: <MessageSquare className={ICON} />,
        permissions: ['manage_settings'],
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: <Settings className={ICON} />,
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

const canSeeEntry = (
  entry: { permissions?: string[]; roles?: string[] },
  role: string | undefined,
  userPermissions: string[] | undefined
): boolean => {
  if (entry.roles && entry.roles.length > 0 && !(role && entry.roles.includes(role))) return false;
  return hasMenuAccess(entry.permissions, role, userPermissions);
};

/** Children the current user may see; a child without its own permissions inherits the parent's. */
const visibleChildren = (item: NavItem, role: string | undefined, userPermissions: string[] | undefined): NavChild[] =>
  (item.children ?? []).filter((child) => {
    if (child.permissions) return canSeeEntry(child, role, userPermissions);
    return true;
  });

/**
 * Used by AdminLayout's route guard — finds the nav entry that owns `pathname` (its own href, one
 * of its children's hrefs, or a sub-page beneath either) and checks access for it. Paths that
 * don't match any known nav entry (Dashboard, /login, dynamic sub-pages not yet added to the
 * sidebar, etc.) default to allowed — this check is a UX convenience only; the real boundary is
 * the API's `permission:` middleware.
 */
export function canAccessPath(pathname: string, role: string | undefined, userPermissions: string[] | undefined): boolean {
  const matchesHref = (href: string) => pathname === href || pathname.startsWith(href + '/');

  for (const item of allNavItems) {
    if (item.children) {
      const child = item.children.find((c) => matchesHref(c.href));
      if (child) {
        if (!canSeeEntry(item, role, userPermissions)) return false;
        return child.permissions ? canSeeEntry(child, role, userPermissions) : true;
      }
    } else if (item.href && matchesHref(item.href)) {
      return canSeeEntry(item, role, userPermissions);
    }
  }
  return true;
}

interface SidebarProps {
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const currentUser = useAuthStore((s) => s.user);
  const visibleNavigation = React.useMemo(
    () =>
      navigation
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (!canSeeEntry(item, currentUser?.role, currentUser?.permissions)) return false;
            // A dropdown with no visible children would be an empty shell — hide it entirely.
            return item.children ? visibleChildren(item, currentUser?.role, currentUser?.permissions).length > 0 : true;
          }),
        }))
        .filter((group) => group.items.length > 0),
    [currentUser?.role, currentUser?.permissions]
  );

  const branding = useBranding();
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Open the dropdown that holds the current page — and only that one, so the menu stays short.
  useEffect(() => {
    const activeParent = allNavItems.find((item) => item.children?.some((child) => pathname === child.href));
    setExpandedItems(activeParent ? [activeParent.title] : []);
  }, [pathname]);

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) => (prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]));
  };

  const isActive = (href: string) => !!pathname && pathname === href;

  const isParentActive = (children?: NavChild[]) => !!pathname && !!children?.some((child) => pathname === child.href);

  // Collapsed rail has no room for a dropdown, so a group click goes straight to its first page.
  const handleGroupClick = (item: NavItem) => {
    if (!isOpen) {
      const first = visibleChildren(item, currentUser?.role, currentUser?.permissions)[0];
      if (first) router.push(first.href);
      return;
    }
    toggleExpand(item.title);
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
        {/* Brand — left-aligned to the same gutter as the nav items so the column reads as one edge */}
        <div
          className={cn(
            'relative flex h-20 flex-shrink-0 items-center border-b border-gray-700/70',
            isOpen ? 'px-[18px]' : 'justify-center px-0'
          )}
        >
          <Link href="/dashboard" className="group flex min-w-0 items-center gap-3.5">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-indigo-600/5 ring-1 ring-inset ring-indigo-400/30 transition group-hover:ring-indigo-300/60">
              <Image
                src={branding.logoDark}
                alt={`${branding.name} logo`}
                width={256}
                height={177}
                className="w-9 h-auto object-contain"
                unoptimized
              />
            </span>
            {isOpen && (
              <span className="min-w-0">
                <span className="block truncate text-[17px] font-bold leading-tight tracking-tight text-white">
                  {branding.name}
                </span>
                <span className="mt-0.5 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-indigo-300/80">
                  Admin panel
                </span>
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {visibleNavigation.map((group, groupIndex) => (
            <div key={group.section} className={cn('pb-1.5', groupIndex > 0 && 'mt-1.5 border-t border-gray-700/60 pt-2')}>
              {isOpen ? (
                <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                  {group.section}
                </p>
              ) : null}
              <ul className="space-y-px">
                {group.items.map((item) => {
                  const itemActive = item.children ? isParentActive(item.children) : isActive(item.href!);
                  const rowClass = cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                    itemActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-sidebar-hover hover:text-white',
                    !isOpen && 'justify-center px-0'
                  );

                  if (!item.children) {
                    return (
                      <li key={item.title}>
                        <Link href={item.href!} title={!isOpen ? item.title : undefined} className={rowClass}>
                          {item.icon}
                          {isOpen && <span className="truncate">{item.title}</span>}
                        </Link>
                      </li>
                    );
                  }

                  const expanded = expandedItems.includes(item.title);
                  const children = visibleChildren(item, currentUser?.role, currentUser?.permissions);

                  return (
                    <li key={item.title}>
                      <button
                        type="button"
                        onClick={() => handleGroupClick(item)}
                        title={!isOpen ? item.title : undefined}
                        aria-expanded={isOpen ? expanded : undefined}
                        className={rowClass}
                      >
                        {item.icon}
                        {isOpen && (
                          <>
                            <span className="flex-1 truncate text-left">{item.title}</span>
                            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                          </>
                        )}
                      </button>
                      {isOpen && expanded && (
                        <ul className="ml-[18px] mb-1 mt-0.5 space-y-px border-l border-gray-700/80 pl-2">
                          {children.map((child) => (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                className={cn(
                                  'block truncate rounded-md px-2 py-1 text-[12.5px] transition-colors',
                                  isActive(child.href)
                                    ? 'bg-primary-600/90 font-medium text-white'
                                    : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
                                )}
                              >
                                {child.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
