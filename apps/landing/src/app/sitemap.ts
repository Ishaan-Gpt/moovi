import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: 'https://moovi-three.vercel.app/', changeFrequency: 'weekly', priority: 1 }];
}
