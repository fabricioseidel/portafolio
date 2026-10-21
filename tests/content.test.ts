import { examples } from '@content/examples';
import siteJson from '@content/site.json';
import { parseSite } from '@/core/define';

/** Textos traducidos solo a algunos de los idiomas del sitio. */
function missingTranslations(site: { locales?: string[] } & Record<string, unknown>): string[] {
  const locales = site.locales ?? ['es'];
  const missing: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (!value || typeof value !== 'object') return;
    const keys = Object.keys(value);
    const isLocalized = keys.length > 0 && keys.every((k) => /^[a-z]{2}$/.test(k));
    if (isLocalized) {
      for (const l of locales) if (!(l in value)) missing.push(`${path} (${l})`);
      return;
    }
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(site, '');
  return missing;
}

// `npm run validate` corre solo este archivo: revisa tu content/site.json y los ejemplos.
describe.each(Object.entries(examples))('contenido: %s', (_key, { site }) => {
  it('cumple el esquema', () => {
    const result = parseSite(site);
    if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
    expect(result.ok).toBe(true);
  });

  it('tiene traducciones para todos sus idiomas', () => {
    expect(missingTranslations(site)).toEqual([]);
  });
});

// Con CONTENT_DIR este archivo es tu contenido real: el despliegue falla aquí si no cumple el esquema.
describe('content/site.json', () => {
  it('cumple el esquema', () => {
    const result = parseSite(siteJson);
    if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
    expect(result.ok).toBe(true);
  });

  it('tiene traducciones para todos sus idiomas', () => {
    expect(missingTranslations(siteJson as never)).toEqual([]);
  });
});
