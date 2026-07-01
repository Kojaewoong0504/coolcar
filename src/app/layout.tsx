import type { Metadata, Viewport } from 'next';
import './globals.css';

const title = '시원칸';
const description = '여름 지하철에서 덜 덥고 덜 답답한 칸을 추천해요. 앱 설치 없이 바로 확인하세요.';

export const metadata: Metadata = {
  metadataBase: new URL('https://coolcar-sigma.vercel.app'),
  title: {
    default: title,
    template: `%s · ${title}`,
  },
  description,
  applicationName: title,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title, statusBarStyle: 'default' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: title,
    title: `${title} — 여름 지하철 무료 웹앱`,
    description,
    locale: 'ko_KR',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '시원칸 — 지하철에서 덜 덥고 덜 답답한 칸을 추천해요',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${title} — 여름 지하철 무료 웹앱`,
    description,
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#eaf8ff' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
