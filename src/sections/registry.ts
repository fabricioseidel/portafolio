import type { ComponentType } from 'react';
import type { SectionOf, SectionType } from '@/core/schema';
import { About } from './About';
import { Contact } from './Contact';
import { Credentials } from './Credentials';
import { Download } from './Download';
import { Gallery } from './Gallery';
import { Hero } from './Hero';
import { Projects } from './Projects';
import { Skills } from './Skills';
import { Text } from './Text';
import { Timeline } from './Timeline';

type Entry<T extends SectionType> = {
  component: ComponentType<{ section: SectionOf<T> }>;
  /** Ruta del archivo, para el inspector "</> Código" y los enlaces a GitHub. */
  file: string;
  /** Las secciones "bleed" ocupan todo el ancho y no llevan numeración. */
  layout?: 'bleed' | 'plain';
};

/**
 * Registro de secciones: `type` en content/site.ts → componente.
 * Para crear una sección nueva: esquema en core/schema.ts, componente en sections/, entrada aquí.
 * TypeScript avisa si falta alguna.
 */
export const registry: { [K in SectionType]: Entry<K> } = {
  hero: { component: Hero, file: 'src/sections/Hero.tsx', layout: 'plain' },
  projects: { component: Projects, file: 'src/sections/Projects.tsx' },
  skills: { component: Skills, file: 'src/sections/Skills.tsx' },
  timeline: { component: Timeline, file: 'src/sections/Timeline.tsx' },
  credentials: { component: Credentials, file: 'src/sections/Credentials.tsx' },
  about: { component: About, file: 'src/sections/About.tsx' },
  gallery: { component: Gallery, file: 'src/sections/Gallery.tsx' },
  text: { component: Text, file: 'src/sections/Text.tsx' },
  download: { component: Download, file: 'src/sections/Download.tsx' },
  contact: { component: Contact, file: 'src/sections/Contact.tsx', layout: 'bleed' },
};

export function componentName(type: SectionType): string {
  return registry[type].file.split('/').pop()!.replace('.tsx', '');
}
