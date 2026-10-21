import { createGitHub, decodeBase64Utf8, encodeBase64Utf8, GitHubError, serializeSite } from '@/admin/github';
import type { PendingFile, RepoRef } from '@/admin/types';
import type { SiteInput } from '@/core/schema';

const API = 'https://api.github.com';
const R = '/repos/usuario/portafolio';
const TOKEN = 'github_pat_11ABCDEF0123456789';
const repo: RepoRef = { owner: 'usuario', name: 'portafolio', branch: 'main' };

const site: SiteInput = {
  meta: { title: 'Ana Prueba', description: { es: 'Diseño, código y café ☕', en: 'Design, code & coffee ☕' } },
  locales: ['es', 'en'],
  brand: { name: 'Ana Prueba' },
  sections: [{ type: 'hero', id: 'inicio', headline: ['Hola, soy Ana', 'Mañana, más 🚀'] }],
};

type Call = { method: string; path: string; headers: Headers; init: RequestInit; body: Record<string, unknown> | undefined };
type Handler = (call: Call) => Response;

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');
/** Como la API de contenidos: base64 partido en líneas de 60 caracteres. */
const apiB64 = (text: string) => b64(text).replace(/.{60}/g, '$&\n');

/** fetch simulado: responde según "MÉTODO /ruta?query" y guarda cada llamada. */
function mockGitHub(routes: Record<string, Handler>, token = TOKEN) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
    const path = url.startsWith(API) ? url.slice(API.length) : url;
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    const call: Call = { method, path, headers: new Headers(init.headers), init, body };
    calls.push(call);
    const handler = routes[`${method} ${path}`];
    return handler ? handler(call) : json({ message: `ruta no simulada: ${method} ${path}` }, 500);
  });
  return { gh: createGitHub(token, fetchMock as unknown as typeof fetch), calls };
}

async function rejection(promise: Promise<unknown>): Promise<GitHubError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(GitHubError);
    return err as GitHubError;
  }
  throw new Error('se esperaba un GitHubError');
}

const refAt = (sha: string) => () => json({ ref: 'refs/heads/main', object: { type: 'commit', sha } });
const contentFile = (sha: string, text = serializeSite(site)) => () =>
  json({ type: 'file', path: 'content/site.json', sha, encoding: 'base64', content: apiB64(text) });

