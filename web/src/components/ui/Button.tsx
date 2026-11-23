import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "../../lib/router.tsx";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "danger-ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "sm";
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

function classes(variant: Variant, size: "md" | "sm", block: boolean, extra?: string) {
  return ["btn", `btn--${variant}`, size === "sm" && "btn--sm", block && "btn--block", extra].filter(Boolean).join(" ");
}

export function Button({ variant = "secondary", size = "md", block = false, loading = false, icon, children, className, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={classes(variant, size, block, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, icon, variant = "ghost", ...rest }: Omit<ButtonProps, "children"> & { label: string; icon: ReactNode }) {
  return <Button variant={variant} className="btn--icon" aria-label={label} title={label} icon={icon} {...rest} />;
}

export function ButtonLink({ href, variant = "secondary", size = "md", block = false, icon, children, external }: { href: string; variant?: Variant; size?: "md" | "sm"; block?: boolean; icon?: ReactNode; children: ReactNode; external?: boolean }) {
  const className = classes(variant, size, block);
  if (external) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={{ textDecoration: "none" }}>
      {icon}
      {children}
    </Link>
  );
}
