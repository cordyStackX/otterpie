import { ReactNode } from "react";

interface ReceiptCardProps {
  children: ReactNode;
}

export default function ReceiptCard({ children }: ReceiptCardProps) {
  return (
    <div className="w-full max-w-md">
      <div className="relative rounded-t-xl overflow-hidden shadow-[0_20px_50px_-20px_rgba(0,119,182,0.35)]">
        {children}
      </div>

      {/* Torn receipt edge */}
      <div
        className="h-4 w-full"
        style={{
          backgroundImage:
            "linear-gradient(-45deg, var(--background) 5px, transparent 0), linear-gradient(45deg, var(--background) 5px, transparent 0)",
          backgroundSize: "10px 10px",
          backgroundPosition: "left top",
        }}
      />
    </div>
  );
}