describe('cliente de GitHub', () => {
  it('getUser manda el token y la versión de la API, sin caché', async () => {
    const { gh, calls } = mockGitHub({
      'GET /user': () =>
        json({ login: 'usuario', id: 42, name: 'Ana Prueba', avatar_url: 'https://avatars.githubusercontent.com/u/42', email: 'x@y.z' }),
    });
    await expect(gh.getUser()).resolves.toEqual({
      login: 'usuario',
      id: 42,
      name: 'Ana Prueba',
      avatar_url: 'https://avatars.githubusercontent.com/u/42',
    });
    const [call] = calls;
    expect(call.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(call.headers.get('x-github-api-version')).toBe('2022-11-28');
    expect(call.headers.get('accept')).toBe('application/vnd.github+json');
    expect(call.headers.has('content-type')).toBe(false);
    expect(call.init.cache).toBe('no-store');
  });

  it('limpia espacios del token y no llama a GitHub si falta', async () => {
    const user = () => json({ login: 'usuario', id: 42, name: null, avatar_url: '' });
    const padded = mockGitHub({ 'GET /user': user }, `  ${TOKEN}\n`);
    await padded.gh.getUser();
    expect(padded.calls[0].headers.get('authorization')).toBe(`Bearer ${TOKEN}`);

    const empty = mockGitHub({ 'GET /user': user }, '   ');
    const err = await rejection(empty.gh.getUser());
    expect([err.code, err.status]).toEqual(['unauthorized', 0]);
    expect(empty.calls).toEqual([]);
  });

  it('getAccess traduce permisos y rama por defecto', async () => {
    const { gh } = mockGitHub({
      [`GET ${R}`]: () => json({ private: false, default_branch: 'main', permissions: { admin: true, push: true, pull: true } }),
    });
    await expect(gh.getAccess(repo)).resolves.toEqual({ push: true, admin: true, private: false, defaultBranch: 'main' });

    const noPerms = mockGitHub({ [`GET ${R}`]: () => json({ private: true, default_branch: 'trunk' }) });
    await expect(noPerms.gh.getAccess(repo)).resolves.toEqual({ push: false, admin: false, private: true, defaultBranch: 'trunk' });
  });
});

describe('loadContent', () => {
  it('decodifica UTF-8 (tildes, ñ, emoji) y devuelve headSha y contentSha', async () => {
    expect(apiB64(serializeSite(site))).toContain('\n');
    const { gh, calls } = mockGitHub({
      [`GET ${R}/git/ref/heads/main`]: refAt('head1'),
      [`GET ${R}/contents/content/site.json?ref=head1`]: contentFile('content1'),
    });
    const loaded = await gh.loadContent(repo);
    expect(loaded).toEqual({ site, headSha: 'head1', contentSha: 'content1' });
    expect(loaded.site.sections[0]).toMatchObject({ headline: ['Hola, soy Ana', 'Mañana, más 🚀'] });
    expect(calls).toHaveLength(2);
  });

  it('codifica la rama por segmentos', async () => {
    const { gh } = mockGitHub({
      [`GET ${R}/git/ref/heads/feature/panel%20nuevo`]: refAt('head1'),
      [`GET ${R}/contents/content/site.json?ref=head1`]: contentFile('content1'),
    });
    await expect(gh.loadContent({ ...repo, branch: 'feature/panel nuevo' })).resolves.toMatchObject({ headSha: 'head1' });
  });

  it('JSON inválido → invalid_content', async () => {
    const { gh } = mockGitHub({
      [`GET ${R}/git/ref/heads/main`]: refAt('head1'),
      [`GET ${R}/contents/content/site.json?ref=head1`]: contentFile('content1', '{ "meta": '),
    });
    const err = await rejection(gh.loadContent(repo));
    expect(err.code).toBe('invalid_content');
    expect(err.message).toMatch(/^content\/site\.json no es un JSON válido/);
  });

  it('si falta site.json → not_found con un mensaje claro', async () => {
    const { gh } = mockGitHub({
      [`GET ${R}/git/ref/heads/main`]: refAt('head1'),
      [`GET ${R}/contents/content/site.json?ref=head1`]: () => json({ message: 'Not Found' }, 404),
    });
    const err = await rejection(gh.loadContent(repo));
    expect([err.code, err.status, err.message]).toEqual(['not_found', 404, 'No se encontró content/site.json en la rama "main".']);
  });

  it('sobre 1 MB lee el contenido desde el blob', async () => {
    const { gh } = mockGitHub({
      [`GET ${R}/git/ref/heads/main`]: refAt('head1'),
      [`GET ${R}/contents/content/site.json?ref=head1`]: () => json({ type: 'file', sha: 'content1', encoding: 'none', content: '' }),
      [`GET ${R}/git/blobs/content1`]: () => json({ sha: 'content1', encoding: 'base64', content: apiB64(serializeSite(site)) }),
    });
    await expect(gh.loadContent(repo)).resolves.toEqual({ site, headSha: 'head1', contentSha: 'content1' });
  });

  it('loadContentAt lee una versión anterior', async () => {
    const old = { ...site, brand: { name: 'Versión anterior' } };
    const { gh } = mockGitHub({ [`GET ${R}/contents/content/site.json?ref=abc123`]: contentFile('content0', serializeSite(old)) });
    await expect(gh.loadContentAt(repo, 'abc123')).resolves.toEqual(old);
  });
});

describe('publish', () => {
  const files: PendingFile[] = [
    {
      path: 'public/uploads/retrato-3f9a1c2b.webp',
      publicPath: '/uploads/retrato-3f9a1c2b.webp',
      base64: 'UklGRiQAAABXRUJQ',
      mime: 'image/webp',
      size: 12,
      dataUrl: 'data:image/webp;base64,UklGRiQAAABXRUJQ',
    },
    {
      path: 'public/uploads/cv-ana-1a2b3c4d.pdf',
      publicPath: '/uploads/cv-ana-1a2b3c4d.pdf',
      base64: 'JVBERi0xLjQK',
      mime: 'application/pdf',
      size: 9,
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
    },
  ];
  const base = { headSha: 'head1', contentSha: 'content1' };
  const commitUrl = 'https://github.com/usuario/portafolio/commit/commit-new';

  /** Respuestas de una publicación correcta; `head` es el commit actual de la rama en GitHub. */
  function publishRoutes(head: string, overrides: Record<string, Handler> = {}): Record<string, Handler> {
    let blobs = 0;
    return {
      [`GET ${R}/git/ref/heads/main`]: refAt(head),
      [`GET ${R}/git/commits/${head}`]: () => json({ sha: head, tree: { sha: `tree-${head}` } }),
      [`POST ${R}/git/blobs`]: () => json({ sha: `blob${++blobs}` }, 201),
      [`POST ${R}/git/trees`]: () => json({ sha: 'tree-new' }, 201),
      [`POST ${R}/git/commits`]: () => json({ sha: 'commit-new', html_url: commitUrl }, 201),
      [`PATCH ${R}/git/refs/heads/main`]: () => json({ ref: 'refs/heads/main', object: { sha: 'commit-new' } }),
      ...overrides,
    };
  }
  const posted = (calls: Call[], path: string) => calls.find((c) => c.method === 'POST' && c.path === `${R}${path}`)?.body;

  it('sube contenido y archivos en un solo commit', async () => {
    const { gh, calls } = mockGitHub(publishRoutes('head1'));
    const result = await gh.publish(repo, { site, files, message: 'Actualiza proyectos', base });

    expect(result).toEqual({ commitSha: 'commit-new', commitUrl, contentSha: 'blob1' });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `GET ${R}/git/ref/heads/main`,
      `GET ${R}/git/commits/head1`,
      `POST ${R}/git/blobs`,
      `POST ${R}/git/blobs`,
      `POST ${R}/git/blobs`,
      `POST ${R}/git/trees`,
      `POST ${R}/git/commits`,
      `PATCH ${R}/git/refs/heads/main`,
    ]);
    const [siteBlob, imageBlob, pdfBlob, tree, commit, ref] = calls.slice(2);
    expect(siteBlob.body).toEqual({ content: b64(serializeSite(site)), encoding: 'base64' });
    expect(imageBlob.body).toEqual({ content: 'UklGRiQAAABXRUJQ', encoding: 'base64' });
    expect(pdfBlob.body).toEqual({ content: 'JVBERi0xLjQK', encoding: 'base64' });
    expect(tree.body).toEqual({
      base_tree: 'tree-head1',
      tree: [
        { path: 'content/site.json', mode: '100644', type: 'blob', sha: 'blob1' },
        { path: 'public/uploads/retrato-3f9a1c2b.webp', mode: '100644', type: 'blob', sha: 'blob2' },
        { path: 'public/uploads/cv-ana-1a2b3c4d.pdf', mode: '100644', type: 'blob', sha: 'blob3' },
      ],
    });
    expect(commit.body).toEqual({ message: 'Actualiza proyectos', tree: 'tree-new', parents: ['head1'] });
    expect(ref.body).toEqual({ sha: 'commit-new', force: false });
    expect(ref.headers.get('content-type')).toBe('application/json');
  });

  it('si la rama avanzó sin tocar site.json, usa el head nuevo como padre', async () => {
    const { gh, calls } = mockGitHub(publishRoutes('head2', { [`GET ${R}/contents/content/site.json?ref=head2`]: contentFile('content1') }));
    await expect(gh.publish(repo, { site, files: [], message: 'Cambia el título', base })).resolves.toMatchObject({ commitSha: 'commit-new' });
    expect(posted(calls, '/git/trees')).toMatchObject({ base_tree: 'tree-head2' });
    expect(posted(calls, '/git/commits')).toMatchObject({ parents: ['head2'] });
  });

  it('si site.json cambió en GitHub, lanza conflict sin crear nada', async () => {
    const { gh, calls } = mockGitHub(publishRoutes('head2', { [`GET ${R}/contents/content/site.json?ref=head2`]: contentFile('content2') }));
    const err = await rejection(gh.publish(repo, { site, files, message: 'Actualiza proyectos', base }));
    expect(err.code).toBe('conflict');
    expect(err.message).toBe(
      'El contenido cambió en GitHub desde que lo abriste. Recarga para traer la versión nueva; tu borrador se conserva.',
    );
    expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  it('si otro publicó entre medio (422 al mover la rama), lanza conflict', async () => {
    const { gh } = mockGitHub(
      publishRoutes('head1', { [`PATCH ${R}/git/refs/heads/main`]: () => json({ message: 'Update is not a fast forward' }, 422) }),
    );
    const err = await rejection(gh.publish(repo, { site, files, message: 'Actualiza proyectos', base }));
    expect([err.code, err.status, err.message]).toEqual(['conflict', 422, 'Alguien publicó al mismo tiempo. Vuelve a intentarlo.']);
  });

  it('una rama protegida muestra el motivo de GitHub', async () => {
    const reason = 'Protected branch update failed for refs/heads/main.';
    const { gh } = mockGitHub(publishRoutes('head1', { [`PATCH ${R}/git/refs/heads/main`]: () => json({ message: reason }, 422) }));
    const err = await rejection(gh.publish(repo, { site, files, message: 'Actualiza proyectos', base }));
    expect(err.code).toBe('conflict');
    expect(err.message).toBe(`GitHub no dejó actualizar la rama "main". (GitHub: ${reason})`);
  });

  it('no repite rutas, no pisa site.json y no deja el commit sin mensaje', async () => {
    const { gh, calls } = mockGitHub(publishRoutes('head1'));
    const replaced = { ...files[0], base64: 'TlVFVk8=' };
    const intruder = { ...files[1], path: '/content/site.json' };
    await gh.publish(repo, { site, files: [files[0], replaced, intruder], message: '  ', base });
    expect(calls.filter((c) => c.path === `${R}/git/blobs`).map((c) => c.body?.content)).toEqual([b64(serializeSite(site)), 'TlVFVk8=']);
    expect(posted(calls, '/git/trees')?.tree).toEqual([
      { path: 'content/site.json', mode: '100644', type: 'blob', sha: 'blob1' },
      { path: 'public/uploads/retrato-3f9a1c2b.webp', mode: '100644', type: 'blob', sha: 'blob2' },
    ]);
    expect(posted(calls, '/git/commits')).toMatchObject({ message: 'Actualiza el contenido del portafolio' });
  });

  it('sin html_url arma el enlace del commit', async () => {
    const { gh } = mockGitHub(publishRoutes('head1', { [`POST ${R}/git/commits`]: () => json({ sha: 'commit-new' }, 201) }));
    await expect(gh.publish(repo, { site, files: [], message: 'm', base })).resolves.toMatchObject({ commitUrl });
  });
});

describe('errores', () => {
  const failing = (handler: Handler) => rejection(mockGitHub({ 'GET /user': handler }).gh.getUser());

  it('401 → unauthorized', async () => {
    const err = await failing(() => json({ message: 'Bad credentials' }, 401));
    expect([err.code, err.status, err.message]).toEqual(['unauthorized', 401, 'El token no es válido o venció.']);
  });

  it('403 con el límite agotado → rate_limited', async () => {
    const reset = String(Math.floor(Date.now() / 1000) + 600);
    const primary = await failing(() =>
      json({ message: 'API rate limit exceeded for user ID 42.' }, 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset }),
    );
    expect([primary.code, primary.status]).toEqual(['rate_limited', 403]);
    expect(primary.message).toBe('GitHub limitó las peticiones. Vuelve a intentarlo en 10 min.');

    const secondary = await failing(() => json({ message: 'You have exceeded a secondary rate limit.' }, 403, { 'retry-after': '60' }));
    expect(secondary.code).toBe('rate_limited');
    expect(secondary.message).toContain('1 min');
  });

  it('otro 403 → forbidden con el motivo de GitHub', async () => {
    const err = await failing(() =>
      json({ message: 'Resource not accessible by personal access token' }, 403, { 'x-ratelimit-remaining': '4999' }),
    );
    expect([err.code, err.status]).toEqual(['forbidden', 403]);
    expect(err.message).toBe('El token no tiene permiso para esta acción. (GitHub: Resource not accessible by personal access token)');
  });

  it('404 → not_found', async () => {
    const err = await rejection(mockGitHub({ [`GET ${R}`]: () => json({ message: 'Not Found' }, 404) }).gh.getAccess(repo));
    expect([err.code, err.status, err.message]).toEqual(['not_found', 404, 'No se encontró el repositorio o el token no tiene acceso.']);
  });

  it('5xx → unknown', async () => {
    const err = await failing(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    expect([err.code, err.status]).toEqual(['unknown', 502]);
  });

  it('fetch que lanza TypeError → network con status 0', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const err = await rejection(createGitHub(TOKEN, offline as unknown as typeof fetch).getUser());
    expect([err.code, err.status]).toEqual(['network', 0]);
    expect(err.cause).toBeInstanceOf(TypeError);
  });
});

