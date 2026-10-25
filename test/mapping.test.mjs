import { test } from "node:test";
import assert from "node:assert/strict";
import { clampCount, extremeChance, faceList, mapFace } from "../scripts/mapping.mjs";

test("two ones and two twenties, no 2 and no 19", () => {
  const faces = faceList(2);
  assert.equal(faces.length, 20);
  assert.equal(faces.filter(f => f === 1).length, 2);
  assert.equal(faces.filter(f => f === 20).length, 2);
  assert.ok(!faces.includes(2));
  assert.ok(!faces.includes(19));
  assert.deepEqual(faces.slice(2, 18), Array.from({ length: 16 }, (_, i) => i + 3));
});

test("average stays 10.5 for every count", () => {
  for ( let k = 2; k <= 10; k++ ) {
    const faces = faceList(k);
    assert.equal(faces.reduce((a, b) => a + b, 0) / 20, 10.5, `count ${k}`);
    assert.equal(faces.filter(f => f === 1).length, k);
    assert.equal(faces.filter(f => f === 20).length, k);
  }
});

test("count is clamped to 2–10", () => {
  assert.equal(clampCount(1), 2);
  assert.equal(clampCount(15), 10);
  assert.equal(clampCount("3"), 3);
  assert.equal(clampCount(NaN), 2);
  assert.deepEqual(faceList(10), [...Array(10).fill(1), ...Array(10).fill(20)]);
});

test("mapping is monotonic", () => {
  for ( let r = 1; r < 20; r++ ) assert.ok(mapFace(r, 3) <= mapFace(r + 1, 3));
});

test("chance of a 1 or a 20", () => {
  assert.equal(extremeChance(2), 10);
  assert.equal(extremeChance(3), 15);
});
