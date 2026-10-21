import type { Metadata } from 'next';
import { AdminApp } from '@/admin/AdminApp';

export const metadata: Metadata = {
  title: 'Panel · Portafolio',
  description: 'Panel administrativo del portafolio.',
  robots: { index: false, follow: false },
};

// El token solo puede viajar a api.github.com, aunque se colara un script ajeno.
// Solo en producción: el modo desarrollo de Next necesita eval.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.github.com",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

export default function AdminPage() {
  return (
    <>
      {process.env.NODE_ENV === 'production' && <meta httpEquiv="Content-Security-Policy" content={CSP} />}
      <AdminApp />
    </>
  );
}
