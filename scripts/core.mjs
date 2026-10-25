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

/**
 * Patcht Foundrys Würfelklassen.
 *
 * - `Roll#evaluate`: Bevor ein Wurf ausgewertet wird, fragt `decide(roll)`, ob der Wurf
 *   riskant sein soll. Wenn ja, werden die passenden W20 markiert.
 * - `Die#roll`: Jedes einzelne Ergebnis eines markierten W20 wird auf die riskanten
 *   Seiten abgebildet. Das gilt auch für Vorteil, Nachwürfe (Halfling Lucky) usw.,
 *   weil diese intern wieder `roll()` aufrufen.
 *
 * @param {object} deps
 * @param {Function} deps.Roll           foundry.dice.Roll
 * @param {Function} deps.Die            foundry.dice.terms.Die
 * @param {(term: object) => boolean} deps.isEligible  Darf dieser Würfel riskant werden?
 * @param {(roll: object) => number|null} deps.decide  Anzahl Einsen/Zwanzigen oder null
 * @param {(roll: object) => void} [deps.onApplied]    Nach einem riskanten Wurf
 */
export function installPatches({ Roll, Die, isEligible, decide, onApplied }) {
  const originalEvaluate = Roll.prototype.evaluate;
  Roll.prototype.evaluate = async function(...args) {
    let applied = false;
    if ( !this._evaluated ) {
      const eligible = this.dice.filter(d => isEligible(d) && (riskyCount(d) === null));
      const count = eligible.length ? decide(this) : null;
      if ( count !== null ) {
        for ( const die of eligible ) die.options[OPTION_KEY] = { count };
        applied = true;
      }
    }
    const result = await originalEvaluate.apply(this, args);
    if ( applied ) onApplied?.(this);
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
