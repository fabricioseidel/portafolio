'use client';

import { useId, useState } from 'react';
import { buttonClass } from '@/components/ui';
import type { RepoRef } from './types';

/** Enlaces para crear el token. El fine-grained se limita a un repo; el clásico es el respaldo. */
export function tokenLinks(repo: RepoRef | null, split = false) {
  const fineGrained = new URL('https://github.com/settings/personal-access-tokens/new');
  fineGrained.searchParams.set('name', 'Panel portafolio');
  fineGrained.searchParams.set('description', 'Editar y publicar el portafolio desde /admin');
  if (repo) fineGrained.searchParams.set('target_name', repo.owner);
  fineGrained.searchParams.set('expires_in', '90');
  fineGrained.searchParams.set('contents', 'write');
  // Con el contenido en otro repo, publicar lanza el workflow del sitio: hace falta Actions en escritura.
  fineGrained.searchParams.set('actions', split ? 'write' : 'read');
  const classic = `https://github.com/settings/tokens/new?scopes=public_repo&description=${encodeURIComponent('Panel portafolio')}`;
  return { fineGrained: fineGrained.toString(), classic };
}

export function Login({
  repo,
  siteRepo,
  busy,
  error,
  onSubmit,
  onDemo,
}: {
  /** Repo donde vive el contenido. */
  repo: RepoRef | null;
  /** Repo del sitio (código y despliegue) cuando es distinto del del contenido. */
  siteRepo: RepoRef | null;
  busy: boolean;
  error: string | null;
  onSubmit: (token: string, remember: boolean) => void;
  onDemo: () => void;
}) {
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(false);
  const id = useId();
  const links = tokenLinks(repo, !!siteRepo);
  const slug = repo ? `${repo.owner}/${repo.name}` : 'tu repositorio';

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-5 py-12">
      <p className="mb-4 text-[13px] uppercase tracking-[0.08em] text-kicker">Panel administrativo</p>
      <h1 className="font-heading text-[clamp(34px,6vw,48px)] font-extrabold leading-none tracking-[-0.02em]">
        Edita tu portafolio<span className="text-accent">.</span>
      </h1>
      <p className="mt-5 text-[15px] leading-6">
        Inicia sesión con tu cuenta de GitHub. Cada vez que publiques, el panel guarda los cambios como un commit en{' '}
        <code className="font-code text-sm">{slug}</code> y el sitio se actualiza solo en 1–2 minutos.
      </p>

      <ol className="mt-8 list-none space-y-6 border-t-2 border-line p-0 pt-6">
        <li>
          <p className="font-heading font-extrabold">1. Crea un token de acceso (una sola vez)</p>
          {siteRepo ? (
            <p className="mt-1.5 text-sm text-muted">
              En GitHub elige <strong>Only select repositories</strong> → <code className="font-code">{repo?.name}</code> (tu contenido) y{' '}
              <code className="font-code">{siteRepo.name}</code> (el sitio). Permisos: <strong>Contents: Read and write</strong> y{' '}
              <strong>Actions: Read and write</strong> (para lanzar el despliegue y ver su estado).
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted">
              En GitHub elige <strong>Only select repositories</strong> → <code className="font-code">{repo?.name ?? 'portafolio'}</code> y da permiso{' '}
              <strong>Contents: Read and write</strong> (y <strong>Actions: Read</strong> para ver el estado del despliegue).
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <a href={links.fineGrained} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
              Crear token en GitHub ↗
            </a>
            <a href={links.classic} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost')}>
              Token clásico ↗
            </a>
          </div>
        </li>
        <li>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (token.trim()) onSubmit(token.trim(), remember);
            }}
          >
            <label htmlFor={`${id}-token`} className="font-heading font-extrabold">
              2. Pega el token y entra
            </label>
            <input
              id={`${id}-token`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="github_pat_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-2 w-full rounded-fk border border-line bg-surface px-3 py-2.5 font-code text-sm focus-visible:outline-2 focus-visible:outline-accent"
            />
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-1 accent-[var(--fk-accent)]" />
              <span>
                Recordar en este navegador <span className="text-muted">(si no, se borra al cerrar la pestaña)</span>
              </span>
            </label>
            {error && (
              <p role="alert" className="mt-3 border-l-2 border-accent pl-3 text-sm text-accent">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy || !token.trim()} className={buttonClass('primary', 'mt-4 disabled:opacity-50')}>
              {busy ? 'Verificando…' : 'Entrar'}
            </button>
          </form>
        </li>
      </ol>

      <div className="mt-10 border-t-2 border-line pt-6">
        <p className="text-sm">¿Solo quieres ver cómo funciona? Edita una copia local: no se publica nada y puedes descargar el resultado.</p>
        <button type="button" onClick={onDemo} className={buttonClass('secondary', 'mt-3')}>
          Probar sin iniciar sesión
        </button>
      </div>

      <p className="mt-10 text-xs leading-5 text-muted">
        El token solo se envía a api.github.com y queda en este navegador. Si alguien sin permiso de escritura entra, el panel no le deja publicar.
      </p>
    </main>
  );
}
