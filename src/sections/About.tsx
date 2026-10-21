'use client';

import { useSite } from '@/components/SiteContext';
import type { SectionOf } from '@/core/schema';

export function About({ section }: { section: SectionOf<'about'> }) {
  const { tr } = useSite();
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-[clamp(24px,5vw,96px)] gap-y-14">
      <p className="max-w-[30ch] font-heading text-[clamp(22px,2.2vw,28px)] font-extrabold leading-[1.35] tracking-[-0.01em]">{tr(section.statement)}</p>
      {section.facts.length > 0 && (
        <div className="border-t-2 border-line">
          {section.facts.map((f, i) => (
            <div key={i} className="flex flex-wrap gap-x-4 gap-y-1.5 border-b-2 border-line py-4.5">
              <span className="flex-[0_0_140px] text-[13px] uppercase tracking-[0.08em]">{tr(f.label)}</span>
              <span className="flex-[1_1_200px] text-[15.5px] leading-6">{tr(f.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
