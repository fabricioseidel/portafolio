import { resolve } from './i18n';
import type { Site } from './schema';

/**
 * Normaliza una tecnología para compararla entre secciones:
 * "Next.js (App Router)", "Next.js 15" y "next.js" son la misma.
 */
export function normTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ (v?\d[\w.+]*|es\d+\+?)$/, '');
}

export function hasTag(tags: string[], key: string | null | undefined): boolean {
  return !key || tags.some((t) => normTag(t) === key);
}

export type TagUse = { title: string; anchor: string };

/** Mapa tecnología → dónde aparece (proyectos y línea de tiempo). */
export function tagUsage(site: Site, locale: string): Map<string, TagUse[]> {
  const fallback = site.locales[0];
  const map = new Map<string, TagUse[]>();
  const add = (tags: string[], use: TagUse) => {
    for (const key of new Set(tags.map(normTag))) {
      const list = map.get(key) ?? [];
      list.push(use);
      map.set(key, list);
    }
  };
  for (const s of site.sections) {
    if (s.hidden) continue;
    if (s.type === 'projects' || s.type === 'timeline') {
      s.items.forEach((item, i) => add(item.tags, { title: resolve(item.title, locale, fallback), anchor: `${s.id}-${i}` }));
    }
  }
  return map;
}
