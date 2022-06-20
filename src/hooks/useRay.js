import { useState, useRef } from "react";
import { useRaycastClosest } from "@react-three/cannon";

export default function useRay({ rayVector, position, collisionFilterMask }) {
  const rayChecker = useRef(setTimeout);
  const from = [position[0], position[1], position[2]];
  const to = [rayVector.current.x, rayVector.current.y, rayVector.current.z];

  const [ray, setRay] = useState({});
  useRaycastClosest(
    {
      from,
      to,
      skipBackfaces: true,
      collisionFilterMask,
    },
    (e) => {
      clearTimeout(rayChecker.current);
      setRay({
        hasHit: e.hasHit,
        distance: e.distance,
      });
      // this callback only fires constantly on collision so this
      // timeout resets state once we've stopped colliding
      rayChecker.current = setTimeout(() => {
        setRay({});
      }, 100);
    },
    [from, to]
  );

  return ray;
}
