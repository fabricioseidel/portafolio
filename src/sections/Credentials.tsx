'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import { Lightbox } from '@/components/Lightbox';
import { useSite } from '@/components/SiteContext';
import { useLinkProps } from '@/components/ui';
import { formatDate } from '@/core/i18n';
import type { SectionOf } from '@/core/schema';
import { isImagePath } from '@/core/utils';

type Open = (e: MouseEvent, raw: string, src: string, title: string) => void;

function MaybeLink({ href, title, open, className, children }: { href?: string; title: string; open: Open; className: string; children: ReactNode }) {
  const linkProps = useLinkProps();
  if (!href) return <div className={className}>{children}</div>;
  const props = linkProps(href);
  return (
    <a {...props} target="_blank" rel="noopener noreferrer" onClick={(e) => open(e, href, props.href, title)} className={className}>
      {children}
    </a>
  );
}

export function Credentials({ section }: { section: SectionOf<'credentials'> }) {
  const { tr, trOpt, locale, u } = useSite();
  const [viewer, setViewer] = useState<{ src: string; title: string } | null>(null);
  // Las imágenes (certificados) se ven en un visor; otros enlaces se abren normal.
  const open: Open = (e, raw, src, title) => {
    if (!isImagePath(raw)) return;
    e.preventDefault();
    setViewer({ src, title });
  };

  return (
    <>
      {section.highlights.length > 0 && (
        <div className="mb-10 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-x-[clamp(24px,4vw,56px)]">
          {section.highlights.map((c, i) => (
            <MaybeLink key={i} href={c.href} title={tr(c.title)} open={open} className="block border-y-2 border-line py-7">
              {c.kicker && <p className="text-[13px] uppercase tracking-[0.08em]">{trOpt(c.kicker)}</p>}
              <h3 className="mt-3 font-heading text-[clamp(24px,2.4vw,30px)] font-extrabold leading-[1.15]">{tr(c.title)}</h3>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 tabular-nums">
                {c.value && <span className="font-heading text-[28px] font-extrabold text-accent">{trOpt(c.value)}</span>}
                {c.date && <span className="text-[15px]">{formatDate(c.date, locale)}</span>}
                {c.href && <span className="ml-auto text-[15px]">{u('view')} ↗</span>}
              </div>
            </MaybeLink>
          ))}
        </div>
      )}
      {section.items.length > 0 && (
        <>
          {section.listTitle && (
            <p className="border-b-2 border-line pb-3 text-[13px] uppercase tracking-[0.08em]">{trOpt(section.listTitle)}</p>
          )}
          {section.items.map((m, i) => (
            <MaybeLink
              key={i}
              href={m.href}
              title={tr(m.title)}
              open={open}
              className="flex min-h-11 flex-wrap items-baseline gap-x-6 gap-y-1.5 border-b-2 border-line py-4 tabular-nums transition-colors hover:bg-accent/[0.06]"
            >
              <span className="flex-[1_1_240px] font-heading text-lg font-extrabold">{tr(m.title)}</span>
              <span className="flex flex-none gap-5 text-[15px]">
                {m.value && <span className="min-w-12">{trOpt(m.value)}</span>}
                {m.date && <span className="min-w-[110px]">{formatDate(m.date, locale)}</span>}
                {m.href && <span>{u('view')} ↗</span>}
              </span>
            </MaybeLink>
          ))}
        </>
      )}
      <Lightbox src={viewer?.src ?? null} title={viewer?.title ?? ''} onClose={() => setViewer(null)} />
    </>
  );
}
