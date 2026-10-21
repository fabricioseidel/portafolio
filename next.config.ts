import path from 'node:path';
import type { NextConfig } from 'next';

// Export estático: el sitio se puede publicar en GitHub Pages, Vercel o cualquier hosting.
// En GitHub Pages el workflow define NEXT_PUBLIC_BASE_PATH=/<nombre-del-repo>.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// CONTENT_DIR: carpeta con tu contenido (content/site.json y public/) guardada fuera de este repo.
// Así el repo del código no lleva datos personales. Ver README › "Contenido privado".
const contentDir = process.env.CONTENT_DIR ? path.resolve(process.env.CONTENT_DIR) : '';

type WebpackConfig = { plugins: unknown[] };
type WebpackOptions = { webpack: { NormalModuleReplacementPlugin: new (pattern: RegExp, replacement: string) => unknown } };

const config: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  webpack(webpackConfig: WebpackConfig, { webpack }: WebpackOptions) {
    // Un alias no basta: Next resuelve antes los "paths" de tsconfig. Se reemplaza el módulo por su ruta absoluta.
    if (contentDir) {
      webpackConfig.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@content\/site\.json$/, path.join(contentDir, 'content', 'site.json')));
    }
    return webpackConfig;
  },
};

export default config;
