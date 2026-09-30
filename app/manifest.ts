import type { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'ClearDrop — Doorway Watch', short_name: 'ClearDrop', description: 'Check your doorway with your phone camera.', start_url: '/phone', scope: '/', display: 'standalone', background_color: '#f7f8f4', theme_color: '#126b58', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] }
}
