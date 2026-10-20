import Image from "next/image";

type LogoProps = {
  tagline?: string;
}

export default function Logo({
  tagline = "Sari-sari payments, split in one scan.",
}: LogoProps) {
  return (
    <div className="bg-primary px-6 py-5">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.svg"
          alt=""
          width={50}
          height={50}
          priority
          className="h-12 w-12 rounded-xl bg-white/15 p-1.5"
        />
        <p className="text-xl font-semibold tracking-tight text-background">Otterpie</p>
      </div>
      <p className="ml-15 mt-0.5 text-xs text-background/80">{tagline}</p>
    </div>
  );
}
