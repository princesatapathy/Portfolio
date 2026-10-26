// Geometry measurements of the low-poly dog rig, shared by the tests and the pose tuning.
// World space: x sideways, y up (ground is y = 0), z forward (the dog faces +z).
import * as THREE from "three";

const toDegrees = (radians) => (radians * 180) / Math.PI;
const average = (...values) => values.reduce((sum, value) => sum + value, 0) / values.length;

const worldPosition = (object) => {
  const point = new THREE.Vector3();
  object.getWorldPosition(point);
  return point;
};

// Measures from plain marker positions ({ name: {x, y, z} }), so the same maths works on a rig in Node
// and on positions read out of the live page. `lowestPoint` is the lowest point of the whole mesh.
export const measureFromPoints = (m, lowestPoint) => {
  const frontPawsY = average(m.pawFrontLeft.y, m.pawFrontRight.y);
  const hindPawsY = average(m.pawHindLeft.y, m.pawHindRight.y);
  const frontPawsZ = average(m.pawFrontLeft.z, m.pawFrontRight.z);
  const hindPawsZ = average(m.pawHindLeft.z, m.pawHindRight.z);
  const headDirection = { y: m.nose.y - m.headCenter.y, z: m.nose.z - m.headCenter.z };

  return {
    markers: m,
    // spine angle above horizontal (pelvis -> shoulders)
    torsoPitchDegrees: toDegrees(Math.atan2(m.shoulder.y - m.pelvis.y, m.shoulder.z - m.pelvis.z)),
    // worst tilt of a front leg from straight down (shoulder joint -> paw)
    frontLegTiltDegrees: Math.max(
      toDegrees(Math.atan2(Math.abs(m.pawFrontLeft.z - m.shoulderLeft.z), m.shoulderLeft.y - m.pawFrontLeft.y)),
      toDegrees(Math.atan2(Math.abs(m.pawFrontRight.z - m.shoulderRight.z), m.shoulderRight.y - m.pawFrontRight.y)),
    ),
    // height of each paw bottom above the ground
    highestFrontPaw: Math.max(m.pawFrontLeft.y, m.pawFrontRight.y),
    highestHindPaw: Math.max(m.pawHindLeft.y, m.pawHindRight.y),
    frontPawsY,
    hindPawsY,
    // lowest point of the haunch above the ground (0 = sitting on it)
    rumpHeight: m.rumpBottom.y,
    hindPawsAheadOfRump: hindPawsZ - m.rumpBottom.z,
    hindPawsBehindFrontPaws: frontPawsZ - hindPawsZ,
    headAboveShoulders: m.headCenter.y - m.shoulder.y,
    headPitchDegrees: toDegrees(Math.atan2(headDirection.y, headDirection.z)),
    tailTipHeight: m.tailTip.y,
    tailTipBehindRump: m.rumpBottom.z - m.tailTip.z,
    // the rig must neither float nor sink: its lowest point is the ground
    lowestPoint,
    hindLegAsymmetry: Math.max(
      Math.abs(m.pawHindLeft.y - m.pawHindRight.y),
      Math.abs(m.pawHindLeft.z - m.pawHindRight.z),
    ),
    // sideways gap between each hind paw and the front paw on its side (hind paws sit outside)
    pawSidewaysClearance: Math.min(
      m.pawHindLeft.x - m.pawFrontLeft.x,
      m.pawFrontRight.x - m.pawHindRight.x,
    ),
    shoulderOffsetFromFrontPaws: Math.abs(m.shoulder.z - frontPawsZ),
    rumpZ: m.rumpBottom.z,
    frontPawsZ,
  };
};

export const measureDog = (rig) => {
  rig.root.updateMatrixWorld(true);
  const points = Object.fromEntries(Object.entries(rig.markers).map(([name, object]) => [name, worldPosition(object)]));
  const bounds = new THREE.Box3().setFromObject(rig.root, true); // true = measure real vertices
  return measureFromPoints(points, bounds.min.y);
};

export const SIT_REQUIREMENTS = [
  ["torso tips back into a sit (38-62 degrees)", (m) => m.torsoPitchDegrees >= 38 && m.torsoPitchDegrees <= 62],
  ["front legs straight down (tilt <= 8 degrees)", (m) => m.frontLegTiltDegrees <= 8],
  ["front paws on the ground (<= 0.05)", (m) => m.highestFrontPaw <= 0.05],
  ["hind paws on the ground (<= 0.05)", (m) => m.highestHindPaw <= 0.05],
  ["rump sits on the ground (<= 0.12)", (m) => m.rumpHeight <= 0.12],
  ["hind paws tucked just ahead of the rump (0.1-0.9)", (m) => m.hindPawsAheadOfRump >= 0.1 && m.hindPawsAheadOfRump <= 0.9],
  ["hind paws stay behind the front paws (>= 0.05)", (m) => m.hindPawsBehindFrontPaws >= 0.05],
  ["hind paws sit outside the front paws, so they do not overlap (>= 0.15 sideways)", (m) => m.pawSidewaysClearance >= 0.15],
  ["head is held up above the shoulders (>= 0.25)", (m) => m.headAboveShoulders >= 0.25],
  ["head looks forward, not craning (-10 to 40 degrees)", (m) => m.headPitchDegrees >= -10 && m.headPitchDegrees <= 40],
  ["tail trails out behind the rump, clear of the haunch so a wag can be seen (tip 0.25-0.8 high, >= 0.5 behind)", (m) => m.tailTipHeight >= 0.25 && m.tailTipHeight <= 0.8 && m.tailTipBehindRump >= 0.5],
  ["nothing sinks into the ground, nothing floats (lowest point -0.03..0.03)", (m) => m.lowestPoint >= -0.03 && m.lowestPoint <= 0.03],
  ["weight is carried by the front legs: shoulders directly above the front paws (<= 0.12)", (m) => m.shoulderOffsetFromFrontPaws <= 0.12],
  ["left and right hind legs mirror each other (<= 0.1)", (m) => m.hindLegAsymmetry <= 0.1],
];

export const STAND_REQUIREMENTS = [
  ["torso level (<= 12 degrees)", (m) => Math.abs(m.torsoPitchDegrees) <= 12],
  ["all four paws on the ground (<= 0.05 apart)", (m) => Math.max(m.highestFrontPaw, m.highestHindPaw) <= 0.05],
  ["front legs straight (<= 6 degrees)", (m) => m.frontLegTiltDegrees <= 6],
  ["lowest point is the ground (-0.03..0.03)", (m) => m.lowestPoint >= -0.03 && m.lowestPoint <= 0.03],
  ["head at about shoulder height or above (>= 0.15)", (m) => m.headAboveShoulders >= 0.15],
];
