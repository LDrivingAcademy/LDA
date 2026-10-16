import assert from "node:assert/strict";
import { clickPatternReason, hazardClips, scoreClip, scoreHazard, validateClipBank } from "../src/lib/hazard-perception";

const clip = hazardClips[0], h = clip.hazards[0];
assert.equal(hazardClips.length, 14);
assert.equal(hazardClips.reduce((n, c) => n + c.hazards.length, 0), 15);
assert.deepEqual(validateClipBank(hazardClips), []);
assert.equal(scoreHazard(h.start - 0.001, h), 0);
assert.equal(scoreHazard(h.start, h), 5);
assert.equal(scoreHazard(h.start + 0.81, h), 4);
assert.equal(scoreHazard(h.end - 0.001, h), 1);
assert.equal(scoreHazard(h.end, h), 0);
for (let band = 0; band < 5; band++) {
  const boundary = h.start + (h.end - h.start) * band / 5;
  assert.equal(scoreHazard(boundary + 0.000001, h), 5 - band);
  if (band) assert.equal(scoreHazard(boundary - 0.000001, h), 6 - band);
}
assert.equal(scoreHazard(NaN, h), 0);
assert.equal(scoreClip(clip, []).total, 0);
assert.equal(scoreClip(clip, [h.start - 1, h.start + 0.1, h.start + 1]).total, 5);
assert.equal(scoreClip(clip, [h.start + 2, h.start + 0.1]).total, 5);
assert.equal(scoreClip(clip, [NaN, Infinity, -1, clip.duration + 1]).total, 0);
assert.equal(clickPatternReason([1, 1.2, 1.4]), null, "Small follow-up burst must not automatically void a clip");
assert.ok(clickPatternReason(Array.from({ length: 8 }, (_, i) => i * 0.1)));
assert.ok(clickPatternReason(Array.from({ length: 8 }, (_, i) => i * 0.8)));
assert.equal(clickPatternReason([0.4, 2.1, 4.4, 4.9, 7.6, 10.3, 11.7, 14.2, 17.1, 20.4, 25.3]), null);
assert.equal(scoreClip(clip, Array.from({ length: 8 }, (_, i) => h.start + i * 0.1)).total, 0);
const double = hazardClips[13];
assert.equal(scoreClip(double, double.hazards.map((v) => v.start + 0.1)).total, 10);
assert.equal(hazardClips.reduce((sum, c) => sum + scoreClip(c, c.hazards.map((v) => v.start)).total, 0), 75);
assert.ok(validateClipBank([clip, clip]).length);
console.log("Hazard perception: 20 scoring, bank and boundary checks passed.");
