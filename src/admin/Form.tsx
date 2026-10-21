'use client';

import { useId, useState, type ReactNode } from 'react';
import { buttonClass } from '@/components/ui';
import { cn } from '@/core/utils';
import type { Field, FieldIssue, FormContext } from './fields';
import { missingLocales, missingLocalesList, readL, readLList, writeL, writeLList } from './localized';

type Obj = Record<string, unknown>;
type Path = (string | number)[];

const INPUT =
  'w-full rounded-fk border bg-surface px-2.5 py-1.5 text-sm text-fg focus-visible:outline-2 focus-visible:outline-accent';
const MONO = 'font-code text-xs';

/** Copia del objeto con la clave cambiada; si el valor queda vacío se elimina la clave. */
function put(obj: Obj, key: string, value: unknown): Obj {
  const next = { ...obj };
  if (value === undefined || value === '') delete next[key];
  else next[key] = value;
  return next;
}

const startsWith = (path: Path, prefix: Path) => prefix.every((p, i) => path[i] === p);
const sameAs = (path: Path, target: Path) => path.length === target.length && startsWith(path, target);

export function Form({ fields, value, onChange, ctx, path = [] }: { fields: Field[]; value: Obj; onChange: (next: Obj) => void; ctx: FormContext; path?: Path }) {
  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => (
        <FieldView key={f.key} field={f} obj={value} onChange={onChange} ctx={ctx} path={path} />
      ))}
    </div>
  );
}

