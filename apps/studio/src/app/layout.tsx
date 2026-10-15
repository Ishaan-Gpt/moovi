import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Serif, DM_Mono } from 'next/font/google';
import '@moovi/brand/tokens.css';
import '@/styles/base.css';
import '@/styles/auth.css';
import '@/styles/dash.css';
import '@/styles/office.css';
import '@/styles/chat.css';
import '@/styles/overlay.css';
import '@/styles/settings.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap', axes: ['opsz', 'wdth'] });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
const mono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Moovi Studio', template: '%s · Moovi' },
  description: 'Hire Moovi: a director and his crew make your video while you watch them work.',
  icons: { icon: '/studio/icon.svg' },
};
export const viewport: Viewport = { themeColor: '#F7FAFD', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
