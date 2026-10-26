// Import React hooks and components
import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Material, Mesh, MeshStandardMaterial } from "three";

// Import the 3D model file for the sky
import skyScene from "../assets/3d/sky.glb";

// multiplied into the sky texture: white keeps the day look, pink turns clouds rose and the blue purple
const DAY_SKY_TINT = "#ffffff";
const DUSK_SKY_TINT = "#e6a6c4";
// the sky texture is self-lit (emissive), so dusk lowers it a little so it does not glare
const DUSK_SKY_EMISSIVE_INTENSITY = 0.55;

type SkyProps = {
  isRotating: boolean;
  isDusk: boolean;
};

// Sky component definition
const Sky = ({ isRotating, isDusk }: SkyProps) => {
  // Load the 3D model using useGLTF hook
  const { scene } = useGLTF(skyScene);

  // Clone the scene AND its materials, so tinting never touches the cached glTF
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    clone.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.isMesh) {
        mesh.material = (mesh.material as Material).clone();
      }
    });

    return clone;
  }, [scene]);

  // Tint the sky for dusk, restore it for day
  useEffect(() => {
    clonedScene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;

      const material = mesh.material as MeshStandardMaterial;
      material.color.set(isDusk ? DUSK_SKY_TINT : DAY_SKY_TINT);

      // remember the day value once, so switching back restores it exactly
      mesh.userData.dayEmissiveIntensity ??= material.emissiveIntensity;
      material.emissiveIntensity = isDusk
        ? DUSK_SKY_EMISSIVE_INTENSITY
        : mesh.userData.dayEmissiveIntensity;
    });
  }, [clonedScene, isDusk]);

  // Create a reference for the sky mesh
  const skyRef = useRef<Mesh>(null);

  // Use useFrame hook for animation logic
  useFrame((_, delta) => {
    if (!skyRef.current) return;

    // Rotate the sky if isRotating is true
    if (isRotating) {
      skyRef.current.rotation.y += 0.25 * delta;
    }
  });

  // Return the JSX for the Sky component with mesh and primitive
  return (
    <mesh ref={skyRef} dispose={null}>
      <primitive object={clonedScene} />
    </mesh>
  );
};

// Export the Sky component as the default export
export default Sky;
