type LogoProps = {
  tagline?: string;
}

export default function Logo({
  tagline = "Sari-sari payments, split in one scan.",
}: LogoProps) {
  return (
    <div className="bg-primary px-6 py-5">
      <p className="text-background font-semibold text-lg tracking-tight">
        Otterpie
      </p>
      <p className="text-background/80 text-xs mt-0.5">{tagline}</p>
    </div>
  );
}
