'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import Modal from './Modal';

interface InfoButtonProps {
  title: string;
  children: React.ReactNode;
}

/** A small (i) icon that opens a modal explaining how the page works — used across the Accounts module. */
const InfoButton: React.FC<InfoButtonProps> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="How this works"
        aria-label="How this works"
        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
      >
        <Info className="w-5 h-5" />
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={title} size="lg">
        <div className="space-y-5 text-sm text-gray-700 leading-relaxed">{children}</div>
      </Modal>
    </>
  );
};

export default InfoButton;
