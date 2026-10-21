'use client';

import { useSite } from '@/components/SiteContext';
import type { SectionOf } from '@/core/schema';

export function Gallery({ section }: { section: SectionOf<'gallery'> }) {
  const { trOpt, asset } = useSite();
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-6">
      {section.items.map((g, i) => (
        <figure key={i} className="m-0">
          <div className="aspect-[4/3] overflow-hidden rounded-fk border-2 border-line bg-surface">
            <img src={asset(g.src)} alt={trOpt(g.alt) ?? ''} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]" />
          </div>
          {g.caption && <figcaption className="mt-2 text-[13px] text-muted">{trOpt(g.caption)}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
