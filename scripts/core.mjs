import { FACES, mapFace } from "./mapping.mjs";

/** Schlüssel in `term.options`, mit dem ein Würfel als riskant markiert wird. */
export const OPTION_KEY = "riskyDie";

/**
 * Ist dieser Würfel als riskanter W20 markiert? Liefert die Anzahl Einsen/Zwanzigen.
 * @param {object} term
 * @returns {number|null}
 */
export function riskyCount(term) {
  const count = term?.options?.[OPTION_KEY]?.count;
  return Number.isFinite(count) ? count : null;
}

/** Modifikatoren, die mehrere W20 werfen und einen behalten (Vorteil, Nachteil, kh, kl, dh, dl). */
const MULTI_ROLL_MODIFIER = /^(adv|dis|k[hl]?|d[hl]?)(\d|$)/i;

/** Nachwurf-Modifikatoren: r, rr (z. B. Halfling Lucky „r1=1“). */
const REROLL_MODIFIER = /^rr?([<>=]|\d|$)/i;

/**
 * Wird dieser W20 mit Vorteil oder Nachteil geworfen?
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
 * Entfernt Nachwurf-Modifikatoren von einem Würfel.
 * @param {object} term
 * @returns {string[]}  Die entfernten Modifikatoren
 */
export function stripRerolls(term) {
  const removed = (term.modifiers ?? []).filter(m => REROLL_MODIFIER.test(m));
  if ( removed.length ) term.modifiers = term.modifiers.filter(m => !REROLL_MODIFIER.test(m));
  return removed;
}

/**
 * Patcht Foundrys Würfelklassen.
 *
 * - `Roll#evaluate`: Bevor ein Wurf ausgewertet wird, fragt `decide(roll)`, ob der Wurf
 *   riskant sein soll. Wenn ja und kein passender W20 mit Vorteil/Nachteil geworfen wird,
 *   werden die W20 markiert und ihre Nachwurf-Modifikatoren entfernt. Mit Vorteil/Nachteil
 *   bleibt der ganze Wurf normal.
 * - `Die#roll`: Jedes Ergebnis eines markierten W20 wird auf die riskanten Seiten abgebildet.
 *
 * @param {object} deps
 * @param {Function} deps.Roll           foundry.dice.Roll
 * @param {Function} deps.Die            foundry.dice.terms.Die
 * @param {(term: object) => boolean} deps.isEligible  Darf dieser Würfel riskant werden?
 * @param {(roll: object) => number|null} deps.decide  Anzahl Einsen/Zwanzigen oder null
 * @param {(roll: object, info: {rerollsRemoved: string[]}) => void} [deps.onApplied]  Nach einem riskanten Wurf
 * @param {(roll: object) => void} [deps.onBlocked]    Riskant gewünscht, aber Vorteil/Nachteil
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
