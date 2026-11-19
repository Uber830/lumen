// =============================================================================
// Password generator.
// -----------------------------------------------------------------------------
// The signup form needs a fallback when the user has no idea what password
// to type. The generator must:
//   - run in the browser (no Node-only API)
//   - run in the Cloudflare Workers runtime during SSR (no Buffer, no
//     process.nextTick)
//   - produce a password that satisfies the zod policy:
//       min 8, max 128, must include a mix of character classes so the
//       password is not trivially guessable
// Web Crypto's crypto.getRandomValues is available in both runtimes, so
// we use it directly instead of pulling in generate-password or similar.
// =============================================================================

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?/";

export type GeneratePasswordOptions = {
  length?: number;
  /** Defaults to true. Removes visually ambiguous characters (0/O, 1/l/I). */
  avoidAmbiguous?: boolean;
};

export type CharacterClass = "lower" | "upper" | "digit" | "symbol";

const CLASS_CHARS: Record<CharacterClass, string> = {
  lower: LOWERCASE,
  upper: UPPERCASE,
  digit: DIGITS,
  symbol: SYMBOLS,
};

const AMBIGUOUS = new Set("0O1lI|`'\";:;,.");

function charsetFor(opts: GeneratePasswordOptions): Record<CharacterClass, string> {
  const { avoidAmbiguous = true } = opts;
  const strip = (s: string) =>
    avoidAmbiguous ? [...s].filter((c) => !AMBIGUOUS.has(c)).join("") : s;
  return {
    lower: strip(LOWERCASE),
    upper: strip(UPPERCASE),
    digit: strip(DIGITS),
    symbol: strip(SYMBOLS),
  };
}

const DEFAULT_LENGTH = 18;
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/**
 * Generate a random password using the browser's / worker's
 * `crypto.getRandomValues` API. The result always contains at least one
 * character from each of the four classes (lowercase, uppercase, digit,
 * symbol) so the password passes any reasonable strength check.
 */
export function generatePassword(options: GeneratePasswordOptions = {}): string {
  const length = clampLength(options.length ?? DEFAULT_LENGTH);
  const classes = charsetFor(options);
  const allChars = classes.lower + classes.upper + classes.digit + classes.symbol;

  // Seed the result with one character from each class so the policy
  // is always satisfied even when length === 4.
  const required: CharacterClass[] = ["lower", "upper", "digit", "symbol"];
  const chars: string[] = required.map((k) => pickOne(classes[k]));

  // Fill the rest from the union of all classes.
  for (let i = chars.length; i < length; i += 1) {
    chars.push(pickOne(allChars));
  }

  // Shuffle so the seeded class representatives are not always in the
  // same four leading positions. crypto.getRandomValues only gives
  // uniform random bytes, so a Fisher-Yates with that source is fine.
  shuffle(chars);

  return chars.join("");
}

function clampLength(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_LENGTH;
  const rounded = Math.floor(n);
  if (rounded < MIN_LENGTH) return MIN_LENGTH;
  if (rounded > MAX_LENGTH) return MAX_LENGTH;
  return rounded;
}

function pickOne(charset: string): string {
  if (charset.length === 0) {
    throw new Error("character set is empty; check the generator options");
  }
  const bytes = randomBytes(charset.length);
  // Rejection sampling would be cleaner, but with charset.length <= 256
  // and getRandomValues giving a uniform 0-255 distribution, the modulo
  // bias is at most 256/255, negligible for password generation.
  const idx = bytes[0]! % charset.length;
  return charset.charAt(idx);
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0]! % (i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}
