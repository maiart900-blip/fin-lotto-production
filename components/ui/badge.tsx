import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        // Gold Primary (Luxury)
        default:
          'border-transparent bg-gradient-to-r from-[#B8860B] to-[#D4AF37] text-[#0F172A] shadow-sm shadow-[rgba(212,175,55,0.3)] [a&]:hover:from-[#D4AF37] [a&]:hover:to-[#FFD700]',
        secondary:
          'border-[rgba(212,175,55,0.2)] bg-[#1E293B] text-[#94A3B8] [a&]:hover:bg-[#334155]',
        destructive:
          'border-transparent bg-gradient-to-r from-[#DC2626] to-[#EF4444] text-white shadow-sm shadow-[rgba(239,68,68,0.3)] [a&]:hover:from-[#B91C1C] [a&]:hover:to-[#DC2626]',
        outline:
          'border-[rgba(212,175,55,0.3)] text-[#D4AF37] bg-transparent [a&]:hover:bg-[rgba(212,175,55,0.1)]',
        // New variants for status
        success:
          'border-transparent bg-gradient-to-r from-[#16A34A] to-[#22C55E] text-white shadow-sm shadow-[rgba(34,197,94,0.3)]',
        warning:
          'border-transparent bg-gradient-to-r from-[#D97706] to-[#F59E0B] text-[#0F172A] shadow-sm shadow-[rgba(245,158,11,0.3)]',
        gold:
          'border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.2)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
