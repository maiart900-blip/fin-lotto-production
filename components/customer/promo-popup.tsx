'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { X, Sparkles, Gift, ExternalLink } from 'lucide-react';

interface PopupImage {
  id: string;
  key: string;
  name: string;
  image_url: string;
  link_url?: string;
  is_active?: boolean;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Session storage key for dismissed popups
const POPUP_DISMISSED_KEY = 'fin_lotto_popup_dismissed';

// Default luxury popup content when no popup image
function DefaultLuxuryPopupContent() {
  return (
    <div className="relative w-full aspect-square max-w-[300px] bg-gradient-to-br from-black via-neutral-900 to-black rounded-2xl overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-[150px] h-[150px] bg-amber-500/10 rounded-full blur-[60px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[100px] h-[100px] bg-amber-600/10 rounded-full blur-[40px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* Gold border */}
      <div className="absolute inset-0 border-2 border-amber-500/30 rounded-2xl" />
      
      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-4">
          <div className="absolute inset-0 blur-xl bg-amber-500/30 rounded-full scale-150" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/40">
            <Gift className="w-10 h-10 text-black" />
          </div>
        </div>
        
        <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 mb-2">
          ยินดีต้อนรับ!
        </h3>
        <p className="text-amber-500/80 text-sm mb-4">
          FIN LOTTO R+ - ระบบหวยออนไลน์ที่ดีที่สุด
        </p>
        
        <div className="space-y-2 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>จ่ายจริง โอนไว มั่นคง 100%</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>ระบบออโต้ ฝาก-ถอน 24 ชม.</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>บริการลูกค้าตลอด 24 ชั่วโมง</span>
          </div>
        </div>
      </div>
      
      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-12 h-12 border-l-2 border-t-2 border-amber-500/40 rounded-tl-2xl" />
      <div className="absolute bottom-0 right-0 w-12 h-12 border-r-2 border-b-2 border-amber-500/40 rounded-br-2xl" />
    </div>
  );
}

export function PromoPopup() {
  const { data: popupImages } = useSWR<PopupImage[]>(
    '/api/web-images?category=popup',
    fetcher,
    { refreshInterval: 60000 }
  );
  
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Get active popup
  const activePopup = popupImages?.find(p => p.image_url && p.image_url.length > 0);

  // Check session storage on mount
  useEffect(() => {
    // Only show popup if not dismissed in this session
    const dismissed = sessionStorage.getItem(POPUP_DISMISSED_KEY);
    if (!dismissed) {
      // Delay popup appearance for better UX
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle close and save to session storage
  const handleClose = () => {
    setIsOpen(false);
    // Save to session storage to prevent showing again in this session
    sessionStorage.setItem(POPUP_DISMISSED_KEY, 'true');
  };

  // Handle image error
  const handleImageError = () => {
    setImageError(true);
  };

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative animate-in fade-in zoom-in duration-300">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute -top-3 -right-3 z-10 w-10 h-10 rounded-full bg-neutral-800 border border-amber-500/30 flex items-center justify-center text-white hover:bg-neutral-700 hover:border-amber-500/50 transition-all shadow-lg"
          aria-label="Close popup"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Popup Content */}
        {activePopup && !imageError ? (
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-amber-500/20 border border-amber-500/30">
            {activePopup.link_url ? (
              <a 
                href={activePopup.link_url} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={handleClose}
              >
                <div className="relative w-[300px] sm:w-[350px] aspect-square">
                  <Image
                    src={activePopup.image_url}
                    alt={activePopup.name || 'Promotion'}
                    fill
                    className="object-cover"
                    onError={handleImageError}
                    priority
                  />
                  {/* Link indicator */}
                  <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm flex items-center gap-1.5 text-amber-400 text-xs">
                    <ExternalLink className="w-3 h-3" />
                    <span>ดูเพิ่มเติม</span>
                  </div>
                </div>
              </a>
            ) : (
              <div className="relative w-[300px] sm:w-[350px] aspect-square">
                <Image
                  src={activePopup.image_url}
                  alt={activePopup.name || 'Promotion'}
                  fill
                  className="object-cover"
                  onError={handleImageError}
                  priority
                />
              </div>
            )}
          </div>
        ) : (
          // Default luxury popup when no image or image failed
          <DefaultLuxuryPopupContent />
        )}
        
        {/* Don't show again hint */}
        <p className="text-center text-neutral-500 text-xs mt-3">
          แตะพื้นหลังหรือปุ่ม X เพื่อปิด
        </p>
      </div>
    </div>
  );
}
