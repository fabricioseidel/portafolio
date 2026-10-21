import {
  CONTENT_PATH,
  type DeployState,
  type DeployStatus,
  type GitHubUser,
  type HistoryEntry,
  type LoadedContent,
  type PendingFile,
  type PublishResult,
  type RepoAccess,
  type RepoRef,
} from '@/admin/types';
import type { SiteInput } from '@/core/schema';

/**
 * Cliente mínimo de la API REST de GitHub para el panel. Corre en el navegador con el token del
 * dueño: lee `content/site.json` y publica el contenido junto con los archivos subidos en un solo commit.
 */

const API = 'https://api.github.com';

export type GitHubErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'network'
  | 'invalid_content'
  | 'unknown';

/** Error con un código estable para la interfaz y un mensaje listo para mostrar. */
export class GitHubError extends Error {
  /** Status HTTP de la respuesta; 0 si no la hubo (red, token mal formado, contenido inválido, conflicto detectado antes de escribir). */
  readonly status: number;
  readonly code: GitHubErrorCode;

  constructor(code: GitHubErrorCode, message: string, status = 0, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'GitHubError';
    this.code = code;
    this.status = status;
  }
}

export type GitHub = {
  getUser(): Promise<GitHubUser>;
  getAccess(repo: RepoRef): Promise<RepoAccess>;
  loadContent(repo: RepoRef): Promise<LoadedContent>;
  loadContentAt(repo: RepoRef, sha: string): Promise<SiteInput>;
  publish(
    repo: RepoRef,
    args: { site: SiteInput; files: PendingFile[]; message: string; base: { headSha: string; contentSha: string } },
  ): Promise<PublishResult>;
  history(repo: RepoRef, limit?: number): Promise<HistoryEntry[]>;
  deployStatus(repo: RepoRef, commitSha: string): Promise<DeployStatus>;
  /** Lanza un workflow con `workflow_dispatch` (despliegue cuando el contenido vive en otro repo). */
  dispatchWorkflow(repo: RepoRef, workflow: string, ref?: string): Promise<void>;
  /** Estado de la ejecución manual más reciente de un workflow creada desde `since` (ms epoch). */
  workflowRunSince(repo: RepoRef, workflow: string, since: number): Promise<DeployStatus>;
};

/** Base64 de un texto codificado como UTF-8 (`btoa` solo acepta Latin-1). */
export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  // Por bloques: pasar cientos de miles de argumentos a fromCharCode desborda la pila.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Inverso de `encodeBase64Utf8`. Acepta el base64 partido en líneas que devuelve la API y falla si no es UTF-8 válido. */
export function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.replace(/\s+/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** Formato con el que se guarda content/site.json: legible y con salto de línea final. */
export function serializeSite(site: SiteInput): string {
  return JSON.stringify(site, null, 2) + '\n';
}

type Method = 'GET' | 'POST' | 'PATCH';
/** Mensaje propio para un status concreto; la función recibe el mensaje de la API. */
type Messages = Partial<Record<number, string | ((apiMessage: string) => string)>>;
type RequestOptions = { body?: unknown; messages?: Messages };

type ApiContentFile = { sha: string; content?: string; encoding?: string };
type ApiCommitItem = {
  sha: string;
  html_url: string;
  author: { login: string } | null;
  commit: { message: string; author: { name?: string; date?: string } | null; committer?: { date?: string } | null };
};
type ApiRun = { name?: string | null; path?: string; status: string | null; conclusion: string | null; html_url: string; created_at?: string };
type TreeEntry = { path: string; mode: '100644'; type: 'blob'; sha: string };

const RACE = 'Alguien publicó al mismo tiempo. Vuelve a intentarlo.';
const CONTENT_CHANGED =
  'El contenido cambió en GitHub desde que lo abriste. Recarga para traer la versión nueva; tu borrador se conserva.';
const DEPLOY_RUN = /deploy|pages/i;
const RUNNING = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);

