// A low-poly dog built from simple shapes, plus its poses (stand, walk, sit, play-bow).
// Pure three.js, no React: scripts/dog-rig.test.mjs tests it headless.
//
// Space: the dog faces +z, y is up, the ground is y = 0, x is sideways.
import * as THREE from "three";

const COLORS = {
  coat: "#e1a265",
  light: "#fbf4e6",
  dark: "#1d2235", // the site's navy text colour
  ear: "#b87a42",
  collar: "#2b77e7", // the site's accent blue
};

// body dimensions
const TORSO_LENGTH = 0.85; // pelvis to shoulders
const SHOULDER_DROP = 0.1; // shoulder joint sits this far below the pelvis centre
const FRONT_LEG_LENGTH = 1.0; // shoulder joint to the bottom of the paw
const HIP_STAND_Y = 1.1; // pelvis centre height while standing
const SIT_PELVIS_Y = 0.4; // pelvis centre height while sitting
const HIND_SIT_HIP_X = 0.5;
const THIGH = 0.45;
const SHIN = 0.45;

// how far the body tips back so the front paws still reach the ground when the rump is down
const SIT_PITCH = (() => {
  const reach = Math.hypot(TORSO_LENGTH, SHOULDER_DROP);
  const offset = Math.atan2(SHOULDER_DROP, TORSO_LENGTH);
  return Math.asin((FRONT_LEG_LENGTH - SIT_PELVIS_Y) / reach) + offset;
})();

// Joint angles (radians, around x). Positive swings the lower end backwards, negative forwards.
// (exported only so scripts/dog-tune can search for angles that meet scripts/dog-metrics.mjs)
export const TUNING = {
  hindStand: { thigh: 0.765, shin: -1.088, foot: -0.101 },
  hindSit: { thigh: -2.051, shin: 2.798, foot: -0.159, splay: 0.007 }, // splay: thighs swing outward
  neck: { stand: -0.25, sit: 0.268 },
  head: { stand: 0.05, sit: 0.382 },
  tailStand: { root: 2.3, mid: -0.4, tip: -0.4 },
  tailSit: { mid: -0.132, tip: -0.285, lift: 0.55, side: 0.5 }, // lift: tail trails up and out, clear of the haunch; side: carried toward the camera side so a wag stays in view
};

export type DogPose = {
  sit: number; // 0 standing .. 1 sitting
  walk: number; // 0 idle .. 1 walking
  walkPhase: number; // radians, advances while walking
  idleTime: number; // seconds, drives breathing and the tail wag
  hit: number; // 0 .. 1 play-bow
  wag: number; // 0 .. 1 happy tail wag
};

// tail wags per second while the dog is happy (hovered)
const WAGS_PER_SECOND = 3.5;

export const STANDING: DogPose = { sit: 0, walk: 0, walkPhase: 0, idleTime: 0, hit: 0, wag: 0 };

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

const flat = (color: string) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0 });

const materials = {
  coat: flat(COLORS.coat),
  light: flat(COLORS.light),
  dark: flat(COLORS.dark),
  ear: flat(COLORS.ear),
  collar: flat(COLORS.collar),
};

const ellipsoid = (
  radii: [number, number, number],
  material: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
) => {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), material);
  mesh.scale.set(...radii);
  mesh.position.set(...position);
  return mesh;
};

// a tapered limb hanging down from its origin
const limb = (length: number, topRadius: number, bottomRadius: number, material: THREE.Material) => {
  const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, length, 10);
  geometry.translate(0, -length / 2, 0);
  return new THREE.Mesh(geometry, material);
};

const group = (position: [number, number, number] = [0, 0, 0]) => {
  const node = new THREE.Group();
  node.position.set(...position);
  return node;
};

const marker = (parent: THREE.Object3D, position: [number, number, number]) => {
  const node = new THREE.Object3D();
  node.position.set(...position);
  parent.add(node);
  return node;
};

export type DogRig = ReturnType<typeof createDogRig>;

