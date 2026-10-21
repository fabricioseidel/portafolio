import raw from '@content/site.json';
import { loadSite } from './define';

/** Contenido validado. Si content/site.json tiene errores, el build se detiene aquí con el detalle. */
export const site = loadSite(raw);