describe('history', () => {
  it('mapea los commits que tocaron site.json', async () => {
    const { gh } = mockGitHub({
      [`GET ${R}/commits?path=content/site.json&sha=main&per_page=5`]: () =>
        json([
          {
            sha: 'c2',
            html_url: 'https://github.com/usuario/portafolio/commit/c2',
            author: { login: 'usuario' },
            commit: { message: 'Actualiza proyectos\n\nDesde el panel', author: { name: 'Ana Prueba', date: '2026-10-20T15:04:05Z' } },
          },
          {
            sha: 'c1',
            html_url: 'https://github.com/usuario/portafolio/commit/c1',
            author: null,
            commit: { message: 'Contenido inicial', author: { name: 'Ana', date: '2026-10-19T10:00:00Z' } },
          },
        ]),
    });
    await expect(gh.history(repo, 5)).resolves.toEqual([
      {
        sha: 'c2',
        message: 'Actualiza proyectos',
        date: '2026-10-20T15:04:05Z',
        author: 'usuario',
        url: 'https://github.com/usuario/portafolio/commit/c2',
      },
      { sha: 'c1', message: 'Contenido inicial', date: '2026-10-19T10:00:00Z', author: 'Ana', url: 'https://github.com/usuario/portafolio/commit/c1' },
    ]);
  });

  it('pide 20 por defecto', async () => {
    const { gh } = mockGitHub({ [`GET ${R}/commits?path=content/site.json&sha=main&per_page=20`]: () => json([]) });
    await expect(gh.history(repo)).resolves.toEqual([]);
  });
});

