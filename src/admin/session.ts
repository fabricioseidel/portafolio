/**
 * Token de GitHub del dueño. Siempre se guarda en la pestaña (sessionStorage); con "recordar",
 * también en el navegador (localStorage) para no pedirlo en la próxima visita.
 */
const KEY = 'portafolio:gh-token';

type Area = 'sessionStorage' | 'localStorage';

function read(area: Area): string | null {
  try {
    return window[area].getItem(KEY);
  } catch {
    return null;
  }
}

function write(area: Area, value: string | null): void {
  try {
    if (value === null) window[area].removeItem(KEY);
    else window[area].setItem(KEY, value);
  } catch {
    /* modo privado o almacenamiento bloqueado: se ignora */
  }
}

export function saveToken(token: string, remember: boolean): void {
  const value = token.trim();
  if (!value) return clearToken();
  write('sessionStorage', value);
  write('localStorage', remember ? value : null);
}

export function loadToken(): { token: string; remembered: boolean } | null {
  const session = read('sessionStorage');
  const local = read('localStorage');
  if (session) return { token: session, remembered: session === local };
  return local ? { token: local, remembered: true } : null;
}

export function clearToken(): void {
  write('sessionStorage', null);
  write('localStorage', null);
}
