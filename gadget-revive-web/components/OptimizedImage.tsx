'use client';

import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  sizes?: string;
  quality?: number;
  placeholder?: 'blur' | 'empty';
}

const PLACEHOLDER_SRC = '/images/placeholder.jpg';

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill,
  className,
  priority = false,
  sizes,
  quality = 75,
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src || PLACEHOLDER_SRC);

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={fill ? undefined : (width ?? 400)}
      height={fill ? undefined : (height ?? 400)}
      fill={fill}
      className={className}
      priority={priority}
      sizes={sizes ?? (fill ? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw' : undefined)}
      quality={quality}
      loading={priority ? 'eager' : 'lazy'}
      onError={() => setImgSrc(PLACEHOLDER_SRC)}
      unoptimized={imgSrc.includes('localhost')}
    />
  );
}
