import { useEffect, useState, useRef, useMemo } from "react";
import { AnimationMixer } from "three";
import { useFrame } from "@react-three/fiber";
import { useFBX, useGLTF } from "@react-three/drei";

function useThirdPersonAnimations(characterObj, animationPaths = {}) {
  const ref = useRef();
  const [clips, setClips] = useState([]);
  const [actualRef, setRef] = useState(ref);
  const [mixer, setMixer] = useState(new AnimationMixer(undefined));
  const lazyActions = useRef({});

  const animations = {};
  const keys = [
    "idle",
    "walk",
    "run",
    "jump",
    "landing",
    "inAir",
    "backpedal",
    "turnLeft",
    "turnRight",
    "strafeLeft",
    "strafeRight",
  ];
  keys.forEach((key) => {
    const fileExt = animationPaths[key].split(".").pop();
    if (fileExt === "fbx") {
      animations[key] = useFBX(animationPaths[key]);
    } else {
      animations[key] = useGLTF(animationPaths[key]);
    }
  });

  const api = useMemo(() => {
    if (!mixer || !clips.length) {
      return {
        actions: {},
      };
    }
    const actions = {};
    clips.forEach((clip) =>
      Object.defineProperty(actions, clip.name, {
        enumerable: true,
        get() {
          if (actualRef.current) {
            lazyActions.current[clip.name] = mixer.clipAction(
              clip,
              actualRef.current
            );

            const clampers = ["jump", "landing"];
            if (clampers.includes(clip.name)) {
              lazyActions.current[clip.name].setLoop(2200); // 2200 = THREE.LoopOnce
              lazyActions.current[clip.name].clampWhenFinished = true;
            }

            return lazyActions.current[clip.name];
          }

          return null;
        },
      })
    );
    return {
      ref: actualRef,
      clips,
      actions,
      names: clips.map((c) => c.name),
      mixer,
    };
  }, [clips, characterObj.name, mixer]);

  useFrame((_, delta) => {
    mixer.update(delta);
  });

  useEffect(() => {
    if (characterObj) {
      setRef({ current: characterObj });
      setMixer(new AnimationMixer(undefined));
    }
  }, [characterObj.name]);

  useEffect(() => {
    const currentRoot = actualRef.current;
    return () => {
      // Clean up only when clips change, wipe out lazy actions and uncache clips
      lazyActions.current = {};
      Object.values(api.actions).forEach((action) => {
        if (currentRoot) {
          mixer.uncacheAction(action, currentRoot);
        }
      });
    };
  }, [clips]);

  // set clips when ready
  useEffect(() => {
    const clipsToSet = [];

    Object.keys(animations).forEach((name) => {
      if (animations[name]?.animations?.length) {
        animations[name].animations[0].name = name;
        clipsToSet.push(animations[name].animations[0]);
      }
    });

    if (clips.length < clipsToSet.length) {
      setClips(clipsToSet);
    }
  }, [animations]);

  return api;
}

export default useThirdPersonAnimations;
