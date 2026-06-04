'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface BannerImage {
  id: string;
  key: string;
  name: string;
  image_url: string;
  link_url?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Default luxury placeholder banner component
function DefaultLuxuryBanner() {
  return (
    <div className="w-full aspect-[21/9] relative overflow-hidden rounded-xl bg-gradient-to-br from-black via-neutral-900 to-black">
      {/* Animated background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[300px] h-[200px] bg-amber-500/10 rounded-full blur-[80px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[250px] h-[150px] bg-amber-600/10 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* Gold border glow */}
      <div className="absolute inset-0 border border-amber-500/30 rounded-xl" />
      <div className="absolute inset-[1px] border border-amber-500/10 rounded-xl" />
      
      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative mb-3">
          <div className="absolute inset-0 blur-xl bg-amber-500/30 rounded-full scale-150" />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/40">
            <Sparkles className="w-8 h-8 text-black" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">
          FIN LOTTO R+
        </h3>
        <p className="text-amber-500/70 text-sm mt-1">จ่ายจริง โอนไว มั่นคง 100%</p>
        <div className="flex items-center gap-2 mt-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-400 text-xs">ระบบพร้อมให้บริการ</span>
        </div>
      </div>
      
      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-amber-500/30 rounded-tl-xl" />
      <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-amber-500/30 rounded-br-xl" />
    </div>
  );
}

export function BannerCarousel() {
  const { data: images, isLoading } = useSWR<BannerImage[]>(
    '/api/web-images?category=banner',
    fetcher,
    { refreshInterval: 60000 }
  );
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Filter banners that have images and haven't failed to load
  const banners = images?.filter(img => 
    img.image_url && 
    img.image_url.length > 0 && 
    !failedImages.has(img.id)
  ) || [];

  // Handle image load error
  const handleImageError = (bannerId: string) => {
    setFailedImages(prev => new Set([...prev, bannerId]));
  };

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

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="w-full aspect-[21/9] rounded-xl bg-neutral-900 animate-pulse" />
    );
  }

  // Show default luxury banner if no active banners
  if (banners.length === 0) {
    return <DefaultLuxuryBanner />;
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
                  onError={() => handleImageError(banner.id)}
                />
              </a>
            ) : (
              <Image
                src={banner.image_url}
                alt={banner.name}
                fill
                className="object-cover"
                priority={index === 0}
                onError={() => handleImageError(banner.id)}
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