describe('deployStatus', () => {
  const runsRoute = `GET ${R}/actions/runs?head_sha=commit-new&per_page=20`;
  const runUrl = (id: number) => `https://github.com/usuario/portafolio/actions/runs/${id}`;
  const run = (id: number, name: string, path: string, status: string, conclusion: string | null) => ({
    id,
    name,
    path,
    status,
    conclusion,
    html_url: runUrl(id),
  });
  const ci = (status: string, conclusion: string | null = null) => run(1, 'CI', '.github/workflows/ci.yml', status, conclusion);
  const deploy = (status: string, conclusion: string | null = null) =>
    run(2, 'Deploy a GitHub Pages', '.github/workflows/deploy.yml', status, conclusion);
  const statusWith = (handler: Handler) => mockGitHub({ [runsRoute]: handler }).gh.deployStatus(repo, 'commit-new');
  const withRuns = (...runs: unknown[]) => statusWith(() => json({ total_count: runs.length, workflow_runs: runs }));

  it('success: prioriza el despliegue aunque CI siga corriendo', async () => {
    await expect(withRuns(ci('in_progress'), deploy('completed', 'success'))).resolves.toEqual({ state: 'success', url: runUrl(2) });
  });

  it('running mientras el despliegue espera o corre', async () => {
    for (const status of ['queued', 'in_progress', 'waiting', 'requested', 'pending']) {
      await expect(withRuns(ci('completed', 'success'), deploy(status))).resolves.toEqual({ state: 'running', url: runUrl(2) });
    }
  });

  it('failure si el despliegue terminó sin éxito', async () => {
    await expect(withRuns(deploy('completed', 'failure'), ci('completed', 'success'))).resolves.toEqual({ state: 'failure', url: runUrl(2) });
    await expect(withRuns(deploy('completed', 'cancelled'))).resolves.toMatchObject({ state: 'failure' });
  });

  it('reconoce el despliegue por la ruta del workflow', async () => {
    const pages = run(3, 'Publicar sitio', '.github/workflows/pages.yml', 'completed', 'success');
    await expect(withRuns(ci('in_progress'), pages)).resolves.toEqual({ state: 'success', url: runUrl(3) });
  });

  it('sin runs → pending; sin runs de despliegue usa el que haya', async () => {
    await expect(withRuns()).resolves.toEqual({ state: 'pending' });
    await expect(withRuns(ci('in_progress'))).resolves.toEqual({ state: 'running', url: runUrl(1) });
  });

  it('403 o 404 → unknown; otros errores se lanzan', async () => {
    await expect(statusWith(() => json({ message: 'Resource not accessible by personal access token' }, 403))).resolves.toEqual({
      state: 'unknown',
    });
    await expect(statusWith(() => json({ message: 'Not Found' }, 404))).resolves.toEqual({ state: 'unknown' });
    const err = await rejection(statusWith(() => json({ message: 'Bad credentials' }, 401)));
    expect(err.code).toBe('unauthorized');
  });
});

