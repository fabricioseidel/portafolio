'use client';

import { useEffect } from 'react';
import { sourceUrl } from '@/core/repo';
import { componentName, registry } from '@/sections/registry';
import { useSite } from './SiteContext';
import { buttonClass, CodeBlock } from './ui';

/** Panel lateral del modo "</> Código": qué componente dibuja la sección y con qué datos. */
export function InspectorDrawer() {
  const { site, inspected, inspect, u, embedded, repo, asset } = useSite();

  useEffect(() => {
    if (!inspected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && inspect(null);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [inspected, inspect]);

  if (!inspected) return null;
  const file = registry[inspected.type].file;
  const configIndex = site.sections.findIndex((s) => s.id === inspected.id);
  const source = repo ? sourceUrl(repo, file) : null;

  return (
    <aside
      role="dialog"
      aria-label={`${componentName(inspected.type)} #${inspected.id}`}
      data-nobuddy="1"
      className="fixed inset-y-0 right-0 z-50 flex w-[min(560px,100%)] flex-col border-l-2 border-line bg-bg shadow-2xl print:hidden"
    >
      <header className="flex items-center justify-between gap-3 border-b-2 border-line px-5 py-3">
        <p className="font-code text-sm">
          {`<${componentName(inspected.type)} />`} <span className="text-muted">#{inspected.id}</span>
        </p>
        <button type="button" onClick={() => inspect(null)} className={buttonClass('ghost')}>
          {u('close')} ✕
        </button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">{u('component')}</dt>
          <dd className="m-0 font-code">{componentName(inspected.type)}</dd>
          <dt className="text-muted">{u('file')}</dt>
          <dd className="m-0 font-code">
            {source ? (
              <a href={source} target="_blank" rel="noopener noreferrer" className="border-b-2 border-accent hover:text-accent">
                {file} ↗
              </a>
            ) : (
              file
            )}
          </dd>
          <dt className="text-muted">Config</dt>
          <dd className="m-0 font-code">content/site.json › sections[{configIndex}]</dd>
        </dl>
        <div>
          <p className="mb-2 text-[13px] uppercase tracking-[0.08em] text-kicker">{u('config')}</p>
          <CodeBlock code={JSON.stringify(inspected, null, 2)} filename={`sections[${configIndex}].json`} />
        </div>
        <div className="flex flex-wrap gap-3">
          {source && (
            <a href={source} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
              {u('source')} ↗
            </a>
          )}
          {site.features.admin && !embedded && (
            <a href={`${asset('/admin/')}?section=${encodeURIComponent(inspected.id)}`} className={buttonClass('primary')}>
              {u('editInPanel')}
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
