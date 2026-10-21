import { parseSite } from '@/core/define';
import { highlight } from '@/core/highlight';
import { formatDate, resolve, resolveList, uiText } from '@/core/i18n';
import { normTag, tagUsage } from '@/core/tags';
import { inkFor, themeCss, themeVars } from '@/core/theme';
import { ThemeSchema } from '@/core/schema';

describe('i18n', () => {
  it('resuelve textos con respaldo', () => {
    expect(resolve('hola', 'en', 'es')).toBe('hola');
    expect(resolve({ es: 'hola', en: 'hi' }, 'en', 'es')).toBe('hi');
    expect(resolve({ es: 'hola' }, 'pt', 'es')).toBe('hola');
    expect(resolve({ en: 'hi' }, 'pt', 'es')).toBe('hi');
    expect(resolveList({ es: ['a'], en: ['b'] }, 'en', 'es')).toEqual(['b']);
    expect(resolveList(undefined, 'es', 'es')).toEqual([]);
  });

  it('usa inglés para idiomas sin diccionario de interfaz', () => {
    expect(uiText('es', 'menu')).toBe('Menú');
    expect(uiText('de', 'menu')).toBe('Menu');
  });

  it('formatea fechas', () => {
    expect(formatDate('2025-05-08', 'es')).toBe('8 may 2025');
    expect(formatDate('2025-05-08', 'en')).toBe('May 8, 2025');
  });
});

describe('tags', () => {
  it.each([
    ['Next.js (App Router)', 'next.js'],
    ['Next.js 15', 'next.js'],
    ['React 19', 'react'],
    ['JavaScript ES6+', 'javascript'],
    ['GitHub Actions (CI/CD)', 'github actions'],
    ['Supabase (Auth, Storage, RLS, RPC)', 'supabase'],
    ['HTML5', 'html5'],
  ])('normTag(%s) = %s', (input, out) => expect(normTag(input)).toBe(out));

  it('tagUsage encuentra proyectos y experiencia', () => {
    const r = parseSite({
      meta: { title: 't', description: 'd' },
      brand: { name: 'n' },
      sections: [
        { type: 'projects', id: 'p', items: [{ title: 'Uno', description: 'x', tags: ['React 19'] }] },
        { type: 'timeline', id: 't', items: [{ period: '2024', title: 'Dos', tags: ['react'] }] },
        { type: 'projects', id: 'oculto', hidden: true, items: [{ title: 'Tres', description: 'x', tags: ['React'] }] },
      ],
    });
    if (!r.ok) throw new Error('fixture inválido');
    expect(tagUsage(r.site, 'es').get('react')).toEqual([
      { title: 'Uno', anchor: 'p-0' },
      { title: 'Dos', anchor: 't-0' },
    ]);
  });
});

describe('tema', () => {
  const theme = ThemeSchema.parse({});

  it('elige texto legible sobre el acento', () => {
    expect(inkFor('#ec3013')).toBe('#ffffff');
    expect(inkFor('#7ee787')).toBe('#141414');
  });

  it('el acento personalizado reemplaza al del preset', () => {
    expect(themeVars({ ...theme, accent: '#123456' }, 'light')['--fk-accent']).toBe('#123456');
    expect(themeVars(theme, 'dark')['--fk-bg']).toBe('#2d2b2b');
  });

  it('genera CSS para claro, oscuro de sistema y oscuro forzado', () => {
    const css = themeCss('[data-fk="x"]', theme);
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain('[data-fk="x"][data-mode="dark"]');
  });
});

describe('highlight', () => {
  it('reconoce comentarios, strings, claves y palabras clave', () => {
    const kinds = (code: string) => highlight(code).filter((t) => t.kind !== 'plain').map((t) => [t.kind, t.text]);
    expect(kinds("const a = 'x'; // nota")).toEqual([
      ['keyword', 'const'],
      ['string', "'x'"],
      ['comment', '// nota'],
    ]);
    expect(kinds('{ "radius": 12 }')).toEqual([
      ['key', '"radius"'],
      ['number', '12'],
    ]);
  });

  it('no pierde texto', () => {
    const code = 'export default defineSite({ id: "x" }); /* fin */';
    expect(highlight(code).map((t) => t.text).join('')).toBe(code);
  });
});
