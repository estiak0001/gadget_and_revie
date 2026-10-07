'use client';

import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Menu, Bell, ScanLine, LogOut, User, ChevronDown, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import type { Order } from '@/types';
import adminService from '@/lib/adminService';

interface HeaderProps {
  onToggleSidebar: () => void;
}

// Admin order link as printed in the invoice / receipt / chalan QR code.
const ORDER_LINK = /\/orders\/(\d+)/;
const SUGGEST_MIN_CHARS = 2;
const SUGGEST_DEBOUNCE_MS = 250;

// What the scan box actually accepts, cycled through as a typewriter placeholder — "Scan
// barcode" leads because the physical scanner on the counter is a 1D laser scanner, which only
// ever reads the barcode printed on documents, never the QR (that's for a customer's phone).
const SCAN_PLACEHOLDERS = ['Scan barcode', 'Search order number', 'Search customer name', 'Search phone number'];
const TYPE_MS = 55;
const DELETE_MS = 28;
const HOLD_MS = 1500;
const GAP_MS = 350;

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const router = useRouter();

  // Scan box: a QR scan (or pasted admin order link) opens that order directly. Typed text shows
  // matching orders as you type; Enter with a row highlighted opens that row, otherwise Enter does an
  // exact lookup, so a barcode scanner (which sends Enter at the end) still works.
  const [scanValue, setScanValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [suggestions, setSuggestions] = useState<Order[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const scanBoxRef = useRef<HTMLDivElement>(null);
  // Each keystroke bumps this; a response only lands if it still belongs to the latest keystroke.
  const suggestSeq = useRef(0);

  const openOrder = (id: number) => {
    setScanValue('');
    setSuggestions([]);
    setSuggestOpen(false);
    setActiveIdx(-1);
    router.push(`/orders/${id}`);
  };

  const handleScan = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const linked = value.match(ORDER_LINK);
    if (linked) {
      openOrder(Number(linked[1]));
      return;
    }
    setScanning(true);
    try {
      const res = await adminService.getOrders({ search: value, per_page: 1 });
      const order = res.data.data[0];
      if (order) {
        openOrder(order.id);
      } else {
        toast.error(`No order found for "${value}"`);
      }
    } catch {
      toast.error('Could not look up that code');
    } finally {
      setScanning(false);
    }
  };

  // Suggestions while typing (not for links, which open directly).
  useEffect(() => {
    const term = scanValue.trim();
    if (term.length < SUGGEST_MIN_CHARS || ORDER_LINK.test(term)) {
      suggestSeq.current++;
      setSuggestions([]);
      setSuggestLoading(false);
      setActiveIdx(-1);
      return;
    }
    const seq = ++suggestSeq.current;
    setSuggestLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await adminService.getOrders({ search: term, per_page: 6 });
        if (seq !== suggestSeq.current) return;
        setSuggestions(res.data.data);
        setActiveIdx(-1);
      } catch {
        if (seq === suggestSeq.current) setSuggestions([]);
      } finally {
        if (seq === suggestSeq.current) setSuggestLoading(false);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [scanValue]);

  // Close the suggestion list when clicking anywhere outside the scan box.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!scanBoxRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Typewriter placeholder, cycling through what the box accepts — types a phrase out, holds it
  // with a blinking cursor, deletes it, then moves to the next. Pauses the moment there's real
  // text to search (the native placeholder is hidden then anyway), and skips the animation
  // entirely for prefers-reduced-motion, just showing the first phrase.
  const [placeholderText, setPlaceholderText] = useState(SCAN_PLACEHOLDERS[0]);
  useEffect(() => {
    if (scanValue) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPlaceholderText(SCAN_PLACEHOLDERS[0]);
      return;
    }

    let phraseIndex = 0;
    let charIndex = 0;
    let blinks = 0;
    let timer: ReturnType<typeof setTimeout>;
    const CURSOR = '▌';

    const typing = () => {
      const phrase = SCAN_PLACEHOLDERS[phraseIndex];
      charIndex++;
      setPlaceholderText(phrase.slice(0, charIndex) + CURSOR);
      if (charIndex === phrase.length) {
        blinks = 0;
        timer = setTimeout(holding, HOLD_MS / 4);
      } else {
        timer = setTimeout(typing, TYPE_MS);
      }
    };
    const holding = () => {
      const phrase = SCAN_PLACEHOLDERS[phraseIndex];
      blinks++;
      setPlaceholderText(blinks % 2 === 0 ? phrase : phrase + CURSOR);
      if (blinks >= 4) {
        timer = setTimeout(deleting, TYPE_MS);
      } else {
        timer = setTimeout(holding, HOLD_MS / 4);
      }
    };
    const deleting = () => {
      const phrase = SCAN_PLACEHOLDERS[phraseIndex];
      charIndex--;
      setPlaceholderText(phrase.slice(0, charIndex) + CURSOR);
      if (charIndex === 0) {
        phraseIndex = (phraseIndex + 1) % SCAN_PLACEHOLDERS.length;
        timer = setTimeout(typing, GAP_MS);
      } else {
        timer = setTimeout(deleting, DELETE_MS);
      }
    };

    timer = setTimeout(typing, TYPE_MS);
    return () => clearTimeout(timer);
  }, [scanValue]);

  const onScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setSuggestOpen(true);
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setSuggestOpen(true);
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setSuggestOpen(false);
      setActiveIdx(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        openOrder(suggestions[activeIdx].id);
      } else {
        setSuggestOpen(false);
        handleScan(scanValue);
      }
    }
  };

  const showSuggestions = suggestOpen && scanValue.trim().length >= SUGGEST_MIN_CHARS && !ORDER_LINK.test(scanValue.trim());
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await adminService.getNotifications({ per_page: 5 });
        const data = response.data?.data || response.data;
        const items = Array.isArray(data) ? data : data.data || [];
        setNotifications(items.slice(0, 5));
        setUnreadCount(items.filter((n: any) => !n.read_at).length);
      } catch { setNotifications([]); }
    };
    fetchNotifications();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="flex h-14 items-center justify-between px-3 sm:px-4 lg:px-5">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          {/* Scan box — QR / barcode / order number → opens the order, with suggestions while typing */}
          <div ref={scanBoxRef} className="relative hidden md:block">
            {scanning
              ? <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500 animate-spin" />
              : <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500" />}
            <input
              type="text"
              value={scanValue}
              onChange={(e) => { setScanValue(e.target.value); setSuggestOpen(true); }}
              onFocus={() => setSuggestOpen(true)}
              onKeyDown={onScanKeyDown}
              placeholder={placeholderText}
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-autocomplete="list"
              aria-label="Scan barcode or search orders"
              className="pl-11 pr-4 py-2.5 w-96 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {showSuggestions && (
              <div role="listbox" className="absolute left-0 top-full mt-1 w-[30rem] z-30 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {suggestions.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-gray-500">{suggestLoading ? 'Searching…' : 'No matching orders'}</div>
                ) : suggestions.map((o, i) => (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={i === activeIdx}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => openOrder(o.id)}
                    className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', i === activeIdx ? 'bg-indigo-50' : 'hover:bg-gray-50')}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-gray-900">{o.order_number}</span>
                        <span className="truncate text-xs text-gray-500">{o.customer_name || 'Guest'}</span>
                      </div>
                      <div className="truncate text-xs text-gray-500">{o.customer_phone || '—'}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(o.total)}</div>
                      <div className="text-[11px] capitalize text-gray-500">{o.order_status.replace(/_/g, ' ')}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                <div className="px-4 py-2 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">No notifications</div>
                  ) : notifications.map((n: any) => (
                    <div key={n.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                      <p className="text-sm text-gray-900">{n.title || n.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{n.created_at ? formatDateTime(n.created_at) : ''}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-gray-100">
                  <button onClick={() => { setShowNotifications(false); router.push('/notifications'); }} className="text-sm text-primary-600 hover:text-primary-700">
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700">
                {user?.name || 'Admin'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="font-medium text-gray-900">{user?.name}</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
