import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

export type ButtonVariant = "default" | "secondary" | "ghost";

export type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: ButtonVariant;
};

const Button = ({ children, className = "", variant = "default", ...rest }: ButtonProps) => {
  const base = "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition-colors";
  const style = variant === "ghost"
    ? "bg-transparent text-foreground hover:bg-accent"
    : variant === "secondary"
      ? "border border-border bg-card text-foreground hover:bg-muted/60"
      : "bg-primary text-primary-foreground hover:bg-primary/90";

  return (
    <button {...rest} className={`${base} ${style} ${className}`}>
      {children}
    </button>
  );
};

export default Button;
