import { useCompoundBody } from '@react-three/cannon';

export default function useCapsuleCollider(radius = 0.5) {
  const [, collider] = useCompoundBody(() => ({
    mass: 0.2,
    fixedRotation: true,
    linearDamping: 0,
    angularDamping: 0,
    material: {
      friction: 0,
      name: 'no-fric-zone',
    },
    shapes: [
      { type: 'Sphere', position: [0, radius, 0], args: [radius] },
      { type: 'Sphere', position: [0, radius * 4.2, 0], args: [radius] },
      {
        type: 'Sphere',
        position: [0, radius * 5 - radius * 2.3, 0],
        args: [radius],
      },
    ],
    position: [0, 0, 0],
    rotation: [0, Math.PI, 0],
    collisionFilterGroup: 1,
  }));

  return collider;
}