function FieldView({ field, obj, onChange, ctx, path }: { field: Field; obj: Obj; onChange: (next: Obj) => void; ctx: FormContext; path: Path }) {
  const id = useId();
  const here: Path = [...path, field.key];
  const own = ctx.issues.filter((i) => sameAs(i.path, here));
  const inside = ctx.issues.filter((i) => startsWith(i.path, here));
  const bad = inside.length > 0;
  const set = (v: unknown) => onChange(put(obj, field.key, v));
  const raw = obj[field.key];

  const Label = ({ extra }: { extra?: ReactNode }) => (
    <div className="mb-1 flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-[13px] font-extrabold">
        {field.label}
      </label>
      {extra}
    </div>
  );
  const Help = () => (field.help ? <p className="mt-1 text-xs text-muted">{field.help}</p> : null);
  const Errors = () => (
    <>
      {own.map((i, n) => (
        <p key={n} role="alert" className="mt-1 text-xs text-accent">
          {i.message}
        </p>
      ))}
    </>
  );
  const border = bad ? 'border-accent' : 'border-line';

  switch (field.kind) {
    case 'text':
    case 'date':
    case 'color': {
      const type = field.kind === 'date' ? 'date' : 'text';
      const v = typeof raw === 'string' ? raw : '';
      return (
        <div>
          <Label />
          <div className="flex items-center gap-2">
            {field.kind === 'color' && (
              <input type="color" aria-label={`${field.label} (selector)`} value={/^#[0-9a-f]{6}$/i.test(v) ? v : '#888888'} onChange={(e) => set(e.target.value)} className="h-9 w-12 shrink-0 cursor-pointer rounded-fk border border-line bg-transparent" />
            )}
            <input id={id} type={type} value={v} placeholder={field.kind === 'text' || field.kind === 'color' ? (field as { placeholder?: string }).placeholder ?? (field.kind === 'color' ? '#ec3013' : undefined) : undefined} onChange={(e) => set(e.target.value)} className={cn(INPUT, border)} />
          </div>
          <Help />
          <Errors />
        </div>
      );
    }
    case 'number':
      return (
        <div>
          <Label />
          <input id={id} type="number" min={field.min} max={field.max} step={field.step} value={typeof raw === 'number' ? raw : ''} onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))} className={cn(INPUT, border)} />
          <Help />
          <Errors />
        </div>
      );
    case 'checkbox':
      return (
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input id={id} type="checkbox" checked={raw === undefined ? true : raw === true} onChange={(e) => set(e.target.checked)} className="accent-[var(--fk-accent)]" />
            <span className="font-extrabold">{field.label}</span>
          </label>
          {field.help && <p className="ml-6 mt-1 text-xs text-muted">{field.help}</p>}
          <Errors />
        </div>
      );
    case 'select':
      return (
        <div>
          <Label />
          <select id={id} value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value || undefined)} className={cn(INPUT, border)}>
            {field.allowEmpty !== undefined && <option value="">{field.allowEmpty}</option>}
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Help />
          <Errors />
        </div>
      );
    case 'code':
      return (
        <div>
          <Label />
          <textarea id={id} spellCheck={false} rows={8} value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value)} className={cn(INPUT, MONO, 'leading-[1.6]', border)} />
          <Help />
          <Errors />
        </div>
      );
    case 'ltext':
    case 'ltextarea': {
      const multi = field.kind === 'ltextarea';
      const missing = missingLocales(raw as string | Record<string, string> | undefined, ctx.locales);
      const main = readL(raw as string | Record<string, string> | undefined, ctx.defaultLocale, ctx.defaultLocale);
      return (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1 flex flex-wrap items-center gap-2 p-0 text-[13px] font-extrabold">
            {field.label}
            {missing.map((l) => (
              <span key={l} className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-accent">
                Falta {l}
              </span>
            ))}
          </legend>
          <div className="space-y-1.5">
            {ctx.locales.map((l, idx) => {
              const text = readL(raw as string | Record<string, string> | undefined, l, ctx.defaultLocale);
              const placeholder = l !== ctx.defaultLocale && main ? main : (field as { placeholder?: string }).placeholder;
              const common = {
                'aria-label': ctx.locales.length > 1 ? `${field.label} (${l.toUpperCase()})` : field.label,
                id: idx === 0 ? id : undefined,
                value: text,
                placeholder,
                onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  set(writeL(raw as string | Record<string, string> | undefined, l, e.target.value, ctx.locales, ctx.defaultLocale) || undefined),
                className: cn(INPUT, border),
              };
              return (
                <div key={l} className="flex items-start gap-2">
                  {ctx.locales.length > 1 && <span className="mt-2 w-6 shrink-0 font-code text-[11px] uppercase text-muted">{l}</span>}
                  {multi ? <textarea rows={(field as { rows?: number }).rows ?? 3} {...common} /> : <input type="text" {...common} />}
                </div>
              );
            })}
          </div>
          <Help />
          <Errors />
        </fieldset>
      );
    }
    case 'llist': {
      const missing = missingLocalesList(raw as string[] | Record<string, string[]> | undefined, ctx.locales);
      return (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1 flex flex-wrap items-center gap-2 p-0 text-[13px] font-extrabold">
            {field.label}
            {missing.map((l) => (
              <span key={l} className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-accent">
                Falta {l}
              </span>
            ))}
          </legend>
          <div className="space-y-1.5">
            {ctx.locales.map((l, idx) => (
              <LineList
                key={l}
                label={ctx.locales.length > 1 ? `${field.label} (${l.toUpperCase()})` : field.label}
                prefix={ctx.locales.length > 1 ? l : undefined}
                id={idx === 0 ? id : undefined}
                items={readLList(raw as string[] | Record<string, string[]> | undefined, l, ctx.defaultLocale)}
                bad={bad}
                placeholder={(field as { placeholder?: string }).placeholder}
                onItems={(items) => set(writeLList(raw as string[] | Record<string, string[]> | undefined, l, items, ctx.locales, ctx.defaultLocale))}
              />
            ))}
          </div>
          <Help />
          <Errors />
        </fieldset>
      );
    }
    case 'lines':
      return (
        <div>
          <Label />
          <LineList label={field.label} id={id} items={Array.isArray(raw) ? (raw as string[]) : []} bad={bad} placeholder={field.placeholder} onItems={(items) => set(items)} />
          <Help />
          <Errors />
        </div>
      );
    case 'tags':
      return (
        <div>
          <Label />
          <TagInput id={id} tags={Array.isArray(raw) ? (raw as string[]) : []} suggestions={ctx.tagSuggestions} placeholder={field.placeholder} bad={bad} onChange={(t) => set(t.length ? t : undefined)} />
          <Help />
          <Errors />
        </div>
      );
    case 'url': {
      const upload = field.upload;
      return (
        <div>
          <Label />
          <div className="flex items-center gap-2">
            <input id={id} type="text" value={typeof raw === 'string' ? raw : ''} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} className={cn(INPUT, border)} />
            {upload && <UploadButton kind={upload} ctx={ctx} onDone={set} label="Subir…" />}
          </div>
          <Help />
          <Errors />
        </div>
      );
    }
    case 'image': {
      const src = typeof raw === 'string' ? raw : '';
      return (
        <div>
          <Label />
          <div className="flex flex-wrap items-start gap-3">
            {src && <img src={ctx.resolveAsset(src)} alt="" className="h-24 max-w-[180px] rounded-fk border border-line object-cover" />}
            <div className="min-w-0 flex-1 space-y-2">
              <input id={id} type="text" value={src} placeholder="/images/foto.webp o https://…" onChange={(e) => set(e.target.value)} className={cn(INPUT, MONO, border)} />
              <div className="flex flex-wrap gap-2">
                <UploadButton kind="image" ctx={ctx} onDone={set} label={src ? 'Cambiar imagen' : 'Subir imagen'} />
                {src && field.optional && (
                  <button type="button" onClick={() => set(undefined)} className={buttonClass('ghost')}>
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>
          <Help />
          <Errors />
        </div>
      );
    }
    case 'list':
      return <ListField field={field} items={Array.isArray(raw) ? (raw as Obj[]) : []} set={set} ctx={ctx} here={here} own={own} bad={bad} />;
    case 'object': {
      const child = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Obj) : undefined;
      if (!child) {
        if (!field.optional && !field.create) return null;
        return (
          <div>
            <p className="mb-1 text-[13px] font-extrabold">{field.label}</p>
            <button type="button" onClick={() => set(field.create ? field.create() : {})} className={buttonClass('secondary')}>
              Agregar {field.label.toLowerCase()}
            </button>
            <Help />
          </div>
        );
      }
      return (
        <fieldset className={cn('m-0 rounded-fk border-2 p-3', border)}>
          <legend className="flex items-center gap-2 px-1 text-[13px] font-extrabold">
            {field.label}
            {field.optional && (
              <button type="button" onClick={() => set(undefined)} className="text-xs font-normal text-muted underline hover:text-accent">
                Quitar
              </button>
            )}
          </legend>
          <Help />
          <div className="mt-2">
            <Form fields={field.fields} value={child} onChange={(next) => onChange({ ...obj, [field.key]: next })} ctx={ctx} path={here} />
          </div>
          <Errors />
        </fieldset>
      );
    }
    case 'variant': {
      const child = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Obj) : undefined;
      const current = child ? field.variants.find((v) => v.value === child[field.discriminator]) : undefined;
      return (
        <fieldset className={cn('m-0 rounded-fk border-2 p-3', border)}>
          <legend className="px-1 text-[13px] font-extrabold">{field.label}</legend>
          <label htmlFor={id} className="sr-only">
            Tipo de {field.label.toLowerCase()}
          </label>
          <select
            id={id}
            value={current?.value ?? ''}
            onChange={(e) => {
              const v = field.variants.find((x) => x.value === e.target.value);
              set(v ? v.create() : undefined);
            }}
            className={cn(INPUT, 'border-line')}
          >
            {field.optional && <option value="">Ninguno</option>}
            {field.variants.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
          <Help />
          {child && current && (
            <div className="mt-3">
              <Form fields={current.fields} value={child} onChange={(next) => onChange({ ...obj, [field.key]: next })} ctx={ctx} path={here} />
            </div>
          )}
          <Errors />
        </fieldset>
      );
    }
  }
}

