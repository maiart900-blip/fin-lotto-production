import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-[#94A3B8] selection:bg-[#EAB308] selection:text-black bg-white border-[#E2E8F0] h-9 w-full min-w-0 rounded-lg border px-3 py-1 text-base text-[#0F172A] shadow-xs transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-[#FDE047] focus-visible:ring-2 focus-visible:ring-[rgba(234,179,8,0.3)] focus-visible:shadow-[0_0_10px_rgba(234,179,8,0.2)]',
        'aria-invalid:ring-[rgba(239,68,68,0.3)] aria-invalid:border-[#EF4444]',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
