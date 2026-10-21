'use client';

import { useSite } from '@/components/SiteContext';
import type { SectionOf } from '@/core/schema';
import { hasTag } from '@/core/tags';
import { cn } from '@/core/utils';

export function Timeline({ section }: { section: SectionOf<'timeline'> }) {
  const { tr, trOpt, activeTag } = useSite();
  return (
    <div className="-mt-3.5">
      {section.items.map((j, i) => (
        <div
          key={i}
          id={`${section.id}-${i}`}
          className={cn(
            'grid scroll-mt-20 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-x-[clamp(24px,4vw,72px)] gap-y-3 py-8 transition-opacity duration-300',
            i > 0 && 'border-t-2 border-line',
            activeTag && !hasTag(j.tags, activeTag.key) && 'opacity-25',
          )}
        >
          <p className="text-[15px] tabular-nums">{tr(j.period)}</p>
          <div>
            <h3 className="font-heading text-2xl font-extrabold tracking-[-0.01em]">{tr(j.title)}</h3>
            {j.subtitle && <p className="mt-1.5 text-[15px] text-kicker">{trOpt(j.subtitle)}</p>}
          </div>
          {j.description && <p className="max-w-[48ch] text-[15.5px] leading-[26px]">{trOpt(j.description)}</p>}
        </div>
      ))}
    </div>
  );
}
