import type { Metadata, Viewport } from 'next';
import { Lilita_One, Nunito } from 'next/font/google';
import { Toaster } from '@/components/Toaster';
import './globals.css';

const lilita = Lilita_One({ weight: '400', subsets: ['latin'], variable: '--font-lilita' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' });

export const metadata: Metadata = {
  title: 'Juan — play with friends',
  description: 'A fast, chaotic card game for friends. Create a room, share the code, play.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0d0618',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lilita.variable} ${nunito.variable}`}>
      <body className="bg-stage min-h-full antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
