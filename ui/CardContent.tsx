import type { PropsWithChildren } from "react";

export type CardContentProps = PropsWithChildren<{ className?: string }>;

const CardContent = ({ children, className = "" }: CardContentProps) => (
  <div className={className}>
    {children}
  </div>
);

export default CardContent;
