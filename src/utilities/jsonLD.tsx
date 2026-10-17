// utilities/Json_LD.ts
import setting from "@/config/json_conf/Meta_data.json";

export default function JsonLD() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "CordyStackX",
    "url": setting.domain__links,
    "publisher": {
      "@type": "Person",
      "name": "Cordova Marc Giestin Louis",
      "sameAs": [
        setting.links__src.Social__links.github,
      ]
    },
    "logo": {
      "@type": "ImageObject",
      "url": setting.openGraph
    }
  };
}