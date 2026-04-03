import type { TextareaHTMLAttributes } from "react";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = ({ className = "", ...props }: TextareaProps) => (
  <textarea
    {...props}
    className={`w-full rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring ${className}`}
  />
);

export default Textarea;
