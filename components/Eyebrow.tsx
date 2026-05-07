export function Eyebrow({
  children,
  dot = "red",
}: {
  children: React.ReactNode;
  dot?: "red" | "green";
}) {
  return (
    <div className="eyebrow">
      <span className={`eyebrow-dot ${dot === "green" ? "eyebrow-dot-green" : ""}`} />
      {children}
    </div>
  );
}
