'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolve, resolveList, uiText, type UIKey } from '@/core/i18n';
import { repoInfo, type RepoInfo } from '@/core/repo';
import type { LListValue, LStringValue, Section, Site } from '@/core/schema';
import { asset as publicAsset, storage } from '@/core/utils';

type Mode = 'light' | 'dark' | undefined;
type ActiveTag = { key: string; label: string } | null;

type SiteState = {
  site: Site;
  /** true dentro del panel (vista previa): sin muñeco ni preferencias guardadas. */
  embedded: boolean;
  /** Ruta del contenido → URL visible (en el panel incluye archivos aún no publicados). */
  asset: (src: string) => string;
  repo: RepoInfo | null;
  locale: string;
  setLocale: (l: string) => void;
  tr: (v: LStringValue) => string;
  trOpt: (v: LStringValue | undefined) => string | undefined;
  trList: (v: LListValue | undefined) => string[];
  u: (k: UIKey) => string;
  /** undefined = sigue al sistema operativo. */
  mode: Mode;
  isDark: boolean;
  toggleMode: () => void;
  inspector: boolean;
  setInspector: (on: boolean) => void;
  inspected: Section | null;
  inspect: (s: Section | null) => void;
  activeTag: ActiveTag;
  setActiveTag: (t: ActiveTag) => void;
  buddy: boolean;
  setBuddy: (on: boolean) => void;
};

const Ctx = createContext<SiteState | null>(null);

export function useSite(): SiteState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSite debe usarse dentro de <SiteProvider>');
  return ctx;
}

const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function SiteProvider({
  site,
  embedded = false,
  resolveAsset,
  children,
}: {
  site: Site;
  embedded?: boolean;
  resolveAsset?: (src: string) => string;
  children: ReactNode;
}) {
  const fallback = site.locales[0];
  const repo = useMemo(() => repoInfo(site), [site]);
  const [locale, setLocaleState] = useState(fallback);
  const [mode, setMode] = useState<Mode>(site.theme.mode === 'system' ? undefined : site.theme.mode);
  const [systemDark, setSystemDark] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [inspected, inspect] = useState<Section | null>(null);
  const [activeTag, setActiveTag] = useState<ActiveTag>(null);
  const [buddy, setBuddyState] = useState(site.features.buddy && !embedded);

  // Preferencias guardadas: se leen después de montar para no romper la hidratación.
  useEffect(() => {
    setSystemDark(prefersDark());
    if (embedded) return;
    const l = storage.get('fk:locale');
    if (l && site.locales.includes(l)) setLocaleState(l);
    else if (typeof navigator !== 'undefined') {
      const nav = navigator.language.slice(0, 2);
      if (site.locales.includes(nav)) setLocaleState(nav);
    }
    const m = storage.get('fk:mode');
    if (m === 'light' || m === 'dark') setMode(m);
    const b = storage.get('fk:buddy');
    if (site.features.buddy) setBuddyState(b ? b === 'on' : !prefersReducedMotion());
  }, [embedded, site.locales, site.features.buddy]);

  useEffect(() => {
    if (!site.locales.includes(locale)) setLocaleState(fallback);
  }, [site.locales, locale, fallback]);

  useEffect(() => {
    if (!embedded) document.documentElement.lang = locale;
  }, [locale, embedded]);

  const setLocale = useCallback(
    (l: string) => {
      setLocaleState(l);
      if (!embedded) storage.set('fk:locale', l);
    },
    [embedded],
  );

  const isDark = mode ? mode === 'dark' : systemDark;
  const toggleMode = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    setMode(next);
    if (!embedded) storage.set('fk:mode', next);
  }, [isDark, embedded]);

  const setBuddy = useCallback(
    (on: boolean) => {
      setBuddyState(on);
      if (!embedded) storage.set('fk:buddy', on ? 'on' : 'off');
    },
    [embedded],
  );

  const value = useMemo<SiteState>(
    () => ({
      site,
      embedded,
      asset: resolveAsset ?? publicAsset,
      repo,
      locale,
      setLocale,
      tr: (v) => resolve(v, locale, fallback),
      trOpt: (v) => resolve(v, locale, fallback),
      trList: (v) => resolveList(v, locale, fallback),
      u: (k) => uiText(locale, k),
      mode,
      isDark,
      toggleMode,
      inspector,
      setInspector: (on) => {
        setInspector(on);
        if (!on) inspect(null);
      },
      inspected,
      inspect,
      activeTag,
      setActiveTag,
      buddy,
      setBuddy,
    }),
    [site, embedded, resolveAsset, repo, locale, setLocale, fallback, mode, isDark, toggleMode, inspector, inspected, activeTag, buddy, setBuddy],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
