import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const KIND_STYLES: Record<ToastKind, { icon: typeof Info; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2,   ring: 'ring-[#34c759]/25', iconColor: 'text-[#34c759]' },
  error:   { icon: AlertTriangle,  ring: 'ring-[#ff3b30]/25', iconColor: 'text-[#ff3b30]' },
  info:    { icon: Info,           ring: 'ring-[#0071e3]/25', iconColor: 'text-[#0071e3]' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(t => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts(current => [...current, { id, kind, message }]);
    window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          className="fixed z-[60] bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 left-4 sm:left-auto sm:w-[360px] flex flex-col gap-2 pointer-events-none"
        >
          {toasts.map(toast => {
            const { icon: Icon, ring, iconColor } = KIND_STYLES[toast.kind];
            return (
              <div
                key={toast.id}
                className={`pointer-events-auto flex items-start gap-2.5 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg ring-1 ${ring} px-3.5 py-3 animate-toast-in`}
              >
                <Icon size={16} className={`${iconColor} shrink-0 mt-0.5`} aria-hidden="true" />
                <p className="text-[13px] text-[#1d1d1f] leading-snug flex-1">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 text-[#86868b] hover:text-[#1d1d1f] cursor-pointer transition-colors"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
