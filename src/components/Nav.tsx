'use client';

import { useState } from 'react';
import { cn } from '@/core/utils';
import { useSite } from './SiteContext';
import { buttonClass } from './ui';

export function Nav() {
  const { site, tr, u } = useSite();
  const [open, setOpen] = useState(false);
  const links = site.sections.filter((s) => !s.hidden && s.nav).map((s) => ({ href: `#${s.id}`, label: tr(s.nav!) }));

  const toTop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.currentTarget.closest('.fk-root')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="sticky top-0 z-40 border-b-2 border-line bg-bg print:hidden">
      <div className="flex min-h-[60px] items-center gap-4 px-[clamp(20px,5vw,72px)]">
        <a href="#top" onClick={toTop} className="mr-auto whitespace-nowrap font-heading text-lg font-extrabold tracking-[-0.01em]">
          {site.brand.name}
          <span className="text-accent">{site.brand.mark}</span>
        </a>
        <div className="hidden gap-7 text-[15px] @min-[1000px]:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-accent">
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden @min-[1000px]:flex">
          <Controls />
        </div>
        <button
          type="button"
          data-nobuddy="1"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={buttonClass('ghost', 'min-h-11 min-w-[88px] @min-[1000px]:hidden')}
        >
          {open ? u('close') : u('menu')}
        </button>
      </div>
      {open && (
        <div className="flex flex-col border-t-2 border-line px-[clamp(20px,5vw,72px)] pb-5 pt-2 @min-[1000px]:hidden">
          {links.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex min-h-[52px] items-center justify-between border-b-2 border-line font-heading text-[22px] font-extrabold tracking-[-0.01em]"
            >
              <span>{l.label}</span>
              <span className="font-body text-[13px] font-normal tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            </a>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Controls stacked />
          </div>
        </div>
      )}
    </nav>
  );
}

/** Idioma, tema, inspector y muñeco. En el menú móvil se ordenan en grilla como en el diseño original. */
function Controls({ stacked = false }: { stacked?: boolean }) {
  const { site, locale, setLocale, isDark, toggleMode, u, inspector, setInspector, buddy, setBuddy, embedded } = useSite();
  const variant = stacked ? 'secondary' : 'ghost';
  const extra = stacked ? 'min-h-11' : '';
  const showBuddy = site.features.buddy && !embedded;
  return (
    <>
      {site.locales.length > 1 && (
        <div className="flex" role="group" aria-label={u('language')}>
          {site.locales.map((l) => (
            <button
              key={l}
              type="button"
              data-nobuddy="1"
              aria-pressed={l === locale}
              onClick={() => setLocale(l)}
              className={buttonClass(l === locale ? 'primary' : 'ghost', cn('uppercase', stacked && 'min-h-11 flex-1'))}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      <button type="button" data-nobuddy="1" onClick={toggleMode} className={buttonClass(variant, extra)}>
        {isDark ? u('light') : u('dark')}
      </button>
      {site.features.inspector && (
        <button
          type="button"
          data-nobuddy="1"
          aria-pressed={inspector}
          onClick={() => setInspector(!inspector)}
          className={buttonClass(variant, cn(extra, 'font-code', stacked && !showBuddy && 'col-span-2'))}
        >
          {inspector ? u('codeOn') : u('code')}
        </button>
      )}
      {showBuddy && (
        <button
          type="button"
          data-nobuddy="1"
          aria-pressed={buddy}
          onClick={() => setBuddy(!buddy)}
          className={buttonClass(variant, cn(extra, stacked && !site.features.inspector && 'col-span-2'))}
        >
          {buddy ? u('buddyOn') : u('buddyOff')}
        </button>
      )}
    </>
  );
}
