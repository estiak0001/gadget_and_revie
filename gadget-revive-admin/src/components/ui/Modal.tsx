'use client';

import React, { Fragment, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Rendered in the header bar, between the title and the close button -- e.g. a Save button
   * so a long form can be saved without scrolling down to the bottom actions. */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  headerActions,
  children,
  size = 'md',
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <Fragment>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <div
          className={cn(
            'bg-white rounded-lg shadow-xl w-full transform transition-all max-h-[90vh] flex flex-col',
            sizes[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 min-w-0">{title}</h2>
              <div className="flex items-center gap-2 flex-shrink-0">
                {headerActions}
                <button
                  onClick={onClose}
                  className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
          )}
          <div className="px-4 py-3 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default Modal;
