import { resolve } from '@/core/i18n';
import { FONTS, PRESETS, type LStringValue, type SectionType, type SiteInput } from '@/core/schema';
import type { Field } from './fields';

/** Texto de un valor traducible para títulos de tarjetas. */
export function textOf(value: unknown, locale: string): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) return resolve(value as LStringValue, locale, locale) ?? '';
  return '';
}

const ID: Field = { kind: 'text', key: 'id', label: 'Ancla (#id)', help: 'Minúsculas, números y guiones. Es la dirección de la sección: tusitio/#id.' };
const TITLE: Field = { kind: 'ltext', key: 'title', label: 'Título', help: 'Se muestra numerado: "01 — Título".' };
const NAV: Field = { kind: 'ltext', key: 'nav', label: 'Texto en el menú', help: 'Vacío = la sección no aparece en el menú.' };

const LINK: Field[] = [
  { kind: 'ltext', key: 'label', label: 'Texto' },
  { kind: 'url', key: 'href', label: 'Enlace', upload: 'file', help: 'https://…, mailto:…, tel:… o un archivo subido (p. ej. tu CV en PDF).' },
  {
    kind: 'select',
    key: 'variant',
    label: 'Estilo',
    options: [
      { value: 'primary', label: 'Principal (relleno de color)' },
      { value: 'secondary', label: 'Secundario (con borde)' },
      { value: 'ghost', label: 'Solo texto' },
    ],
  },
];

const linkList = (key: string, label: string): Field => ({
  kind: 'list',
  key,
  label,
  item: LINK,
  itemTitle: (i, l) => textOf(i.label, l),
  newItem: () => ({ label: 'Nuevo enlace', href: 'https://', variant: 'secondary' }),
});

const STAT: Field[] = [
  { kind: 'ltext', key: 'value', label: 'Cifra', placeholder: '980' },
  { kind: 'ltext', key: 'label', label: 'Descripción', placeholder: 'tests automatizados' },
];

const statList = (key: string, label: string, min = 0): Field => ({
  kind: 'list',
  key,
  label,
  item: STAT,
  min,
  itemTitle: (i, l) => [textOf(i.value, l), textOf(i.label, l)].filter(Boolean).join(' · '),
  newItem: () => ({ value: '0', label: 'Descripción' }),
});

const PROJECT: Field[] = [
  { kind: 'ltext', key: 'title', label: 'Nombre del proyecto' },
  { kind: 'ltext', key: 'kicker', label: 'Etiqueta superior', help: 'Opcional, p. ej. "Freelance".' },
  { kind: 'ltext', key: 'period', label: 'Período', placeholder: '2025 —' },
  { kind: 'checkbox', key: 'featured', label: 'Destacado', help: 'Destacado: bloque grande con imagen o código. Si no, tarjeta compacta.' },
  { kind: 'ltextarea', key: 'description', label: 'Descripción' },
  { kind: 'llist', key: 'highlights', label: 'Logros (uno por línea)' },
  statList('stats', 'Cifras'),
  { kind: 'tags', key: 'tags', label: 'Tecnologías', help: 'Se cruzan con la sección de habilidades para el filtro.' },
  linkList('links', 'Enlaces (sitio, código…)'),
  {
    kind: 'variant',
    key: 'media',
    label: 'Imagen o código',
    discriminator: 'type',
    optional: true,
    variants: [
      {
        value: 'image',
        label: 'Imagen',
        fields: [
          { kind: 'image', key: 'src', label: 'Captura' },
          { kind: 'ltext', key: 'alt', label: 'Texto alternativo' },
        ],
        create: () => ({ type: 'image', src: '' }),
      },
      {
        value: 'code',
        label: 'Fragmento de código',
        fields: [
          { kind: 'text', key: 'filename', label: 'Nombre del archivo', placeholder: 'src/app.ts' },
          { kind: 'text', key: 'language', label: 'Lenguaje', placeholder: 'ts' },
          { kind: 'code', key: 'code', label: 'Código' },
        ],
        create: () => ({ type: 'code', filename: 'ejemplo.ts', language: 'ts', code: '// tu código' }),
      },
    ],
  },
];

const CREDENTIAL: Field[] = [
  { kind: 'ltext', key: 'title', label: 'Nombre' },
  { kind: 'ltext', key: 'value', label: 'Valor', placeholder: '440 h' },
  { kind: 'date', key: 'date', label: 'Fecha' },
  { kind: 'url', key: 'href', label: 'Certificado (imagen o enlace)', upload: 'image', help: 'Las imágenes se abren en un visor dentro de la página.' },
];

