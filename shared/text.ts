/**
 * Text helpers copied from the client: plugins cannot import its modules, so
 * these stay byte-for-byte the client's behaviour.
 */

/**
 * Lower-cases and strips diacritics one UTF-16 unit at a time, so the result
 * has the same length as the input.
 */
export function foldText(text: string): string {
    let out = '';
    for (let i = 0; i < text.length; i++) {
        const lower = text[i]!.toLowerCase();
        // l-stroke has no canonical decomposition, so NFD leaves it alone.
        if (lower === 'ł') {
            out += 'l';
            continue;
        }
        out += lower.normalize('NFD')[0] ?? text[i];
    }
    return out;
}

/**
 * Normalized Levenshtein similarity: 0 (completely different) to 1 (identical).
 */
export function fuzzyMatchScore(a: string, b: string): number {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    if (aLower === bLower) return 1;
    if (aLower.length === 0 || bLower.length === 0) return 0;

    let previous = Array.from({ length: bLower.length + 1 }, (_, j) => j);
    for (let i = 1; i <= aLower.length; i++) {
        const current = [i];
        for (let j = 1; j <= bLower.length; j++) {
            const cost = aLower[i - 1] === bLower[j - 1] ? 0 : 1;
            current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
        }
        previous = current;
    }

    return 1 - previous[bLower.length]! / Math.max(aLower.length, bLower.length);
}