/** Un elemento por línea. Guarda el texto crudo mientras se escribe para no perder líneas vacías intermedias. */
function LineList({ items, onItems, label, id, prefix, bad, placeholder }: { items: string[]; onItems: (items: string[]) => void; label: string; id?: string; prefix?: string; bad: boolean; placeholder?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? items.join('\n');
  return (
    <div className="flex items-start gap-2">
      {prefix && <span className="mt-2 w-6 shrink-0 font-code text-[11px] uppercase text-muted">{prefix}</span>}
      <textarea
        id={id}
        aria-label={label}
        rows={Math.min(10, Math.max(3, text.split('\n').length))}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
          onItems(e.target.value.split('\n').map((l) => l.trim()).filter(Boolean));
        }}
        onBlur={() => setDraft(null)}
        className={cn(INPUT, bad ? 'border-accent' : 'border-line')}
      />
    </div>
  );
}

function TagInput({ tags, onChange, suggestions, id, placeholder, bad }: { tags: string[]; onChange: (t: string[]) => void; suggestions: string[]; id: string; placeholder?: string; bad: boolean }) {
  const [text, setText] = useState('');
  const listId = `${id}-sugerencias`;
  const add = (raw: string) => {
    const t = raw.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setText('');
  };
  return (
    <div className={cn('rounded-fk border bg-surface p-2', bad ? 'border-accent' : 'border-line')}>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-fk bg-fg/10 px-2 py-0.5 text-xs">
            {t}
            <button type="button" aria-label={`Quitar ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))} className="text-muted hover:text-accent">
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          list={listId}
          value={text}
          placeholder={placeholder ?? 'Escribe y presiona Enter'}
          onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value.slice(0, -1)) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1));
          }}
          onBlur={() => text.trim() && add(text)}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>
      <datalist id={listId}>
        {suggestions.filter((s) => !tags.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}

function UploadButton({ kind, ctx, onDone, label }: { kind: 'image' | 'file'; ctx: FormContext; onDone: (publicPath: string) => void; label: string }) {
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const id = useId();
  return (
    <span className="shrink-0">
      <input
        id={id}
        type="file"
        accept={kind === 'image' ? 'image/*' : undefined}
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setState({ busy: true, error: null });
          try {
            onDone(await ctx.upload(file, kind));
            setState({ busy: false, error: null });
          } catch (err) {
            setState({ busy: false, error: err instanceof Error ? err.message : 'No se pudo subir el archivo.' });
          }
        }}
      />
      <label htmlFor={id} className={cn(buttonClass('secondary'), 'cursor-pointer', state.busy && 'pointer-events-none opacity-60')}>
        {state.busy ? 'Subiendo…' : label}
      </label>
      {state.error && (
        <span role="alert" className="mt-1 block max-w-[220px] text-xs text-accent">
          {state.error}
        </span>
      )}
    </span>
  );
}

function ListField({ field, items, set, ctx, here, own, bad }: { field: Extract<Field, { kind: 'list' }>; items: Obj[]; set: (v: unknown) => void; ctx: FormContext; here: Path; own: FieldIssue[]; bad: boolean }) {
  const [fresh, setFresh] = useState<number | null>(null);
  const min = field.min ?? 0;
  const replace = (list: Obj[]) => set(list.length ? list : field.min ? [] : undefined);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const list = [...items];
    [list[i], list[j]] = [list[j], list[i]];
    replace(list);
  };
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 flex w-full items-center justify-between gap-2 p-0">
        <span className="text-[13px] font-extrabold">
          {field.label} <span className="font-normal text-muted">({items.length})</span>
        </span>
        <button
          type="button"
          onClick={() => {
            replace([...items, field.newItem()]);
            setFresh(items.length);
          }}
          className={buttonClass('secondary')}
          aria-label={`Agregar a ${field.label}`}
        >
          + Agregar
        </button>
      </legend>
      {field.help && <p className="mb-2 text-xs text-muted">{field.help}</p>}
      <div className="space-y-2">
        {items.map((item, i) => {
          const itemPath: Path = [...here, i];
          const itemBad = ctx.issues.some((x) => startsWith(x.path, itemPath));
          return (
            <details key={i} open={fresh === i || undefined} className={cn('rounded-fk border-2', itemBad ? 'border-accent' : 'border-line')}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{field.itemTitle(item, ctx.defaultLocale) || `#${i + 1}`}</span>
                <span className="flex shrink-0 gap-0.5" onClick={(e) => e.preventDefault()}>
                  <Mini label="Subir" onClick={() => move(i, -1)} disabled={i === 0} text="↑" />
                  <Mini label="Bajar" onClick={() => move(i, 1)} disabled={i === items.length - 1} text="↓" />
                  <Mini label="Duplicar" onClick={() => replace([...items.slice(0, i + 1), structuredClone(item), ...items.slice(i + 1)])} text="⧉" />
                  <Mini label="Eliminar" onClick={() => replace(items.filter((_, j) => j !== i))} disabled={items.length <= min} text="✕" />
                </span>
              </summary>
              <div className="border-t-2 border-line p-3">
                <Form fields={field.item} value={item} onChange={(next) => replace(items.map((x, j) => (j === i ? next : x)))} ctx={ctx} path={itemPath} />
              </div>
            </details>
          );
        })}
      </div>
      {bad && own.map((i, n) => (
        <p key={n} role="alert" className="mt-1 text-xs text-accent">
          {i.message}
        </p>
      ))}
    </fieldset>
  );
}

function Mini({ label, text, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; text: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...props} className="grid size-7 place-items-center rounded-fk text-sm hover:bg-fg/10 disabled:opacity-25">
      {text}
    </button>
  );
}