/** Campos editables de cada tipo de sección. `hidden` se maneja desde la lista de secciones. */
export const SECTION_FIELDS: Record<SectionType, Field[]> = {
  hero: [
    ID,
    NAV,
    { kind: 'ltext', key: 'eyebrow', label: 'Antetítulo', help: 'Rol y ciudad; se muestra en mayúsculas pequeñas.' },
    { kind: 'lines', key: 'headline', label: 'Nombre (un renglón por línea)', help: 'El punto de color se agrega solo al final.' },
    { kind: 'ltextarea', key: 'intro', label: 'Presentación' },
    { kind: 'ltextarea', key: 'meta', label: 'Línea secundaria', rows: 2 },
    linkList('actions', 'Botones'),
    {
      kind: 'variant',
      key: 'aside',
      label: 'Columna derecha',
      discriminator: 'kind',
      optional: true,
      variants: [
        { value: 'stats', label: 'Cifras', fields: [statList('items', 'Cifras', 1)], create: () => ({ kind: 'stats', items: [{ value: '0', label: 'Descripción' }] }) },
        {
          value: 'image',
          label: 'Retrato o imagen',
          fields: [
            { kind: 'image', key: 'src', label: 'Imagen', help: 'Formato vertical 4:5. Se muestra en escala de grises y toma color al pasar el mouse.' },
            { kind: 'ltext', key: 'alt', label: 'Texto alternativo' },
          ],
          create: () => ({ kind: 'image', src: '' }),
        },
      ],
    },
  ],
  projects: [
    ID,
    TITLE,
    NAV,
    {
      kind: 'list',
      key: 'items',
      label: 'Proyectos',
      min: 1,
      item: PROJECT,
      itemTitle: (i, l) => textOf(i.title, l),
      newItem: () => ({ title: 'Nuevo proyecto', description: 'Qué problema resolvió y cuál fue el resultado.', featured: false, tags: [] }),
    },
  ],
  skills: [
    ID,
    TITLE,
    NAV,
    {
      kind: 'list',
      key: 'groups',
      label: 'Grupos',
      min: 1,
      item: [
        { kind: 'ltext', key: 'title', label: 'Nombre del grupo' },
        { kind: 'tags', key: 'items', label: 'Habilidades' },
      ],
      itemTitle: (i, l) => textOf(i.title, l),
      newItem: () => ({ title: 'Nuevo grupo', items: ['Habilidad'] }),
    },
  ],
  timeline: [
    ID,
    TITLE,
    NAV,
    {
      kind: 'list',
      key: 'items',
      label: 'Experiencias',
      min: 1,
      item: [
        { kind: 'ltext', key: 'period', label: 'Período', placeholder: '2025 — hoy' },
        { kind: 'ltext', key: 'title', label: 'Empresa o proyecto' },
        { kind: 'ltext', key: 'subtitle', label: 'Cargo' },
        { kind: 'ltextarea', key: 'description', label: 'Descripción' },
        { kind: 'tags', key: 'tags', label: 'Tecnologías', help: 'Opcional; conecta esta experiencia con el filtro de habilidades.' },
      ],
      itemTitle: (i, l) => [textOf(i.title, l), textOf(i.period, l)].filter(Boolean).join(' · '),
      newItem: () => ({ period: '2025 — hoy', title: 'Empresa', subtitle: 'Cargo', tags: [] }),
    },
  ],
  credentials: [
    ID,
    TITLE,
    NAV,
    {
      kind: 'list',
      key: 'highlights',
      label: 'Destacados (tarjetas grandes)',
      item: [{ kind: 'ltext', key: 'kicker', label: 'Etiqueta superior', placeholder: 'Carrera · Desafío Latam' }, ...CREDENTIAL],
      itemTitle: (i, l) => textOf(i.title, l),
      newItem: () => ({ title: 'Nuevo certificado' }),
    },
    { kind: 'ltext', key: 'listTitle', label: 'Título de la lista' },
    {
      kind: 'list',
      key: 'items',
      label: 'Lista',
      item: CREDENTIAL,
      itemTitle: (i, l) => textOf(i.title, l),
      newItem: () => ({ title: 'Nuevo módulo' }),
    },
  ],
  about: [
    ID,
    TITLE,
    NAV,
    { kind: 'ltextarea', key: 'statement', label: 'Frase principal', rows: 4 },
    {
      kind: 'list',
      key: 'facts',
      label: 'Datos',
      item: [
        { kind: 'ltext', key: 'label', label: 'Etiqueta' },
        { kind: 'ltextarea', key: 'value', label: 'Valor', rows: 2 },
      ],
      itemTitle: (i, l) => textOf(i.label, l),
      newItem: () => ({ label: 'Dato', value: 'Valor' }),
    },
  ],
  gallery: [
    ID,
    TITLE,
    NAV,
    {
      kind: 'list',
      key: 'items',
      label: 'Imágenes',
      min: 1,
      item: [
        { kind: 'image', key: 'src', label: 'Imagen' },
        { kind: 'ltext', key: 'caption', label: 'Pie de foto' },
        { kind: 'ltext', key: 'alt', label: 'Texto alternativo' },
      ],
      itemTitle: (i, l) => textOf(i.caption, l) || textOf(i.src, l),
      newItem: () => ({ src: '' }),
    },
  ],
  text: [ID, TITLE, NAV, { kind: 'llist', key: 'body', label: 'Párrafos (uno por línea)' }],
  download: [
    ID,
    TITLE,
    NAV,
    { kind: 'ltextarea', key: 'intro', label: 'Introducción', rows: 2 },
    {
      kind: 'list',
      key: 'items',
      label: 'Descargas',
      min: 1,
      item: [
        {
          kind: 'select',
          key: 'kind',
          label: 'Tipo',
          options: [
            { value: 'zip', label: 'Código del repositorio (.zip)' },
            { value: 'template', label: 'Usar como plantilla en GitHub' },
            { value: 'file', label: 'Archivo propio (CV, PDF…)' },
            { value: 'link', label: 'Enlace externo' },
            { value: 'print', label: 'Guardar la página como PDF' },
          ],
        },
        { kind: 'ltext', key: 'label', label: 'Título' },
        { kind: 'ltextarea', key: 'description', label: 'Descripción', rows: 2 },
        { kind: 'url', key: 'href', label: 'Archivo o enlace', upload: 'file', help: 'Solo para "Archivo propio" y "Enlace externo".' },
      ],
      itemTitle: (i, l) => textOf(i.label, l),
      newItem: () => ({ kind: 'file', label: 'Nuevo archivo', href: '/cv/cv.pdf' }),
    },
  ],
  contact: [
    ID,
    NAV,
    { kind: 'ltext', key: 'headline', label: 'Frase de cierre' },
    {
      kind: 'list',
      key: 'lines',
      label: 'Líneas de contacto',
      item: [
        { kind: 'ltext', key: 'label', label: 'Texto' },
        { kind: 'url', key: 'href', label: 'Enlace', help: 'mailto:, tel:, https://… o vacío para texto simple.' },
      ],
      itemTitle: (i, l) => textOf(i.label, l),
      newItem: () => ({ label: 'Nuevo contacto' }),
    },
  ],
};

