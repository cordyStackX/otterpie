import { Geist, Geist_Mono } from "next/font/google";
import { MetadataUtils, JsonLD, Gtag } from "@/utilities";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = MetadataUtils();

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JsonLD()) }}
        />
        <Gtag />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
