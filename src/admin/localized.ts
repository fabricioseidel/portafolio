/**
 * Lectura y escritura de textos traducibles (`'Hola'` o `{ es: 'Hola', en: 'Hi' }`) desde los formularios.
 *
 * Regla: un string simple significa "igual en todos los idiomas". Si se escribe una traducción,
 * el valor pasa a objeto; si se borran todas las traducciones menos la principal, vuelve a string.
 */
type LValue = string | Record<string, string> | undefined;
type LListValue = string[] | Record<string, string[]> | undefined;

function asRecord(value: LValue, defaultLocale: string): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value === 'string') return value ? { [defaultLocale]: value } : {};
  return { ...value };
}

/** Texto de un idioma. Un string simple pertenece al idioma principal. */
export function readL(value: LValue, locale: string, defaultLocale: string): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return locale === defaultLocale ? value : '';
  return value[locale] ?? '';
}

export function writeL(value: LValue, locale: string, text: string, locales: string[], defaultLocale: string): string | Record<string, string> {
  const record = asRecord(value, defaultLocale);
  if (text) record[locale] = text;
  else delete record[locale];
  const keys = Object.keys(record);
  if (locales.length <= 1) return record[defaultLocale] ?? Object.values(record)[0] ?? '';
  if (keys.length === 0) return '';
  if (keys.length === 1 && keys[0] === defaultLocale) return record[defaultLocale];
  return record;
}

/** Idiomas del sitio sin traducción propia en un valor que ya está traducido parcialmente. */
export function missingLocales(value: LValue, locales: string[]): string[] {
  if (value === undefined || typeof value === 'string') return [];
  return locales.filter((l) => !value[l]);
}

export function readLList(value: LListValue, locale: string, defaultLocale: string): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return locale === defaultLocale ? value : [];
  return value[locale] ?? [];
}

export function writeLList(value: LListValue, locale: string, items: string[], locales: string[], defaultLocale: string): string[] | Record<string, string[]> {
  const record: Record<string, string[]> = value === undefined ? {} : Array.isArray(value) ? (value.length ? { [defaultLocale]: value } : {}) : { ...value };
  if (items.length) record[locale] = items;
  else delete record[locale];
  const keys = Object.keys(record);
  if (locales.length <= 1) return record[defaultLocale] ?? Object.values(record)[0] ?? [];
  if (keys.length === 0) return [];
  if (keys.length === 1 && keys[0] === defaultLocale) return record[defaultLocale];
  return record;
}

export function missingLocalesList(value: LListValue, locales: string[]): string[] {
  if (value === undefined || Array.isArray(value)) return [];
  return locales.filter((l) => !value[l]?.length);
}
