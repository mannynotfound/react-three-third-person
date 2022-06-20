import { useState, useEffect } from "react";

const defaultMap = {
  up: "w",
  down: "s",
  right: "d",
  left: "a",
  jump: " ",
  walk: "Shift",
};

const getInputFromKeyboard = (keyMap, keyPressed) => {
  let inputFound = "";
  Object.entries(keyMap).forEach(([k, v]) => {
    if (v === keyPressed) {
      inputFound = k;
    }
  });
  return inputFound;
};

export default function useKeyboardInput(inputManager, userKeyMap = {}) {
  const [isMouseLooking, setIsMouseLooking] = useState(false);
  const [inputsPressed, setInputsPressed] = useState({});
  const keyMap = {
    ...defaultMap,
    ...userKeyMap,
  };

  function downHandler({ key }) {
    const input = getInputFromKeyboard(keyMap, key);
    if (input) {
      setInputsPressed((prevState) => ({
        ...prevState,
        [input]: true,
      }));
    }
  }

  const upHandler = ({ key }) => {
    const input = getInputFromKeyboard(keyMap, key);
    if (input) {
      setInputsPressed((prevState) => ({
        ...prevState,
        [input]: false,
      }));
    }
  };

  function pointerdownHandler({ button }) {
    if (button === 2) {
      setIsMouseLooking(true);
    }
  }

  const pointerupHandler = ({ button }) => {
    if (button === 2) {
      setIsMouseLooking(false);
    }
  };

  useEffect(() => {
    inputManager.subscribe("keydown", "character-controls", downHandler);
    inputManager.subscribe("keyup", "character-controls", upHandler);
    inputManager.subscribe(
      "pointerdown",
      "character-controls",
      pointerdownHandler
    );
    inputManager.subscribe("pointerup", "character-controls", pointerupHandler);

    return () => {
      inputManager.unsubscribe("keydown", "character-controls");
      inputManager.unsubscribe("keyup", "character-controls");
      inputManager.unsubscribe("pointerdown", "character-controls");
      inputManager.unsubscribe("pointerup", "character-controls");
    };
  }, []);

  return { ...inputsPressed, isMouseLooking };
}
