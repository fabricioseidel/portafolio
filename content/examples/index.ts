import type { SiteInput } from '@/core/schema';
import chef from './chef.json';
import demo from './demo.json';
import designer from './designer.json';

// Los JSON pierden los tipos literales al importarse; tests/content.test.ts valida cada uno con el esquema.
const asSite = (json: unknown) => json as SiteInput;

/** Contenidos que el panel puede cargar en modo demo. Agrega el tuyo aquí. */
export const examples: Record<string, { label: string; site: SiteInput }> = {
  demo: { label: 'Plantilla · Desarrolladora full stack', site: asSite(demo) },
  chef: { label: 'Plantilla · Chef ejecutiva', site: asSite(chef) },
  designer: { label: 'Plantilla · Product Designer', site: asSite(designer) },
};
