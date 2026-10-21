import { z } from 'zod';

// Mensajes de validación en español (los muestra el panel y el build).
z.config(z.locales.es());

/**
 * Esquema del portafolio. Es la única fuente de verdad sobre qué se puede escribir en
 * `content/site.json`: si el contenido no cumple, el build falla con un mensaje claro
 * y el panel no deja publicar.
 *
 * Textos traducibles: cualquier campo `LString` acepta un string simple
 * o un objeto por idioma, p. ej. `{ "es": "Proyectos", "en": "Projects" }`.
 */
export const LString = z.union([z.string(), z.record(z.string(), z.string())]);
export const LList = z.union([z.array(z.string()), z.record(z.string(), z.array(z.string()))]);

const UNSAFE_URL = /^\s*(javascript|vbscript|data):/i;
/** Enlace o ruta. Se bloquean esquemas que ejecutan código. */
export const Href = z
  .string()
  .min(1)
  .refine((v) => !UNSAFE_URL.test(v), 'enlace no permitido');
/** Ruta de imagen local (`/images/foto.webp`) o URL https. */
export const ImageSrc = Href;

export const LinkSchema = z.object({
  label: LString,
  href: Href,
  variant: z.enum(['primary', 'secondary', 'ghost']).default('secondary'),
});

export const StatSchema = z.object({ value: LString, label: LString });

export const MediaSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('image'), src: ImageSrc, alt: LString.optional() }),
  z.object({
    type: z.literal('code'),
    filename: z.string().optional(),
    language: z.string().default('ts'),
    code: z.string().min(1),
  }),
]);

const base = {
  /** Ancla de la sección (#id). Minúsculas, números y guiones. */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'usa minúsculas, números y guiones'),
  /** Si existe, la sección aparece en el menú con este texto. */
  nav: LString.optional(),
  /** Título corto que se muestra como "01 — Título". */
  title: LString.optional(),
  hidden: z.boolean().default(false),
};

export const HeroSection = z.object({
  ...base,
  type: z.literal('hero'),
  eyebrow: LString.optional(),
  headline: z.array(z.string()).min(1),
  intro: LString.optional(),
  meta: LString.optional(),
  actions: z.array(LinkSchema).default([]),
  aside: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('stats'), items: z.array(StatSchema).min(1) }),
      z.object({ kind: z.literal('image'), src: ImageSrc, alt: LString.optional() }),
    ])
    .optional(),
});

export const ProjectSchema = z.object({
  title: LString,
  kicker: LString.optional(),
  period: LString.optional(),
  description: LString,
  highlights: LList.optional(),
  stats: z.array(StatSchema).default([]),
  tags: z.array(z.string()).default([]),
  links: z.array(LinkSchema).default([]),
  media: MediaSchema.optional(),
  /** `true`: bloque grande con media. `false`: tarjeta compacta. */
  featured: z.boolean().default(true),
});

export const ProjectsSection = z.object({ ...base, type: z.literal('projects'), items: z.array(ProjectSchema).min(1) });

export const SkillsSection = z.object({
  ...base,
  type: z.literal('skills'),
  groups: z.array(z.object({ title: LString, items: z.array(z.string()).min(1) })).min(1),
});

export const TimelineSection = z.object({
  ...base,
  type: z.literal('timeline'),
  items: z
    .array(
      z.object({
        period: LString,
        title: LString,
        subtitle: LString.optional(),
        description: LString.optional(),
        tags: z.array(z.string()).default([]),
      }),
    )
    .min(1),
});

const Credential = {
  title: LString,
  value: LString.optional(),
  date: z.iso.date().optional(),
  /** Enlace o imagen del certificado. Las imágenes se abren en un visor dentro de la página. */
  href: Href.optional(),
};

export const CredentialsSection = z.object({
  ...base,
  type: z.literal('credentials'),
  highlights: z.array(z.object({ kicker: LString.optional(), ...Credential })).default([]),
  listTitle: LString.optional(),
  items: z.array(z.object(Credential)).default([]),
});

export const AboutSection = z.object({
  ...base,
  type: z.literal('about'),
  statement: LString,
  facts: z.array(z.object({ label: LString, value: LString })).default([]),
});

