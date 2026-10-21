import { missingLocales, missingLocalesList, readL, readLList, writeL, writeLList } from '@/admin/localized';
import { contentRepoInfo, parseRepo, repoInfo, sameRepo, sourceUrl, templateUrl, zipUrl } from '@/core/repo';
import { asset, isDownloadable, isImagePath, safeHref } from '@/core/utils';

const L = ['es', 'en'];

describe('textos traducibles en el panel', () => {
  it('un string simple pertenece al idioma principal', () => {
    expect(readL('Hola', 'es', 'es')).toBe('Hola');
    expect(readL('Hola', 'en', 'es')).toBe('');
    expect(readL({ es: 'Hola', en: 'Hi' }, 'en', 'es')).toBe('Hi');
    expect(readL(undefined, 'es', 'es')).toBe('');
  });

  it('escribir solo el idioma principal mantiene un string', () => {
    expect(writeL(undefined, 'es', 'Hola', L, 'es')).toBe('Hola');
    expect(writeL('Hola', 'es', 'Chao', L, 'es')).toBe('Chao');
  });

  it('agregar una traducción convierte a objeto y quitarla vuelve a string', () => {
    const both = writeL('Hola', 'en', 'Hi', L, 'es');
    expect(both).toEqual({ es: 'Hola', en: 'Hi' });
    expect(writeL(both, 'en', '', L, 'es')).toBe('Hola');
  });

  it('con un solo idioma siempre guarda string', () => {
    expect(writeL({ es: 'Hola', en: 'Hi' }, 'es', 'Buenas', ['es'], 'es')).toBe('Buenas');
  });

  it('vaciar todo deja un string vacío', () => {
    expect(writeL('Hola', 'es', '', L, 'es')).toBe('');
  });

  it('detecta traducciones faltantes solo en valores ya traducidos', () => {
    expect(missingLocales('Hola', L)).toEqual([]);
    expect(missingLocales({ es: 'Hola' }, L)).toEqual(['en']);
    expect(missingLocales({ es: 'Hola', en: '' }, L)).toEqual(['en']);
  });

  it('listas traducibles siguen la misma regla', () => {
    expect(readLList(['a'], 'es', 'es')).toEqual(['a']);
    expect(readLList(['a'], 'en', 'es')).toEqual([]);
    const both = writeLList(['a'], 'en', ['b'], L, 'es');
    expect(both).toEqual({ es: ['a'], en: ['b'] });
    expect(writeLList(both, 'en', [], L, 'es')).toEqual(['a']);
    expect(missingLocalesList({ es: ['a'], en: [] }, L)).toEqual(['en']);
  });
});

describe('repositorio', () => {
  it('reconoce URLs y slugs de GitHub', () => {
    expect(parseRepo('https://github.com/usuario/portafolio')).toEqual({ owner: 'usuario', name: 'portafolio' });
    expect(parseRepo('https://github.com/usuario/portafolio.git')).toEqual({ owner: 'usuario', name: 'portafolio' });
    expect(parseRepo('usuario/mi.sitio')).toEqual({ owner: 'usuario', name: 'mi.sitio' });
    expect(parseRepo('no es un repo')).toBeNull();
  });

  it('arma los enlaces de descarga, plantilla y código', () => {
    const r = repoInfo({ repo: { url: 'https://github.com/usuario/portafolio', branch: 'main' } })!;
    expect(zipUrl(r)).toBe('https://github.com/usuario/portafolio/archive/refs/heads/main.zip');
    expect(templateUrl(r)).toBe('https://github.com/usuario/portafolio/generate');
    expect(sourceUrl(r, 'src/sections/Hero.tsx')).toBe('https://github.com/usuario/portafolio/blob/main/src/sections/Hero.tsx');
  });

  it('la variable de entorno del workflow manda sobre el contenido (forks)', () => {
    vi.stubEnv('NEXT_PUBLIC_GITHUB_REPOSITORY', 'otra-persona/su-portafolio');
    vi.stubEnv('NEXT_PUBLIC_GITHUB_BRANCH', 'principal');
    expect(repoInfo({ repo: { url: 'https://github.com/usuario/portafolio', branch: 'main' } })).toMatchObject({
      owner: 'otra-persona',
      name: 'su-portafolio',
      branch: 'principal',
    });
    vi.unstubAllEnvs();
  });

  it('sin repo no hay enlaces', () => {
    expect(repoInfo({})).toBeNull();
  });
});

describe('enlaces', () => {
  it('nunca pinta javascript:', () => {
    expect(safeHref('javascript:alert(1)')).toBe('#');
    expect(safeHref('  JAVASCRIPT:alert(1)')).toBe('#');
    expect(safeHref('https://github.com')).toBe('https://github.com');
  });

  it('distingue archivos descargables e imágenes', () => {
    expect(isDownloadable('/cv/cv.pdf')).toBe(true);
    expect(isDownloadable('/certs/sql.webp')).toBe(false);
    expect(isImagePath('/certs/sql.webp')).toBe(true);
    expect(isImagePath('https://sitio.cl/foto.JPG?x=1')).toBe(true);
  });

  it('el basePath solo se aplica a rutas locales', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/portafolio');
    expect(asset('/images/a.webp')).toBe('/portafolio/images/a.webp');
    expect(asset('https://x.cl/a.webp')).toBe('https://x.cl/a.webp');
    expect(asset('//cdn.x.cl/a.webp')).toBe('//cdn.x.cl/a.webp');
    vi.unstubAllEnvs();
  });
});

describe('contenido en otro repositorio', () => {
  const code = { owner: 'usuario', name: 'portafolio', branch: 'main', url: 'https://github.com/usuario/portafolio' };

  it('sin variable, el contenido vive en el repo del código', () => {
    expect(contentRepoInfo(code)).toBe(code);
    expect(contentRepoInfo(null)).toBeNull();
  });

  it('con NEXT_PUBLIC_CONTENT_REPOSITORY apunta al repo aparte', () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_REPOSITORY', 'usuario/portafolio-contenido');
    const content = contentRepoInfo(code)!;
    expect(content).toMatchObject({ owner: 'usuario', name: 'portafolio-contenido', branch: 'main', url: 'https://github.com/usuario/portafolio-contenido' });
    expect(sameRepo(code, content)).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_CONTENT_BRANCH', 'datos');
    expect(contentRepoInfo(code)!.branch).toBe('datos');
    vi.unstubAllEnvs();
  });

  it('sameRepo ignora mayúsculas y null', () => {
    expect(sameRepo(code, { ...code, owner: 'USUARIO' })).toBe(true);
    expect(sameRepo(code, null)).toBe(false);
  });
});
