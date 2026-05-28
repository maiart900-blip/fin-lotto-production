'use client';

import { cn } from '@/lib/utils';
import { Delete } from 'lucide-react';

interface NumericKeypadProps {
  onInput: (digit: string) => void;
  onDelete: () => void;
  onClear?: () => void;
  disabled?: boolean;
  className?: string;
}

export function NumericKeypad({
  onInput,
  onDelete,
  onClear,
  disabled = false,
  className,
}: NumericKeypadProps) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete'];

  const handleKeyPress = (key: string) => {
    // Delete and Clear should ALWAYS work, even when digit input is disabled
    if (key === 'delete') {
      onDelete();
      return;
    }
    
    if (key === 'clear') {
      onClear?.();
      return;
    }
    
    // Only block digit input when disabled
    if (disabled) return;
    
    onInput(key);
  };

  return (
    <div className={cn('grid grid-cols-3 gap-3 p-4 bg-white rounded-xl border-2 border-[#D4AF37]', className)}>
      {keys.map((key) => {
        // Delete and Clear buttons are NEVER disabled
        const isActionButton = key === 'delete' || key === 'clear';
        const isButtonDisabled = isActionButton ? false : disabled;
        
        return (
          <button
            key={key}
            type="button"
            disabled={isButtonDisabled}
            onClick={() => handleKeyPress(key)}
            className={cn(
              'h-14 rounded-xl font-bold text-2xl transition-all duration-150 shadow-md',
              'active:scale-95 active:shadow-sm',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              key === 'delete' && 'bg-gradient-to-b from-red-50 to-red-100 text-red-600 hover:from-red-100 hover:to-red-200 border-2 border-red-300 active:bg-red-200',
              key === 'clear' && 'bg-gradient-to-b from-gray-50 to-gray-100 text-gray-600 hover:from-gray-100 hover:to-gray-200 border-2 border-gray-300 text-sm font-semibold active:bg-gray-200',
              !['delete', 'clear'].includes(key) && 'bg-white text-black hover:bg-[#D4AF37]/10 border-2 border-[#D4AF37] hover:border-[#B8860B]'
            )}
          >
            {key === 'delete' ? (
              <Delete className="h-6 w-6 mx-auto" />
            ) : key === 'clear' ? (
              'ลบทั้งหมด'
            ) : (
              key
            )}
          </button>
        );
      })}
    </div>
  );
}
