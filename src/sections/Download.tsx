'use client';

import { useSite } from '@/components/SiteContext';
import { buttonClass, useLinkProps } from '@/components/ui';
import { templateUrl, zipUrl } from '@/core/repo';
import type { SectionOf } from '@/core/schema';

type Item = SectionOf<'download'>['items'][number];

function kicker(it: Item): string {
  if (it.kind === 'zip') return 'ZIP · GitHub';
  if (it.kind === 'template') return 'GitHub';
  if (it.kind === 'print') return 'PDF';
  if (it.kind === 'link') return 'Web';
  return it.href?.match(/\.(\w+)(?:$|[?#])/)?.[1]?.toUpperCase() ?? 'Archivo';
}

/** Descargas: el código del portafolio, la plantilla, archivos propios y una versión imprimible. */
export function Download({ section }: { section: SectionOf<'download'> }) {
  const { tr, trOpt, u, repo } = useSite();
  const linkProps = useLinkProps();
  // Sin repositorio conocido no hay zip ni plantilla que ofrecer.
  const items = section.items.filter((it) => repo || (it.kind !== 'zip' && it.kind !== 'template'));

  const action = (it: Item) => {
    switch (it.kind) {
      case 'zip':
        return (
          <a href={zipUrl(repo!)} className={buttonClass('primary')}>
            {u('downloadZip')} ↓
          </a>
        );
      case 'template':
        return (
          <a href={templateUrl(repo!)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
            {u('useTemplate')} ↗
          </a>
        );
      case 'file':
        return (
          <a {...linkProps(it.href!)} download="" className={buttonClass('secondary')}>
            {u('downloadFile')} ↓
          </a>
        );
      case 'link':
        return (
          <a {...linkProps(it.href!)} className={buttonClass('secondary')}>
            {u('openLink')} ↗
          </a>
        );
      case 'print':
        return (
          <button type="button" onClick={() => window.print()} className={buttonClass('secondary')}>
            {u('print')}
          </button>
        );
    }
  };

  return (
    <>
      {section.intro && <p className="-mt-3 mb-8 max-w-[60ch] text-[16px] leading-7">{tr(section.intro)}</p>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-x-[clamp(24px,4vw,56px)]">
        {items.map((it, i) => (
          <div key={i} className="flex flex-col border-y-2 border-line py-7">
            <p className="text-[13px] uppercase tracking-[0.08em] text-kicker">{kicker(it)}</p>
            <h3 className="mt-3 font-heading text-[22px] font-extrabold leading-tight">{tr(it.label)}</h3>
            {it.description && <p className="mt-3 flex-1 text-[15px] leading-6">{trOpt(it.description)}</p>}
            <div className="mt-6 print:hidden">{action(it)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
