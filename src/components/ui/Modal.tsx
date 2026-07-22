import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Tailwind max-width class for the dialog surface. */
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' } as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: renders in a portal, closes on Escape and backdrop click,
 * locks background scroll, traps Tab focus, and restores focus on close.
 */
export default function Modal({ open, onClose, title, description, size = 'md', children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  // Escape to close + Tab containment.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  // Lock background scroll while the dialog is up.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  // Move focus in on open, restore it on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const target = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`bg-white w-full ${SIZES[size]} rounded-t-2xl sm:rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden font-sans max-h-[92dvh] sm:max-h-[88dvh] pb-[env(safe-area-inset-bottom)] sm:pb-0 flex flex-col animate-sheet-in`}
      >
        <div className="px-6 py-4 border-b border-[#e8e8ed] flex justify-between items-start gap-4 shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-semibold text-[#1d1d1f] leading-tight">{title}</h2>
            {description && (
              <p id={descId} className="text-[13px] text-[#86868b] mt-0.5 leading-snug">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 -mr-1.5 -mt-0.5 p-1.5 rounded-full text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] cursor-pointer transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
