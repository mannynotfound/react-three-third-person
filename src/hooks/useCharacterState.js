import { useRaycastClosest } from '@react-three/cannon';
import { useState, useEffect } from 'react';

const getAnimationFromUserInputs = (inputs) => {
  const { up, down, right, left, isMouseLooking } = inputs;

  if (up && !down) {
    return 'run';
  }

  if (down && !up) {
    return 'backpedal';
  }

  if (!right && left) {
    return isMouseLooking ? 'strafeLeft' : 'turnLeft';
  }

  if (!left && right) {
    return isMouseLooking ? 'strafeRight' : 'turnRight';
  }

  return 'idle';
};

export default function useCharacterState(inputs = {}, position, mixer) {
  const [characterState, setCharacterState] = useState({
    animation: 'idle',
    isJumping: false,
    inAir: false,
    isMoving: false,
  });

  const [jumpPressed, setJumpPressed] = useState(false);
  const [landed, setLanded] = useState();

  const { up, down, right, left, jump, isMouseLooking } = inputs;
  const { isJumping, inAir, isLanding } = characterState;

  useEffect(() => {
    setJumpPressed(jump);
    setLanded(false);
  }, [jump]);

  const rayFrom = [position[0], position[1], position[2]];
  const rayTo = [position[0], position[1] - 0.2, position[2]];
  useRaycastClosest(
    {
      from: rayFrom,
      to: rayTo,
      skipBackfaces: true,
    },
    (e) => {
      if (e.hasHit && !landed) {
        setLanded(true);
      }
    },
    [position]
  );

  useEffect(() => {
    if (inAir && landed) {
      setCharacterState((prevState) => ({
        ...prevState,
        inAir: false,
        animation: 'landing',
        isLanding: true,
      }));
    }
  }, [landed, inAir]);

  useEffect(() => {
    setCharacterState((prevState) => ({
      ...prevState,
      isMoving: up || down || left || right,
    }));
  }, [up, down, left, right]);

  useEffect(() => {
    if (isJumping || inAir) {
      return;
    }
    const newState = {
      animation: getAnimationFromUserInputs(inputs),
    };

    if (jump && !jumpPressed) {
      newState.animation = 'jump';
      newState.isJumping = true;
    }

    // let landing animation playout if we're still landing
    if (isLanding && newState.animation === 'idle') {
      return;
    }

    setCharacterState((prevState) => ({
      ...prevState,
      isLanding: false,
      ...newState,
    }));
  }, [up, down, left, right, jump, isMouseLooking, isJumping, inAir]);

  useEffect(() => {
    const checker = () => {
      setCharacterState((prevState) => ({
        ...prevState,
        isJumping: false,
        inAir: true,
        animation: 'inAir',
      }));
    };
    if (characterState.isJumping) {
      // play 200ms of jump animation then transition to inAir
      setTimeout(checker, 200);
    }
    return () => {
      clearTimeout(checker);
    };
  }, [characterState.isJumping]);

  useEffect(() => {
    if (!mixer) {
      return;
    }
    const onMixerFinish = () => {
      setCharacterState((prevState) => ({
        ...prevState,
        isJumping: false,
        inAir: false,
        isLanding: false,
        animation: 'idle',
      }));
    };

    mixer.addEventListener('finished', onMixerFinish);

    return () => {
      mixer.removeEventListener('finished', onMixerFinish);
    };
  }, [mixer]);

  return characterState;
}
