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
      siteName: "CordyStackX",
      images: [
        {
            url: setting.openGraph,
            width: 800,
            height: 800,
        },
        {
            url: setting.openGraph,
            width: 1800,
            height: 1800,
            alt: "Cordy Portfolio",
        },
      ],
      locale: "en-US",
      type: "website",
      },
    other: {
      "article:publisher": setting.links__src.Social__links.github,
      "twitter:creator": "@CordyStackX",
    },                                  
  };

  return metadata;

}