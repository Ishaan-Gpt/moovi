import type { Metadata, Viewport } from 'next';
import { Manrope, Fraunces, DM_Mono, Fredoka } from 'next/font/google';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/chrome.css';
import '@/styles/sections.css';
import '@/styles/film.css';
import { Intro, introGateScript } from '@/components/motion/Intro';
import { PageTransition } from '@/components/motion/PageTransition';
import { SmoothScroll } from '@/components/motion/SmoothScroll';
import { Reveals } from '@/components/motion/Reveals';
import { Header } from '@/components/chrome/Header';
import { Timeline } from '@/components/chrome/Timeline';

// a calm, slightly rounded grotesk for UI and body; a soft serif (Fraunces at full SOFT) for the expressive lines,
// whose rounded terminals echo Moovi's jelly
const display = Manrope({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const serif = Fraunces({ subsets: ['latin'], style: ['normal', 'italic'], axes: ['SOFT', 'WONK', 'opsz'], variable: '--font-serif', display: 'swap' });
const mono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });
// the logo's word: a heavy, fully rounded face (Ishaan's reference), round like the jelly
const logo = Fredoka({ subsets: ['latin'], weight: ['700'], variable: '--font-logo', display: 'swap' });

export const metadata: Metadata = {
  title: 'Moovi · the AI video director you hire',
  description: 'Tell Moovi what your video is for. His crew of AI specialists writes it, cuts it, scores it and checks it, and he remembers every note you give.',
  metadataBase: new URL('https://moovi-three.vercel.app'),
  openGraph: { title: 'Moovi · the AI video director you hire', description: 'A director, seven specialists and a memory graph. Your video, made by a crew.', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#F7FAFD', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${mono.variable} ${logo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introGateScript }} />
        <link rel="preload" as="image" href="/brand/halo.webp" type="image/webp" fetchPriority="high" />
      </head>
      <body>
        <a href="#main" className="skip t-sub2">Skip to content</a>
        <Intro />
        <SmoothScroll />
        <Reveals />
        <Header />
        <Timeline />
        <main id="main">{children}</main>
        <PageTransition />
      </body>
    </html>
  );
}
