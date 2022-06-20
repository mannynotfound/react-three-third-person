import { useCompoundBody } from "@react-three/cannon";

export default function useCapsuleCollider() {
  const [, collider] = useCompoundBody(() => {
    const radius = 0.3;
    return {
      mass: 0.2,
      fixedRotation: true,
      linearDamping: 0,
      angularDamping: 0,
      material: {
        friction: 0,
        name: "no-fric-zone",
      },
      shapes: [
        { type: "Sphere", position: [0, 0.3, 0], args: [radius] },
        { type: "Sphere", position: [0, 1.3, 0], args: [radius] },
        {
          type: "Sphere",
          position: [0, 1.6 - radius * 2.667, 0],
          args: [radius],
        },
      ],
      position: [0, 0, 0],
      rotation: [0, Math.PI, 0],
      collisionFilterGroup: 1,
    };
  });

  return collider;
}