export const createDogRig = () => {
  const root = group();
  const hip = group([0, HIP_STAND_Y, 0]); // pelvis centre; the whole body pivots here
  root.add(hip);

  // haunch and torso
  hip.add(ellipsoid([0.34, 0.36, 0.42], materials.coat, [0, -0.02, -0.02]));
  hip.add(ellipsoid([0.36, 0.4, 0.6], materials.coat, [0, 0.02, 0.44]));
  hip.add(ellipsoid([0.26, 0.28, 0.36], materials.light, [0, -0.12, 0.68])); // chest
  hip.add(ellipsoid([0.3, 0.16, 0.5], materials.light, [0, -0.3, 0.36])); // belly

  const pelvis = marker(hip, [0, 0, 0]);
  const rumpBottom = marker(hip, [0, -0.38, -0.18]);
  const shoulder = marker(hip, [0, -SHOULDER_DROP, TORSO_LENGTH]);

  // front legs
  const makeFrontLeg = (side: 1 | -1) => {
    const leg = group([0.18 * side, -SHOULDER_DROP, TORSO_LENGTH]);
    leg.add(limb(FRONT_LEG_LENGTH - 0.12, 0.15, 0.115, materials.coat));
    leg.add(ellipsoid([0.16, 0.11, 0.21], materials.light, [0, -(FRONT_LEG_LENGTH - 0.11), 0.06]));
    const paw = marker(leg, [0, -FRONT_LEG_LENGTH, 0.06]);
    hip.add(leg);
    return { leg, paw };
  };
  const frontLeft = makeFrontLeg(1);
  const frontRight = makeFrontLeg(-1);

  // hind legs: thigh -> shin -> foot, a zigzag like a real dog
  const makeHindLeg = (side: 1 | -1) => {
    const thigh = group([0.22 * side, -0.1, -0.1]);
    thigh.add(limb(THIGH, 0.18, 0.12, materials.coat));
    thigh.add(ellipsoid([0.22, 0.28, 0.28], materials.coat, [0, -0.14, -0.02]));
    const shin = group([0, -THIGH, 0]);
    shin.add(limb(SHIN, 0.11, 0.08, materials.coat));
    thigh.add(shin);
    const foot = group([0, -SHIN, 0]);
    foot.add(limb(0.2, 0.08, 0.075, materials.coat));
    foot.add(ellipsoid([0.13, 0.1, 0.18], materials.light, [0, -0.2, 0.06]));
    shin.add(foot);
    const paw = marker(foot, [0, -0.3, 0.06]);
    hip.add(thigh);
    return { thigh, shin, foot, paw };
  };
  const hindLeft = makeHindLeg(1);
  const hindRight = makeHindLeg(-1);

  // neck and head
  const neck = group([0, 0.12, 0.78]);
  neck.add(ellipsoid([0.19, 0.22, 0.28], materials.coat, [0, 0.1, 0.1]));
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 5, 10), materials.collar);
  collar.position.set(0, 0.05, 0.02);
  collar.rotation.x = Math.PI / 2 + 0.25;
  neck.add(collar);
  hip.add(neck);

  const head = group([0, 0.28, 0.2]);
  head.add(ellipsoid([0.29, 0.27, 0.3], materials.coat));
  head.add(ellipsoid([0.16, 0.13, 0.23], materials.light, [0, -0.08, 0.31])); // snout
  head.add(ellipsoid([0.075, 0.065, 0.065], materials.dark, [0, -0.02, 0.54])); // nose
  for (const side of [1, -1] as const) {
    head.add(ellipsoid([0.05, 0.055, 0.05], materials.dark, [0.14 * side, 0.09, 0.22])); // eye
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.36, 4), materials.ear);
    ear.position.set(0.17 * side, 0.27, -0.04);
    ear.rotation.set(-0.15, 0, -0.3 * side);
    head.add(ear);
  }
  neck.add(head);
  const headCenter = marker(head, [0, 0, 0]);
  const nose = marker(head, [0, -0.02, 0.54]);

  // tail: three segments hanging from the root, curled by their angles
  const tailRoot = group([0, 0.12, -0.34]);
  tailRoot.add(limb(0.42, 0.12, 0.1, materials.coat));
  const tailMid = group([0, -0.42, 0]);
  tailMid.add(limb(0.36, 0.1, 0.085, materials.coat));
  tailRoot.add(tailMid);
  const tailTipGroup = group([0, -0.36, 0]);
  tailTipGroup.add(limb(0.3, 0.085, 0.06, materials.light));
  tailMid.add(tailTipGroup);
  const tailTip = marker(tailTipGroup, [0, -0.3, 0]);
  hip.add(tailRoot);

  return {
    root,
    hip,
    neck,
    head,
    tail: { root: tailRoot, mid: tailMid, tip: tailTipGroup },
    legs: { frontLeft, frontRight, hindLeft, hindRight },
    markers: {
      pelvis,
      rumpBottom,
      shoulder,
      shoulderLeft: frontLeft.leg,
      shoulderRight: frontRight.leg,
      headCenter,
      nose,
      tailTip,
      pawFrontLeft: frontLeft.paw,
      pawFrontRight: frontRight.paw,
      pawHindLeft: hindLeft.paw,
      pawHindRight: hindRight.paw,
    },
  };
};

const vertex = new THREE.Vector3();
const inverseRoot = new THREE.Matrix4();

