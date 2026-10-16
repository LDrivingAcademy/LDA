import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/live-gps-utils.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    strict: true,
  },
}).outputText;

const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const gps = await import(moduleUrl);

assert.equal(gps.normaliseGpsCoordinate("51.5", "lat"), 51.5);
assert.equal(gps.normaliseGpsCoordinate("181", "lng"), null);
assert.equal(gps.normaliseGpsAccuracy(12.7), 12.7);
assert.equal(gps.normaliseGpsHeading(-10), 350);
assert.equal(gps.normaliseGpsSpeed("4.567"), 4.57);

const pointA = {
  lat: 51.5,
  lng: -0.14,
  accuracy: 10,
  heading: null,
  speed: null,
  recordedAt: "2026-07-12T10:00:00.000Z",
};
const pointB = {
  lat: 51.5002,
  lng: -0.14,
  accuracy: 10,
  heading: null,
  speed: null,
  recordedAt: "2026-07-12T10:00:03.000Z",
};

assert.ok(gps.distanceInMetersBetweenPoints(pointA, pointB) > 20);
assert.equal(gps.shouldSendLiveGpsUpdate({ previousSent: null, current: pointA }), true);
assert.equal(
  gps.shouldSendLiveGpsUpdate({
    previousSent: { ...pointA, sentAtMs: 1000 },
    current: { ...pointA },
    nowMs: 2000,
  }),
  false,
);
assert.equal(
  gps.shouldSendLiveGpsUpdate({
    previousSent: { ...pointA, sentAtMs: 1000 },
    current: pointB,
    nowMs: 5000,
  }),
  true,
);

const smoothed = gps.smoothGpsPoint(pointA, pointB);
assert.ok(smoothed.lat > pointA.lat);
assert.ok(smoothed.lat < pointB.lat);
assert.ok(smoothed.heading !== null);

console.log("Live GPS utility tests passed.");
