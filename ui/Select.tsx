import type { SelectHTMLAttributes } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const Select = ({ className = "", ...props }: SelectProps) => (
  <select
    {...props}
    className={`w-full rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring ${className}`}
  />
);

export default Select;
