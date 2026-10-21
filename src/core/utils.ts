export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Prefija el basePath (GitHub Pages) a rutas locales como `/images/foto.webp`. */
export function asset(src: string): string {
  return src.startsWith('/') && !src.startsWith('//') ? (process.env.NEXT_PUBLIC_BASE_PATH ?? '') + src : src;
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

/** mailto:, tel: y anclas no pasan por el basePath. */
export function isSpecialHref(href: string): boolean {
  return /^(mailto:|tel:|#)/.test(href);
}

/** Último filtro antes de pintar un enlace: nunca `javascript:` ni similares. */
export function safeHref(href: string): string {
  return /^\s*(javascript|vbscript|data):/i.test(href) ? '#' : href;
}

/** Archivos que conviene descargar en vez de abrir (CV, zip…). */
export function isDownloadable(href: string): boolean {
  return /\.(pdf|zip|docx?)($|[?#])/i.test(href);
}

export function isImagePath(href: string): boolean {
  return /\.(webp|png|jpe?g|gif|svg|avif)($|[?#])/i.test(href);
}

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* modo privado o almacenamiento bloqueado: se ignora */
    }
  },
};
