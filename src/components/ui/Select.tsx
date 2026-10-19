import { SelectHTMLAttributes } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
}

export default function Select({ label, id, options, className = "", ...props }: SelectProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm text-foreground/70">
        {label}
      </label>
      <select
        id={id}
        className={`mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
