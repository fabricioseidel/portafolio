import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { examples } from '@content/examples';
import { SiteRenderer } from '@/components/SiteRenderer';
import { loadSite } from '@/core/define';
import type { SiteInput } from '@/core/schema';

const load = (input: SiteInput) => loadSite({ ...input, features: { ...input.features, buddy: false } });

describe('SiteRenderer', () => {
  it.each(Object.entries(examples))('dibuja todas las secciones visibles de "%s"', (_k, { site }) => {
    const parsed = load(site);
    const { container } = render(<SiteRenderer site={parsed} />);
    const ids = parsed.sections.filter((s) => !s.hidden).map((s) => s.id);
    expect([...container.querySelectorAll('section[data-section]')].map((s) => s.id)).toEqual(ids);
  });

  it('numera las secciones con título y cambia de idioma', async () => {
    render(<SiteRenderer site={load(examples.demo.site)} />);
    expect(screen.getByText(/01 — Proyectos/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'en' })[0]);
    expect(screen.getByText(/01 — Projects/)).toBeInTheDocument();
  });

  it('el inspector muestra el componente, el archivo y la configuración', async () => {
    render(<SiteRenderer site={load(examples.demo.site)} />);
    await userEvent.click(screen.getAllByRole('button', { name: '</> Código' })[0]);
    await userEvent.click(screen.getByRole('button', { name: /<Skills \/> #stack/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText(/src\/sections\/Skills\.tsx/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/"type"/)).toBeInTheDocument();
    expect(within(dialog).getByText(/content\/site\.json/)).toBeInTheDocument();
  });

  it('al tocar una tecnología se atenúan los proyectos que no la usan', async () => {
    const { container } = render(<SiteRenderer site={load(examples.demo.site)} />);
    const stack = container.querySelector('#stack')!;
    // Playwright lo usan la app de reservas (1) y este portafolio (2), pero no la tienda (0).
    await userEvent.click(within(stack as HTMLElement).getByRole('button', { name: /^Playwright/ }));
    expect(screen.getByRole('status')).toHaveTextContent(/Filtrando por Playwright/);
    expect(container.querySelector('#proyectos-0')).toHaveClass('opacity-25');
    expect(container.querySelector('#proyectos-1')).not.toHaveClass('opacity-25');
    expect(container.querySelector('#proyectos-2')).not.toHaveClass('opacity-25');
  });

  it('respeta las funciones desactivadas', () => {
    const site = load({ ...examples.demo.site, features: { inspector: false, tagFilter: false } });
    render(<SiteRenderer site={site} />);
    expect(screen.queryByRole('button', { name: '</> Código' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Zod/ })).not.toBeInTheDocument();
  });
});

describe('certificaciones', () => {
  it('abre el certificado en un visor dentro de la página', async () => {
    const { container } = render(<SiteRenderer site={load(examples.demo.site)} />);
    const section = container.querySelector('#certificaciones') as HTMLElement;
    const link = within(section).getByRole('link', { name: /Desarrolladora Full Stack JavaScript/ });
    expect(link).toHaveAttribute('href', '/examples/certificado-1.svg');
    await userEvent.click(link);
    const dialog = container.querySelector('dialog[aria-label="Desarrolladora Full Stack JavaScript"]') as HTMLElement;
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/examples/certificado-1.svg');
  });

  it('solo los elementos con certificado son enlaces', () => {
    const { container } = render(<SiteRenderer site={load(examples.demo.site)} />);
    const hrefs = [...container.querySelectorAll<HTMLAnchorElement>('#certificaciones a')].map((a) => a.getAttribute('href'));
    // 2 destacados + 2 módulos con imagen; "React" no tiene certificado y no es un enlace.
    expect(hrefs).toHaveLength(4);
    expect(hrefs.every((h) => /.svg$/.test(h ?? ''))).toBe(true);
  });
});

describe('descargas', () => {
  it('ofrece el CV, el zip del repositorio, la plantilla y la versión PDF', () => {
    const { container } = render(<SiteRenderer site={load(examples.demo.site)} />);
    const section = container.querySelector('#descargar') as HTMLElement;
    const cv = within(section).getByRole('link', { name: /^Descargar ↓$/ });
    expect(cv).toHaveAttribute('href', '/examples/cv-ejemplo.pdf');
    expect(cv).toHaveAttribute('download');
    expect(within(section).getByRole('link', { name: /Descargar \.zip/ })).toHaveAttribute(
      'href',
      'https://github.com/usuario/portafolio/archive/refs/heads/main.zip',
    );
    expect(within(section).getByRole('link', { name: /Usar plantilla/ })).toHaveAttribute('href', 'https://github.com/usuario/portafolio/generate');
    expect(within(section).getByRole('button', { name: /Guardar como PDF/ })).toBeInTheDocument();
  });

  it('sin repositorio no ofrece zip ni plantilla', () => {
    const withoutRepo = { ...examples.demo.site, repo: undefined };
    const { container } = render(<SiteRenderer site={load(withoutRepo as SiteInput)} />);
    const section = container.querySelector('#descargar') as HTMLElement;
    expect(within(section).queryByRole('link', { name: /\.zip/ })).not.toBeInTheDocument();
    expect(within(section).queryByRole('link', { name: /plantilla/i })).not.toBeInTheDocument();
  });
});
