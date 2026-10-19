import { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  loading?: boolean;
  loadingText?: string;
  variant?: "primary" | "ghost" | "danger";
  fullWidth?: boolean;
};

const variants = {
  primary: "bg-primary text-background hover:bg-primary/90",
  ghost: "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export default function Button({
  loading,
  loadingText,
  variant = "primary",
  fullWidth = true,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-md px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60 ${
        fullWidth ? "w-full" : ""
      } ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? loadingText ?? "Please wait…" : children}
    </button>
  );
}