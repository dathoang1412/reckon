import type { ReactNode } from "react";

// Common "centered column" wrapper repeated by hand across Settings/Login/
// the Review view — same maxWidth/margin/padding shape each time.
export default function PageShell({
  maxWidth = 480,
  margin = "2rem auto",
  padding = "0 1rem",
  children,
}: {
  maxWidth?: number;
  margin?: string;
  padding?: string;
  children: ReactNode;
}) {
  return <div style={{ maxWidth, margin, padding }}>{children}</div>;
}
