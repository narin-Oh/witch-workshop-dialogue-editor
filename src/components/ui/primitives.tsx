import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'soft' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary-deep text-white hover:brightness-110 border-transparent shadow-card',
  soft: 'bg-primary-soft text-primary-deep border-primary/60 hover:bg-primary/30',
  ghost: 'bg-transparent text-text border-transparent hover:bg-primary-soft',
  danger: 'bg-pink-soft text-pink-deep border-pink hover:bg-pink/40',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  compact?: boolean;
}

export function Button({ variant = 'soft', icon, compact, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-[13px]'} ${VARIANTS[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...rest}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-sub transition hover:bg-primary-soft hover:text-primary-deep disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-text-sub">{hint}</span> : null}
    </label>
  );
}

export function Section({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-line bg-panel p-3 shadow-card">
      <header className="mb-2 flex items-center gap-2">
        <span className="text-primary-deep">{icon}</span>
        <h2 className="font-serif text-[15px] font-bold tracking-wide text-text">{title}</h2>
        <span className="ml-auto">{action}</span>
      </header>
      {children}
    </section>
  );
}
