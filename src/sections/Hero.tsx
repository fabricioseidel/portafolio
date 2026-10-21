'use client';

import { useSite } from '@/components/SiteContext';
import { Actions } from '@/components/ui';
import type { SectionOf } from '@/core/schema';

export function Hero({ section }: { section: SectionOf<'hero'> }) {
  const { site, tr, trOpt, asset } = useSite();
  const { aside } = section;
  const last = section.headline.length - 1;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-end gap-x-[clamp(24px,5vw,96px)] gap-y-12 py-[clamp(48px,10vw,96px)]">
      <div>
        {section.eyebrow && <p className="mb-5 text-[13px] uppercase tracking-[0.08em] text-kicker">{tr(section.eyebrow)}</p>}
        <h1 className="-ml-[0.058em] font-heading text-[clamp(52px,7.4vw,104px)] font-extrabold leading-none tracking-[-0.025em]">
          {section.headline.map((line, i) => (
            <span key={i} className="block">
              {line}
              {i === last && <span className="text-accent">{site.brand.mark}</span>}
            </span>
          ))}
        </h1>
        {section.intro && <p className="mt-8 max-w-[46ch] text-[17px] leading-7">{tr(section.intro)}</p>}
        {section.meta && <p className="mt-4 max-w-[52ch] text-sm leading-[22px] text-muted">{tr(section.meta)}</p>}
        <Actions links={section.actions} className="mt-8" />
      </div>

      {aside?.kind === 'stats' && (
        <div className="grid grid-cols-2 border-t-2 border-line">
          {aside.items.map((s, i) => (
            <div key={i} className="border-b-2 border-line py-5 pr-4">
              <p className="font-heading text-[clamp(34px,4vw,52px)] font-extrabold leading-none tracking-[-0.02em] text-accent tabular-nums">{tr(s.value)}</p>
              <p className="mt-2 text-[13px] leading-[18px]">{tr(s.label)}</p>
            </div>
          ))}
        </div>
      )}
      {aside?.kind === 'image' && (
        <div className="fk-grayscale aspect-[4/5] w-full max-w-[440px] overflow-hidden rounded-fk">
          <img src={asset(aside.src)} alt={trOpt(aside.alt) ?? ''} className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  );
}