export const GallerySection = z.object({
  ...base,
  type: z.literal('gallery'),
  items: z.array(z.object({ src: ImageSrc, alt: LString.optional(), caption: LString.optional() })).min(1),
});

export const TextSection = z.object({ ...base, type: z.literal('text'), body: LList });

export const DOWNLOAD_KINDS = ['zip', 'template', 'file', 'link', 'print'] as const;

export const DownloadSection = z.object({
  ...base,
  type: z.literal('download'),
  intro: LString.optional(),
  items: z
    .array(
      z
        .object({
          /** zip: código del repo · template: "Use this template" · file: archivo propio · link: enlace · print: guardar como PDF. */
          kind: z.enum(DOWNLOAD_KINDS),
          label: LString,
          description: LString.optional(),
          href: Href.optional(),
        })
        .refine((it) => (it.kind !== 'file' && it.kind !== 'link') || !!it.href, { message: 'falta el enlace o archivo', path: ['href'] }),
    )
    .min(1),
});

export const ContactSection = z.object({
  ...base,
  type: z.literal('contact'),
  headline: LString,
  lines: z.array(z.object({ label: LString, href: Href.optional() })).default([]),
});

export const SectionSchema = z.discriminatedUnion('type', [
  HeroSection,
  ProjectsSection,
  SkillsSection,
  TimelineSection,
  CredentialsSection,
  AboutSection,
  GallerySection,
  TextSection,
  DownloadSection,
  ContactSection,
]);

export const PRESETS = ['modernist', 'paper', 'midnight'] as const;
export const FONTS = ['archivo', 'inter', 'fraunces', 'mono'] as const;

export const ThemeSchema = z
  .object({
    preset: z.enum(PRESETS).default('modernist'),
    /** Color de acento opcional (#rrggbb). Sobrescribe el del preset. */
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'usa un color hex de 6 dígitos, p. ej. #ec3013')
      .optional(),
    font: z.enum(FONTS).optional(),
    radius: z.number().min(0).max(24).default(0),
    mode: z.enum(['system', 'light', 'dark']).default('system'),
  })
  .prefault({});

export const FeaturesSchema = z
  .object({
    /** Muñeco animado que corre y salta sobre los bordes de la página. */
    buddy: z.boolean().default(true),
    /** Botón "</> Código" para inspeccionar componente, archivo y configuración de cada sección. */
    inspector: z.boolean().default(true),
    /** Enlace al panel administrativo (/admin) en el pie de página y en el inspector. */
    admin: z.boolean().default(true),
    /** Tocar una tecnología filtra proyectos y experiencia que la usan. */
    tagFilter: z.boolean().default(true),
  })
  .prefault({});

export const SiteSchema = z
  .object({
    meta: z.object({ title: z.string().min(1), description: LString, url: z.url().optional() }),
    locales: z.array(z.string().min(2)).min(1).default(['es']),
    brand: z.object({ name: z.string().min(1), mark: z.string().default('.') }),
    /** Repositorio del portafolio. En GitHub Actions se detecta solo; esto es el respaldo. */
    repo: z.object({ url: z.url(), branch: z.string().default('main') }).optional(),
    theme: ThemeSchema,
    features: FeaturesSchema,
    sections: z.array(SectionSchema).min(1),
  })
  .superRefine((site, ctx) => {
    const seen = new Set<string>();
    site.sections.forEach((s, i) => {
      if (seen.has(s.id)) ctx.addIssue({ code: 'custom', path: ['sections', i, 'id'], message: `id repetido: "${s.id}"` });
      seen.add(s.id);
    });
  });

export type Site = z.output<typeof SiteSchema>;
export type SiteInput = z.input<typeof SiteSchema>;
export type Section = Site['sections'][number];
export type SectionType = Section['type'];
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;
export type Theme = Site['theme'];
export type Link = z.output<typeof LinkSchema>;
export type Stat = z.output<typeof StatSchema>;
export type Media = z.output<typeof MediaSchema>;
export type LStringValue = z.output<typeof LString>;
export type LListValue = z.output<typeof LList>;
export const SECTION_TYPES = SectionSchema.options.map((o) => o.shape.type.value) as SectionType[];
