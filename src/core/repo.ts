import type { Site } from './schema';

export type RepoInfo = { owner: string; name: string; branch: string; url: string };

/** `owner/name` desde una URL de GitHub o un slug. */
export function parseRepo(value: string): { owner: string; name: string } | null {
  const m = value.trim().match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  return m ? { owner: m[1], name: m[2] } : null;
}

/**
 * Repositorio del portafolio. En GitHub Actions el workflow define NEXT_PUBLIC_GITHUB_REPOSITORY,
 * así que un fork apunta solo a sí mismo; si no, se usa `repo` de content/site.json.
 */
export function repoInfo(site: Pick<Site, 'repo'>): RepoInfo | null {
  const fromEnv = process.env.NEXT_PUBLIC_GITHUB_REPOSITORY;
  const parsed = (fromEnv && parseRepo(fromEnv)) || (site.repo && parseRepo(site.repo.url));
  if (!parsed) return null;
  const branch = process.env.NEXT_PUBLIC_GITHUB_BRANCH || site.repo?.branch || 'main';
  return { ...parsed, branch, url: `https://github.com/${parsed.owner}/${parsed.name}` };
}

/**
 * Repositorio donde vive el contenido (`content/site.json` y las subidas). Por defecto es el mismo del código;
 * con NEXT_PUBLIC_CONTENT_REPOSITORY el contenido puede estar en otro repo (p. ej. privado) y el repo público
 * del código no lleva datos personales. Ver README › "Contenido privado".
 */
export function contentRepoInfo(code: RepoInfo | null): RepoInfo | null {
  const parsed = parseRepo(process.env.NEXT_PUBLIC_CONTENT_REPOSITORY ?? '');
  if (!parsed) return code;
  return { ...parsed, branch: process.env.NEXT_PUBLIC_CONTENT_BRANCH || 'main', url: `https://github.com/${parsed.owner}/${parsed.name}` };
}

export const sameRepo = (a: RepoInfo | null, b: RepoInfo | null) =>
  !!a && !!b && a.owner.toLowerCase() === b.owner.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();

export const zipUrl = (r: RepoInfo) => `${r.url}/archive/refs/heads/${r.branch}.zip`;
export const templateUrl = (r: RepoInfo) => `${r.url}/generate`;
export const sourceUrl = (r: RepoInfo, path: string) => `${r.url}/blob/${r.branch}/${path}`;
