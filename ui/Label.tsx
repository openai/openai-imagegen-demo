import type { LabelHTMLAttributes, PropsWithChildren } from "react";

export type LabelProps = PropsWithChildren<LabelHTMLAttributes<HTMLLabelElement>>;

const Label = ({ children, className = "", ...rest }: LabelProps) => (
  <label {...rest} className={`block text-sm font-medium mb-1 ${className}`}>
    {children}
  </label>
);

export default Label;
