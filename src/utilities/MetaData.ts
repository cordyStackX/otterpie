import type { Metadata } from "next";
import setting from "@/config/json_conf/Meta_data.json"; 


export default function MetadataUtils() {
  const metadata: Metadata = {
    title: setting.title,
    description: setting.description,
    alternates: {
      canonical: setting.domain__links,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: {
      google: "google9249e550c23b54d0.html",
    },
    openGraph: {
      title: setting.title,
      description: setting.description,
      url: setting.domain__links,
      siteName: "Otterpie",
      images: [
        {
            url: setting.openGraph,
            width: 1200,
            height: 630,
            type: "image/png",
            alt: "Otterpie — a wallet that shows where the money goes.",
        },
        {
            url: setting.openGraphSvg,
            width: 1200,
            height: 630,
            type: "image/svg+xml",
            alt: "Otterpie — a wallet that shows where the money goes.",
        },
      ],
      locale: "en-US",
      type: "website",
      },
    twitter: {
      card: "summary_large_image",
      title: setting.title,
      description: setting.description,
      images: [setting.openGraph],
      creator: "@CordyStackX",
    },
    other: {
      "article:publisher": setting.links__src.Social__links.github,
    },                                  
  };

  return metadata;

}
