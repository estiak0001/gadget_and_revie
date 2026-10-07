'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  allowClear?: boolean;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placeUp: boolean;
}

const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;
const MAX_MENU_HEIGHT = 320;
const MIN_MENU_WIDTH = 240;

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found',
  className,
  disabled = false,
  label,
  required = false,
  allowClear = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
      setSearchQuery('');
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The menu is portaled to <body> so parent cards, modals and scroll areas can't clip it.
  // It is anchored to the trigger and flips upward when there isn't room below.
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const placeUp = spaceBelow < 260 && spaceAbove > spaceBelow;
    setMenuPos({
      top: placeUp ? rect.top - MENU_GAP : rect.bottom + MENU_GAP,
      left: rect.left,
      width: Math.max(rect.width, MIN_MENU_WIDTH),
      maxHeight: Math.min(MAX_MENU_HEIGHT, placeUp ? spaceAbove : spaceBelow),
      placeUp,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  const menu = isOpen && menuPos ? (
    <div
      ref={menuRef}
      style={{
        top: menuPos.top,
        left: menuPos.left,
        width: menuPos.width,
        maxHeight: menuPos.maxHeight,
        transform: menuPos.placeUp ? 'translateY(-100%)' : undefined,
      }}
      className="fixed z-[1000] flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
    >
      <div className="shrink-0 border-b border-gray-200 p-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-gray-500">
            {emptyMessage}
          </div>
        ) : (
          filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                'hover:bg-gray-100',
                option.value === value && 'bg-primary-50 text-primary-700'
              )}
            >
              {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
              <div className="flex-1 text-left">
                <div className="font-medium">{option.label}</div>
                {option.description && (
                  <div className="text-xs text-gray-500">{option.description}</div>
                )}
              </div>
              {option.value === value && (
                <Check className="w-4 h-4 text-primary-600" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={cn('relative w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div ref={containerRef}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            disabled
              ? 'bg-gray-50 cursor-not-allowed text-gray-400'
              : 'bg-white hover:border-gray-400',
            isOpen ? 'border-primary-500 ring-2 ring-primary-500' : 'border-gray-300'
          )}
        >
          <span className="flex items-center gap-2 flex-1 text-left truncate">
            {selectedOption?.icon}
            <span className={selectedOption ? 'text-gray-900' : 'text-gray-400'}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </span>
          <div className="flex items-center gap-1">
            {allowClear && selectedOption && !disabled && (
              <X
                className="w-4 h-4 text-gray-400 hover:text-gray-600"
                onClick={handleClear}
              />
            )}
            <ChevronDown
              className={cn(
                'w-4 h-4 text-gray-400 transition-transform',
                isOpen && 'transform rotate-180'
              )}
            />
          </div>
        </button>
      </div>
      {menu && typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </div>
  );
};

export default SearchableSelect;
