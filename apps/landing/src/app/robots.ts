import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/studio/'] }], sitemap: 'https://moovi-three.vercel.app/sitemap.xml' };
}
