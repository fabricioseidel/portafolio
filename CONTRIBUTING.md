# Contribuir a folio-kit

¡Gracias por sumarte! Este proyecto busca que cualquier persona, de cualquier área, tenga un buen portafolio editando un solo archivo.

## Antes de abrir un PR

```bash
npm install
npm run check      # tipos + lint + tests + build
npm run e2e        # opcional: pruebas en navegador
```

La CI corre lo mismo en cada pull request.

## Qué tipo de aportes buscamos

- **Secciones nuevas** que sirvan a varias profesiones (testimonios, publicaciones, precios, FAQ…). Sigue los 4 pasos de “Crear un tipo de sección nuevo” en el README e incluye un test.
- **Temas** nuevos en `src/core/theme.ts`, con buen contraste en claro y oscuro.
- **Traducciones de la interfaz** en `src/core/i18n.ts` (objeto `UI`).
- **Ejemplos** de perfiles en `content/examples/`. Usa personas ficticias y regístralos en `content/examples/index.ts`.
- Mejoras de accesibilidad y rendimiento.

## Convenciones

- El contenido nunca va dentro de los componentes: todo texto visible sale de `content/` o del diccionario `UI`.
- Los componentes usan los tokens del tema (`bg-bg`, `text-fg`, `border-line`, `text-accent`…), no colores fijos.
- Todo campo nuevo del esquema debe tener valor por defecto o ser opcional, para no romper los portafolios existentes.
- Commits y PRs en español o inglés, cortos y en imperativo: “Agrega sección de testimonios”.
