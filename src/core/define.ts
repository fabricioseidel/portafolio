import { SiteSchema, type Site } from './schema';

export type Issue = { path: string; message: string; raw: PropertyKey[] };
export type ParseResult = { ok: true; site: Site } | { ok: false; issues: Issue[] };

/** Valida contenido sin lanzar errores (lo usa el panel). */
export function parseSite(input: unknown): ParseResult {
  const result = SiteSchema.safeParse(input);
  if (result.success) return { ok: true, site: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({ path: formatPath(i.path, input), message: i.message, raw: i.path })),
  };
}

/** Valida contenido y lanza un error legible (lo usa el build). */
export function loadSite(input: unknown): Site {
  const result = parseSite(input);
  if (result.ok) return result.site;
  const lines = result.issues.map((i) => `  • ${i.path || '(raíz)'}: ${i.message}`).join('\n');
  throw new Error(`content/site.json no es válido:\n${lines}`);
}

/** `sections.2.items.0.title` → `sections[2] (proyectos) › items[0] › title` */
export function formatPath(path: PropertyKey[], input?: unknown): string {
  return path
    .map((key, i) => {
      if (typeof key !== 'number') return String(key);
      if (i === 1 && path[0] === 'sections') {
        const id = (input as { sections?: { id?: unknown }[] } | undefined)?.sections?.[key]?.id;
        return typeof id === 'string' ? `[${key}] (${id})` : `[${key}]`;
      }
      return `[${key}]`;
    })
    .join(' › ')
    .replace(/ › \[/g, '[');
}
