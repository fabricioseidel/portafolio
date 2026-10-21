/**
 * Descripción declarativa de los formularios del panel. `src/admin/spec.ts` la usa para
 * describir cada tipo de sección; `src/admin/Form.tsx` la dibuja.
 */
type Base = {
  /** Clave dentro del objeto que se edita. */
  key: string;
  label: string;
  help?: string;
};

export type Field =
  /** Texto de una línea (sin traducción): ids, años, rutas. */
  | (Base & { kind: 'text'; placeholder?: string })
  /** Enlace o archivo. Con `upload` muestra un botón para subir un archivo y guarda su ruta pública. */
  | (Base & { kind: 'url'; placeholder?: string; upload?: 'image' | 'file' })
  /** Fecha ISO `AAAA-MM-DD`. */
  | (Base & { kind: 'date' })
  /** Código fuente (monoespaciado, sin traducción). */
  | (Base & { kind: 'code' })
  /** Color `#rrggbb`; vacío = sin valor. */
  | (Base & { kind: 'color' })
  /** Texto traducible de una línea. */
  | (Base & { kind: 'ltext'; placeholder?: string })
  /** Texto traducible de varias líneas. */
  | (Base & { kind: 'ltextarea'; placeholder?: string; rows?: number })
  /** Lista traducible de textos, un elemento por línea. */
  | (Base & { kind: 'llist'; placeholder?: string })
  /** Lista de textos sin traducción, un elemento por línea. */
  | (Base & { kind: 'lines'; placeholder?: string })
  /** Etiquetas (tecnologías, herramientas). */
  | (Base & { kind: 'tags'; placeholder?: string })
  | (Base & { kind: 'select'; options: { value: string; label: string }[]; allowEmpty?: string })
  | (Base & { kind: 'checkbox' })
  | (Base & { kind: 'number'; min?: number; max?: number; step?: number })
  /** Ruta de una imagen con botón de subida y miniatura. */
  | (Base & { kind: 'image'; optional?: boolean })
  /** Lista de objetos: tarjetas plegables que se pueden ordenar, duplicar y borrar. */
  | (Base & {
      kind: 'list';
      item: Field[];
      /** Título de cada tarjeta. */
      itemTitle: (item: Record<string, unknown>, locale: string) => string;
      newItem: () => Record<string, unknown>;
      min?: number;
    })
  /** Objeto anidado opcional o fijo. */
  | (Base & { kind: 'object'; fields: Field[]; optional?: boolean; create?: () => Record<string, unknown> })
  /** Objeto con variantes según un discriminador (p. ej. media: imagen o código). */
  | (Base & {
      kind: 'variant';
      discriminator: string;
      optional?: boolean;
      variants: { value: string; label: string; fields: Field[]; create: () => Record<string, unknown> }[];
    });

export type FieldKind = Field['kind'];

/** Problema de validación con su ruta (claves y posiciones) dentro del objeto editado. */
export type FieldIssue = { path: (string | number)[]; message: string };

/** Lo que los campos necesitan del panel, aparte de su propio valor. */
export type FormContext = {
  locales: string[];
  defaultLocale: string;
  /** Sube un archivo y devuelve la ruta pública que se guarda en el contenido. */
  upload: (file: File, kind: 'image' | 'file') => Promise<string>;
  /** Convierte una ruta del contenido en una URL visible (incluye archivos aún no publicados). */
  resolveAsset: (src: string) => string;
  /** Problemas de validación relativos al objeto raíz del formulario. */
  issues: FieldIssue[];
  /** Tecnologías ya usadas en el sitio, para autocompletar etiquetas. */
  tagSuggestions: string[];
};
