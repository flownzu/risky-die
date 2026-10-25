import { FACES, mapFace } from "./mapping.mjs";

/** Key in `term.options` that marks a die as risky. */
export const OPTION_KEY = "riskyDie";

/**
 * Is this die marked as a risky d20? Returns the number of ones/twenties.
 * @param {object} term
 * @returns {number|null}
 */
export function riskyCount(term) {
  const count = term?.options?.[OPTION_KEY]?.count;
  return Number.isFinite(count) ? count : null;
}

/** Modifiers that roll several d20s and keep one (advantage, disadvantage, kh, kl, dh, dl). */
const MULTI_ROLL_MODIFIER = /^(adv|dis|k[hl]?|d[hl]?)(\d|$)/i;

/** Reroll modifiers: r, rr (e.g. Halfling Lucky "r1=1"). */
const REROLL_MODIFIER = /^rr?([<>=]|\d|$)/i;

/**
 * Is this d20 rolled with advantage or disadvantage?
 * @param {object} term
 * @param {object} [roll]
 * @returns {boolean}
 */
export function hasAdvantage(term, roll) {
  if ( roll?.options?.advantageMode ) return true;
  if ( term.options?.pending?.advantage ) return true;
  if ( (term.number ?? 1) !== 1 ) return true;
  return (term.modifiers ?? []).some(m => MULTI_ROLL_MODIFIER.test(m));
}

/**
 * Removes reroll modifiers from a die.
 * @param {object} term
 * @returns {string[]}  The removed modifiers
 */
export function stripRerolls(term) {
  const removed = (term.modifiers ?? []).filter(m => REROLL_MODIFIER.test(m));
  if ( removed.length ) term.modifiers = term.modifiers.filter(m => !REROLL_MODIFIER.test(m));
  return removed;
}

/**
 * Patches Foundry's dice classes.
 *
 * - `Roll#evaluate`: Before a roll is evaluated, `decide(roll)` says whether it should be risky.
 *   If so and no eligible d20 is rolled with advantage/disadvantage, the d20s are marked and
 *   their reroll modifiers removed. With advantage/disadvantage the whole roll stays normal.
 * - `Die#roll`: Every result of a marked d20 is mapped onto the risky faces.
 *
 * @param {object} deps
 * @param {Function} deps.Roll           foundry.dice.Roll
 * @param {Function} deps.Die            foundry.dice.terms.Die
 * @param {(term: object) => boolean} deps.isEligible  May this die become risky?
 * @param {(roll: object) => number|null} deps.decide  Number of ones/twenties, or null
 * @param {(roll: object, info: {rerollsRemoved: string[]}) => void} [deps.onApplied]  After a risky roll
 * @param {(roll: object) => void} [deps.onBlocked]    Risky requested, but advantage/disadvantage
 */
export function installPatches({ Roll, Die, isEligible, decide, onApplied, onBlocked }) {
  const originalEvaluate = Roll.prototype.evaluate;
  Roll.prototype.evaluate = async function(...args) {
    let applied = null;
    if ( !this._evaluated ) {
      const eligible = this.dice.filter(d => isEligible(d) && (riskyCount(d) === null));
      const count = eligible.length ? decide(this) : null;
      if ( (count !== null) && eligible.some(d => hasAdvantage(d, this)) ) onBlocked?.(this);
      else if ( count !== null ) {
        const rerollsRemoved = [];
        for ( const die of eligible ) {
          rerollsRemoved.push(...stripRerolls(die));
          die.options[OPTION_KEY] = { count };
        }
        applied = { rerollsRemoved };
      }
    }
    const result = await originalEvaluate.apply(this, args);
    if ( applied ) onApplied?.(this, applied);
    return result;
  };

  const originalRoll = Die.prototype.roll;
  Die.prototype.roll = async function(...args) {
    const result = await originalRoll.apply(this, args);
    const count = riskyCount(this);
    if ( (count !== null) && (this.faces === FACES) && Number.isFinite(result?.result) ) {
      result.result = mapFace(result.result, count);
    }
    return result;
  };

  return {
    uninstall() {
      Roll.prototype.evaluate = originalEvaluate;
      Die.prototype.roll = originalRoll;
    }
  };
}
