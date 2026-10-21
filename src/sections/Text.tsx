'use client';

import { useSite } from '@/components/SiteContext';
import type { SectionOf } from '@/core/schema';

export function Text({ section }: { section: SectionOf<'text'> }) {
  const { trList } = useSite();
  return (
    <div className="max-w-[65ch] space-y-4 text-[17px] leading-7">
      {trList(section.body).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
