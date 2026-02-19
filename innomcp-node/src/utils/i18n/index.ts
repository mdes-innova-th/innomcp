/**
 * Multi-language Support System
 * à¸£à¸­à¸‡à¸£à¸±à¸šà¸«à¸¥à¸²à¸¢à¸ à¸²à¸©à¸²: à¹„à¸—à¸¢, English
 * 
 * Features:
 * - Auto language detection
 * - Translation dictionary
 * - Localized responses
 * - Bilingual support
 * 
 * @module utils/i18n
 */

import { logBoth } from '../mcpLogger';

/**
 * Supported Languages
 */
export type Language = 'th' | 'en';

/**
 * Translation Dictionary
 */
export interface TranslationDict {
  [key: string]: {
    th: string;
    en: string;
  };
}

/**
 * Language Detection Result
 */
export interface LanguageDetectionResult {
  language: Language;
  confidence: number;
}

/**
 * Built-in translations
 */
const translations: TranslationDict = {
  // Weather
  'weather.temperature': {
    th: 'à¸­à¸¸à¸“à¸«à¸ à¸¹à¸¡à¸´',
    en: 'Temperature'
  },
  'weather.humidity': {
    th: 'à¸„à¸§à¸²à¸¡à¸Šà¸·à¹‰à¸™',
    en: 'Humidity'
  },
  'weather.rainfall': {
    th: 'à¸›à¸£à¸´à¸¡à¸²à¸“à¸à¸™',
    en: 'Rainfall'
  },
  'weather.windSpeed': {
    th: 'à¸„à¸§à¸²à¸¡à¹€à¸£à¹‡à¸§à¸¥à¸¡',
    en: 'Wind Speed'
  },
  'weather.condition': {
    th: 'à¸ªà¸ à¸²à¸žà¸­à¸²à¸à¸²à¸¨',
    en: 'Weather Condition'
  },
  
  // Time
  'time.current': {
    th: 'à¹€à¸§à¸¥à¸²à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™',
    en: 'Current Time'
  },
  'time.date': {
    th: 'à¸§à¸±à¸™à¸—à¸µà¹ˆ',
    en: 'Date'
  },
  'time.timezone': {
    th: 'à¹€à¸‚à¸•à¹€à¸§à¸¥à¸²',
    en: 'Timezone'
  },
  
  // Location
  'location.province': {
    th: 'à¸ˆà¸±à¸‡à¸«à¸§à¸±à¸”',
    en: 'Province'
  },
  'location.district': {
    th: 'à¸­à¸³à¹€à¸ à¸­',
    en: 'District'
  },
  'location.subdistrict': {
    th: 'à¸•à¸³à¸šà¸¥',
    en: 'Sub-district'
  },
  
  // Errors
  'error.notFound': {
    th: 'à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥',
    en: 'Data not found'
  },
  'error.serverError': {
    th: 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¸‚à¸­à¸‡à¸£à¸°à¸šà¸š',
    en: 'Server error occurred'
  },
  'error.invalidInput': {
    th: 'à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡',
    en: 'Invalid input'
  },
  'error.timeout': {
    th: 'à¸«à¸¡à¸”à¹€à¸§à¸¥à¸²à¸£à¸­',
    en: 'Timeout'
  },
  
  // Sources
  'source.from': {
    th: 'à¹à¸«à¸¥à¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥',
    en: 'Source'
  },
  'source.updatedAt': {
    th: 'à¸­à¸±à¸žà¹€à¸”à¸—à¹€à¸¡à¸·à¹ˆà¸­',
    en: 'Updated at'
  },
  'source.reliability': {
    th: 'à¸„à¸§à¸²à¸¡à¸™à¹ˆà¸²à¹€à¸Šà¸·à¹ˆà¸­à¸–à¸·à¸­',
    en: 'Reliability'
  },
  
  // Common
  'common.yes': {
    th: 'à¹ƒà¸Šà¹ˆ',
    en: 'Yes'
  },
  'common.no': {
    th: 'à¹„à¸¡à¹ˆ',
    en: 'No'
  },
  'common.loading': {
    th: 'à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”...',
    en: 'Loading...'
  },
  'common.success': {
    th: 'à¸ªà¸³à¹€à¸£à¹‡à¸ˆ',
    en: 'Success'
  },
  'common.failed': {
    th: 'à¸¥à¹‰à¸¡à¹€à¸«à¸¥à¸§',
    en: 'Failed'
  }
};

/**
 * Internationalization Manager
 */
class I18nManager {
  private currentLanguage: Language = 'th';
  private customTranslations: TranslationDict = {};

