import type { Theme } from './schema';

type Palette = { bg: string; surface: string; text: string; accent: string };
type Preset = { font: NonNullable<Theme['font']>; light: Palette; dark: Palette };

/** Para crear un tema nuevo: agrega una entrada aquí y su nombre a PRESETS en schema.ts. */
export const THEME_PRESETS: Record<Theme['preset'], Preset> = {
  modernist: {
    font: 'archivo',
    light: { bg: '#f3f2f2', surface: '#eae9e9', text: '#201e1d', accent: '#ec3013' },
    dark: { bg: '#2d2b2b', surface: '#383535', text: '#f8f4f4', accent: '#ff563c' },
  },
  paper: {
    font: 'fraunces',
    light: { bg: '#f6f1e7', surface: '#ece4d4', text: '#2b2620', accent: '#2f6b4f' },
    dark: { bg: '#1f1c18', surface: '#2a2621', text: '#efe7d8', accent: '#7fc6a0' },
  },
  midnight: {
    font: 'inter',
    light: { bg: '#f5f7fa', surface: '#e8edf3', text: '#0e1116', accent: '#1f6feb' },
    dark: { bg: '#0e1116', surface: '#161b22', text: '#e6edf3', accent: '#7ee787' },
  },
};

const FONT_VARS: Record<NonNullable<Theme['font']>, string> = {
  archivo: 'var(--font-archivo), system-ui, sans-serif',
  inter: 'var(--font-inter), system-ui, sans-serif',
  fraunces: 'var(--font-fraunces), Georgia, serif',
  mono: 'var(--font-jetbrains), ui-monospace, monospace',
};

/** Texto legible sobre un fondo dado (blanco o casi negro), según luminancia WCAG. */
export function inkFor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#141414' : '#ffffff';
}

export function themeVars(theme: Theme, mode: 'light' | 'dark'): Record<string, string> {
  const preset = THEME_PRESETS[theme.preset];
  const p = preset[mode];
  const accent = theme.accent ?? p.accent;
  const font = theme.font ?? preset.font;
  return {
    '--fk-bg': p.bg,
    '--fk-surface': p.surface,
    '--fk-text': p.text,
    '--fk-accent': accent,
    '--fk-accent-ink': inkFor(accent),
    '--fk-kicker': `color-mix(in srgb, ${accent} ${mode === 'dark' ? 85 : 72}%, ${p.text})`,
    '--fk-line': `color-mix(in srgb, ${p.text} 38%, transparent)`,
    '--fk-muted': `color-mix(in srgb, ${p.text} 64%, transparent)`,
    '--fk-font-heading': FONT_VARS[font],
    '--fk-font-body': font === 'fraunces' ? FONT_VARS.inter : FONT_VARS[font],
    '--fk-radius': `${theme.radius}px`,
  };
}

const decl = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');

/**
 * CSS con ambas paletas para un contenedor. Sin `data-mode` sigue al sistema;
 * con `data-mode="light|dark"` manda la elección del visitante. Sin parpadeo al cargar.
 */
export function themeCss(scope: string, theme: Theme): string {
  const light = decl(themeVars(theme, 'light'));
  const dark = decl(themeVars(theme, 'dark'));
  return [
    `${scope}{${light}color-scheme:light}`,
    `@media (prefers-color-scheme: dark){${scope}:not([data-mode="light"]){${dark}color-scheme:dark}}`,
    `${scope}[data-mode="dark"]{${dark}color-scheme:dark}`,
    // "Guardar como PDF" siempre en claro, aunque el visitante esté en modo oscuro.
    `@media print{${scope},${scope}[data-mode]{${light}color-scheme:light}}`,
  ].join('\n');
}
