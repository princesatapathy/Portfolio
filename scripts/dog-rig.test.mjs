// Headless tests for the low-poly dog rig (no browser needed): node --test scripts/dog-rig.test.mjs
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { applyDogPose, createDogRig, STANDING } from "../src/models/dogRig.ts";
import { measureDog, SIT_REQUIREMENTS, STAND_REQUIREMENTS } from "./dog-metrics.mjs";

const round = (metrics) =>
  JSON.stringify(Object.fromEntries(Object.entries(metrics).filter(([key]) => key !== "markers").map(([key, value]) => [key, +value.toFixed(2)])));

describe("dog standing", () => {
  const rig = createDogRig();
  applyDogPose(rig, STANDING);
  const standing = measureDog(rig);

  for (const [label, passes] of STAND_REQUIREMENTS) {
    test(label, () => assert.ok(passes(standing), round(standing)));
  }
});

describe("dog sitting", () => {
  const rig = createDogRig();
  applyDogPose(rig, { ...STANDING, sit: 1 });
  const seated = measureDog(rig);

  for (const [label, passes] of SIT_REQUIREMENTS) {
    test(label, () => assert.ok(passes(seated), round(seated)));
  }
});

describe("dog walking", () => {
  test("paws swing and nothing sinks into the ground at any point of the stride", () => {
    const rig = createDogRig();
    let travelled = 0;
    let previous = null;
    for (let step = 0; step <= 64; step++) {
      applyDogPose(rig, { ...STANDING, walk: 1, walkPhase: (step / 64) * Math.PI * 2 });
      const metrics = measureDog(rig);
      assert.ok(metrics.lowestPoint >= -0.03, `sinks into the ground at step ${step}: ${metrics.lowestPoint.toFixed(3)}`);
      assert.ok(metrics.lowestPoint <= 0.03, `floats at step ${step}: ${metrics.lowestPoint.toFixed(3)}`);
      if (previous) travelled = Math.max(travelled, Math.abs(metrics.markers.pawFrontLeft.z - previous.markers.pawFrontLeft.z));
      previous = metrics;
    }
    assert.ok(travelled > 0.01, "the paws never move");
  });

  test("the front paw swings through a real stride (>= 0.3)", () => {
    const rig = createDogRig();
    const zs = [];
    for (let step = 0; step < 32; step++) {
      applyDogPose(rig, { ...STANDING, walk: 1, walkPhase: (step / 32) * Math.PI * 2 });
      zs.push(measureDog(rig).markers.pawFrontLeft.z);
    }
    assert.ok(Math.max(...zs) - Math.min(...zs) >= 0.3, `stride only ${(Math.max(...zs) - Math.min(...zs)).toFixed(2)}`);
  });
});

describe("dog transitions", () => {
  test("sitting down moves every marker smoothly (no snaps between small steps)", () => {
    const rig = createDogRig();
    let previous = null;
    let largest = 0;
    for (let step = 0; step <= 100; step++) {
      applyDogPose(rig, { ...STANDING, sit: step / 100 });
      rig.root.updateMatrixWorld(true);
      const points = Object.values(measureDog(rig).markers).map((point) => point.clone());
      if (previous) points.forEach((point, index) => { largest = Math.max(largest, point.distanceTo(previous[index])); });
      previous = points;
    }
    assert.ok(largest <= 0.06, `a marker jumped ${largest.toFixed(3)} in one 1% step`);
  });

  test("standing up again returns exactly to the standing pose", () => {
    const rig = createDogRig();
    applyDogPose(rig, STANDING);
    const before = measureDog(rig);
    applyDogPose(rig, { ...STANDING, sit: 1 });
    applyDogPose(rig, STANDING);
    const after = measureDog(rig);
    for (const name of Object.keys(before.markers)) {
      assert.ok(before.markers[name].distanceTo(after.markers[name]) < 1e-6, `${name} did not return`);
    }
  });

  test("while sitting the paws and rump stay planted through the whole idle motion", () => {
    const rig = createDogRig();
    for (let step = 0; step < 40; step++) {
      applyDogPose(rig, { ...STANDING, sit: 1, idleTime: step * 0.15 });
      const metrics = measureDog(rig);
      assert.ok(metrics.highestFrontPaw <= 0.06 && metrics.highestHindPaw <= 0.06, `paw lifted at step ${step}`);
      assert.ok(metrics.lowestPoint >= -0.03, `sinks at step ${step}`);
    }
  });
});