  /**
   * Detect language from text
   */
  detectLanguage(text: string): LanguageDetectionResult {
    // Thai characters range: \u0E00-\u0E7F
    const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
    // English characters range: a-zA-Z
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    
    const totalChars = thaiChars + englishChars;
    
    if (totalChars === 0) {
      return { language: 'th', confidence: 0.5 };
    }
    
    const thaiRatio = thaiChars / totalChars;
    
    // If more than 30% Thai characters, consider it Thai
    if (thaiRatio > 0.3) {
      return { language: 'th', confidence: thaiRatio };
    } else {
      return { language: 'en', confidence: 1 - thaiRatio };
    }
  }

  /**
   * Set current language
   */
  setLanguage(lang: Language): void {
    this.currentLanguage = lang;
    logBoth('info', `[i18n] Language set to: ${lang}`);
  }

  /**
   * Get current language
   */
  getLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Auto-detect and set language from text
   */
  autoSetLanguage(text: string): Language {
    const result = this.detectLanguage(text);
    if (result.confidence > 0.7) {
      this.setLanguage(result.language);
    }
    return result.language;
  }

  /**
   * Add custom translations
   */
  addTranslations(dict: TranslationDict): void {
    this.customTranslations = { ...this.customTranslations, ...dict };
    logBoth('info', `[i18n] Added ${Object.keys(dict).length} custom translations`);
  }

  /**
   * Get translation
   */
  t(key: string, lang?: Language): string {
    const targetLang = lang || this.currentLanguage;
    
    // Check custom translations first
    if (this.customTranslations[key]) {
      return this.customTranslations[key][targetLang];
    }
    
    // Check built-in translations
    if (translations[key]) {
      return translations[key][targetLang];
    }
    
    // Return key if not found
    logBoth('warn', `[i18n] Translation not found: ${key}`);
    return key;
  }

  /**
   * Get translation in both languages
   */
  tBilingual(key: string): { th: string; en: string } {
    if (this.customTranslations[key]) {
      return this.customTranslations[key];
    }
    
    if (translations[key]) {
      return translations[key];
    }
    
    return { th: key, en: key };
  }

  /**
   * Translate multiple keys
   */
  tMultiple(keys: string[], lang?: Language): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = this.t(key, lang);
    }
    return result;
  }

  /**
   * Format text with variables
   */
  format(template: string, vars: Record<string, string | number>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }
    return result;
  }

  /**
   * Check if text is Thai
   */
  isThaiText(text: string): boolean {
    return this.detectLanguage(text).language === 'th';
  }

  /**
   * Check if text is English
   */
  isEnglishText(text: string): boolean {
    return this.detectLanguage(text).language === 'en';
  }

  /**
   * Get all available translations
   */
  getAvailableTranslations(): string[] {
    return [
      ...Object.keys(translations),
      ...Object.keys(this.customTranslations)
    ];
  }

  /**
   * Convert Thai numeral to Arabic
   */
  thaiToArabicNumeral(text: string): string {
    const thaiNumerals = 'à¹à¹‘à¹’à¹“à¹”à¹•à¹–à¹—à¹˜à¹™';
    const arabicNumerals = '0123456789';
    
    return text.split('').map(char => {
      const index = thaiNumerals.indexOf(char);
      return index !== -1 ? arabicNumerals[index] : char;
    }).join('');
  }

  /**
   * Convert Arabic numeral to Thai
   */
  arabicToThaiNumeral(text: string): string {
    const thaiNumerals = 'à¹à¹‘à¹’à¹“à¹”à¹•à¹–à¹—à¹˜à¹™';
    const arabicNumerals = '0123456789';
    
    return text.split('').map(char => {
      const index = arabicNumerals.indexOf(char);
      return index !== -1 ? thaiNumerals[index] : char;
    }).join('');
  }
}

// Export singleton instance
export const i18n = new I18nManager();

/**
 * Helper: Translate
 */
export function t(key: string, lang?: Language): string {
  return i18n.t(key, lang);
}

/**
 * Helper: Detect language
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  return i18n.detectLanguage(text);
}

/**
 * Helper: Auto-detect and set language
 */
export function autoSetLanguage(text: string): Language {
  return i18n.autoSetLanguage(text);
}

/**
 * Helper: Format text with variables
 */
export function format(template: string, vars: Record<string, string | number>): string {
  return i18n.format(template, vars);
}

/**
 * Helper: Check if Thai
 */
export function isThaiText(text: string): boolean {
  return i18n.isThaiText(text);
}

/**
 * Helper: Check if English
 */
export function isEnglishText(text: string): boolean {
  return i18n.isEnglishText(text);
}
