import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '시원칸 CoolCar',
    short_name: '시원칸',
    description: '지하철에서 지금 타기 좋은 칸을 추천해요.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#eef9ff',
    theme_color: '#0ea5e9',
    lang: 'ko',
    categories: ['navigation', 'travel', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
