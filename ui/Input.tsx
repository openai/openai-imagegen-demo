import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = ({ className = "", ...props }: InputProps) => (
  <input
    {...props}
    className={`w-full rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring ${className}`}
  />
);

export default Input;