describe('base64 UTF-8', () => {
  const text = 'Diseño y código: ¿qué tal? Ñandú, café ☕, cohete 🚀 y 你好';

  it('ida y vuelta sin perder caracteres', () => {
    expect(decodeBase64Utf8(encodeBase64Utf8(text))).toBe(text);
    expect(decodeBase64Utf8(encodeBase64Utf8(''))).toBe('');
  });

  it('produce el base64 estándar de UTF-8', () => {
    expect(encodeBase64Utf8('ñ')).toBe('w7E=');
    expect(encodeBase64Utf8(text)).toBe(b64(text));
    expect(decodeBase64Utf8(b64(text))).toBe(text);
  });

  it('tolera los saltos de línea de la API', () => {
    const long = text.repeat(10);
    expect(apiB64(long)).toContain('\n');
    expect(decodeBase64Utf8(apiB64(long))).toBe(long);
  });

  it('maneja textos grandes', () => {
    const big = 'ñ🚀'.repeat(100_000);
    expect(decodeBase64Utf8(encodeBase64Utf8(big))).toBe(big);
  });

  it('rechaza bytes que no son UTF-8', () => {
    expect(() => decodeBase64Utf8(Buffer.from([0xff, 0xfe, 0x41]).toString('base64'))).toThrow();
  });
});