const seg = encodeURIComponent;
/** Codifica cada segmento y conserva las barras (ramas como `feature/x`, rutas de archivos). */
const encodePath = (path: string) => path.split('/').map(seg).join('/');
const repoPath = (repo: RepoRef) => `/repos/${seg(repo.owner)}/${seg(repo.name)}`;
const withDetail = (text: string, apiMessage: string) => (apiMessage ? `${text} (GitHub: ${apiMessage})` : text);

function classify(status: number, apiMessage: string): [GitHubErrorCode, string] {
  if (status === 401) return ['unauthorized', 'El token no es válido o venció.'];
  if (status === 403) return ['forbidden', withDetail('El token no tiene permiso para esta acción.', apiMessage)];
  if (status === 404) return ['not_found', 'No se encontró el repositorio o el token no tiene acceso.'];
  if (status === 409 || status === 422) return ['conflict', withDetail('GitHub rechazó la operación por un conflicto.', apiMessage)];
  if (status >= 500) return ['unknown', `GitHub no está disponible (${status}). Inténtalo de nuevo en unos minutos.`];
  return ['unknown', withDetail(`GitHub respondió con un error (${status}).`, apiMessage)];
}

function rateLimitMessage(res: Response): string {
  const retryAfter = Number(res.headers.get('retry-after'));
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  const seconds = retryAfter > 0 ? retryAfter : reset > 0 ? reset - Date.now() / 1000 : 0;
  const minutes = Math.ceil(seconds / 60);
  return minutes > 0
    ? `GitHub limitó las peticiones. Vuelve a intentarlo en ${minutes} min.`
    : 'GitHub limitó las peticiones. Espera un minuto y vuelve a intentarlo.';
}

