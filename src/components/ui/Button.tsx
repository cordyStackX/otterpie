import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
}

export default function Button({
  loading,
  loadingText,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`w-full rounded-md bg-primary text-background text-sm font-medium py-2.5 hover:bg-primary/90 disabled:opacity-60 transition-colors ${className}`}
      {...props}
    >
      {loading ? loadingText ?? "Please wait…" : children}
    </button>
  );
}