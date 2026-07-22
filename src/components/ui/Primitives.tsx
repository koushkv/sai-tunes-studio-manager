import React from 'react';
import type { LucideIcon } from 'lucide-react';

/* ── Shared class strings ─────────────────────────────────────────────
   Every form control in the app pulls from these so focus rings, radii,
   and sizing stay identical across panels. */

export const inputClass =
  'w-full px-3 py-2.5 bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg text-[14px] text-[#1d1d1f] ' +
  'placeholder:text-[#86868b] transition-shadow focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] ' +
  'disabled:bg-[#e8e8ed] disabled:text-[#6e6e73] disabled:cursor-not-allowed';

export const selectClass = `${inputClass} cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%2386868b" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>')] bg-no-repeat bg-[right_0.75rem_center] pr-9`;

export const textareaClass = `${inputClass} h-24 resize-none`;

export const labelClass = 'block text-[13px] font-medium text-[#1d1d1f] mb-1.5';

export const cardClass = 'bg-white rounded-2xl border border-[#e8e8ed]';

/* ── Buttons ───────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-[#0071e3] hover:bg-[#0077ED] text-white disabled:bg-[#e8e8ed] disabled:text-[#86868b]',
  secondary: 'bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] disabled:opacity-50',
  danger: 'bg-[#ff3b30] hover:bg-[#ff453a] text-white disabled:opacity-50',
  ghost: 'text-[#0071e3] hover:bg-[#0071e3]/8 disabled:opacity-50',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  /** Shows a spinner and blocks interaction while an async action is inflight. */
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  icon: Icon,
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-colors
        cursor-pointer disabled:cursor-not-allowed whitespace-nowrap
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40 focus-visible:ring-offset-2
        ${VARIANTS[variant]} ${className}`}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon size={14} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

/* ── Section header ────────────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
      <div className="min-w-0">
        <h2 className="text-[24px] sm:text-[26px] font-bold tracking-tight text-[#1d1d1f] leading-tight">{title}</h2>
        {subtitle && <p className="text-[13px] text-[#86868b] mt-1 leading-snug">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`${cardClass} py-16 px-6 text-center`}>
      <Icon size={36} className="text-[#d2d2d7] mx-auto" aria-hidden="true" />
      <p className="text-[16px] font-semibold text-[#1d1d1f] mt-3">{title}</p>
      {message && <p className="text-[14px] text-[#86868b] max-w-sm mx-auto mt-1.5 leading-relaxed">{message}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/* ── Loading state ─────────────────────────────────────────────────── */

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20" role="status" aria-live="polite">
      <span className="h-6 w-6 rounded-full border-[2.5px] border-[#d2d2d7] border-t-[#0071e3] animate-spin" aria-hidden="true" />
      <p className="text-[14px] text-[#86868b]">{label}</p>
    </div>
  );
}

/* ── Stat card ─────────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'blue' | 'green';
}) {
  const valueColor =
    tone === 'blue' ? 'text-[#0071e3]' : tone === 'green' ? 'text-[#34c759]' : 'text-[#1d1d1f]';
  return (
    <div className={`${cardClass} p-5`}>
      <p className="text-[12px] text-[#86868b] font-medium">{label}</p>
      <p className={`text-[26px] font-bold tracking-tight mt-1 tabular-nums ${valueColor}`}>{value}</p>
      {hint && <p className="text-[12px] text-[#86868b] mt-0.5 leading-snug">{hint}</p>}
    </div>
  );
}

/* ── Filter pill ───────────────────────────────────────────────────── */

export function FilterPill({
  active,
  onClick,
  children,
  activeClass = 'bg-[#1d1d1f] text-white',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40 focus-visible:ring-offset-2
        ${active ? activeClass : 'bg-[#e8e8ed] text-[#6e6e73] hover:bg-[#d2d2d7]'}`}
    >
      {children}
    </button>
  );
}
