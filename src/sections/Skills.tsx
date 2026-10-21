'use client';

import { useMemo } from 'react';
import { useSite } from '@/components/SiteContext';
import { Tag } from '@/components/ui';
import type { SectionOf } from '@/core/schema';
import { normTag, tagUsage } from '@/core/tags';

export function Skills({ section }: { section: SectionOf<'skills'> }) {
  const { site, locale, tr, u, activeTag } = useSite();
  const usage = useMemo(() => tagUsage(site, locale), [site, locale]);
  const filter = site.features.tagFilter;
  const uses = activeTag ? (usage.get(activeTag.key) ?? []) : [];

  return (
    <>
      {filter && <p className="-mt-3 mb-6 text-sm text-muted">{u('tagHint')}</p>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] border-t-2 border-line">
        {section.groups.map((g, i) => (
          <div key={i} className="border-b-2 border-line py-7 pr-7">
            <h3 className="mb-4 font-heading text-lg font-extrabold">{tr(g.title)}</h3>
            <div className="flex flex-wrap gap-2">
              {g.items.map((x) => (
                <Tag key={x} label={x} count={filter ? usage.get(normTag(x))?.length : undefined} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {activeTag && (
        <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2" aria-live="polite">
          <span className="font-heading text-lg font-extrabold">{activeTag.label}</span>
          <span className="text-[13px] uppercase tracking-[0.08em] text-kicker">{u('usedIn')}</span>
          {uses.length ? (
            uses.map((x) => (
              <a key={x.anchor} href={`#${x.anchor}`} className="border-b-2 border-accent text-[15px] hover:text-accent">
                {x.title}
              </a>
            ))
          ) : (
            <span className="text-[15px] text-muted">{u('noUse')}</span>
          )}
        </div>
      )}
    </>
  );
}
