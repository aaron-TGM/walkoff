import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Use `custom` when passing a full className (e.g. form-submit). */
  variant?: "primary" | "ghost" | "custom";
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: Props) {
  if (variant === "custom") {
    return (
      <button type={type} className={className.trim() || undefined} {...rest} />
    );
  }
  const base = variant === "primary" ? "btn-primary" : "btn-ghost";
  return (
    <button type={type} className={`${base} ${className}`.trim()} {...rest} />
  );
}
