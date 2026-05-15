import { type HTMLAttributes } from "react";

export function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-sand-200 bg-white/70 shadow-sm backdrop-blur-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`border-b border-sand-200 px-5 py-4 ${className}`}>{children}</div>
  );
}

export function CardBody({ children, className = "" }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: HTMLAttributes<HTMLDivElement>) {
  return (
    <h3 className={`text-base font-semibold text-sand-800 ${className}`}>{children}</h3>
  );
}
