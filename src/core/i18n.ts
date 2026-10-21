import type { LListValue, LStringValue } from './schema';

/** Devuelve el texto en `locale`, si no en `fallback`, si no el primero disponible. */
export function resolve(value: LStringValue, locale: string, fallback: string): string;
export function resolve(value: LStringValue | undefined, locale: string, fallback: string): string | undefined;
export function resolve(value: LStringValue | undefined, locale: string, fallback: string) {
  if (value === undefined || typeof value === 'string') return value;
  return value[locale] || value[fallback] || Object.values(value).find(Boolean) || '';
}

export function resolveList(value: LListValue | undefined, locale: string, fallback: string): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  return (value[locale]?.length ? value[locale] : value[fallback]) ?? Object.values(value)[0] ?? [];
}

const UI = {
  es: {
    menu: 'Menú',
    close: 'Cerrar',
    dark: 'Oscuro',
    light: 'Claro',
    buddyOn: 'Muñeco: sí',
    buddyOff: 'Muñeco: no',
    code: '</> Código',
    codeOn: '</> Ocultar',
    source: 'Ver fuente en GitHub',
    component: 'Componente',
    file: 'Archivo',
    config: 'Configuración de esta sección',
    editInPanel: 'Editar en el panel',
    filtering: 'Filtrando por',
    match: 'coincidencia',
    matches: 'coincidencias',
    clear: 'Quitar filtro',
    usedIn: 'Usado en',
    noUse: 'Sin proyectos asociados todavía.',
    tagHint: 'Toca una tecnología para ver dónde la usé.',
    language: 'Idioma',
    copy: 'Copiar',
    copied: 'Copiado',
    view: 'Ver',
    openNewTab: 'Abrir en pestaña nueva',
    sourceCode: 'Código fuente',
    panel: 'Panel administrativo',
    downloadZip: 'Descargar .zip',
    useTemplate: 'Usar plantilla',
    downloadFile: 'Descargar',
    openLink: 'Abrir',
    print: 'Guardar como PDF',
    madeWith: 'Hecho con Next.js, TypeScript y Tailwind CSS · código abierto (MIT)',
    months: 'ene feb mar abr may jun jul ago sep oct nov dic',
  },
  en: {
    menu: 'Menu',
    close: 'Close',
    dark: 'Dark',
    light: 'Light',
    buddyOn: 'Buddy: on',
    buddyOff: 'Buddy: off',
    code: '</> Code',
    codeOn: '</> Hide',
    source: 'View source on GitHub',
    component: 'Component',
    file: 'File',
    config: 'This section’s config',
    editInPanel: 'Edit in the admin panel',
    filtering: 'Filtering by',
    match: 'match',
    matches: 'matches',
    clear: 'Clear filter',
    usedIn: 'Used in',
    noUse: 'No linked projects yet.',
    tagHint: 'Tap a technology to see where I used it.',
    language: 'Language',
    copy: 'Copy',
    copied: 'Copied',
    view: 'View',
    openNewTab: 'Open in a new tab',
    sourceCode: 'Source code',
    panel: 'Admin panel',
    downloadZip: 'Download .zip',
    useTemplate: 'Use template',
    downloadFile: 'Download',
    openLink: 'Open',
    print: 'Save as PDF',
    madeWith: 'Built with Next.js, TypeScript and Tailwind CSS · open source (MIT)',
    months: 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec',
  },
} as const;

export type UIKey = keyof (typeof UI)['es'];

/** Textos de interfaz. Idiomas sin diccionario usan inglés: agrega el tuyo a `UI`. */
export function uiText(locale: string, key: UIKey): string {
  return (UI as Record<string, Record<UIKey, string>>)[locale]?.[key] ?? UI.en[key];
}

/** `2025-05-08` → `8 may 2025` / `May 8, 2025` */
export function formatDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const month = uiText(locale, 'months').split(' ')[m - 1];
  return locale === 'en' ? `${month} ${d}, ${y}` : `${d} ${month} ${y}`;
}
