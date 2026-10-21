// Copia las imágenes y archivos de tu carpeta de contenido (CONTENT_DIR/public/*) a public/ para verlos en local.
// Esos archivos quedan fuera de git SOLO en esta copia (.git/info/exclude), así nunca se suben por accidente.
// Uso: npm run content:sync   (CONTENT_DIR sale del entorno o de .env.local)
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

function readEnvLocal() {
  if (!existsSync('.env.local')) return {};
  return Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*?)"?\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
}

const dir = process.env.CONTENT_DIR || readEnvLocal().CONTENT_DIR;
if (!dir) {
  console.error('Define CONTENT_DIR (variable de entorno o .env.local) con la carpeta de tu contenido.');
  process.exit(1);
}
const source = path.join(path.resolve(dir), 'public');
if (!existsSync(source)) {
  console.log(`No hay ${source}: nada que copiar.`);
  process.exit(0);
}

const tracked = (p) => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', p], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

mkdirSync('public', { recursive: true });
const excludeFile = path.join('.git', 'info', 'exclude');
const known = existsSync(excludeFile) ? readFileSync(excludeFile, 'utf8').split(/\r?\n/) : [];
for (const entry of readdirSync(source)) {
  const target = path.join('public', entry);
  if (tracked(target)) {
    console.error(`public/${entry} ya está en git: no se sobrescribe. Renómbralo en tu carpeta de contenido.`);
    process.exit(1);
  }
  cpSync(path.join(source, entry), target, { recursive: true });
  const rule = `/public/${entry}`;
  if (!known.includes(rule) && existsSync('.git')) {
    mkdirSync(path.dirname(excludeFile), { recursive: true });
    appendFileSync(excludeFile, `${rule}\n`);
  }
  console.log(`public/${entry} ← ${path.join(source, entry)}`);
}
