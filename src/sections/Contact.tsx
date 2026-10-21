'use client';

import { useSite } from '@/components/SiteContext';
import { Container, useLinkProps } from '@/components/ui';
import type { SectionOf } from '@/core/schema';

export function Contact({ section }: { section: SectionOf<'contact'> }) {
  const { tr } = useSite();
  const linkProps = useLinkProps();
  return (
    <div className="bg-accent text-accent-ink">
      <Container className="flex flex-wrap items-end justify-between gap-8 py-[84px]">
        <h2 className="-ml-[0.058em] font-heading text-[clamp(40px,5vw,72px)] font-extrabold leading-[1.02] tracking-[-0.02em]">{tr(section.headline)}</h2>
        <div className="flex flex-col gap-2 text-[17px]">
          {section.lines.map((l, i) =>
            l.href ? (
              <a key={i} {...linkProps(l.href)} className="underline-offset-4 hover:text-accent-ink hover:underline">
                {tr(l.label)}
              </a>
            ) : (
              <span key={i}>{tr(l.label)}</span>
            ),
          )}
        </div>
      </Container>
    </div>
  );
}
