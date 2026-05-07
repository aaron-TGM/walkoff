export function BrandSpan({ children }: { children?: React.ReactNode }) {
  return <span className="brand">{children ?? "Walkoff"}</span>;
}
