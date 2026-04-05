import Link from "next/link";
import {
  Search,
  type LucideIcon,
} from "lucide-react";
import type {
  ButtonHTMLAttributes,
  ForwardedRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">
          {eyebrow}
        </p>
        <div className="space-y-2">
          <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[var(--foreground)] md:text-[2.45rem]">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] md:text-[15px]">
            {description}
          </p>
        </div>
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap gap-2.5">{actions}</div> : null}
    </div>
  );
}

export function WireframeBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
      {children}
    </span>
  );
}

type ActionButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  href?: string;
  type?: "button" | "submit";
  className?: string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className" | "onClick" | "type"
>;

export function ActionButton({
  children,
  variant = "primary",
  href,
  onClick,
  type = "button",
  className,
  ...buttonProps
}: ActionButtonProps) {
  const sharedClassName = cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-medium transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(26,130,121,0.24)]",
    variant === "primary" &&
      "border border-black bg-black text-white shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:bg-black/90",
    variant === "secondary" &&
      "border border-black bg-black text-white hover:-translate-y-0.5 hover:bg-black/90",
    variant === "ghost" &&
      "border border-black bg-black/85 text-white hover:bg-black",
    className,
  );

  if (href) {
    return (
      <Link className={sharedClassName} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button
      {...buttonProps}
      className={sharedClassName}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

export function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[26px] border border-[var(--border)] bg-[var(--surface-strong)] p-5 shadow-[var(--shadow-sm)] md:p-6",
        className,
      )}
    >
      <div className="mb-5 flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--foreground)]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = "ink",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "ink" | "mint" | "amber" | "rose";
}) {
  const toneClassName = {
    ink: "bg-[var(--foreground)] text-white border-transparent",
    mint: "bg-[var(--accent-soft)] text-[var(--accent-strong)] border-transparent",
    amber: "bg-[var(--warn-soft)] text-[var(--warn)] border-transparent",
    rose: "bg-[var(--rose-soft)] text-[var(--rose)] border-transparent",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-[22px] border p-5 shadow-[var(--shadow-sm)]",
        toneClassName,
      )}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-75">{label}</p>
      <p className="mt-4 text-[1.8rem] font-semibold tracking-[-0.03em] md:text-[2.1rem]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 opacity-80">{detail}</p>
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "mint" | "amber" | "rose";
}) {
  const toneClassName = {
    neutral:
      "border-[var(--border)] bg-[rgba(255,255,255,0.72)] text-[var(--foreground)]",
    mint: "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)]",
    amber: "border-transparent bg-[var(--warn-soft)] text-[var(--warn)]",
    rose: "border-transparent bg-[var(--rose-soft)] text-[var(--rose)]",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        toneClassName,
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-[var(--foreground)]">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-5 text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef(function Input(
  props: InputHTMLAttributes<HTMLInputElement>,
  ref: ForwardedRef<HTMLInputElement>,
) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.8)] px-4 py-3 text-sm text-[var(--foreground)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,130,121,0.08)]",
        props.className,
      )}
      ref={ref}
    />
  );
});

export const Select = forwardRef(function Select(
  props: SelectHTMLAttributes<HTMLSelectElement>,
  ref: ForwardedRef<HTMLSelectElement>,
) {
  const { style, ...restProps } = props;

  return (
    <select
      {...restProps}
      className={cn(
        "w-full appearance-none rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.8)] px-4 py-3 pr-11 text-sm text-[var(--foreground)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] focus:border-[var(--accent)] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,130,121,0.08)]",
        props.className,
      )}
      ref={ref}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2366737c' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.95rem center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "16px 16px",
        ...style,
      }}
    />
  );
});

export const Textarea = forwardRef(function Textarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
  ref: ForwardedRef<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.8)] px-4 py-3 text-sm text-[var(--foreground)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,130,121,0.08)]",
        props.className,
      )}
      ref={ref}
    />
  );
});

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-dashed border-[var(--border)] bg-[rgba(255,255,255,0.5)] px-5 py-10 text-center">
      <p className="text-base font-semibold tracking-[-0.02em] text-[var(--foreground)]">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </div>
  );
}

export function QuickJumpTrigger({
  onClick,
  icon: Icon = Search,
  label = "Cari atau lompat",
  shortcut = "Ctrl K",
  className,
  ...props
}: {
  onClick?: () => void;
  icon?: LucideIcon;
  label?: string;
  shortcut?: string;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children">) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.76)] px-4 py-2.5 text-left text-[13px] text-[var(--foreground)] shadow-[var(--shadow-sm)] hover:border-[var(--border-strong)] hover:bg-white",
        className,
      )}
      onClick={onClick}
      type="button"
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <Icon className="size-4" strokeWidth={2.1} />
        </span>
        <span className="truncate leading-5">{label}</span>
      </span>
      <span className="hidden min-h-7 min-w-[3.4rem] items-center justify-center self-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-[10px] uppercase leading-none tracking-[0.16em] text-[var(--muted)] sm:inline-flex">
        {shortcut}
      </span>
    </button>
  );
}
