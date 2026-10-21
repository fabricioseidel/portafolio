'use client';

import { useEffect, useRef } from 'react';
import { useSite } from './SiteContext';
import { buttonClass } from './ui';

/** Visor de imágenes (certificados) con <dialog>: foco atrapado, Esc y clic fuera cierran. */
export function Lightbox({ src, title, onClose }: { src: string | null; title: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { u } = useSite();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Sin showModal (navegadores muy viejos) se abre igual, solo que sin fondo modal.
    if (src && !dialog.open) {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!src && dialog.open) {
      if (dialog.close) dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [src]);

  return (
    <dialog
      ref={ref}
      data-nobuddy="1"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-[min(1100px,calc(100%-32px))] max-w-none border-2 border-line bg-bg p-0 text-fg backdrop:bg-black/70"
    >
      {src && (
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b-2 border-line px-4 py-2.5">
            <p className="truncate font-heading text-sm font-extrabold">{title}</p>
            <div className="flex shrink-0 gap-2">
              <a href={src} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost')}>
                {u('openNewTab')} ↗
              </a>
              <button type="button" onClick={onClose} className={buttonClass('secondary')} autoFocus>
                {u('close')} ✕
              </button>
            </div>
          </div>
          <img src={src} alt={title} className="max-h-[80dvh] w-full bg-white object-contain" />
        </div>
      )}
    </dialog>
  );
}