// lowest point of every mesh, in the dog's own space (so it holds wherever the dog is placed or scaled)
const lowestLocalY = (root: THREE.Object3D) => {
  inverseRoot.copy(root.matrixWorld).invert();
  let lowest = Infinity;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      vertex.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverseRoot);
      lowest = Math.min(lowest, vertex.y);
    }
  });
  return lowest;
};

export const applyDogPose = (rig: DogRig, pose: DogPose) => {
  const sit = pose.sit;
  const walk = pose.walk * (1 - sit);
  const pitch = SIT_PITCH * sit;
  const phase = pose.walkPhase;

  // body: tips back when sitting, bows forward on a hit, bobs when walking
  const bounce = Math.abs(Math.sin(phase)) * 0.04 * walk + Math.sin(pose.hit * Math.PI) * 0.05;
  rig.hip.position.set(0, lerp(HIP_STAND_Y, SIT_PELVIS_Y, sit) + bounce, 0);
  rig.hip.rotation.x = -pitch + 0.45 * pose.hit;

  // front legs hang straight down whatever the body does, plus the walking swing
  const swing = 0.42 * walk;
  rig.legs.frontLeft.leg.rotation.x = -rig.hip.rotation.x + swing * Math.sin(phase);
  rig.legs.frontLeft.leg.rotation.z = 0.1 * sit;
  rig.legs.frontRight.leg.rotation.z = -0.1 * sit;
  rig.legs.frontRight.leg.rotation.x = -rig.hip.rotation.x + swing * Math.sin(phase + Math.PI);

  // hind legs: standing zigzag blends into the folded sit; diagonal pairs swing together
  const hindSwing = (offset: number) => 0.5 * walk * Math.sin(phase + offset);
  const setHind = (leg: DogRig["legs"]["hindLeft"], offset: number, side: 1 | -1) => {
    const swingAmount = hindSwing(offset);
    leg.thigh.rotation.x = lerp(TUNING.hindStand.thigh, TUNING.hindSit.thigh, sit) + swingAmount;
    leg.thigh.rotation.z = side * TUNING.hindSit.splay * sit;
    // the hips spread a little when sitting, so the folded hind legs sit outside the front legs
    leg.thigh.position.x = side * lerp(0.22, HIND_SIT_HIP_X, sit);
    // the knee folds more while the leg is swinging forward
    leg.shin.rotation.x = lerp(TUNING.hindStand.shin, TUNING.hindSit.shin, sit) - 0.5 * walk * Math.max(0, Math.cos(phase + offset));
    leg.foot.rotation.x = lerp(TUNING.hindStand.foot, TUNING.hindSit.foot, sit);
  };
  setHind(rig.legs.hindLeft, Math.PI, 1);
  setHind(rig.legs.hindRight, 0, -1);

  // neck and head, with a slow breathing sway
  const breathe = 0.03 * Math.sin(pose.idleTime * 1.6);
  rig.neck.rotation.x = lerp(TUNING.neck.stand, TUNING.neck.sit, sit) + breathe - 0.3 * pose.hit;
  rig.head.rotation.x = lerp(TUNING.head.stand, TUNING.head.sit, sit) - breathe;

  // tail: raised and wagging when standing, resting on the ground when sitting
  const wag = Math.sin(pose.idleTime * 4) * 0.35 * (1 - 0.6 * sit) + Math.sin(phase * 2) * 0.2 * walk;
  rig.tail.root.rotation.x =
    lerp(TUNING.tailStand.root, Math.PI / 2 + pitch + TUNING.tailSit.lift, sit) +
    // the wag also flicks the tail up and down, so it reads from any camera angle
    pose.wag * 0.3 * Math.sin(pose.idleTime * WAGS_PER_SECOND * Math.PI * 2 + 0.6);
  const wagSwing = pose.idleTime * WAGS_PER_SECOND * Math.PI * 2;
  rig.tail.root.rotation.z = wag + TUNING.tailSit.side * sit + pose.wag * 0.6 * Math.sin(wagSwing);
  // the rest of the tail follows a little behind, so it whips instead of swinging stiffly
  rig.tail.mid.rotation.z = pose.wag * 0.45 * Math.sin(wagSwing - 0.9);
  rig.tail.tip.rotation.z = pose.wag * 0.45 * Math.sin(wagSwing - 1.8);
  rig.tail.mid.rotation.x = lerp(TUNING.tailStand.mid, TUNING.tailSit.mid, sit);
  rig.tail.tip.rotation.x = lerp(TUNING.tailStand.tip, TUNING.tailSit.tip, sit);

  // keep the lowest point of the dog exactly on the ground
  rig.root.position.set(0, 0, 0);
  rig.root.updateMatrixWorld(true);
  rig.root.position.y = -lowestLocalY(rig.root);
  rig.root.updateMatrixWorld(true);
};
