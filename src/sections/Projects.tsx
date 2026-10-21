'use client';

import { useSite } from '@/components/SiteContext';
import { Actions, Bullets, MediaView, StatGrid, Tags } from '@/components/ui';
import type { SectionOf } from '@/core/schema';
import { hasTag } from '@/core/tags';
import { cn } from '@/core/utils';

type Project = SectionOf<'projects'>['items'][number];

export function Projects({ section }: { section: SectionOf<'projects'> }) {
  const indexed = section.items.map((item, i) => ({ item, anchor: `${section.id}-${i}` }));
  const featured = indexed.filter((p) => p.item.featured);
  const cards = indexed.filter((p) => !p.item.featured);
  return (
    <>
      <div className="space-y-[clamp(56px,8vw,84px)]">
        {featured.map((p) => (
          <Featured key={p.anchor} project={p.item} anchor={p.anchor} />
        ))}
      </div>
      {cards.length > 0 && (
        <div className={cn('grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-x-[clamp(24px,4vw,56px)]', featured.length > 0 && 'mt-[clamp(56px,8vw,84px)]')}>
          {cards.map((p) => (
            <Card key={p.anchor} project={p.item} anchor={p.anchor} />
          ))}
        </div>
      )}
    </>
  );
}

function useDim(tags: string[]) {
  const { activeTag } = useSite();
  return activeTag && !hasTag(tags, activeTag.key) ? 'opacity-25' : '';
}

function Featured({ project: p, anchor }: { project: Project; anchor: string }) {
  const { tr, trOpt, trList } = useSite();
  const dim = useDim(p.tags);
  const head = (
    <>
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h2 className="font-heading text-[clamp(32px,3.4vw,44px)] font-extrabold tracking-[-0.02em]">{tr(p.title)}</h2>
        {p.period && <span className="text-[15px] tabular-nums">{trOpt(p.period)}</span>}
      </div>
      <p className="mt-4 max-w-[52ch] text-base leading-7">{tr(p.description)}</p>
      <Bullets items={trList(p.highlights)} />
    </>
  );
  const details = (
    <>
      <StatGrid stats={p.stats} />
      <Tags items={p.tags} variant="outline" />
      <Actions links={p.links} className="mt-7" />
    </>
  );
  return (
    <article id={anchor} className={cn('grid scroll-mt-20 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-x-[clamp(24px,5vw,72px)] gap-y-10 transition-opacity duration-300', dim)}>
      {p.media ? (
        <>
          <MediaView media={p.media} />
          <div>
            {head}
            {details}
          </div>
        </>
      ) : (
        <>
          <div>{head}</div>
          <div className="[&>*:first-child]:mt-0">{details}</div>
        </>
      )}
    </article>
  );
}

function Card({ project: p, anchor }: { project: Project; anchor: string }) {
  const { tr, trOpt } = useSite();
  const dim = useDim(p.tags);
  return (
    <article id={anchor} className={cn('scroll-mt-20 border-y-2 border-line py-7 transition-opacity duration-300', dim)}>
      {(p.kicker || p.period) && (
        <p className="text-[13px] uppercase tracking-[0.08em]">{[trOpt(p.kicker), trOpt(p.period)].filter(Boolean).join(' · ')}</p>
      )}
      <h3 className="mt-3 font-heading text-[clamp(24px,2.4vw,30px)] font-extrabold">{tr(p.title)}</h3>
      <p className="mt-3 text-[15px] leading-6">{tr(p.description)}</p>
      <Tags items={p.tags} />
      <Actions links={p.links} className="mt-6" />
    </article>
  );
}
