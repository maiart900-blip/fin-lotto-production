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
    <div className={cn('grid grid-cols-3 gap-3 p-4', className)}>
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => handleKeyPress(key)}
          className={cn(
            'h-14 rounded-xl font-bold text-xl transition-all duration-150',
            'active:scale-95 active:bg-white/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            key === 'delete' && 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
            key === 'clear' && 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 text-base',
            !['delete', 'clear'].includes(key) && 'bg-white/10 text-white hover:bg-white/20'
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
