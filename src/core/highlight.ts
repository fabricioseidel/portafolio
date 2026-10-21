export type Token = { kind: 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'key'; text: string };

const KEYWORDS =
  'const|let|var|function|return|if|else|await|async|export|default|import|from|type|interface|new|class|extends|for|of|in|true|false|null|undefined|try|catch|throw|satisfies|as';

const RE = new RegExp(
  [
    String.raw`(\/\/[^\n]*|\/\*[\s\S]*?\*\/)`, // 1 comentario
    String.raw`("(?:\\.|[^"\\])*"(?=\s*:))`, // 2 clave JSON
    String.raw`('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|` + '`(?:\\\\.|[^`\\\\])*`)', // 3 string
    String.raw`\b(\d+(?:\.\d+)?)\b`, // 4 número
    String.raw`\b(${KEYWORDS})\b`, // 5 palabra clave
  ].join('|'),
  'g',
);

const KINDS: Token['kind'][] = ['comment', 'key', 'string', 'number', 'keyword'];

/** Resaltado mínimo para TS/JS/JSON, sin dependencias. Suficiente para fragmentos cortos. */
export function highlight(code: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of code.matchAll(RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: 'plain', text: code.slice(last, idx) });
    const group = m.slice(1).findIndex((g) => g !== undefined);
    out.push({ kind: KINDS[group], text: m[0] });
    last = idx + m[0].length;
  }
  if (last < code.length) out.push({ kind: 'plain', text: code.slice(last) });
  return out;
}
