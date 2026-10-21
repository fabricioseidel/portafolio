import { formatPath, loadSite, parseSite } from '@/core/define';
import { SECTION_TYPES } from '@/core/schema';
import { newSection, SECTION_TEMPLATES } from '@/core/templates';

const minimal = {
  meta: { title: 'Test', description: 'desc' },
  brand: { name: 'Test' },
  sections: [{ type: 'hero', id: 'inicio', headline: ['Hola'] }],
};

describe('esquema', () => {
  it('aplica valores por defecto', () => {
    const r = parseSite(minimal);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.site.locales).toEqual(['es']);
    expect(r.site.theme).toMatchObject({ preset: 'modernist', radius: 0, mode: 'system' });
    expect(r.site.features).toEqual({ buddy: true, inspector: true, admin: true, tagFilter: true });
    expect(r.site.brand.mark).toBe('.');
  });

  it('rechaza ids repetidos e inválidos con rutas legibles', () => {
    const r = parseSite({
      ...minimal,
      sections: [
        { type: 'hero', id: 'inicio', headline: ['A'] },
        { type: 'text', id: 'inicio', body: ['x'] },
        { type: 'text', id: 'Con Espacios', body: ['x'] },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const paths = r.issues.map((i) => i.path);
    expect(paths).toContain('sections[2] (Con Espacios) › id');
    expect(r.issues.some((i) => i.message.includes('id repetido'))).toBe(true);
  });

  it('rechaza tipos de sección desconocidos', () => {
    const r = parseSite({ ...minimal, sections: [{ type: 'carrusel', id: 'x' }] });
    expect(r.ok).toBe(false);
  });

  it('valida colores de acento', () => {
    expect(parseSite({ ...minimal, theme: { accent: 'rojo' } }).ok).toBe(false);
    expect(parseSite({ ...minimal, theme: { accent: '#ff0000' } }).ok).toBe(true);
  });

  it('loadSite lanza un error con todos los problemas', () => {
    expect(() => loadSite({ ...minimal, sections: [] })).toThrow(/content\/site\.json no es válido/);
  });

  it('bloquea enlaces que ejecutan código', () => {
    const hero = (href: string) => ({ ...minimal, sections: [{ type: 'hero', id: 'inicio', headline: ['A'], actions: [{ label: 'x', href }] }] });
    expect(parseSite(hero('javascript:alert(1)')).ok).toBe(false);
    expect(parseSite(hero(' JavaScript:alert(1)')).ok).toBe(false);
    expect(parseSite(hero('data:text/html,hola')).ok).toBe(false);
    expect(parseSite(hero('mailto:yo@correo.cl')).ok).toBe(true);
    expect(parseSite(hero('/cv/cv.pdf')).ok).toBe(true);
  });

  it('las descargas de archivo o enlace exigen href', () => {
    const dl = (item: object) => ({ ...minimal, sections: [{ type: 'download', id: 'descargas', items: [item] }] });
    expect(parseSite(dl({ kind: 'file', label: 'CV' })).ok).toBe(false);
    expect(parseSite(dl({ kind: 'file', label: 'CV', href: '/cv.pdf' })).ok).toBe(true);
    expect(parseSite(dl({ kind: 'zip', label: 'Código' })).ok).toBe(true);
  });

  it('los mensajes de error están en español', () => {
    const r = parseSite({ ...minimal, brand: {} });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.find((i) => i.path === 'brand › name')?.message).toMatch(/se esperaba/);
  });

  it('formatPath usa el id de la sección', () => {
    expect(formatPath(['sections', 0, 'items', 1, 'title'], minimal)).toBe('sections[0] (inicio) › items[1] › title');
  });
});

describe('plantillas de sección', () => {
  it('existe una plantilla válida para cada tipo', () => {
    expect(Object.keys(SECTION_TEMPLATES).sort()).toEqual([...SECTION_TYPES].sort());
    for (const type of SECTION_TYPES) {
      const r = parseSite({ ...minimal, sections: [newSection(type, [])] });
      expect(r.ok, type).toBe(true);
    }
  });

  it('genera ids únicos', () => {
    expect(newSection('text', ['text', 'text-2']).id).toBe('text-3');
  });
});
