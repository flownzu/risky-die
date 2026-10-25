/**
 * Pure dice logic without Foundry dependencies.
 *
 * A risky d20 with `count` ones and `count` twenties has these faces:
 *   count = 2:  1, 1, 3, 4, …, 18, 20, 20
 *   count = 3:  1, 1, 1, 4, …, 17, 20, 20, 20
 * The faces next to 1 and 20 are removed.
 */

export const FACES = 20;
export const MIN_COUNT = 2;
export const MAX_COUNT = 10;

/**
 * Clamps the configured count to the valid range.
 * @param {number} count
 * @returns {number}
 */
export function clampCount(count) {
  const n = Math.round(Number(count));
  if ( !Number.isFinite(n) ) return MIN_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, n));
}

/**
 * Maps the result of a normal d20 onto the face of the risky d20.
 * Since the face is picked uniformly, this is the same as rolling the relabelled die,
 * whether the result is digital, from Dice So Nice or from a physical die.
 * @param {number} result  Result 1–20
 * @param {number} count   Number of ones and twenties
 * @returns {number}
 */
export function mapFace(result, count) {
  const k = clampCount(count);
  if ( result <= k ) return 1;
  if ( result >= FACES + 1 - k ) return FACES;
  return result;
}

/**
 * The faces of the risky d20, ascending.
 * @param {number} count
 * @returns {number[]}
 */
export function faceList(count) {
  return Array.from({ length: FACES }, (_, i) => mapFace(i + 1, count));
}

/**
 * Chance of a natural 1 (or 20) in percent.
 * @param {number} count
 * @returns {number}
 */
export function extremeChance(count) {
  return clampCount(count) / FACES * 100;
}