async function errorFrom(res: Response, messages: Messages = {}): Promise<GitHubError> {
  const apiMessage: string = await res.json().then(
    (data: { message?: unknown } | null) => (typeof data?.message === 'string' ? data.message : ''),
    () => '',
  );
  const { status } = res;
  // Límite primario (x-ratelimit-remaining: 0) o secundario (retry-after o el texto de la API).
  const limited =
    status === 429 ||
    (status === 403 &&
      (res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after') || /rate limit/i.test(apiMessage)));
  if (limited) return new GitHubError('rate_limited', rateLimitMessage(res), status);
  const [code, fallback] = classify(status, apiMessage);
  const custom = messages[status];
  return new GitHubError(code, (typeof custom === 'function' ? custom(apiMessage) : custom) ?? fallback, status);
}

function parseContent(b64: string): SiteInput {
  let text: string;
  try {
    text = decodeBase64Utf8(b64);
  } catch (err) {
    throw new GitHubError('invalid_content', `${CONTENT_PATH} no es texto UTF-8 válido.`, 0, err);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new GitHubError('invalid_content', `${CONTENT_PATH} no es un JSON válido: ${(err as Error).message}`, 0, err);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new GitHubError('invalid_content', `${CONTENT_PATH} no contiene un objeto JSON.`);
  }
  return data as SiteInput;
}

function runState(run: ApiRun): DeployState {
  if (run.status === 'completed') return run.conclusion === 'success' ? 'success' : 'failure';
  return RUNNING.has(run.status ?? '') ? 'running' : 'unknown';
}

export function createGitHub(token: string, fetchImpl?: typeof fetch): GitHub {
  const auth = `Bearer ${token.trim()}`;

  async function request<T>(method: Method, path: string, { body, messages }: RequestOptions = {}): Promise<T> {
    // Un token vacío o con caracteres raros haría fallar fetch con un TypeError que parecería un error de red.
    if (!/^Bearer [\x21-\x7e]+$/.test(auth)) throw new GitHubError('unauthorized', 'Falta el token o tiene caracteres no válidos.');
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: auth,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const init: RequestInit = { method, headers, cache: 'no-store' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    let res: Response;
    try {
      res = await (fetchImpl ?? fetch)(API + path, init);
    } catch (err) {
      throw new GitHubError('network', 'No se pudo conectar con GitHub. Revisa tu conexión.', 0, err);
    }
    if (!res.ok) throw await errorFrom(res, messages);
    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch (err) {
      throw new GitHubError('unknown', 'GitHub devolvió una respuesta inesperada.', res.status, err);
    }
  }

  async function headOf(repo: RepoRef): Promise<string> {
    const ref = await request<{ object: { sha: string } }>('GET', `${repoPath(repo)}/git/ref/heads/${encodePath(repo.branch)}`, {
      messages: { 404: `No se encontró la rama "${repo.branch}" en ${repo.owner}/${repo.name}, o el token no tiene acceso.` },
    });
    return ref.object.sha;
  }

  const contentFile = (repo: RepoRef, ref: string, notFound: string) =>
    request<ApiContentFile>('GET', `${repoPath(repo)}/contents/${encodePath(CONTENT_PATH)}?ref=${seg(ref)}`, {
      messages: { 404: notFound },
    });

  async function readSite(repo: RepoRef, ref: string, notFound: string): Promise<{ site: SiteInput; sha: string }> {
    const file = await contentFile(repo, ref, notFound);
    let b64 = file.content;
    // Sobre 1 MB la API de contenidos no incluye el texto; se lee el blob.
    if (file.encoding !== 'base64' || typeof b64 !== 'string') {
      b64 = (await request<{ content: string }>('GET', `${repoPath(repo)}/git/blobs/${seg(file.sha)}`)).content;
    }
    return { site: parseContent(b64), sha: file.sha };
  }

  const missingAtHead = (repo: RepoRef) => `No se encontró ${CONTENT_PATH} en la rama "${repo.branch}".`;

  return {
    async getUser() {
      const user = await request<GitHubUser>('GET', '/user');
      return { login: user.login, id: user.id, name: user.name ?? null, avatar_url: user.avatar_url };
    },

    async getAccess(repo) {
      const data = await request<{ private: boolean; default_branch: string; permissions?: { push?: boolean; admin?: boolean } }>(
        'GET',
        repoPath(repo),
      );
      return {
        push: data.permissions?.push ?? false,
        admin: data.permissions?.admin ?? false,
        private: data.private,
        defaultBranch: data.default_branch,
      };
    },

    async loadContent(repo) {
      const headSha = await headOf(repo);
      const { site, sha } = await readSite(repo, headSha, missingAtHead(repo));
      return { site, headSha, contentSha: sha };
    },

    async loadContentAt(repo, sha) {
      return (await readSite(repo, sha, `No se encontró ${CONTENT_PATH} en esa versión.`)).site;
    },

    async publish(repo, { site, files, message, base }) {
      const root = repoPath(repo);
      const parent = await headOf(repo);
      if (parent !== base.headSha) {
        // La rama avanzó: solo hay conflicto si cambió el contenido; otros commits (p. ej. código) no importan.
        const current = await contentFile(repo, parent, missingAtHead(repo));
        if (current.sha !== base.contentSha) throw new GitHubError('conflict', CONTENT_CHANGED);
      }
      const parentCommit = await request<{ tree: { sha: string } }>('GET', `${root}/git/commits/${seg(parent)}`);

      const createBlob = async (content: string) =>
        (await request<{ sha: string }>('POST', `${root}/git/blobs`, { body: { content, encoding: 'base64' } })).sha;
      const contentSha = await createBlob(encodeBase64Utf8(serializeSite(site)));
      const tree: TreeEntry[] = [{ path: CONTENT_PATH, mode: '100644', type: 'blob', sha: contentSha }];
      // Una entrada por ruta (gana la última) y nunca una segunda copia de site.json.
      const uploads = new Map(files.map((f): [string, string] => [f.path.replace(/^\/+/, ''), f.base64]));
      uploads.delete(CONTENT_PATH);
      // En serie: GitHub recomienda no crear contenido con peticiones concurrentes.
      for (const [path, base64] of uploads) tree.push({ path, mode: '100644', type: 'blob', sha: await createBlob(base64) });

      const newTree = await request<{ sha: string }>('POST', `${root}/git/trees`, {
        body: { base_tree: parentCommit.tree.sha, tree },
      });
      const commit = await request<{ sha: string; html_url?: string }>('POST', `${root}/git/commits`, {
        body: { message: message.trim() || 'Actualiza el contenido del portafolio', tree: newTree.sha, parents: [parent] },
      });
      await request('PATCH', `${root}/git/refs/heads/${encodePath(repo.branch)}`, {
        body: { sha: commit.sha, force: false },
        messages: {
          // "Update is not a fast forward" es la carrera; otro 422 (p. ej. rama protegida) se muestra tal cual.
          422: (m) => (!m || /fast.?forward/i.test(m) ? RACE : withDetail(`GitHub no dejó actualizar la rama "${repo.branch}".`, m)),
        },
      });
      return {
        commitSha: commit.sha,
        commitUrl: commit.html_url ?? `https://github.com/${repo.owner}/${repo.name}/commit/${commit.sha}`,
        contentSha,
      };
    },

    async history(repo, limit = 20) {
      const perPage = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 20;
      const commits = await request<ApiCommitItem[]>(
        'GET',
        `${repoPath(repo)}/commits?path=${encodePath(CONTENT_PATH)}&sha=${seg(repo.branch)}&per_page=${perPage}`,
      );
      return commits.map((c) => ({
        sha: c.sha,
        message: c.commit.message.split(/\r?\n/)[0].trim(),
        date: c.commit.author?.date ?? c.commit.committer?.date ?? '',
        author: c.author?.login ?? c.commit.author?.name ?? '',
        url: c.html_url,
      }));
    },

    async deployStatus(repo, commitSha) {
      let runs: ApiRun[];
      try {
        const data = await request<{ workflow_runs?: ApiRun[] }>(
          'GET',
          `${repoPath(repo)}/actions/runs?head_sha=${seg(commitSha)}&per_page=20`,
        );
        runs = data.workflow_runs ?? [];
      } catch (err) {
        // Sin permiso de Actions no se puede saber; no es un fallo de la publicación.
        if (err instanceof GitHubError && (err.code === 'forbidden' || err.code === 'not_found')) return { state: 'unknown' };
        throw err;
      }
      const run = runs.find((r) => DEPLOY_RUN.test(r.name ?? '') || DEPLOY_RUN.test(r.path ?? '')) ?? runs[0];
      if (!run) return { state: 'pending' };
      return { state: runState(run), url: run.html_url };
    },

    async dispatchWorkflow(repo, workflow, ref) {
      await request('POST', `${repoPath(repo)}/actions/workflows/${seg(workflow)}/dispatches`, {
        body: { ref: ref ?? repo.branch },
        messages: {
          403: 'El token no puede ejecutar workflows: en GitHub dale el permiso "Actions: Read and write" sobre el repositorio del sitio.',
          404: `No se encontró el workflow "${workflow}" en ${repo.owner}/${repo.name}, o el token no tiene acceso a ese repositorio.`,
          422: `El workflow "${workflow}" no admite ejecución manual (falta "workflow_dispatch") o la rama "${ref ?? repo.branch}" no existe.`,
        },
      });
    },

    async workflowRunSince(repo, workflow, since) {
      let runs: ApiRun[];
      try {
        const data = await request<{ workflow_runs?: ApiRun[] }>(
          'GET',
          `${repoPath(repo)}/actions/workflows/${seg(workflow)}/runs?event=workflow_dispatch&per_page=10`,
        );
        runs = data.workflow_runs ?? [];
      } catch (err) {
        if (err instanceof GitHubError && (err.code === 'forbidden' || err.code === 'not_found')) return { state: 'unknown' };
        throw err;
      }
      // El reloj de GitHub y el del navegador pueden diferir unos segundos.
      const mine = runs
        .filter((r) => Date.parse(r.created_at ?? '') >= since - 20_000)
        .sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''))[0];
      if (!mine) return { state: 'pending' };
      return { state: runState(mine), url: mine.html_url };
    },
  };
}
