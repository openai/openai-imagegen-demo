import type { PropsWithChildren } from "react";

export type CardProps = PropsWithChildren<{ className?: string }>;

const Card = ({ children, className = "" }: CardProps) => (
  <div className={className}>
    {children}
  </div>
);

export default Card;
