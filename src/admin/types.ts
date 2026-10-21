import type { SiteInput } from '@/core/schema';

/** Ruta del contenido dentro del repositorio. El panel lee y escribe este archivo. */
export const CONTENT_PATH = 'content/site.json';

/** Repositorio donde vive el portafolio. */
export type RepoRef = { owner: string; name: string; branch: string };

export type GitHubUser = { login: string; id: number; name: string | null; avatar_url: string };

export type RepoAccess = { push: boolean; admin: boolean; private: boolean; defaultBranch: string };

/** Archivo subido desde el panel que aún no se publica. */
export type PendingFile = {
  /** Ruta en el repo, p. ej. `public/uploads/retrato-3f9a1c2b.webp`. */
  path: string;
  /** Ruta pública que se guarda en el contenido, p. ej. `/uploads/retrato-3f9a1c2b.webp`. */
  publicPath: string;
  /** Contenido en base64 (sin prefijo data:). */
  base64: string;
  mime: string;
  size: number;
  /** `data:` URL para la vista previa mientras no está publicado. */
  dataUrl: string;
};

/** Archivos pendientes, indexados por `publicPath`. */
export type PendingFiles = Record<string, PendingFile>;

/** Contenido cargado desde GitHub junto con las referencias para publicar sin pisar cambios ajenos. */
export type LoadedContent = {
  site: SiteInput;
  /** Commit de la rama al momento de cargar. */
  headSha: string;
  /** SHA del blob de content/site.json al momento de cargar. */
  contentSha: string;
};

export type PublishResult = { commitSha: string; commitUrl: string; contentSha: string };

export type HistoryEntry = { sha: string; message: string; date: string; author: string; url: string };

export type DeployState = 'pending' | 'running' | 'success' | 'failure' | 'unknown';
export type DeployStatus = { state: DeployState; url?: string };
