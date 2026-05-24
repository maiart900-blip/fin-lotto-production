'use client';

import { 
  BadgeCheck, 
  Wallet, 
  ShieldCheck, 
  Clock, 
  Smartphone 
} from 'lucide-react';

const features = [
  {
    icon: BadgeCheck,
    label: 'จ่ายจริง',
  },
  {
    icon: Wallet,
    label: 'ฝาก-ถอน',
  },
  {
    icon: ShieldCheck,
    label: 'ระบบปลอดภัย',
  },
  {
    icon: Clock,
    label: 'บริการ 24 ชม.',
  },
  {
    icon: Smartphone,
    label: 'รองรับทุกอุปกรณ์',
  },
];

export function FeatureBar() {
  return (
    <div className="w-full overflow-hidden bg-gradient-to-r from-neutral-900/90 via-neutral-800/90 to-neutral-900/90 backdrop-blur-sm border-t border-b border-amber-500/20 py-3">
      <div className="flex items-center justify-around gap-4 px-4 overflow-x-auto scrollbar-hide">
        {features.map((feature, index) => (
          <div 
            key={index} 
            className="flex items-center gap-2 flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
              <feature.icon className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-white text-xs font-medium whitespace-nowrap">
              {feature.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