describe("dog tail wag", () => {
  const tailTipXs = (pose, seconds = 2, step = 0.01) => {
    const rig = createDogRig();
    const xs = [];
    const pelvisZ = [];
    const shoulderY = [];
    let worst = { paw: 0, rump: 0 };
    for (let t = 0; t < seconds; t += step) {
      applyDogPose(rig, { ...STANDING, ...pose, idleTime: t });
      const metrics = measureDog(rig);
      xs.push(metrics.markers.tailTip.x);
      pelvisZ.push(metrics.markers.pelvis.z);
      shoulderY.push(metrics.markers.shoulder.y);
      worst = { paw: Math.max(worst.paw, metrics.highestFrontPaw, metrics.highestHindPaw), rump: Math.max(worst.rump, metrics.rumpHeight) };
    }
    return { xs, pelvisZ, shoulderY, worst };
  };
  const range = (values) => Math.max(...values) - Math.min(...values);

  test("wagging sweeps the tail tip well to both sides (>= 0.5)", () => {
    const { xs } = tailTipXs({ sit: 1, wag: 1 });
    assert.ok(range(xs) >= 0.5, `tail tip only swept ${range(xs).toFixed(2)}`);
  });

  test("the tail wags at a happy rate: 2.5 to 5 wags per second", () => {
    const { xs } = tailTipXs({ sit: 1, wag: 1 }, 4);
    const mean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
    let crossings = 0;
    for (let i = 1; i < xs.length; i++) if ((xs[i - 1] - mean) * (xs[i] - mean) < 0) crossings++;
    const wagsPerSecond = crossings / 2 / 4;
    assert.ok(wagsPerSecond >= 2.5 && wagsPerSecond <= 5, `${wagsPerSecond.toFixed(1)} wags per second`);
  });

  test("only the tail moves: body, paws and rump stay planted while wagging", () => {
    const { pelvisZ, shoulderY, worst } = tailTipXs({ sit: 1, wag: 1 });
    assert.ok(range(pelvisZ) < 0.02, `pelvis moved ${range(pelvisZ).toFixed(3)}`);
    assert.ok(range(shoulderY) < 0.02, `shoulders moved ${range(shoulderY).toFixed(3)}`);
    assert.ok(worst.paw <= 0.06, `a paw lifted to ${worst.paw.toFixed(3)}`);
    assert.ok(worst.rump <= 0.12, `the rump lifted to ${worst.rump.toFixed(3)}`);
  });

  test("the wag also flicks the tail up and down, so it reads from any angle (>= 0.15 of height change)", () => {
    const rig = createDogRig();
    const heights = [];
    for (let time = 0; time < 2; time += 0.01) {
      applyDogPose(rig, { ...STANDING, sit: 1, wag: 1, idleTime: time });
      heights.push(measureDog(rig).markers.tailTip.y);
    }
    assert.ok(range(heights) >= 0.15, `tail tip height only changed ${range(heights).toFixed(2)}`);
  });

  test("without hovering the tail rests (sweeps less than 0.35)", () => {
    const { xs } = tailTipXs({ sit: 1, wag: 0 });
    assert.ok(range(xs) <= 0.35, `tail swept ${range(xs).toFixed(2)} without a wag`);
  });

  test("the wag fades in smoothly (the tail tip never jumps more than 0.05 per 1% of wag)", () => {
    const rig = createDogRig();
    let previous = null;
    let largest = 0;
    for (let step = 0; step <= 100; step++) {
      applyDogPose(rig, { ...STANDING, sit: 1, wag: step / 100, idleTime: 0.07 });
      const tip = measureDog(rig).markers.tailTip.clone();
      if (previous) largest = Math.max(largest, tip.distanceTo(previous));
      previous = tip;
    }
    assert.ok(largest <= 0.05, `tail tip jumped ${largest.toFixed(3)}`);
  });
});
