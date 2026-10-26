// Browser tests for the contact-page dog: it sits by default, hovering wags its tail,
// double-click makes it stand (walks while hovered), double-click again sits it back down.
// Needs the site running (npm run preview) and Playwright:
//   PLAYWRIGHT_MODULE=<path to playwright> node --test scripts/dog-page.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";

import { measureFromPoints, SIT_REQUIREMENTS, STAND_REQUIREMENTS } from "./dog-metrics.mjs";

// createRequire so an absolute PLAYWRIGHT_MODULE path also works on Windows
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4173";

// page coordinates on the dog (viewport 1280x607)
const ON_DOG = { x: 880, y: 360 };
const AWAY_FROM_DOG = { x: 300, y: 300 };

let browser;
let page;
const pageErrors = [];

// marker positions straight from the live rig, in the dog's own space
const readMarkers = () =>
  page.evaluate(() => {
    const { rig } = window.__dogTest;
    rig.root.updateMatrixWorld(true);
    const inverse = rig.root.matrixWorld.clone().invert();
    return Object.fromEntries(
      Object.entries(rig.markers).map(([name, object]) => {
        const point = object.getWorldPosition(object.position.clone()).applyMatrix4(inverse);
        return [name, { x: point.x, y: point.y, z: point.z }];
      }),
    );
  });

const metricsNow = async () => measureFromPoints(await readMarkers(), 0);
const dogState = () => page.evaluate(() => ({ ...window.__dogTest.state }));
const describeMetrics = (metrics) =>
  JSON.stringify(Object.fromEntries(Object.entries(metrics).filter(([key]) => key !== "markers").map(([key, value]) => [key, +value.toFixed(2)])));

// samples the tail tip sideways position for `durationMs`
const sampleTailSweep = async (durationMs = 900, everyMs = 30) => {
  const xs = [];
  for (let waited = 0; waited < durationMs; waited += everyMs) {
    xs.push((await readMarkers()).tailTip.x);
    await page.waitForTimeout(everyMs);
  }
  return Math.max(...xs) - Math.min(...xs);
};

// records the sit blend amount once per rendered dog frame (using the frame's own timestamp) while `action` runs
const recordSitAmount = async (action, durationMs = 1600) => {
  await page.evaluate((duration) => {
    const { state } = window.__dogTest;
    window.__sitSamples = [];
    const start = performance.now();
    let lastFrame = -1;
    const tick = () => {
      if (state.frameTimeMs !== lastFrame) {
        lastFrame = state.frameTimeMs;
        window.__sitSamples.push([state.frameTimeMs - start, state.sitAmount]);
      }
      if (performance.now() - start < duration) requestAnimationFrame(tick);
    };
    tick();
  }, durationMs);
  await action();
  await page.waitForTimeout(durationMs + 200);
  return page.evaluate(() => window.__sitSamples);
};

// checks an eased, jolt-free blend between standing (0) and sitting (1)
const assertSmoothBlend = (samples, direction) => {
  let firstSlope = null;
  let maxSlope = 0;
  let settledAt = null;
  const settled = direction === "up" ? (amount) => amount >= 0.99 : (amount) => amount <= 0.01;
  for (let i = 1; i < samples.length; i++) {
    const [time, amount] = samples[i];
    const [previousTime, previousAmount] = samples[i - 1];
    const slope = Math.abs(amount - previousAmount) / ((time - previousTime) / 1000 || 1);
    if (firstSlope === null && Math.abs(amount - samples[0][1]) > 1e-6) firstSlope = slope;
    maxSlope = Math.max(maxSlope, slope);
    if (settledAt === null && settled(amount)) settledAt = time;
  }
  assert.ok(firstSlope !== null && firstSlope <= 1.5, `starts with a jolt: first slope ${firstSlope?.toFixed(2)}/s`);
  assert.ok(maxSlope <= 3, `peak speed ${maxSlope.toFixed(2)}/s (want <= 3)`);
  assert.ok(settledAt !== null && settledAt >= 300 && settledAt <= 1200, `settled after ${settledAt}ms`);
};