describe('serializeSite', () => {
  it('usa 2 espacios y salto de línea final', () => {
    const out = serializeSite(site);
    expect(out).toBe(`${JSON.stringify(site, null, 2)}\n`);
    expect(out.startsWith('{\n  "meta": {\n    "title": "Ana Prueba"')).toBe(true);
  });
});

describe('despliegue con el contenido en otro repo', () => {
  const siteRepo: RepoRef = { owner: 'usuario', name: 'sitio', branch: 'main' };
  const W = '/repos/usuario/sitio/actions/workflows/deploy.yml';
  const run = (id: number, status: string, conclusion: string | null, createdAt: string) => ({
    id,
    status,
    conclusion,
    html_url: `https://github.com/usuario/sitio/actions/runs/${id}`,
    created_at: createdAt,
  });
  const T0 = Date.parse('2026-10-21T15:00:00Z');

  it('dispatchWorkflow lanza el workflow en la rama y acepta la respuesta 204 sin cuerpo', async () => {
    const { gh, calls } = mockGitHub({ [`POST ${W}/dispatches`]: () => new Response(null, { status: 204 }) });
    await expect(gh.dispatchWorkflow(siteRepo, 'deploy.yml')).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ ref: 'main' });
    expect(calls[0].headers.get('content-type')).toBe('application/json');
  });

  it('dispatchWorkflow explica qué permiso falta con 403', async () => {
    const { gh } = mockGitHub({ [`POST ${W}/dispatches`]: () => json({ message: 'Resource not accessible by personal access token' }, 403) });
    const err = await rejection(gh.dispatchWorkflow(siteRepo, 'deploy.yml'));
    expect(err.code).toBe('forbidden');
    expect(err.message).toMatch(/Actions: Read and write/);
  });

  it('dispatchWorkflow distingue workflow inexistente (404) y sin workflow_dispatch (422)', async () => {
    const missing = mockGitHub({ [`POST ${W}/dispatches`]: () => json({ message: 'Not Found' }, 404) });
    expect((await rejection(missing.gh.dispatchWorkflow(siteRepo, 'deploy.yml'))).message).toMatch(/No se encontró el workflow "deploy\.yml"/);
    const manual = mockGitHub({ [`POST ${W}/dispatches`]: () => json({ message: 'Workflow does not have workflow_dispatch trigger' }, 422) });
    expect((await rejection(manual.gh.dispatchWorkflow(siteRepo, 'deploy.yml'))).message).toMatch(/workflow_dispatch/);
  });

  it('workflowRunSince elige la ejecución manual más reciente creada desde el lanzamiento', async () => {
    const { gh, calls } = mockGitHub({
      [`GET ${W}/runs?event=workflow_dispatch&per_page=10`]: () =>
        json({
          workflow_runs: [
            run(1, 'completed', 'success', '2026-10-21T14:00:00Z'), // anterior: se ignora
            run(2, 'in_progress', null, '2026-10-21T15:00:05Z'),
          ],
        }),
    });
    await expect(gh.workflowRunSince(siteRepo, 'deploy.yml', T0)).resolves.toEqual({
      state: 'running',
      url: 'https://github.com/usuario/sitio/actions/runs/2',
    });
    expect(calls[0].method).toBe('GET');
  });

  it('workflowRunSince tolera unos segundos de diferencia entre relojes', async () => {
    const { gh } = mockGitHub({
      [`GET ${W}/runs?event=workflow_dispatch&per_page=10`]: () => json({ workflow_runs: [run(7, 'completed', 'success', '2026-10-21T14:59:50Z')] }),
    });
    expect((await gh.workflowRunSince(siteRepo, 'deploy.yml', T0)).state).toBe('success');
  });

  it('workflowRunSince: fallo, sin ejecuciones y sin permiso', async () => {
    const failing = mockGitHub({
      [`GET ${W}/runs?event=workflow_dispatch&per_page=10`]: () => json({ workflow_runs: [run(3, 'completed', 'failure', '2026-10-21T15:01:00Z')] }),
    });
    expect((await failing.gh.workflowRunSince(siteRepo, 'deploy.yml', T0)).state).toBe('failure');
    const none = mockGitHub({ [`GET ${W}/runs?event=workflow_dispatch&per_page=10`]: () => json({ workflow_runs: [] }) });
    expect(await none.gh.workflowRunSince(siteRepo, 'deploy.yml', T0)).toEqual({ state: 'pending' });
    const denied = mockGitHub({ [`GET ${W}/runs?event=workflow_dispatch&per_page=10`]: () => json({ message: 'Forbidden' }, 403) });
    expect(await denied.gh.workflowRunSince(siteRepo, 'deploy.yml', T0)).toEqual({ state: 'unknown' });
  });
});
