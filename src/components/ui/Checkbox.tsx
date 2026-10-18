import { InputHTMLAttributes } from "react";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
}

export default function Checkbox({ label, id, className = "", ...props }: CheckboxProps) {
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-foreground/25 text-primary focus:ring-1 focus:ring-primary accent-primary"
        {...props}
      />
      <label htmlFor={id} className="text-sm text-foreground/70 leading-snug">
        {label}
      </label>
    </div>
  );
}
