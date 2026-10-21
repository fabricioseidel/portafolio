'use client';

import { useMemo } from 'react';
import { tagUsage } from '@/core/tags';
import { useSite } from './SiteContext';

/** Aviso flotante mientras hay una tecnología seleccionada. */
export function FilterBar() {
  const { site, locale, activeTag, setActiveTag, u, embedded } = useSite();
  const usage = useMemo(() => tagUsage(site, locale), [site, locale]);
  if (!activeTag) return null;
  const count = usage.get(activeTag.key)?.length ?? 0;
  return (
    <div
      data-nobuddy="1"
      role="status"
      className={`${embedded ? 'sticky' : 'fixed'} bottom-4 left-1/2 z-40 flex w-max print:hidden max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-fk bg-fg px-4 py-2 text-sm text-bg shadow-xl`}
    >
      <span>
        {u('filtering')} <strong className="font-heading">{activeTag.label}</strong> · {count} {u(count === 1 ? 'match' : 'matches')}
      </span>
      <button type="button" onClick={() => setActiveTag(null)} className="font-heading font-extrabold text-accent" aria-label={u('clear')}>
        ✕
      </button>
    </div>
  );
}
