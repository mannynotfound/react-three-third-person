import "default-passive-events";
import { useState, useEffect } from "react";

export default function useInputEventManager(container = window) {
  const [subscriptions, setSubscriptions] = useState({});

  const subscribe = (eventName, key, subscribeFn) => {
    setSubscriptions((prevState) => ({
      ...prevState,
      [eventName]: {
        ...prevState[eventName],
        [key]: subscribeFn,
      },
    }));
  };

  const unsubscribe = (eventName, key) => {
    setSubscriptions((prevState) => {
      delete prevState?.[eventName]?.[key];
      return prevState;
    });
  };

  const makeEventHandler = (eventName) => (event) => {
    const handlers = subscriptions[eventName] ?? {};
    const subscribers = Object.values(handlers);
    subscribers.forEach((sub) => sub(event));
  };

  const keydownHandler = makeEventHandler("keydown");
  const keyupHandler = makeEventHandler("keyup");
  const wheelHandler = makeEventHandler("wheel");
  const pointerdownHandler = makeEventHandler("pointerdown");
  const pointerupHandler = makeEventHandler("pointerup");
  const pointermoveHandler = makeEventHandler("pointermove");
  const pointercancelHandler = makeEventHandler("pointercancel");
  const pointerlockchangeHandler = makeEventHandler("pointerlockchange");
  const pointerlockerrorHandler = makeEventHandler("pointerlockerror");
  const contextmenuHandler = makeEventHandler("contextmenu");

  const setupEventListeners = () => {
    window.addEventListener("keydown", keydownHandler);
    window.addEventListener("keyup", keyupHandler);

    container.addEventListener("wheel", wheelHandler);
    container.addEventListener("pointerdown", pointerdownHandler);
    container.addEventListener("pointerup", pointerupHandler);
    container.addEventListener("pointermove", pointermoveHandler);
    container.addEventListener("pointercancel", pointercancelHandler);
    container.addEventListener("contextmenu", contextmenuHandler);

    document.addEventListener("pointerlockchange", pointerlockchangeHandler);
    document.addEventListener("pointerlockerror", pointerlockerrorHandler);

    return () => {
      window.removeEventListener("keydown", keydownHandler);
      window.removeEventListener("keyup", keyupHandler);

      container.removeEventListener("wheel", wheelHandler);
      container.removeEventListener("pointerdown", pointerdownHandler);
      container.removeEventListener("pointerup", pointerupHandler);
      container.removeEventListener("pointermove", pointermoveHandler);
      container.removeEventListener("pointercancel", pointercancelHandler);
      container.removeEventListener("contextmenu", contextmenuHandler);

      document.removeEventListener(
        "pointerlockchange",
        pointerlockchangeHandler
      );
      document.removeEventListener("pointerlockerror", pointerlockerrorHandler);
    };
  };

  useEffect(setupEventListeners, [subscriptions, container]);

  return {
    subscribe,
    unsubscribe,
  };
}
