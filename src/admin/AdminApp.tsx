'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { examples } from '@content/examples';
import { SiteRenderer } from '@/components/SiteRenderer';
import { buttonClass } from '@/components/ui';
import { parseSite } from '@/core/define';
import { formatDate } from '@/core/i18n';
import { contentRepoInfo, repoInfo, sameRepo } from '@/core/repo';
import { SECTION_TYPES, ThemeSchema, type SectionType, type Site, type SiteInput } from '@/core/schema';
import { site as builtSite } from '@/core/site';
import { newSection } from '@/core/templates';
import { themeCss } from '@/core/theme';
import { asset, cn } from '@/core/utils';
import { clearDraft, loadDraft, saveDraft, type Draft } from './draft';
import type { FieldIssue, FormContext } from './fields';
import { Form } from './Form';
import { createGitHub, GitHubError, serializeSite, type GitHub } from './github';
import { Login } from './Login';
import { clearToken, loadToken, saveToken } from './session';
import { GENERAL_FIELDS, SECTION_FIELDS, SECTION_TYPE_LABELS, THEME_FIELDS, sectionLabel } from './spec';
import type { DeployStatus, GitHubUser, HistoryEntry, PendingFiles, RepoAccess, RepoRef } from './types';
import { prepareUpload } from './uploads';

const CHROME_CSS = themeCss('[data-fk="admin"]', ThemeSchema.parse({}));
const toRef = (r: { owner: string; name: string; branch: string } | null): RepoRef | null => r && { owner: r.owner, name: r.name, branch: r.branch };
const codeInfo = repoInfo(builtSite);
/** Repo del código y del despliegue (workflow). */
const CODE = toRef(codeInfo);
/** Repo donde vive el contenido: el mismo, o uno aparte (privado) si NEXT_PUBLIC_CONTENT_REPOSITORY está definido. */
const REPO = toRef(contentRepoInfo(codeInfo));
const SPLIT = !!CODE && !!REPO && !sameRepo(codeInfo, contentRepoInfo(codeInfo));
const DEPLOY_WORKFLOW = 'deploy.yml';
const INITIAL = examples.demo.site;
const DEFAULT_MESSAGE = 'Actualiza el portafolio desde el panel';

type SectionInput = SiteInput['sections'][number];
type Session = { gh: GitHub; user: GitHubUser; access: RepoAccess };
type View = { kind: 'section'; index: number } | { kind: 'general' } | { kind: 'theme' } | { kind: 'history' };
type Status =
  | { kind: 'idle' }
  | { kind: 'publishing' }
  | { kind: 'deploying'; commitSha: string; commitUrl: string; /** ms epoch del lanzamiento manual del despliegue; solo con contenido en otro repo */ since?: number }
  | { kind: 'published'; commitUrl: string; deploy: DeployStatus; warning?: string }
  | { kind: 'error'; message: string; conflict: boolean };

