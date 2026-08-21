// Root layout - FIN LOTTO
import type { Metadata, Viewport } from 'next'
import { Prompt } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from '@/components/providers'
import './globals.css'

const prompt = Prompt({ 
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
});

export const viewport: Viewport = {
  themeColor: '#000000', // Pure Black for Premium Midnight Gold theme
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: 'FIN LOTTO R+ | เว็บหวยออนไลน์ระดับพรีเมี่ยม',
    template: '%s | FIN LOTTO R+',
  },
  description: 'FIN LOTTO R+ เว็บหวยออนไลน์ระดับพรีเมี่ยม จ่ายสูงบาทละ 900 มั่นคง ปลอดภัย ฝาก-ถอนออโต้ 24 ชม.',
  keywords: ['หวยออนไลน์', 'แทงหวย', 'หวย', 'ลอตเตอรี่', 'FIN LOTTO', 'หวยรัฐบาล', 'หวยหุ้น', 'หวยลาว', 'หวยฮานอย'],
  authors: [{ name: 'FIN LOTTO R+' }],
  creator: 'FIN LOTTO R+',
  publisher: 'FIN LOTTO R+',
  generator: 'Next.js',
  manifest: '/manifest.json',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://finlottop.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    url: '/',
    siteName: 'FIN LOTTO R+',
    title: 'FIN LOTTO R+ | เว็บหวยออนไลน์ระดับพรีเมี่ยม',
    description: 'FIN LOTTO R+ เว็บหวยออนไลน์ระดับพรีเมี่ยม จ่ายสูงบาทละ 900 มั่นคง ปลอดภัย ฝาก-ถอนออโต้ 24 ชม.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FIN LOTTO R+ - เว็บหวยออนไลน์ระดับพรีเมี่ยม',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FIN LOTTO R+ | เว็บหวยออนไลน์ระดับพรีเมี่ยม',
    description: 'FIN LOTTO R+ เว็บหวยออนไลน์ระดับพรีเมี่ยม จ่ายสูงบาทละ 900 มั่นคง ปลอดภัย',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FIN LOTTO R+',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon-32x32.png',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" className="bg-black" data-scroll-behavior="smooth">
      <body className={`${prompt.variable} font-sans antialiased bg-black text-[#E5E5E5]`}>
        <Providers>
          {children}
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
