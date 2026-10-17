import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'الموسوعة العُمانية الرقمية',
    template: '%s | الموسوعة العُمانية الرقمية',
  },
  applicationName: 'الموسوعة العُمانية الرقمية',
  description:
    'الموسوعة العُمانية الرقمية — بوابة معرفية عربية موثقة للبحث في تاريخ سلطنة عُمان وتراثها وجغرافيتها وشخصياتها.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/images/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/images/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/images/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/images/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/images/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
  },
  openGraph: {
    title: 'الموسوعة العُمانية الرقمية',
    description:
      'ابحث في تاريخ عُمان وتراثها وجغرافيتها وشخصياتها عبر مقالات ومصادر موثقة.',
    siteName: 'الموسوعة العُمانية الرقمية',
    locale: 'ar_OM',
    type: 'website',
    images: [
      {
        url: '/images/oman-encyclopedia-og.png',
        width: 1200,
        height: 630,
        alt: 'شعار الموسوعة العُمانية الرقمية',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'الموسوعة العُمانية الرقمية',
    description:
      'ابحث في تاريخ عُمان وتراثها وجغرافيتها وشخصياتها عبر مقالات ومصادر موثقة.',
    images: ['/images/oman-encyclopedia-og.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen flex flex-col bg-omani-ivory text-stone-900 antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