before(async () => {
  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  page = await browser.newPage({ viewport: { width: 1280, height: 607 } });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${BASE_URL}/contact?dogtest`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__dogTest, null, { timeout: 15000 });
  await page.waitForTimeout(1500);
});

after(async () => {
  await browser?.close();
});

describe("dog on the contact page", () => {
  describe("when the page opens", () => {
    test("the dog is already sitting (no sit-down animation on load)", async () => {
      assert.ok((await dogState()).sitAmount >= 0.99, "not seated on load");
    });

    let seated;
    before(async () => {
      seated = await metricsNow();
    });
    for (const [label, passes] of SIT_REQUIREMENTS) {
      if (label.startsWith("nothing sinks")) continue; // needs mesh bounds; covered headless in dog-rig.test.mjs
      test(`seated: ${label}`, () => assert.ok(passes(seated), describeMetrics(seated)));
    }
  });

  test("the dog is fully inside the canvas, not cut off", async () => {
    const box = await page.evaluate(() => {
      const canvas = document.querySelector("canvas").getBoundingClientRect();
      return { left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height };
    });
    const shot = await page.screenshot({ clip: { x: box.left, y: box.top, width: box.width, height: box.height }, type: "png" });
    const edges = await page.evaluate(async (dataUrl) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const surface = document.createElement("canvas");
      surface.width = image.width;
      surface.height = image.height;
      const context = surface.getContext("2d");
      context.drawImage(image, 0, 0);
      const background = context.getImageData(Math.floor(image.width / 2), 2, 1, 1).data;
      const differs = (x, y) => {
        const pixel = context.getImageData(x, y, 1, 1).data;
        return Math.abs(pixel[0] - background[0]) + Math.abs(pixel[1] - background[1]) + Math.abs(pixel[2] - background[2]) > 40;
      };
      const count = { left: 0, right: 0, top: 0, bottom: 0 };
      for (let i = 0; i < image.height; i += 2) { if (differs(1, i)) count.left++; if (differs(image.width - 2, i)) count.right++; }
      for (let i = 0; i < image.width; i += 2) { if (differs(i, 1)) count.top++; if (differs(i, image.height - 2)) count.bottom++; }
      return count;
    }, `data:image/png;base64,${shot.toString("base64")}`);
    assert.equal(edges.left + edges.right + edges.top + edges.bottom, 0, `the dog touches the canvas edge: ${JSON.stringify(edges)}`);
  });

  test("the tail rests while nobody hovers", async () => {
    await page.mouse.move(AWAY_FROM_DOG.x, AWAY_FROM_DOG.y);
    await page.waitForTimeout(500);
    assert.ok((await sampleTailSweep()) <= 0.35, "the tail moves on its own");
  });

  test("hovering over the seated dog makes it wag its tail, and it stays seated", async () => {
    await page.mouse.move(ON_DOG.x, ON_DOG.y);
    await page.waitForTimeout(500);
    const sweep = await sampleTailSweep();
    assert.ok(sweep >= 0.4, `tail only swept ${sweep.toFixed(2)} while hovering`);
    const state = await dogState();
    assert.ok(state.wagAmount > 0.9, `wag amount ${state.wagAmount.toFixed(2)}`);
    assert.ok(state.sitAmount >= 0.99, "it stood up when hovered");
    assert.ok(state.walkAmount < 0.05, "it walked while seated");
  });

  test("the wag is big enough to see on screen (tail tip travels >= 0.6 world units sideways and >= 0.25 up and down)", async () => {
    await page.mouse.move(ON_DOG.x, ON_DOG.y);
    await page.waitForTimeout(500);
    const xs = [];
    const ys = [];
    for (let waited = 0; waited < 900; waited += 30) {
      const tip = await page.evaluate(() => {
        const { rig } = window.__dogTest;
        rig.root.updateMatrixWorld(true);
        const point = rig.markers.tailTip.getWorldPosition(rig.markers.tailTip.position.clone());
        return { x: point.x, y: point.y };
      });
      xs.push(tip.x);
      ys.push(tip.y);
      await page.waitForTimeout(30);
    }
    const sideways = Math.max(...xs) - Math.min(...xs);
    const upDown = Math.max(...ys) - Math.min(...ys);
    assert.ok(sideways >= 0.6, `tail tip only moved ${sideways.toFixed(2)} sideways on screen`);
    assert.ok(upDown >= 0.25, `tail tip only moved ${upDown.toFixed(2)} up and down on screen`);
  });

  test("moving the mouse away stops the wag", async () => {
    await page.mouse.move(AWAY_FROM_DOG.x, AWAY_FROM_DOG.y);
    await page.waitForTimeout(1300);
    assert.ok((await dogState()).wagAmount < 0.05, "still wagging");
    assert.ok((await sampleTailSweep()) <= 0.35, "the tail keeps moving");
  });

  test("double-clicking makes the dog stand up, smoothly", async () => {
    const samples = await recordSitAmount(() => page.mouse.dblclick(ON_DOG.x, ON_DOG.y));
    assertSmoothBlend(samples, "down");
    await page.mouse.move(AWAY_FROM_DOG.x, AWAY_FROM_DOG.y);
    await page.waitForTimeout(500);
    const standing = await metricsNow();
    for (const [label, passes] of STAND_REQUIREMENTS) {
      if (label.startsWith("lowest point")) continue; // needs mesh bounds; covered headless
      assert.ok(passes(standing), `standing: ${label}: ${describeMetrics(standing)}`);
    }
  });

  test("while standing, hovering makes the dog walk", async () => {
    await page.mouse.move(ON_DOG.x, ON_DOG.y);
    await page.waitForTimeout(400);
    const zs = [];
    for (let i = 0; i < 14; i++) {
      zs.push((await readMarkers()).pawFrontLeft.z);
      await page.waitForTimeout(90);
    }
    assert.ok(Math.max(...zs) - Math.min(...zs) > 0.25, "the front paw barely moved");
    await page.mouse.move(AWAY_FROM_DOG.x, AWAY_FROM_DOG.y);
    await page.waitForTimeout(1200);
    assert.ok((await dogState()).walkAmount < 0.05, "still walking after the mouse left");
  });

  test("double-clicking again sits the dog back down, smoothly", async () => {
    const samples = await recordSitAmount(() => page.mouse.dblclick(ON_DOG.x, ON_DOG.y));
    assertSmoothBlend(samples, "up");
    await page.mouse.move(AWAY_FROM_DOG.x, AWAY_FROM_DOG.y);
    await page.waitForTimeout(400);
    const seated = await metricsNow();
    for (const [label, passes] of SIT_REQUIREMENTS) {
      if (label.startsWith("nothing sinks")) continue;
      assert.ok(passes(seated), `seated again: ${label}: ${describeMetrics(seated)}`);
    }
  });

  test("no script errors during the whole interaction", () => {
    assert.deepEqual(pageErrors, []);
  });
});
