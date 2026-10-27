import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { MathUtils } from "three";

import { applyDogPose, createDogRig } from "./dogRig";

export type DogAnimation = "idle" | "walk" | "hit";

type DogProps = ThreeElements["group"] & {
  currentAnimation: DogAnimation;
  isSitting?: boolean;
  isWagging?: boolean; // happy tail wag (the page turns it on while the dog is hovered)
};

// seconds to settle into / get up from the sit; eased at both ends so it never jolts
const SIT_TRANSITION_SECONDS = 0.7;
// how quickly walking / the play-bow fade in and out (higher is faster)
const BLEND_SPEED = 9;
// strides per second while walking
const STRIDES_PER_SECOND = 1.6;

// The contact-page dog. All of its shapes and poses live in dogRig.ts.
const Dog = ({ currentAnimation, isSitting = false, isWagging = false, ...props }: DogProps) => {
  const rig = useMemo(() => createDogRig(), []);

  // starts seated when the page asks for it, with no sit-down animation on load
  const sitProgress = useRef(isSitting ? 1 : 0);
  const walkAmount = useRef(0);
  const hitAmount = useRef(0);
  const wagAmount = useRef(0);
  const walkPhase = useRef(0);
  const idleTime = useRef(0);

  // Test hook, only when the URL has ?dogtest: lets scripts/dog-page.test.mjs read the live rig.
  const testState = useRef({ sitAmount: 0, walkAmount: 0, wagAmount: 0, frameTimeMs: 0 });
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("dogtest")) return;
    (window as unknown as Record<string, unknown>).__dogTest = { rig, state: testState.current };
  }, [rig]);

  useFrame((_, delta) => {
    // move linearly toward sitting (1) or standing (0), then ease the result
    const target = isSitting ? 1 : 0;
    const step = delta / SIT_TRANSITION_SECONDS;
    sitProgress.current =
      target > sitProgress.current
        ? Math.min(sitProgress.current + step, target)
        : Math.max(sitProgress.current - step, target);
    const sit = MathUtils.smootherstep(sitProgress.current, 0, 1);

    walkAmount.current = MathUtils.damp(walkAmount.current, currentAnimation === "walk" ? 1 : 0, BLEND_SPEED, delta);
    hitAmount.current = MathUtils.damp(hitAmount.current, currentAnimation === "hit" ? 1 : 0, BLEND_SPEED, delta);
    wagAmount.current = MathUtils.damp(wagAmount.current, isWagging ? 1 : 0, BLEND_SPEED, delta);

    walkPhase.current += delta * STRIDES_PER_SECOND * Math.PI * 2 * walkAmount.current;
    idleTime.current += delta;

    applyDogPose(rig, {
      sit,
      walk: walkAmount.current,
      walkPhase: walkPhase.current,
      idleTime: idleTime.current,
      hit: hitAmount.current,
      wag: wagAmount.current,
    });

    testState.current.sitAmount = sit;
    testState.current.walkAmount = walkAmount.current;
    testState.current.wagAmount = wagAmount.current;
    testState.current.frameTimeMs = performance.now();
  });

  return (
    <group {...props} dispose={null}>
      <primitive object={rig.root} />
    </group>
  );
};

export default Dog;
