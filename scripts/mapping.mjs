/**
 * Reine Würfellogik ohne Foundry-Abhängigkeiten.
 *
 * Ein riskanter W20 mit `count` Einsen und `count` Zwanzigen hat diese Seiten:
 *   count = 2:  1, 1, 3, 4, …, 18, 20, 20
 *   count = 3:  1, 1, 1, 4, …, 17, 20, 20, 20
 * Die Seiten direkt neben 1 und 20 fallen jeweils weg.
 */

export const FACES = 20;
export const MIN_COUNT = 2;
export const MAX_COUNT = 10;

/**
 * Begrenzt die eingestellte Anzahl auf den gültigen Bereich.
 * @param {number} count
 * @returns {number}
 */
export function clampCount(count) {
  const n = Math.round(Number(count));
  if ( !Number.isFinite(n) ) return MIN_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, n));
}

/**
 * Bildet das Ergebnis eines normalen W20 auf die Seite des riskanten W20 ab.
 * Weil die Seite gleichverteilt gewählt wird, ist das dasselbe wie ein Wurf mit dem
 * umbeschrifteten Würfel – egal ob das Ergebnis digital, von Dice So Nice oder von
 * einem echten Würfel kommt.
 * @param {number} result  Ergebnis 1–20
 * @param {number} count   Anzahl Einsen bzw. Zwanzigen
 * @returns {number}
 */
export function mapFace(result, count) {
  const k = clampCount(count);
  if ( result <= k ) return 1;
  if ( result >= FACES + 1 - k ) return FACES;
  return result;
}

/**
 * Die Seiten des riskanten W20, aufsteigend.
 * @param {number} count
 * @returns {number[]}
 */
export function faceList(count) {
  return Array.from({ length: FACES }, (_, i) => mapFace(i + 1, count));
}

/**
 * Wahrscheinlichkeit für eine natürliche 1 bzw. 20 in Prozent.
 * @param {number} count
 * @returns {number}
 */
export function extremeChance(count) {
  return clampCount(count) / FACES * 100;
}
