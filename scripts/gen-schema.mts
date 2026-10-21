// Genera content/schema.json a partir del esquema Zod, para tener autocompletado y
// validación al editar content/site.json en VS Code. Uso: npm run schema
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { SiteSchema } from '../src/core/schema.ts';

const schema = z.toJSONSchema(SiteSchema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
schema.title = 'Contenido del portafolio (content/site.json)';
const properties = (schema.properties ?? {}) as Record<string, unknown>;
schema.properties = { $schema: { type: 'string' }, ...properties };

const out = new URL('../content/schema.json', import.meta.url);
writeFileSync(out, JSON.stringify(schema, null, 2) + '\n');
console.log('content/schema.json actualizado');
