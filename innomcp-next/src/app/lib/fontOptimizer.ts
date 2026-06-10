// fontOptimizer.ts - ฟังก์ชันปรับปรุงการแสดงผลฟอนต์ภาษาไทยสำหรับ INNOMCP
// Thai font rendering optimization utilities for INNOMCP

// Thai Unicode range
export const THAI_UNICODE_RANGE = 'U+0E00-U+0E7F';

// Thai consonant characters (ก to ฮ)
export const THAI_CONSONANTS: string[] = [
  'ก', 'ข', 'ฃ', 'ค', 'ฅ', 'ฆ', 'ง', 'จ', 'ฉ', 'ช', 'ซ', 'ฌ', 'ญ',
  'ฎ', 'ฏ', 'ฐ', 'ฑ', 'ฒ', 'ณ', 'ด', 'ต', 'ถ', 'ท', 'ธ', 'น', 'บ',
  'ป', 'ผ', 'ฝ', 'พ', 'ฟ', 'ภ', 'ม', 'ย', 'ร', 'ล', 'ว', 'ศ', 'ษ',
  'ส', 'ห', 'ฬ', 'อ', 'ฮ'
];

// Thai vowel characters (สระ)
export const THAI_VOWELS: string[] = [
  'ะ', 'ั', 'า', 'ำ', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'เ', 'แ', 'โ',
  'ใ', 'ไ', 'ฤ', 'ฦ'
];

// Thai tone marks (วรรณยุกต์)
export const THAI_TONE_MARKS: string[] = [
  '่', '้', '๊', '๋'
];

// Compiled regex for matching any Thai character (including vowels and tone marks)
const THAI_CHAR_REGEX = /[\u0E00-\u0E7F]/;

// Regex to match consecutive Thai characters (for word break insertion)
const THAI_SEQUENCE_REGEX = /[\u0E00-\u0E7F]+/g;

/**
 * Detect proportion of Thai characters in the given text.
 * Returns a number between 0 and 1.
 */
export function thaiContentRatio(text: string): number {
  if (text.length === 0) return 0;
  const thaiChars = text.match(THAI_CHAR_REGEX);
  const totalThai = thaiChars ? thaiChars.length : 0;
  return totalThai / text.length;
}

/**
 * Classify text based on Thai content density.
 * Returns:
 * - "thai-content" if Thai characters account for more than 50% of total characters
 * - "mixed-content" if at least one Thai character is present (but ≤50%)
 * - "latin-content" if no Thai characters are found
 */
export function getThaiTextClass(text: string): string {
  const ratio = thaiContentRatio(text);
  if (ratio > 0.5) return 'thai-content';
  if (ratio > 0) return 'mixed-content';
  return 'latin-content';
}

/**
 * Insert zero-width spaces (U+200B) into long sequences of Thai characters
 * to allow the browser to break lines appropriately.
 * Thai text often lacks spaces, causing overflow; this function
 * splits sequences longer than `maxChunk` into chunks of `breakInterval`.
 * Both defaults are set to 10 and 5 respectively for reasonable behaviour.
 *
 * @param text - The text to process
 * @param maxChunk - Maximum allowed consecutive Thai characters before inserting a break (default 10)
 * @param breakInterval - Interval (in characters) at which to insert break (default 5)
 * @returns The text with zero-width spaces inserted
 */
export function addThaiWordBreaks(
  text: string,
  maxChunk: number = 10,
  breakInterval: number = 5
): string {
  // Replace each Thai-only sequences longer than maxChunk
  return text.replace(THAI_SEQUENCE_REGEX, (match) => {
    if (match.length <= maxChunk) return match;
    // Insert zero-width space at intervals
    let result = '';
    for (let i = 0; i < match.length; i++) {
      if (i > 0 && i % breakInterval === 0) {
        result += '\u200B'; // zero-width space
      }
      result += match[i];
    }
    return result;
  });
}

/**
 * Check whether the given text contains any Thai character (in the Unicode range U+0E00–U+0E7F).
 * Returns `true` if at least one Thai character is present.
 */
export function needsThaiFont(text: string): boolean {
  return THAI_CHAR_REGEX.test(text);
}

/**
 * Compute a recommended line height (in pixels) for Thai text given a font size.
 * Thai script requires extra vertical space due to ascenders and descenders
 * of vowels and tone marks; the default multiplier is 1.5.
 *
 * @param fontSize - The font size in pixels
 * @returns Recommended line height in pixels
 */
export function thaiLineHeight(fontSize: number): number {
  return fontSize * 1.5;
}