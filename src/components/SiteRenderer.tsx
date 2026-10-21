'use client';

import { useId, useRef, type ComponentType } from 'react';
import type { Section, Site } from '@/core/schema';
import { themeCss } from '@/core/theme';
import { cn } from '@/core/utils';
import { componentName, registry } from '@/sections/registry';
import { Buddy } from './Buddy';
import { FilterBar } from './FilterBar';
import { InspectorDrawer } from './Inspector';
import { Nav } from './Nav';
import { SiteProvider, useSite } from './SiteContext';
import { Container, Kicker, Rule } from './ui';

/** Dibuja un portafolio completo a partir de un `Site` validado. */
export function SiteRenderer({ site, embedded = false, resolveAsset }: { site: Site; embedded?: boolean; resolveAsset?: (src: string) => string }) {
  return (
    <SiteProvider site={site} embedded={embedded} resolveAsset={resolveAsset}>
      <Frame />
    </SiteProvider>
  );
}

function Frame() {
  const { site, mode, buddy, embedded } = useSite();
  const scope = `fk${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = site.sections.filter((s) => !s.hidden);
  let n = 0;

  return (
    <div ref={rootRef} data-fk={scope} data-mode={mode} className="fk-root @container min-h-full bg-bg font-body text-fg">
      <style dangerouslySetInnerHTML={{ __html: themeCss(`[data-fk="${scope}"]`, site.theme) }} />
      <Nav />
      <main>
        {visible.map((section, i) => {
          const layout = registry[section.type].layout;
          const number = layout || !section.title ? null : ++n;
          const next = visible[i + 1];
          const rule = next && layout !== 'bleed' && registry[next.type].layout !== 'bleed';
          return (
            <div key={section.id}>
              <SectionShell section={section} number={number} />
              {rule && (
                <Container>
                  <Rule />
                </Container>
              )}
            </div>
          );
        })}
      </main>
      <Footer />
      <InspectorDrawer />
      <FilterBar />
      {buddy && !embedded && <Buddy rootRef={rootRef} />}
    </div>
  );
}

function Footer() {
  const { site, u, repo, asset, embedded } = useSite();
  return (
    <footer data-nobuddy="1" className="print:hidden">
      <Container className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-6 text-[13px] text-muted">
        <span>
          © {site.brand.name} · {u('madeWith')}
        </span>
        <span className="flex gap-5">
          {repo && (
            <a href={repo.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
              {u('sourceCode')} ↗
            </a>
          )}
          {site.features.admin && !embedded && (
            <a href={asset('/admin/')} className="hover:text-accent">
              {u('panel')}
            </a>
          )}
        </span>
      </Container>
    </footer>
  );
}

function SectionShell({ section, number }: { section: Section; number: number | null }) {
  const { tr, inspector, inspect, inspected } = useSite();
  const entry = registry[section.type];
  const Component = entry.component as ComponentType<{ section: Section }>;
  const body = <Component section={section} />;
  const isActive = inspected?.id === section.id;

  return (
    <section
      id={section.id}
      data-section={section.type}
      className={cn(
        'relative scroll-mt-16 print:break-inside-avoid-page',
        inspector && 'outline-2 -outline-offset-2 outline-dashed',
        inspector && (isActive ? 'outline-accent' : 'outline-accent/40'),
      )}
    >
      {inspector && (
        <button
          type="button"
          data-nobuddy="1"
          onClick={() => inspect(isActive ? null : section)}
          className="absolute right-2 top-2 z-20 rounded-fk bg-fg px-2.5 py-1 font-code text-xs text-bg shadow-lg hover:bg-accent hover:text-accent-ink print:hidden"
        >
          {`<${componentName(section.type)} />`} <span className="opacity-60">#{section.id}</span>
        </button>
      )}
      {entry.layout === 'bleed' ? (
        body
      ) : entry.layout === 'plain' ? (
        <Container>{body}</Container>
      ) : (
        <Container className="py-[clamp(56px,9vw,84px)]">
          {number !== null && section.title && (
            <Kicker>
              {String(number).padStart(2, '0')} — {tr(section.title)}
            </Kicker>
          )}
          {body}
        </Container>
      )}
    </section>
  );
}
