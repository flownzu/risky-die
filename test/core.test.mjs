import { test } from "node:test";
import assert from "node:assert/strict";
import { OPTION_KEY, installPatches, riskyCount } from "../scripts/core.mjs";

// Minimale Nachbildung von Foundrys Die/Roll: Die#roll legt ein Ergebnis an und gibt es zurück,
// Roll#evaluate würfelt alle Würfel. Ergebnisse kommen aus einer festen Folge.
function makeFoundry(sequence) {
  let i = 0;
  class Die {
    constructor(faces, number = 1, extra = 0) { this.faces = faces; this.number = number; this.extra = extra; this.options = {}; this.results = []; }
    async roll() { const r = { result: sequence[i++ % sequence.length], active: true }; this.results.push(r); return r; }
    // nachgebildeter Vorteil: würfelt intern erneut über roll()
    async evaluate() { for ( let n = 0; n < this.number + this.extra; n++ ) await this.roll(); }
  }
  class Roll {
    constructor(dice) { this.dice = dice; this._evaluated = false; }
    async evaluate() { for ( const d of this.dice ) await d.evaluate(); this._evaluated = true; return this; }
  }
  return { Die, Roll };
}

test("markierter W20 würfelt riskant, andere Würfel nicht", async () => {
  const { Die, Roll } = makeFoundry([2, 19, 2, 5]);
  const patches = installPatches({ Roll, Die, isEligible: d => d.faces === 20, decide: () => 2 });
  const d20 = new Die(20), d6 = new Die(6), second = new Die(20);
  await new Roll([d20, second, d6]).evaluate();
  assert.equal(d20.results[0].result, 1);
  assert.equal(second.results[0].result, 20);
  assert.equal(d6.results[0].result, 2);
  assert.equal(riskyCount(d20), 2);
  assert.equal(riskyCount(d6), null);
  patches.uninstall();
});

test("Vorteil: jeder Einzelwurf wird abgebildet", async () => {
  const { Die, Roll } = makeFoundry([19, 3]);
  const patches = installPatches({ Roll, Die, isEligible: () => true, decide: () => 2 });
  const d20 = new Die(20, 1, 1);
  await new Roll([d20]).evaluate();
  assert.deepEqual(d20.results.map(r => r.result), [20, 3]);
  patches.uninstall();
});

test("nicht scharf: normaler Wurf, onApplied wird nicht gerufen", async () => {
  const { Die, Roll } = makeFoundry([2]);
  let applied = 0;
  const patches = installPatches({ Roll, Die, isEligible: () => true, decide: () => null, onApplied: () => applied++ });
  const d20 = new Die(20);
  await new Roll([d20]).evaluate();
  assert.equal(d20.results[0].result, 2);
  assert.equal(OPTION_KEY in d20.options, false);
  assert.equal(applied, 0);
  patches.uninstall();
});

test("onApplied genau einmal pro riskantem Wurf, decide nur bei passendem Würfel", async () => {
  const { Die, Roll } = makeFoundry([10]);
  let applied = 0, asked = 0;
  const patches = installPatches({
    Roll, Die, isEligible: d => d.faces === 20,
    decide: () => { asked++; return 3; }, onApplied: () => applied++
  });
  await new Roll([new Die(20), new Die(20)]).evaluate();
  await new Roll([new Die(8)]).evaluate();
  assert.equal(applied, 1);
  assert.equal(asked, 1);
  patches.uninstall();
});
