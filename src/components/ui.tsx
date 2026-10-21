'use client';

import { useState, type ReactNode } from 'react';
import { highlight } from '@/core/highlight';
import type { Link, Media, Stat } from '@/core/schema';
import { normTag } from '@/core/tags';
import { cn, isDownloadable, isExternal, isSpecialHref, safeHref } from '@/core/utils';
import { useSite } from './SiteContext';

/** Atributos de un enlace del contenido: basePath para rutas locales, pestaña nueva para externos y descarga para archivos. */
export function useLinkProps() {
  const { asset } = useSite();
  return (rawHref: string) => {
    const href = safeHref(rawHref);
    if (isExternal(href)) return { href, target: '_blank', rel: 'noopener noreferrer' } as const;
    if (isSpecialHref(href)) return { href } as const;
    return { href: asset(href), ...(isDownloadable(href) ? { download: '' } : {}) } as const;
  };
}

/** Contenedor con el ancho y los márgenes laterales del sitio. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-[1200px] px-[clamp(20px,5vw,72px)]', className)}>{children}</div>;
}

export function Rule() {
  return <hr className="m-0 h-0.5 border-0 bg-line" />;
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mb-7 text-[13px] uppercase tracking-[0.08em] text-kicker', className)}>{children}</p>;
}

const BUTTON = {
  base: 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-fk border px-3.5 py-2 font-heading text-sm font-extrabold leading-tight transition-colors',
  primary: 'border-accent bg-accent text-accent-ink hover:brightness-95',
  secondary: 'border-line text-fg hover:bg-fg/[0.07]',
  ghost: 'border-transparent px-1.5 text-accent hover:bg-accent/10',
};

export function buttonClass(variant: Link['variant'] = 'secondary', extra?: string) {
  return cn(BUTTON.base, BUTTON[variant], extra);
}

export function LinkButton({ link }: { link: Link }) {
  const { tr } = useSite();
  const linkProps = useLinkProps();
  return (
    <a {...linkProps(link.href)} className={buttonClass(link.variant)}>
      {tr(link.label)}
      {isExternal(link.href) && <span aria-hidden>↗</span>}
    </a>
  );
}

export function Actions({ links, className }: { links: Link[]; className?: string }) {
  if (!links.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {links.map((l, i) => (
        <LinkButton key={i} link={l} />
      ))}
    </div>
  );
}

/** Tecnología. Con el filtro activado es un botón que resalta dónde se usa. */
export function Tag({ label, variant = 'neutral', count }: { label: string; variant?: 'neutral' | 'outline'; count?: number }) {
  const { site, activeTag, setActiveTag } = useSite();
  const key = normTag(label);
  const active = activeTag?.key === key;
  const cls = cn(
    'inline-flex items-center gap-1 rounded-[calc(var(--fk-radius)*0.75)] border px-2.5 py-0.5 text-xs tracking-[0.02em] transition-colors',
    active
      ? 'border-accent bg-accent text-accent-ink'
      : variant === 'outline'
        ? 'border-accent text-accent'
        : 'border-transparent bg-fg/[0.07] text-fg/85',
  );
  if (!site.features.tagFilter) return <span className={cls}>{label}</span>;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => setActiveTag(active ? null : { key, label })}
      className={cn(cls, 'cursor-pointer', !active && 'hover:border-accent hover:text-accent')}
    >
      {label}
      {count ? <sup className="text-[10px] opacity-60">{count}</sup> : null}
    </button>
  );
}

export function Tags({ items, variant }: { items: string[]; variant?: 'neutral' | 'outline' }) {
  if (!items.length) return null;
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {items.map((t) => (
        <Tag key={t} label={t} variant={variant} />
      ))}
    </div>
  );
}

export function StatGrid({ stats, className }: { stats: Stat[]; className?: string }) {
  const { tr } = useSite();
  if (!stats.length) return null;
  return (
    <div className={cn('mt-7 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-x-5 border-b-2 border-line', className)}>
      {stats.map((s, i) => (
        <div key={i} className="border-t-2 border-line py-4.5">
          <p className="font-heading text-[28px] font-extrabold leading-none text-accent tabular-nums">{tr(s.value)}</p>
          <p className="mt-2 text-[13px] leading-[18px]">{tr(s.label)}</p>
        </div>
      ))}
    </div>
  );
}

export function Bullets({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-4 max-w-[56ch] list-none p-0">
      {items.map((x, i) => (
        <li key={i} className="relative py-1.5 pl-[18px] text-[14.5px] leading-[23px] before:absolute before:left-0 before:top-[15px] before:h-0.5 before:w-2 before:bg-accent">
          {x}
        </li>
      ))}
    </ul>
  );
}

export function CodeBlock({ code, filename, className }: { code: string; filename?: string; className?: string }) {
  const { u } = useSite();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* portapapeles no disponible */
    }
  };
  return (
    <figure className={cn('overflow-hidden rounded-fk border-2 border-line bg-surface', className)}>
      <figcaption className="flex items-center justify-between gap-3 border-b-2 border-line px-3 py-1.5 font-code text-xs text-muted">
        <span className="truncate">{filename ?? 'snippet'}</span>
        <button type="button" data-nobuddy="1" onClick={copy} className="shrink-0 hover:text-accent">
          {copied ? u('copied') : u('copy')}
        </button>
      </figcaption>
      <pre className="m-0 overflow-x-auto p-4 font-code text-[12.5px] leading-[1.65]">
        <code>
          {highlight(code).map((t, i) =>
            t.kind === 'plain' ? t.text : (
              <span key={i} className={`tok-${t.kind}`}>
                {t.text}
              </span>
            ),
          )}
        </code>
      </pre>
    </figure>
  );
}

export function MediaView({ media }: { media: Media }) {
  const { trOpt, asset } = useSite();
  if (media.type === 'code') return <CodeBlock code={media.code} filename={media.filename} />;
  return (
    <div className="fk-grayscale aspect-[16/10] overflow-hidden rounded-fk border-2 border-line bg-surface">
      <img src={asset(media.src)} alt={trOpt(media.alt) ?? ''} loading="lazy" className="h-full w-full object-cover object-top" />
    </div>
  );
}