function errorText(e: unknown): string {
  if (e instanceof GitHubError || e instanceof Error) return e.message;
  return 'Ocurrió un error inesperado.';
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Tecnologías ya usadas en el sitio, para autocompletar. */
function collectTags(site: SiteInput): string[] {
  const out = new Set<string>();
  for (const s of site.sections) {
    if (s.type === 'skills') s.groups.forEach((g) => g.items.forEach((t) => out.add(t)));
    if (s.type === 'projects' || s.type === 'timeline') s.items.forEach((it) => it.tags?.forEach((t) => out.add(t)));
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

export function AdminApp() {
  const [phase, setPhase] = useState<'boot' | 'login' | 'editor'>('boot');
  const [session, setSession] = useState<Session | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [site, setSite] = useState<SiteInput>(INITIAL);
  const [base, setBase] = useState<{ site: SiteInput; headSha: string | null; contentSha: string | null }>({ site: INITIAL, headSha: null, contentSha: null });
  const [files, setFiles] = useState<PendingFiles>({});
  const [pending, setPending] = useState<string[]>([]);
  const [view, setView] = useState<View>({ kind: 'section', index: 0 });
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [restorable, setRestorable] = useState<Draft | null>(null);
  const [message, setMessage] = useState('');
  const [mobileTab, setMobileTab] = useState<'list' | 'edit' | 'preview'>('edit');
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [confirm, setConfirm] = useState<{ text: string; action: () => void } | null>(null);
  const [preview, setPreview] = useState<Site | null>(() => {
    const r = parseSite(INITIAL);
    return r.ok ? r.site : null;
  });
  const previewRef = useRef<HTMLDivElement>(null);
  const wantedSection = useRef<string | null>(null);

  const draftKey = session && REPO ? `${REPO.owner}/${REPO.name}` : 'demo';
  const locales = site.locales?.length ? site.locales : ['es'];
  const defaultLocale = locales[0];

  const parsed = useMemo(() => parseSite(site), [site]);
  useEffect(() => {
    if (parsed.ok) setPreview(parsed.site);
  }, [parsed]);
  const issues = parsed.ok ? [] : parsed.issues;
  const dirty = pending.length > 0 || !same(site, base.site);

  // ── Inicio ────────────────────────────────────────────────────────────────
  const startEditing = useCallback((content: SiteInput, headSha: string | null, contentSha: string | null, key: string) => {
    setBase({ site: content, headSha, contentSha });
    setSite(content);
    setFiles({});
    setPending([]);
    setStatus({ kind: 'idle' });
    const draft = loadDraft(key);
    setRestorable(draft && !same(draft.site, content) ? draft : null);
    const index = wantedSection.current ? content.sections.findIndex((s) => s.id === wantedSection.current) : -1;
    setView({ kind: 'section', index: Math.max(0, index) });
    setPhase('editor');
  }, []);

  const login = useCallback(
    async (token: string, remember: boolean, silent = false) => {
      if (!REPO) {
        setLoginError('No se detectó el repositorio del portafolio. Revisa "repo" en content/site.json.');
        setPhase('login');
        return;
      }
      setLoginBusy(true);
      setLoginError(null);
      try {
        const gh = createGitHub(token);
        const user = await gh.getUser();
        const access = await gh.getAccess(REPO);
        if (!access.push) throw new Error(`La cuenta @${user.login} no tiene permiso de escritura en ${REPO.owner}/${REPO.name}. Puedes probar el modo demo.`);
        if (SPLIT && CODE) {
          // El despliegue vive en el repo del código: hay que poder verlo para lanzarlo.
          await gh.getAccess(CODE).catch(() => {
            throw new Error(`El token no ve el repositorio del sitio (${CODE.owner}/${CODE.name}). Dale acceso a los dos repositorios.`);
          });
        }
        const content = await gh.loadContent(REPO);
        saveToken(token, remember);
        setSession({ gh, user, access });
        startEditing(content.site, content.headSha, content.contentSha, `${REPO.owner}/${REPO.name}`);
      } catch (e) {
        if (silent) clearToken();
        setLoginError(errorText(e));
        setPhase('login');
      } finally {
        setLoginBusy(false);
      }
    },
    [startEditing],
  );

  const enterDemo = useCallback(() => {
    setSession(null);
    startEditing(INITIAL, null, null, 'demo');
  }, [startEditing]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    wantedSection.current = params.get('section');
    if (params.has('demo')) return enterDemo();
    const saved = loadToken();
    if (saved && REPO) void login(saved.token, saved.remembered, true);
    else setPhase('login');
  }, [enterDemo, login]);

  const logout = () => {
    clearToken();
    setSession(null);
    setStatus({ kind: 'idle' });
    setPhase('login');
  };

  // ── Borrador automático y aviso al salir ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'editor' || restorable) return;
    const t = setTimeout(() => {
      if (!dirty) return clearDraft(draftKey);
      const kept: PendingFiles = {};
      for (const p of pending) if (files[p]) kept[p] = files[p];
      saveDraft(draftKey, { site, files: kept, baseHeadSha: base.headSha });
    }, 600);
    return () => clearTimeout(t);
  }, [phase, restorable, dirty, draftKey, site, files, pending, base.headSha]);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', onLeave);
    return () => removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const restoreDraft = () => {
    if (!restorable) return;
    setSite(restorable.site);
    setFiles((prev) => ({ ...prev, ...restorable.files }));
    setPending(Object.keys(restorable.files));
    setRestorable(null);
  };

  // ── Archivos y formularios ───────────────────────────────────────────────
  const upload = useCallback(async (file: File, kind: 'image' | 'file') => {
    const pf = await prepareUpload(file, kind);
    setFiles((prev) => ({ ...prev, [pf.publicPath]: pf }));
    setPending((prev) => (prev.includes(pf.publicPath) ? prev : [...prev, pf.publicPath]));
    return pf.publicPath;
  }, []);
  const resolveAsset = useCallback((src: string) => files[src]?.dataUrl ?? asset(src), [files]);
  const tagSuggestions = useMemo(() => collectTags(site), [site]);
  const ctx = (scoped: FieldIssue[]): FormContext => ({ locales, defaultLocale, upload, resolveAsset, issues: scoped, tagSuggestions });

  const issuesWhere = (match: (raw: PropertyKey[]) => boolean, strip = 0): FieldIssue[] =>
    issues.filter((i) => match(i.raw)).map((i) => ({ path: i.raw.slice(strip) as (string | number)[], message: i.message }));
  const sectionIssueCount = (index: number) => issues.filter((i) => i.raw[0] === 'sections' && i.raw[1] === index).length;
  const GENERAL_KEYS = ['meta', 'brand', 'locales', 'repo'];
  const THEME_KEYS = ['theme', 'features'];

  const updateSection = (index: number, next: Record<string, unknown>) =>
    setSite((s) => ({ ...s, sections: s.sections.map((x, j) => (j === index ? (next as SectionInput) : x)) }));

  // ── Secciones ─────────────────────────────────────────────────────────────
  const select = (index: number) => {
    setView({ kind: 'section', index });
    setMobileTab('edit');
    const id = site.sections[index]?.id;
    if (id) setTimeout(() => previewRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  };
  const move = (i: number, dir: -1 | 1) =>
    setSite((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.sections.length) return s;
      const sections = [...s.sections];
      [sections[i], sections[j]] = [sections[j], sections[i]];
      if (view.kind === 'section' && view.index === i) setView({ kind: 'section', index: j });
      return { ...s, sections };
    });
  const toggleHidden = (i: number) =>
    setSite((s) => ({ ...s, sections: s.sections.map((x, j) => (j === i ? ({ ...x, hidden: !x.hidden } as SectionInput) : x)) }));
  const remove = (i: number) =>
    setConfirm({
      text: `¿Eliminar la sección "${sectionLabel(site.sections[i], defaultLocale) || site.sections[i].id}"? Puedes deshacerlo descartando los cambios antes de publicar.`,
      action: () => {
        setSite((s) => ({ ...s, sections: s.sections.filter((_, j) => j !== i) }));
        setView({ kind: 'section', index: Math.max(0, i - 1) });
      },
    });
  const add = (type: SectionType) => {
    const section = newSection(type, site.sections.map((s) => s.id));
    const contactAt = site.sections.findIndex((s) => s.type === 'contact');
    const at = contactAt === -1 ? site.sections.length : contactAt;
    setSite((s) => ({ ...s, sections: [...s.sections.slice(0, at), section, ...s.sections.slice(at)] }));
    setView({ kind: 'section', index: at });
    setMobileTab('edit');
  };

  // ── Publicar ──────────────────────────────────────────────────────────────
  const publish = async () => {
    if (!session || !REPO || !parsed.ok || base.headSha === null || base.contentSha === null) return;
    setStatus({ kind: 'publishing' });
    try {
      const used = JSON.stringify(site);
      const toUpload = pending.filter((p) => used.includes(JSON.stringify(p))).map((p) => files[p]);
      const result = await session.gh.publish(REPO, {
        site,
        files: toUpload,
        message: message.trim() || DEFAULT_MESSAGE,
        base: { headSha: base.headSha, contentSha: base.contentSha },
      });
      setBase({ site, headSha: result.commitSha, contentSha: result.contentSha });
      setPending([]);
      setMessage('');
      clearDraft(draftKey);
      if (SPLIT && CODE) {
        // El contenido está en otro repo: guardarlo no despliega nada, hay que lanzar el workflow del sitio.
        const since = Date.now();
        try {
          await session.gh.dispatchWorkflow(CODE, DEPLOY_WORKFLOW, CODE.branch);
          setStatus({ kind: 'deploying', commitSha: result.commitSha, commitUrl: result.commitUrl, since });
        } catch (e) {
          setStatus({
            kind: 'published',
            commitUrl: result.commitUrl,
            deploy: { state: 'unknown', url: `https://github.com/${CODE.owner}/${CODE.name}/actions` },
            warning: `El contenido quedó guardado, pero no se pudo lanzar el despliegue. ${errorText(e)}`,
          });
        }
      } else {
        setStatus({ kind: 'deploying', commitSha: result.commitSha, commitUrl: result.commitUrl });
      }
    } catch (e) {
      setStatus({ kind: 'error', message: errorText(e), conflict: e instanceof GitHubError && e.code === 'conflict' });
    }
  };

  useEffect(() => {
    if (status.kind !== 'deploying' || !session || !REPO) return;
    let stopped = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      tries++;
      try {
        const deploy =
          status.since !== undefined && CODE
            ? await session.gh.workflowRunSince(CODE, DEPLOY_WORKFLOW, status.since)
            : await session.gh.deployStatus(REPO, status.commitSha);
        if (stopped) return;
        if (deploy.state === 'success' || deploy.state === 'failure' || deploy.state === 'unknown' || tries >= 72) {
          setStatus({ kind: 'published', commitUrl: status.commitUrl, deploy: tries >= 72 ? { state: 'unknown' } : deploy });
          return;
        }
      } catch {
        /* se reintenta en el siguiente ciclo */
      }
      if (!stopped) timer = setTimeout(tick, 5000);
    };
    timer = setTimeout(tick, 4000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [status, session]);

  const reloadFromGitHub = () => {
    if (!session || !REPO) return;
    const run = async () => {
      try {
        const content = await session.gh.loadContent(REPO);
        clearDraft(draftKey);
        startEditing(content.site, content.headSha, content.contentSha, draftKey);
      } catch (e) {
        setStatus({ kind: 'error', message: errorText(e), conflict: false });
      }
    };
    if (dirty) setConfirm({ text: 'Se descartarán tus cambios sin publicar y se cargará la versión de GitHub.', action: () => void run() });
    else void run();
  };

  const discard = () =>
    setConfirm({
      text: 'Se descartarán todos los cambios sin publicar.',
      action: () => {
        setSite(base.site);
        setPending([]);
        clearDraft(draftKey);
      },
    });

  // ── Modo demo: descargar el resultado ────────────────────────────────────
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([serializeSite(site)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'site.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const loadTemplate = (key: string) => {
    const run = () => {
      setSite(examples[key].site);
      setView({ kind: 'section', index: 0 });
    };
    if (dirty) setConfirm({ text: `Se reemplazará el contenido por "${examples[key].label}".`, action: run });
    else run();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase !== 'editor') {
    return (
      <Chrome>
        {phase === 'boot' ? (
          <p className="grid min-h-dvh place-items-center text-sm text-muted">Cargando panel…</p>
        ) : (
          <Login repo={REPO} siteRepo={SPLIT ? CODE : null} busy={loginBusy} error={loginError} onSubmit={(t, r) => void login(t, r)} onDemo={enterDemo} />
        )}
      </Chrome>
    );
  }

  const current = view.kind === 'section' ? site.sections[view.index] : undefined;

  return (
    <Chrome>
      <div className="flex h-dvh flex-col">
        {/* Barra superior */}
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-line px-4 py-2.5">
          <a href={asset('/')} className="font-heading text-lg font-extrabold">
            Panel<span className="text-accent">.</span>
          </a>
          <StatusPill session={session} status={status} dirty={dirty} invalid={!parsed.ok} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {session ? (
              <>
                {dirty && (
                  <button type="button" onClick={discard} className={buttonClass('ghost')}>
                    Descartar
                  </button>
                )}
                <input
                  aria-label="Mensaje del cambio"
                  placeholder={DEFAULT_MESSAGE}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="hidden w-64 rounded-fk border border-line bg-surface px-2.5 py-1.5 text-sm min-[1100px]:block"
                />
                <button
                  type="button"
                  onClick={() => void publish()}
                  disabled={!dirty || !parsed.ok || status.kind === 'publishing'}
                  className={buttonClass('primary', 'disabled:cursor-not-allowed disabled:opacity-40')}
                >
                  {status.kind === 'publishing' ? 'Publicando…' : 'Publicar'}
                </button>
                <UserMenu user={session.user} onLogout={logout} />
              </>
            ) : (
              <>
                <select aria-label="Cargar plantilla" value="" onChange={(e) => e.target.value && loadTemplate(e.target.value)} className="rounded-fk border border-line bg-surface px-2 py-1.5 text-sm">
                  <option value="">Plantillas…</option>
                  {Object.entries(examples).map(([k, ex]) => (
                    <option key={k} value={k}>
                      {ex.label}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={downloadJson} disabled={!parsed.ok} className={buttonClass('primary', 'disabled:opacity-40')}>
                  Descargar site.json
                </button>
                <button type="button" onClick={() => setPhase('login')} className={buttonClass('secondary')}>
                  Iniciar sesión
                </button>
              </>
            )}
          </div>
        </header>

        {confirm && (
          <Banner tone="warn">
            <span>{confirm.text}</span>
            <span className="flex gap-2">
              <button type="button" className={buttonClass('ghost')} onClick={() => setConfirm(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={buttonClass('primary')}
                onClick={() => {
                  confirm.action();
                  setConfirm(null);
                }}
              >
                Confirmar
              </button>
            </span>
          </Banner>
        )}
        {restorable && (
          <Banner tone="info">
            <span>
              Tienes un borrador sin publicar guardado en este navegador ({new Date(restorable.savedAt).toLocaleString('es-CL')}).
              {restorable.baseHeadSha && restorable.baseHeadSha !== base.headSha && ' Se hizo sobre una versión anterior del contenido.'}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className={buttonClass('ghost')}
                onClick={() => {
                  clearDraft(draftKey);
                  setRestorable(null);
                }}
              >
                Descartar borrador
              </button>
              <button type="button" className={buttonClass('primary')} onClick={restoreDraft}>
                Restaurar
              </button>
            </span>
          </Banner>
        )}
        {status.kind === 'error' && (
          <Banner tone="warn">
            <span role="alert">{status.message}</span>
            {status.conflict && (
              <button type="button" className={buttonClass('primary')} onClick={reloadFromGitHub}>
                Recargar desde GitHub
              </button>
            )}
          </Banner>
        )}
        {status.kind === 'published' && (
          <Banner tone={status.deploy.state === 'failure' || status.warning ? 'warn' : 'ok'}>
            <span>
              {status.warning}
              {!status.warning && status.deploy.state === 'success' && 'Publicado: el sitio ya muestra los cambios.'}
              {!status.warning && status.deploy.state === 'failure' && 'El cambio se guardó, pero el despliegue falló. Revisa el detalle en GitHub Actions.'}
              {!status.warning &&
                (status.deploy.state === 'unknown' || status.deploy.state === 'pending' || status.deploy.state === 'running') &&
                'Publicado. El sitio se actualizará en 1–2 minutos.'}
            </span>
            <span className="flex flex-wrap gap-3 text-sm">
              <a className="underline" href={status.commitUrl} target="_blank" rel="noopener noreferrer">
                Ver commit ↗
              </a>
              {status.deploy.url && (
                <a className="underline" href={status.deploy.url} target="_blank" rel="noopener noreferrer">
                  Ver despliegue ↗
                </a>
              )}
              <a className="underline" href={asset('/')} target="_blank" rel="noopener noreferrer">
                Abrir sitio ↗
              </a>
            </span>
          </Banner>
        )}
        {!session && (
          <p className="border-b-2 border-line bg-surface px-4 py-2 text-xs">
            <strong>Modo demo:</strong> los cambios no se publican. Puedes probar todo y descargar el resultado como <code className="font-code">site.json</code>.
          </p>
        )}

        {/* Pestañas en pantallas chicas */}
        <div className="flex border-b-2 border-line min-[1100px]:hidden" role="tablist">
          {(
            [
              ['list', 'Secciones'],
              ['edit', 'Editar'],
              ['preview', 'Vista previa'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mobileTab === k}
              onClick={() => setMobileTab(k)}
              className={cn('flex-1 py-2.5 text-sm', mobileTab === k ? 'font-extrabold text-accent shadow-[inset_0_-2px_0_var(--fk-accent)]' : 'text-muted')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Barra lateral */}
          <aside className={cn('min-h-0 w-full shrink-0 overflow-y-auto border-line p-3 min-[1100px]:block min-[1100px]:w-[260px] min-[1100px]:border-r-2', mobileTab === 'list' ? 'block' : 'hidden')}>
            <NavGroup title="Sitio">
              <NavItem active={view.kind === 'general'} onClick={() => (setView({ kind: 'general' }), setMobileTab('edit'))} badge={issuesWhere((r) => GENERAL_KEYS.includes(String(r[0]))).length}>
                Datos generales
              </NavItem>
              <NavItem active={view.kind === 'theme'} onClick={() => (setView({ kind: 'theme' }), setMobileTab('edit'))} badge={issuesWhere((r) => THEME_KEYS.includes(String(r[0]))).length}>
                Apariencia y funciones
              </NavItem>
              {session && (
                <NavItem active={view.kind === 'history'} onClick={() => (setView({ kind: 'history' }), setMobileTab('edit'))}>
                  Historial
                </NavItem>
              )}
            </NavGroup>
            <NavGroup title="Secciones">
              <ol className="m-0 list-none space-y-1 p-0">
                {site.sections.map((s, i) => (
                  <li key={`${s.id}-${i}`} className={cn('group flex items-center gap-1 rounded-fk border-2', view.kind === 'section' && view.index === i ? 'border-accent' : 'border-transparent hover:border-line', s.hidden && 'opacity-50')}>
                    <button type="button" onClick={() => select(i)} className="min-w-0 flex-1 px-2 py-1.5 text-left">
                      <span className="block font-code text-[10px] uppercase tracking-wide text-kicker">{SECTION_TYPE_LABELS[s.type]}</span>
                      <span className="block truncate text-sm font-extrabold">
                        {sectionLabel(s, defaultLocale) || `#${s.id}`}
                        {sectionIssueCount(i) > 0 && <span className="ml-1.5 text-accent">●</span>}
                      </span>
                    </button>
                    <IconButton label="Subir" onClick={() => move(i, -1)} disabled={i === 0}>
                      ↑
                    </IconButton>
                    <IconButton label="Bajar" onClick={() => move(i, 1)} disabled={i === site.sections.length - 1}>
                      ↓
                    </IconButton>
                    <IconButton label={s.hidden ? 'Mostrar' : 'Ocultar'} onClick={() => toggleHidden(i)}>
                      {s.hidden ? '◌' : '●'}
                    </IconButton>
                    <IconButton label="Eliminar" onClick={() => remove(i)} disabled={site.sections.length === 1}>
                      ✕
                    </IconButton>
                  </li>
                ))}
              </ol>
              <AddSection onAdd={add} />
            </NavGroup>
          </aside>

          {/* Editor */}
          <section className={cn('min-h-0 w-full overflow-y-auto min-[1100px]:block min-[1100px]:max-w-[640px] min-[1100px]:flex-1 min-[1500px]:flex-none min-[1500px]:basis-[600px]', mobileTab === 'edit' ? 'block' : 'hidden')}>
            <div className="p-5">
              {view.kind === 'section' && current && (
                <>
                  <EditorHeading kicker={SECTION_TYPE_LABELS[current.type]} title={sectionLabel(current, defaultLocale) || `#${current.id}`} />
                  <Form
                    key={`section-${view.index}-${current.type}`}
                    fields={SECTION_FIELDS[current.type]}
                    value={current as Record<string, unknown>}
                    onChange={(next) => updateSection(view.index, next)}
                    ctx={ctx(issuesWhere((r) => r[0] === 'sections' && r[1] === view.index, 2))}
                  />
                </>
              )}
              {view.kind === 'general' && (
                <>
                  <EditorHeading kicker="Sitio" title="Datos generales" />
                  <Form
                    fields={GENERAL_FIELDS}
                    value={site as Record<string, unknown>}
                    onChange={(next) => setSite(next as SiteInput)}
                    ctx={ctx(issuesWhere((r) => GENERAL_KEYS.includes(String(r[0]))))}
                  />
                </>
              )}
              {view.kind === 'theme' && (
                <>
                  <EditorHeading kicker="Sitio" title="Apariencia y funciones" />
                  <Form fields={THEME_FIELDS} value={site as Record<string, unknown>} onChange={(next) => setSite(next as SiteInput)} ctx={ctx(issuesWhere((r) => THEME_KEYS.includes(String(r[0]))))} />
                </>
              )}
              {view.kind === 'history' && session && REPO && (
                <HistoryPanel
                  gh={session.gh}
                  repo={REPO}
                  onLoad={(content) =>
                    setConfirm({
                      text: 'Se cargará esa versión en el editor. Publica para restaurarla en el sitio.',
                      action: () => {
                        setSite(content);
                        setView({ kind: 'section', index: 0 });
                      },
                    })
                  }
                />
              )}
              {!parsed.ok && (
                <details className="mt-8 rounded-fk border-2 border-accent p-3 text-sm" open={issues.length <= 3}>
                  <summary className="cursor-pointer font-extrabold text-accent">
                    {issues.length} {issues.length === 1 ? 'problema impide publicar' : 'problemas impiden publicar'}
                  </summary>
                  <ul className="mt-2 list-none space-y-1 p-0 font-code text-xs">
                    {issues.map((i, n) => (
                      <li key={n}>
                        <span className="text-muted">{i.path}</span> {i.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </section>

          {/* Vista previa */}
          <section aria-label="Vista previa" className={cn('min-h-0 flex-1 flex-col border-line min-[1100px]:flex min-[1100px]:border-l-2', mobileTab === 'preview' ? 'flex' : 'hidden')}>
            <div className="flex items-center justify-between gap-3 border-b-2 border-line px-3 py-1.5 text-xs">
              <span className="text-muted">{parsed.ok ? 'Vista previa en vivo' : 'Vista previa (última versión válida)'}</span>
              <span className="flex gap-1">
                {(['desktop', 'mobile'] as const).map((w) => (
                  <button key={w} type="button" aria-pressed={previewWidth === w} onClick={() => setPreviewWidth(w)} className={cn('rounded-fk px-2 py-1', previewWidth === w ? 'bg-fg text-bg' : 'hover:bg-fg/10')}>
                    {w === 'desktop' ? 'Escritorio' : 'Móvil'}
                  </button>
                ))}
              </span>
            </div>
            <div ref={previewRef} className="min-h-0 flex-1 overflow-y-auto bg-surface">
              <div className={cn('mx-auto min-h-full', previewWidth === 'mobile' && 'max-w-[400px] border-x-2 border-line')}>
                {preview && <SiteRenderer site={preview} embedded resolveAsset={resolveAsset} />}
              </div>
            </div>
          </section>
        </div>
      </div>
    </Chrome>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  return (
    <div data-fk="admin" className="fk-root min-h-dvh bg-bg font-body text-fg">
      <style dangerouslySetInnerHTML={{ __html: CHROME_CSS }} />
      {children}
    </div>
  );
}

function StatusPill({ session, status, dirty, invalid }: { session: Session | null; status: Status; dirty: boolean; invalid: boolean }) {
  let text = session ? 'Todo publicado' : 'Modo demo';
  let tone = 'bg-fg/10';
  if (status.kind === 'publishing') text = 'Publicando…';
  else if (status.kind === 'deploying') text = 'Desplegando…';
  else if (invalid) [text, tone] = ['Hay problemas por corregir', 'bg-accent text-accent-ink'];
  else if (dirty && session) [text, tone] = ['Cambios sin publicar', 'bg-accent/15 text-fg'];
  return (
    <span role="status" className={cn('rounded-full px-2.5 py-0.5 text-xs font-extrabold', tone)}>
      {text}
    </span>
  );
}

function UserMenu({ user, onLogout }: { user: GitHubUser; onLogout: () => void }) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-fk px-1.5 py-1 hover:bg-fg/10" aria-label="Cuenta">
        <img src={user.avatar_url} alt="" className="size-7 rounded-full border border-line" />
        <span className="hidden text-sm min-[700px]:inline">@{user.login}</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-56 rounded-fk border-2 border-line bg-bg p-2 shadow-xl">
        <p className="px-2 py-1 text-xs text-muted">Conectado como {user.name ?? user.login}</p>
        {REPO && (
          <a href={`https://github.com/${REPO.owner}/${REPO.name}`} target="_blank" rel="noopener noreferrer" className="block rounded-fk px-2 py-1.5 text-sm hover:bg-fg/10">
            Repositorio ↗
          </a>
        )}
        <a href={asset('/')} target="_blank" rel="noopener noreferrer" className="block rounded-fk px-2 py-1.5 text-sm hover:bg-fg/10">
          Ver sitio ↗
        </a>
        <button type="button" onClick={onLogout} className="block w-full rounded-fk px-2 py-1.5 text-left text-sm text-accent hover:bg-fg/10">
          Cerrar sesión
        </button>
      </div>
    </details>
  );
}

function Banner({ tone, children }: { tone: 'info' | 'warn' | 'ok'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b-2 border-line px-4 py-2.5 text-sm',
        tone === 'warn' && 'bg-accent/10',
        tone === 'ok' && 'bg-kicker/10',
        tone === 'info' && 'bg-surface',
      )}
    >
      {children}
    </div>
  );
}

function NavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.08em] text-muted">{title}</p>
      {children}
    </div>
  );
}

function NavItem({ active, onClick, badge, children }: { active: boolean; onClick: () => void; badge?: number; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn('mb-1 flex w-full items-center justify-between rounded-fk border-2 px-2 py-1.5 text-left text-sm font-extrabold', active ? 'border-accent' : 'border-transparent hover:border-line')}
    >
      {children}
      {badge ? <span className="text-accent">●</span> : null}
    </button>
  );
}

function IconButton({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...props} className="grid size-7 shrink-0 place-items-center rounded-fk text-sm hover:bg-fg/10 disabled:opacity-25">
      {children}
    </button>
  );
}

function EditorHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-6 border-b-2 border-line pb-4">
      <p className="text-[12px] uppercase tracking-[0.08em] text-kicker">{kicker}</p>
      <h1 className="mt-1 font-heading text-2xl font-extrabold tracking-[-0.01em]">{title}</h1>
    </div>
  );
}

function AddSection({ onAdd }: { onAdd: (type: SectionType) => void }) {
  const [type, setType] = useState<SectionType>('projects');
  return (
    <div className="mt-3 flex gap-2 px-1">
      <select aria-label="Tipo de sección" value={type} onChange={(e) => setType(e.target.value as SectionType)} className="min-w-0 flex-1 rounded-fk border border-line bg-surface px-2 py-1.5 text-sm">
        {SECTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {SECTION_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onAdd(type)} className={buttonClass('secondary')}>
        + Añadir
      </button>
    </div>
  );
}

function HistoryPanel({ gh, repo, onLoad }: { gh: GitHub; repo: RepoRef; onLoad: (site: SiteInput) => void }) {
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    gh.history(repo, 20)
      .then(setItems)
      .catch((e) => setError(errorText(e)));
  }, [gh, repo]);

  const load = async (sha: string) => {
    setLoading(sha);
    try {
      onLoad(await gh.loadContentAt(repo, sha));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <EditorHeading kicker="Sitio" title="Historial de cambios" />
      <p className="mb-4 text-sm text-muted">Cada publicación es un commit en GitHub. Puedes cargar una versión anterior y volver a publicarla.</p>
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
      {!items && !error && <p className="text-sm text-muted">Cargando…</p>}
      <ol className="m-0 list-none divide-y-2 divide-line border-y-2 border-line p-0">
        {items?.map((c) => (
          <li key={c.sha} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">{c.message}</p>
              <p className="text-xs text-muted">
                {formatDate(c.date.slice(0, 10), 'es')} · {c.author} · <code className="font-code">{c.sha.slice(0, 7)}</code>
              </p>
            </div>
            <span className="flex gap-2">
              <a href={c.url} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost')}>
                Ver ↗
              </a>
              <button type="button" onClick={() => void load(c.sha)} disabled={loading === c.sha} className={buttonClass('secondary')}>
                {loading === c.sha ? 'Cargando…' : 'Cargar'}
              </button>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
