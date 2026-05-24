'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BannerImage {
  id: string;
  key: string;
  name: string;
  image_url: string;
  link_url?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function BannerCarousel() {
  const { data: images } = useSWR<BannerImage[]>(
    '/api/web-images?category=banner',
    fetcher,
    { refreshInterval: 60000 }
  );
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Filter banners that have images
  const banners = images?.filter(img => img.image_url && img.image_url.length > 0) || [];

  const nextSlide = useCallback(() => {
    if (banners.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    if (banners.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  // Auto-play carousel
  useEffect(() => {
    if (!isAutoPlaying || banners.length <= 1) return;
    const interval = setInterval(nextSlide, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide, banners.length]);

  // Reset index when banners change
  useEffect(() => {
    if (currentIndex >= banners.length && banners.length > 0) {
      setCurrentIndex(0);
    }
  }, [banners.length, currentIndex]);

  if (banners.length === 0) {
    return null;
  }

  return (
    <div 
      className="relative w-full overflow-hidden rounded-xl"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Banner Container */}
      <div 
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className="w-full flex-shrink-0 relative aspect-[21/9]"
          >
            {banner.link_url ? (
              <a href={banner.link_url} target="_blank" rel="noopener noreferrer">
                <Image
                  src={banner.image_url}
                  alt={banner.name}
                  fill
                  className="object-cover"
                  priority={index === 0}
                />
              </a>
            ) : (
              <Image
                src={banner.image_url}
                alt={banner.name}
                fill
                className="object-cover"
                priority={index === 0}
              />
            )}
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            aria-label="Previous banner"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            aria-label="Next banner"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-amber-400 w-6'
                  : 'bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`Go to banner ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
