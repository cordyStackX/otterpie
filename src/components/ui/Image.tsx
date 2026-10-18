import NextImage, { ImageProps } from "next/image";

export default function Image({ alt, className = "", ...props }: ImageProps) {
  return <NextImage alt={alt} className={`object-cover ${className}`} {...props} />;
}
