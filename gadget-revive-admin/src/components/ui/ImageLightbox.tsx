'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageLightboxProps {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

const ImageLightbox: React.FC<ImageLightboxProps> = ({ images, index, onIndexChange, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const applyZoom = useCallback((next: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    setZoom(z);
    if (z === 1) setOffset({ x: 0, y: 0 });
  }, []);

  const go = useCallback((dir: number) => {
    if (images.length < 2) return;
    onIndexChange((index + dir + images.length) % images.length);
  }, [images.length, index, onIndexChange]);

  useEffect(() => { reset(); }, [index, reset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === '+' || e.key === '=') applyZoom(zoom + 0.5);
      else if (e.key === '-') applyZoom(zoom - 0.5);
      else if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, go, applyZoom, reset, zoom]);

  if (!mounted || !images[index]) return null;

  const btn = 'p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center select-none"
      onClick={onClose}
      onWheel={(e) => applyZoom(zoom + (e.deltaY < 0 ? 0.25 : -0.25))}
    >
      <div className="absolute top-3 right-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs text-white/70 mr-1">{Math.round(zoom * 100)}%</span>
        <button type="button" className={btn} title="Zoom out (-)" onClick={() => applyZoom(zoom - 0.5)}><ZoomOut className="w-5 h-5" /></button>
        <button type="button" className={btn} title="Zoom in (+)" onClick={() => applyZoom(zoom + 0.5)}><ZoomIn className="w-5 h-5" /></button>
        <button type="button" className={btn} title="Reset (0)" onClick={reset}><RotateCcw className="w-5 h-5" /></button>
        <button type="button" className={btn} title="Close (Esc)" onClick={onClose}><X className="w-5 h-5" /></button>
      </div>

      {images.length > 1 && (
        <>
          <button type="button" className={`${btn} absolute left-3 top-1/2 -translate-y-1/2`} onClick={(e) => { e.stopPropagation(); go(-1); }}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button type="button" className={`${btn} absolute right-3 top-1/2 -translate-y-1/2`} onClick={(e) => { e.stopPropagation(); go(1); }}>
            <ChevronRight className="w-6 h-6" />
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/40 px-3 py-1 rounded-full">
            {index + 1} / {images.length}
          </span>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt={`Image ${index + 1}`}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={() => (zoom > 1 ? reset() : applyZoom(2.5))}
        onPointerDown={(e) => {
          if (zoom <= 1) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setOffset({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y });
        }}
        onPointerUp={() => { drag.current = null; }}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          cursor: zoom > 1 ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in',
          transition: drag.current ? 'none' : 'transform 0.15s ease-out',
          touchAction: 'none',
        }}
        className="max-w-[92vw] max-h-[88vh] object-contain"
      />
    </div>,
    document.body
  );
};

export default ImageLightbox;
