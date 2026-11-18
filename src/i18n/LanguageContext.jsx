import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './i18n';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    // Default to 'ml' (Malayalam) as requested
    const saved = localStorage.getItem('krs_billing_lang_v2');
    if (saved) return saved;
    return 'ml';
  });

  useEffect(() => {
    localStorage.setItem('krs_billing_lang_v2', lang);
    localStorage.setItem('krs_billing_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'ml' : 'en'));
  };

  const t = (key) => {
    if (translations[lang] && translations[lang][key]) {
      return translations[lang][key];
    }
    if (translations.ml && translations.ml[key]) {
      return translations.ml[key];
    }
    if (translations.en && translations.en[key]) {
      return translations.en[key];
    }
    return key;
  };

  const getVarietyName = (variety, explicitLang = null) => {
    if (!variety) return '';
    const currentLang = explicitLang || lang;
    if (currentLang === 'ml') {
      return variety.name_ml 
        ? `${variety.name_ml}${variety.name_en ? ` (${variety.name_en})` : ''}` 
        : variety.name_en || '';
    }
    return variety.name_en 
      ? `${variety.name_en}${variety.name_ml ? ` (${variety.name_ml})` : ''}` 
      : variety.name_ml || '';
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLanguage, t, getVarietyName }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
