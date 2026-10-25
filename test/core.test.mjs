import { test } from "node:test";
import assert from "node:assert/strict";
import { OPTION_KEY, installPatches, riskyCount } from "../scripts/core.mjs";

// Minimal stand-in for Foundry's Die/Roll: Die#roll creates a result and returns it,
// Roll#evaluate rolls every die. Results come from a fixed sequence.
function makeFoundry(sequence) {
  let i = 0;
  class Die {
    constructor(faces, number = 1, extra = 0) { this.faces = faces; this.number = number; this.extra = extra; this.options = {}; this.modifiers = []; this.results = []; }
    async roll() { const r = { result: sequence[i++ % sequence.length], active: true }; this.results.push(r); return r; }
    // rolls `extra` additional times through roll(), like advantage does internally
    async evaluate() { for ( let n = 0; n < this.number + this.extra; n++ ) await this.roll(); }
  }
  class Roll {
    constructor(dice) { this.dice = dice; this._evaluated = false; }
    async evaluate() { for ( const d of this.dice ) await d.evaluate(); this._evaluated = true; return this; }
  }
  return { Die, Roll };
}

test("marked d20 rolls risky, other dice do not", async () => {
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

test("every single result of a marked die is mapped", async () => {
  const { Die, Roll } = makeFoundry([19, 3]);
  const patches = installPatches({ Roll, Die, isEligible: () => true, decide: () => 2 });
  const d20 = new Die(20, 1, 1);
  await new Roll([d20]).evaluate();
  assert.deepEqual(d20.results.map(r => r.result), [20, 3]);
  patches.uninstall();
});

test("not armed: normal roll, onApplied is not called", async () => {
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

test("onApplied once per risky roll, decide only for eligible dice", async () => {
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

test("advantage/disadvantage: roll stays normal, onBlocked instead of onApplied", async () => {
  const { Die, Roll } = makeFoundry([2, 19]);
  let applied = 0, blocked = 0;
  const patches = installPatches({ Roll, Die, isEligible: d => d.faces === 20, decide: () => 2,
    onApplied: () => applied++, onBlocked: () => blocked++ });
  const adv = new Die(20, 2); adv.modifiers = ["kh"];
  await new Roll([adv]).evaluate();
  assert.deepEqual(adv.results.map(r => r.result), [2, 19]);
  assert.equal(riskyCount(adv), null);

  const dnd = new Die(20); dnd.modifiers = ["adv"];
  await new Roll([dnd]).evaluate();
  const viaOption = new Die(20); const roll = new Roll([viaOption]); roll.options = { advantageMode: -1 };
  await roll.evaluate();
  assert.equal(riskyCount(dnd), null);
  assert.equal(riskyCount(viaOption), null);
  assert.equal(blocked, 3);
  assert.equal(applied, 0);
  patches.uninstall();
});

test("rerolls are removed, other modifiers stay", async () => {
  const { Die, Roll } = makeFoundry([2]);
  let info = null;
  const patches = installPatches({ Roll, Die, isEligible: () => true, decide: () => 2, onApplied: (r, i) => { info = i; } });
  const d20 = new Die(20); d20.modifiers = ["r1=1", "min10", "rr<3", "cs>=19"];
  await new Roll([d20]).evaluate();
  assert.deepEqual(d20.modifiers, ["min10", "cs>=19"]);
  assert.deepEqual(info.rerollsRemoved, ["r1=1", "rr<3"]);
  patches.uninstall();
});
