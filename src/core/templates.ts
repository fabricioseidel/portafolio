import type { SectionType, SiteInput } from './schema';

type SectionInput = SiteInput['sections'][number];

/** Bloques de partida para "Añadir sección" en el Playground. Todos pasan la validación. */
export const SECTION_TEMPLATES: { [K in SectionType]: Omit<Extract<SectionInput, { type: K }>, 'id'> } = {
  hero: { type: 'hero', headline: ['Tu', 'Nombre'], intro: 'Una frase sobre lo que haces y para quién.' },
  projects: {
    type: 'projects',
    title: 'Proyectos',
    nav: 'Proyectos',
    items: [{ title: 'Proyecto', description: 'Qué problema resolvió y cuál fue el resultado.', tags: ['Herramienta'] }],
  },
  skills: { type: 'skills', title: 'Habilidades', groups: [{ title: 'Grupo', items: ['Habilidad 1', 'Habilidad 2'] }] },
  timeline: { type: 'timeline', title: 'Experiencia', nav: 'Experiencia', items: [{ period: '2024 — hoy', title: 'Empresa', subtitle: 'Cargo' }] },
  credentials: { type: 'credentials', title: 'Formación', highlights: [{ title: 'Título o certificado', value: '120 h', date: '2024-01-15' }] },
  about: { type: 'about', title: 'Sobre mí', statement: 'Lo que te diferencia, en una o dos frases.', facts: [{ label: 'Idiomas', value: 'Español' }] },
  gallery: { type: 'gallery', title: 'Galería', items: [{ src: '/examples/composicion.svg', caption: 'Pie de foto' }] },
  text: { type: 'text', title: 'Texto', body: ['Un párrafo libre.'] },
  download: {
    type: 'download',
    title: 'Descargar',
    nav: 'Descargar',
    items: [
      { kind: 'zip', label: 'Código del portafolio', description: 'Todo el proyecto en un .zip.' },
      { kind: 'print', label: 'Versión PDF', description: 'Guarda esta página como PDF.' },
    ],
  },
  contact: { type: 'contact', headline: '¿Hablamos?', lines: [{ label: 'tu@correo.com', href: 'mailto:tu@correo.com' }] },
};

export function newSection(type: SectionType, existing: string[]): SectionInput {
  let id: string = type;
  for (let n = 2; existing.includes(id); n++) id = `${type}-${n}`;
  return { id, ...structuredClone(SECTION_TEMPLATES[type]) } as SectionInput;
}