/** Datos generales del sitio (edita la raíz de content/site.json). */
export const GENERAL_FIELDS: Field[] = [
  {
    kind: 'object',
    key: 'brand',
    label: 'Marca',
    fields: [
      { kind: 'text', key: 'name', label: 'Nombre en el menú' },
      { kind: 'text', key: 'mark', label: 'Signo de acento', help: 'El carácter de color después del nombre (por defecto ".").' },
    ],
  },
  {
    kind: 'object',
    key: 'meta',
    label: 'Buscadores y redes',
    fields: [
      { kind: 'text', key: 'title', label: 'Título de la pestaña' },
      { kind: 'ltextarea', key: 'description', label: 'Descripción', rows: 3 },
      { kind: 'url', key: 'url', label: 'URL pública del sitio', placeholder: 'https://usuario.github.io/portafolio/' },
    ],
  },
  { kind: 'lines', key: 'locales', label: 'Idiomas (uno por línea)', help: 'El primero es el principal. Códigos de 2 letras: es, en, pt…' },
  {
    kind: 'object',
    key: 'repo',
    label: 'Repositorio',
    optional: true,
    create: () => ({ url: 'https://github.com/usuario/portafolio', branch: 'main' }),
    fields: [
      { kind: 'url', key: 'url', label: 'URL del repositorio' },
      { kind: 'text', key: 'branch', label: 'Rama' },
    ],
  },
];

export const THEME_FIELDS: Field[] = [
  {
    kind: 'object',
    key: 'theme',
    label: 'Tema',
    create: () => ({}),
    fields: [
      { kind: 'select', key: 'preset', label: 'Estilo base', options: PRESETS.map((p) => ({ value: p, label: p })) },
      { kind: 'color', key: 'accent', label: 'Color de acento', help: 'Vacío = el del estilo base.' },
      { kind: 'select', key: 'font', label: 'Tipografía', allowEmpty: 'La del estilo base', options: FONTS.map((f) => ({ value: f, label: f })) },
      { kind: 'number', key: 'radius', label: 'Redondeo de bordes (px)', min: 0, max: 24, step: 1 },
      {
        kind: 'select',
        key: 'mode',
        label: 'Modo al abrir',
        options: [
          { value: 'light', label: 'Claro' },
          { value: 'dark', label: 'Oscuro' },
          { value: 'system', label: 'Según el sistema del visitante' },
        ],
      },
    ],
  },
  {
    kind: 'object',
    key: 'features',
    label: 'Funciones',
    create: () => ({}),
    fields: [
      { kind: 'checkbox', key: 'buddy', label: 'Muñeco animado' },
      { kind: 'checkbox', key: 'inspector', label: 'Botón "</> Código"' },
      { kind: 'checkbox', key: 'tagFilter', label: 'Filtro por tecnología' },
      { kind: 'checkbox', key: 'admin', label: 'Enlace al panel en el pie de página' },
    ],
  },
];

/** Nombre corto de una sección para la barra lateral. */
export function sectionLabel(s: SiteInput['sections'][number], locale: string): string {
  if (s.type === 'hero') return s.headline.join(' ');
  return textOf(s.title ?? s.nav ?? (s.type === 'contact' ? s.headline : undefined), locale);
}

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  hero: 'Portada',
  projects: 'Proyectos',
  skills: 'Habilidades',
  timeline: 'Experiencia',
  credentials: 'Certificaciones',
  about: 'Sobre mí',
  gallery: 'Galería',
  text: 'Texto libre',
  download: 'Descargas',
  contact: 'Contacto',
};
