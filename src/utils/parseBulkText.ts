/**
 * parseBulkText.ts
 * Parses a raw bulk-address text (blank-line separated blocks) into
 * structured ParsedRecord objects ready for user review.
 */
import { searchPincodes } from '../data/india_pincodes';

export interface ParsedRecord {
  /** Unique key for React list rendering */
  _key: string;
  name: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  /** Auto-suggested category id from pincode/city lookup */
  suggestedCategory: string;
  /** Completeness flag — missing critical fields */
  needsReview: boolean;
  /** The raw block text this was parsed from */
  rawBlock: string;
}

// ── Shared regex / keyword constants ──────────────────────────────────────────

const PHONE_RE    = /(?:\+91|0)?\s?[6-9]\d{4}\s?\d{5}/;
const PINCODE_RE  = /\b(\d{6})\b/;

const ADDR_KEYWORDS = [
  'street','road',' st ',' rd ','nagar','puram','colony','layout',
  'no:','door','floor','town','dist','taluk','india','opposite',
  'near','beside','main','cross','avenue','lane','bazaar','bazar',
  'salai','theru','veedhi','plot','block','phase','sector','ward',
];

const JUNK_RE = /www\.|http|@|\.com|\.in|\.org/i;

const TITLE_RE = /^(Mr|Ms|Mrs|Dr|Shri|Smt|Thiru|Tmt|Prof)\.?\s/i;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Splits `rawText` on blank lines and parses each block into a ParsedRecord.
 */
export function parseBulkText(rawText: string): ParsedRecord[] {
  // Split on one-or-more blank lines
  const blocks = rawText
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(b => b.length > 0);

  return blocks.map((block, idx) => parseBlock(block, idx));
}

// ── Per-block parser ──────────────────────────────────────────────────────────

function parseBlock(block: string, idx: number): ParsedRecord {
  const lines = block
    .split('\n')
    .map(l => l.trim().replace(/[|_*~`^]/g, '').trim())
    .filter(l => l.length > 1);

  let name    = '';
  let phone   = '';
  let pincode = '';
  let city    = '';
  const addressParts: string[] = [];

  for (const line of lines) {
    if (JUNK_RE.test(line)) continue;
    const lo = line.toLowerCase();

    // ── Phone ──
    if (!phone && PHONE_RE.test(line)) {
      const m = line.match(PHONE_RE);
      if (m) phone = m[0].replace(/[\s+]/g, '').replace(/^91/, '').slice(-10);
      continue;
    }

    // ── Pincode → auto-lookup city ──
    if (!pincode && PINCODE_RE.test(line)) {
      const m = line.match(PINCODE_RE);
      if (m) {
        pincode = m[1];
        const hits = searchPincodes(pincode);
        if (hits.length > 0 && !city) city = hits[0].city;
        addressParts.push(line);
        continue;
      }
    }

    // ── Address keywords ──
    if (ADDR_KEYWORDS.some(k => lo.includes(k))) {
      addressParts.push(line);
      continue;
    }

    // ── Name heuristic ──
    const hasTitle    = TITLE_RE.test(line);
    const isShortAlpha = line.length < 45
      && /^[A-Z\u0B80-\u0BFF]/i.test(line)
      && !/\d/.test(line)
      && line.split(' ').length <= 6;

    if (!name && (hasTitle || isShortAlpha)) {
      name = line;
    } else if (line.length > 3) {
      addressParts.push(line);
    }
  }

  // Fallback city from address parts
  if (!city && addressParts.length > 0) {
    city = guessCityFromAddress(addressParts.join(' '));
  }

  const needsReview = !name || !phone;

  return {
    _key: `bulk_${idx}_${Date.now()}`,
    name,
    phone,
    address: addressParts.join(', '),
    pincode,
    city,
    suggestedCategory: '',   // caller fills this based on city matching
    needsReview,
    rawBlock: block,
  };
}

// ── City guesser from free-text ───────────────────────────────────────────────

/**
 * Tries to find a city name by running searchPincodes on words in the address.
 */
function guessCityFromAddress(addr: string): string {
  const words = addr.split(/[\s,]+/).filter(w => w.length > 3);
  for (const word of words) {
    const hits = searchPincodes(word);
    if (hits.length > 0) return hits[0].city;
  }
  return '';
}

/**
 * Given a city string and a list of Category objects, returns the best
 * matching category id (by name similarity), or empty string if none found.
 */
export function suggestCategoryForCity(
  city: string,
  categories: { id: string; name: string }[]
): string {
  if (!city) return '';
  const lo = city.toLowerCase();
  const match = categories.find(c => c.name.toLowerCase().includes(lo) || lo.includes(c.name.toLowerCase()));
  return match?.id ?? '';
}
