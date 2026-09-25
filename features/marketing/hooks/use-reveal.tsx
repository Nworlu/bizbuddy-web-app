import type { ReactNode } from "react";

export function Reveal({ children, className = "", delay = 0, load = false }: { children: ReactNode; className?: string; delay?: number; load?: boolean }) {
  return (
    <div className={`${load ? "reveal-load" : "reveal"} ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
