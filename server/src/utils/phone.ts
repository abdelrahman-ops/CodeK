/**
 * Normalizes Egyptian phone numbers into a canonical format.
 * Examples:
 *  "01012345678" -> "+201012345678"
 *  "010 1234 5678" -> "+201012345678"
 *  "+20 1012345678" -> "+201012345678"
 *  "201012345678" -> "+201012345678"
 */
export function normalizeEgyptianPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  // Clean non-digits except initial '+'
  let cleaned = phone.trim().replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+20')) {
    return cleaned;
  }
  if (cleaned.startsWith('20') && cleaned.length >= 12) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return `+20${cleaned.substring(1)}`;
  }
  if (cleaned.startsWith('1') && cleaned.length === 10) {
    return `+20${cleaned}`;
  }
  
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }

  return cleaned;
}
