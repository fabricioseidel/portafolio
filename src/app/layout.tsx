import type { Metadata } from 'next';
import { Archivo, Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { resolve } from '@/core/i18n';
import { site } from '@/core/site';
import './globals.css';

const archivo = Archivo({ subsets: ['latin', 'latin-ext'], variable: '--font-archivo', display: 'swap' });
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-fraunces', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

const description = resolve(site.meta.description, site.locales[0], site.locales[0]);

export const metadata: Metadata = {
  title: site.meta.title,
  description,
  ...(site.meta.url ? { metadataBase: new URL(site.meta.url) } : {}),
  openGraph: { title: site.meta.title, description, type: 'website' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={site.locales[0]} className={`${archivo.variable} ${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
