import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Los tests no deben depender del entorno donde corren (el workflow de despliegue o tu .env.local definen estas variables).
const AMBIENT_VARS = [
  'NEXT_PUBLIC_BASE_PATH',
  'NEXT_PUBLIC_GITHUB_REPOSITORY',
  'NEXT_PUBLIC_GITHUB_BRANCH',
  'NEXT_PUBLIC_CONTENT_REPOSITORY',
  'NEXT_PUBLIC_CONTENT_BRANCH',
];

beforeEach(() => {
  for (const name of AMBIENT_VARS) vi.stubEnv(name, '');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllEnvs();
});

// jsdom no implementa matchMedia ni scrollIntoView.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
Element.prototype.scrollIntoView = () => {};
// El sitio adopta el idioma del navegador; los tests parten en español.
Object.defineProperty(navigator, 'language', { configurable: true, value: 'es-CL' });
