import { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function TextField({
  label,
  id,
  className = "",
  ...props
}: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm text-foreground/70">
        {label}
      </label>
      <input
        id={id}
        className={`mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors ${className}`}
        {...props}
      />
    </div>
  );
}
