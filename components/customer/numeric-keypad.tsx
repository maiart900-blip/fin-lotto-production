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
    if (disabled) return;
    
    if (key === 'delete') {
      onDelete();
    } else if (key === 'clear') {
      onClear?.();
    } else {
      onInput(key);
    }
  };

  return (
    <div className={cn('grid grid-cols-3 gap-3 p-4 bg-white rounded-2xl border-4 border-[#D4AF37]', className)}>
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => handleKeyPress(key)}
          className={cn(
            'h-16 rounded-xl font-bold text-2xl transition-all duration-150 border-2',
            'active:scale-95 shadow-md',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            key === 'delete' && 'bg-red-50 text-red-600 hover:bg-red-100 border-red-300',
            key === 'clear' && 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300 text-base font-semibold',
            !['delete', 'clear'].includes(key) && 'bg-white text-gray-900 hover:bg-[#D4AF37]/10 border-[#D4AF37] hover:border-[#B8860B]'
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
      ))}
    </div>
  );
}
