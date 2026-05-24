import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold uppercase tracking-wide transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#FDE047] focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        // Primary - Premium Metallic Gold (Luxury)
        default: 'premium-gold-btn border border-[rgba(0,0,0,0.1)] shadow-[0_4px_15px_rgba(184,134,11,0.4)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(212,175,55,0.6)] active:translate-y-0 active:shadow-[0_2px_10px_rgba(184,134,11,0.3)]',
        destructive:
          'bg-gradient-to-b from-[#EF4444] via-[#DC2626] to-[#B91C1C] text-white border border-[rgba(0,0,0,0.1)] shadow-[0_4px_15px_rgba(239,68,68,0.4)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(239,68,68,0.6)]',
        outline:
          'border-2 border-[#bf953f] bg-transparent text-[#bf953f] hover:bg-[rgba(191,149,63,0.1)] hover:shadow-[0_0_15px_rgba(191,149,63,0.3)]',
        secondary:
          'bg-gradient-to-b from-[#1E293B] to-[#0F172A] text-[#F8FAFC] border border-[rgba(255,255,255,0.1)] shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:brightness-125 hover:-translate-y-0.5',
        ghost:
          'text-[#64748B] hover:bg-[rgba(191,149,63,0.1)] hover:text-[#bf953f] normal-case',
        link: 'text-[#bf953f] underline-offset-4 hover:underline hover:text-[#fcf6ba] normal-case',
        // Gold Outline with Glow
        'gold-outline': 'border-2 border-[#bf953f] bg-transparent text-[#bf953f] hover:bg-[rgba(191,149,63,0.15)] hover:shadow-[0_0_20px_rgba(191,149,63,0.4)] hover:border-[#fcf6ba]',
        // Success Premium
        success: 'bg-gradient-to-br from-[#22C55E] via-[#16A34A] to-[#15803D] text-white border border-[rgba(0,0,0,0.1)] shadow-[0_4px_15px_rgba(34,197,94,0.4)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(34,197,94,0.6)]',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
