// src/context/LanguageContext.js
import { createContext, useContext, useState } from "react";
import { SITE_CONFIG } from "../data/catalog";

export const translations = {
  en: {
    tagline:      SITE_CONFIG.tagline,
    subtitle:     "CATALOG",
    portfolio:    "Portfolio",
    contact:      "Contact",
    shop:         "Shop",
    available:    "AVAILABLE",
    unavailable:  "UNAVAILABLE",
    socials:      "Socials",
    links:        "Links",
    noContact:    "No contact info added yet.",
    footer_works: (n) => `${n} works`,
    filterAll:    "All",
    collection:   "Collection",
    buyNow:       "Buy Now",
    buyWithEtsy:  "Buy with etsy"
  },
  th: {
    tagline:      SITE_CONFIG.taglineTh,
    subtitle:     "เเคตตาล็อก",
    portfolio:    "ผลงาน",
    contact:      "ติดต่อ",
    shop:         "ร้านค้า",
    available:    "พร้อมให้บริการ",
    unavailable:  "ไม่ว่าง",
    socials:      "โซเชียล",
    links:        "ลิงก์",
    noContact:    "ยังไม่มีข้อมูลติดต่อ",
    footer_works: (n) => `${n} ชิ้น`,
    filterAll:    "ทั้งหมด",
    collection:   "คอลเลกชัน",
    buyNow:       "ซื้อเลย",
    buyWithEtsy:  "ซื้อด้วย etsy"
  },
};

const LanguageContext = createContext({
  lang:   "en",
  t:      translations.en,
  toggle: () => {},
});

function detectLang() {
  const pref = (navigator.language || navigator.languages?.[0] || "en").toLowerCase();
  return pref.startsWith("th") ? "th" : "en";
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(detectLang);
  const toggle = () => setLang((l) => (l === "en" ? "th" : "en"));
  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
