import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { AnimationMixer } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import 'default-passive-events';
import { useRaycastClosest, useCompoundBody } from '@react-three/cannon';
import { jsx } from 'react/jsx-runtime';

const FBX_LOADER = new FBXLoader();
const GLTF_LOADER = new GLTFLoader();
async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
function loadModelSync(url, loader) {
  return new Promise((resolve, reject) => {
    loader.load(url, data => resolve(data), null, reject);
  });
}
function useThirdPersonAnimations(characterObj, animationPaths, onLoad) {
  if (animationPaths === void 0) {
    animationPaths = {};
  }
  if (onLoad === void 0) {
    onLoad = () => {};
  }
  const ref = useRef();
  const [clips, setClips] = useState([]);
  const [actualRef, setRef] = useState(ref);
  const [mixer, setMixer] = useState(new AnimationMixer(undefined));
  const lazyActions = useRef({});
  const [animations, setAnimations] = useState({});

  // set character obj + mixer for character
  useEffect(() => {
    if (characterObj) {
      setRef({
        current: characterObj
      });
      setMixer(new AnimationMixer(undefined));
    }
  }, [characterObj.name]);

  // load animations async initially
  useEffect(() => {
    const loadAnimations = async () => {
      const newAnimations = {};
      const keys = ['idle', 'walk', 'run', 'jump', 'landing', 'inAir', 'backpedal', 'turnLeft', 'turnRight', 'strafeLeft', 'strafeRight'];
      await asyncForEach(keys, async key => {
        const fileExt = animationPaths[key].split('.').pop();
        const loader = fileExt === 'fbx' ? FBX_LOADER : GLTF_LOADER;
        const model = await loadModelSync(animationPaths[key], loader);
        newAnimations[key] = model;
      });
      setAnimations(newAnimations);
      onLoad();
    };
    loadAnimations();
  }, []);

  // set clips once animations are loaded
  useEffect(() => {
    const clipsToSet = [];
    Object.keys(animations).forEach(name => {
      var _animations$name, _animations$name$anim;
      if ((_animations$name = animations[name]) != null && (_animations$name$anim = _animations$name.animations) != null && _animations$name$anim.length) {
        animations[name].animations[0].name = name;
        clipsToSet.push(animations[name].animations[0]);
      }
    });
    if (clips.length < clipsToSet.length) {
      setClips(clipsToSet);
    }
  }, [animations]);
  const api = useMemo(() => {
    if (!mixer || !clips.length) {
      return {
        actions: {}
      };
    }
    const actions = {};
    clips.forEach(clip => Object.defineProperty(actions, clip.name, {
      enumerable: true,
      get() {
        if (actualRef.current) {
          lazyActions.current[clip.name] = mixer.clipAction(clip, actualRef.current);
          const clampers = ['jump', 'landing'];
          if (clampers.includes(clip.name)) {
            lazyActions.current[clip.name].setLoop(2200); // 2200 = THREE.LoopOnce
            lazyActions.current[clip.name].clampWhenFinished = true;
          }
          return lazyActions.current[clip.name];
        }
        return null;
      }
    }));
    return {
      ref: actualRef,
      clips,
      actions,
      names: clips.map(c => c.name),
      mixer
    };
  }, [clips, characterObj.name, mixer]);
  useEffect(() => {
    const currentRoot = actualRef.current;
    return () => {
      // Clean up only when clips change, wipe out lazy actions and uncache clips
      lazyActions.current = {};
      Object.values(api.actions).forEach(action => {
        if (currentRoot) {
          mixer.uncacheAction(action, currentRoot);
        }
      });
    };
  }, [clips]);
  useFrame((_, delta) => {
    mixer.update(delta);
  });
  return api;
}

/*
 * Based on code written by knav.eth for chainspace (https://somnet.chainrunners.xyz/chainspace)
 */
const CameraControlOperation = {
  NONE: -1,
  ROTATE: 0,
  TOUCH_ROTATE: 3,
  TOUCH_ZOOM_ROTATE: 6
};
const ROTATION_ANGLE = new THREE.Vector3(0, 1, 0);
class CameraState {
  operation = CameraControlOperation.NONE;
  pointers = [];
  pointerPositions = {};
  reset() {
    this.operation = CameraControlOperation.NONE;
    this.pointers = [];
    this.pointerPositions = {};
  }
}
class ThirdPersonCameraControls {
  enabled = true;
  // How far you can zoom in and out ( PerspectiveCamera only )
  minDistance = 0;
  maxDistance = Infinity;

  // How far you can orbit vertically, upper and lower limits.
  // Range is 0 to Math.PI radians.
  minPolarAngle = 0;
  maxPolarAngle = Math.PI;
  enableZoom = true;
  zoomSpeed = 1.75;
  enableRotate = true;
  rotateSpeed = 1.0;

  // "target" sets the location of focus, where the object orbits around
  targetOffset = new THREE.Vector3(0, 0, 0);
  spherical = new THREE.Spherical(3.5, Math.PI / 3, Math.PI);
  rotateStart = new THREE.Vector2();
  rotateEnd = new THREE.Vector2();
  rotateDelta = new THREE.Vector2();
  zoomStart = new THREE.Vector2();
  zoomEnd = new THREE.Vector2();
  zoomDelta = new THREE.Vector2();
  outerCameraContainer = new THREE.Object3D();
  constructor(camera, domElement, target, inputManager, options, cameraContainer) {
    var _options, _options2;
    if (options === void 0) {
      options = {};
    }
    this.camera = camera;
    this.cameraState = new CameraState();
    this.cameraContainer = cameraContainer;
    this.domElement = domElement;
    this.input = {};
    const k = 'camera';
    inputManager.subscribe('wheel', k, this.handleMouseWheel.bind(this));
    inputManager.subscribe('pointerlockchange', k, this.onPointerLockChange.bind(this));
    inputManager.subscribe('pointerdown', k, this.onPointerDown.bind(this));
    inputManager.subscribe('pointerup', k, this.onPointerUp.bind(this));
    inputManager.subscribe('pointermove', k, this.onPointerMove.bind(this));
    inputManager.subscribe('pointercancel', k, this.onPointerCancel.bind(this));
    inputManager.subscribe('pointerlockerror', k, e => console.error('POINTERLOCK ERROR ', e));
    inputManager.subscribe('contextmenu', k, this.onContextMenu.bind(this));
    this.cameraCollisionOn = (_options = options) == null ? void 0 : _options.cameraCollisionOn;
    this.targetOffset.y = ((_options2 = options) == null ? void 0 : _options2.yOffset) ?? 1.6;
    this.outerCameraContainer.position.copy(this.targetOffset);
    this.outerCameraContainer.add(this.cameraContainer);
    this.target = target;
    this.target.add(this.outerCameraContainer);
  }
  _cameraPos = new THREE.Vector3();
  _raycastTargetVector = new THREE.Vector3();
  getCameraPosition(rayResult) {
    this.cameraContainer.position.setFromSphericalCoords(this.spherical.radius, this.spherical.phi, this.spherical.theta);
    if (rayResult.hasHit && this.cameraCollisionOn) {
      this.cameraContainer.position.setFromSphericalCoords(rayResult.distance - 0.1, this.spherical.phi, this.spherical.theta);
    }
    this.cameraContainer.getWorldPosition(this._cameraPos);
    return this._cameraPos;
  }
  _workingVec = new THREE.Vector3();
  getCameraLookVec() {
    this.target.getWorldPosition(this._workingVec).add(this.targetOffset);
    return this._workingVec;
  }
  _workingQuat = new THREE.Quaternion();
  update(rayResult) {
    if (this.input.isMouseLooking) {
      this._workingQuat.setFromAxisAngle(ROTATION_ANGLE, this.spherical.theta - Math.PI);
      this.target.quaternion.multiply(this._workingQuat);
      this.spherical.theta = Math.PI;
    }

    // restrict phi to be between desired limits
    this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
    this.spherical.makeSafe();

    // restrict radius to be between desired limits
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));

    // copy maths to actual three.js camera
    this.camera.position.copy(this.getCameraPosition(rayResult));
    this.camera.lookAt(this.getCameraLookVec());
  }
  getZoomScale() {
    return 0.95 ** this.zoomSpeed;
  }
  rotateLeft(angle) {
    this.spherical.theta -= angle;
  }
  rotateUp(angle) {
    this.spherical.phi -= angle;
  }
  handleApplyRotate(speedMultiplier) {
    if (speedMultiplier === void 0) {
      speedMultiplier = 1;
    }
    this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed * speedMultiplier);
    const element = this.domElement;
    this.rotateLeft(2 * Math.PI * this.rotateDelta.x / element.clientHeight); // yes, height

    this.rotateUp(2 * Math.PI * this.rotateDelta.y / element.clientHeight);
    this.rotateStart.copy(this.rotateEnd);
  }
  zoomOut(zoomScale) {
    this.spherical.radius /= zoomScale;
  }
  zoomIn(zoomScale) {
    this.spherical.radius *= zoomScale;
  }

  // Event Handlers
  handleMouseDownRotate(event) {
    this.rotateEnd.set(event.clientX, event.clientY);
    this.rotateStart.set(event.clientX, event.clientY);
  }
  handleMouseMoveRotate(event) {
    if (document.pointerLockElement === this.domElement) {
      this.rotateEnd.x += event.movementX * 0.25;
      this.rotateEnd.y += event.movementY * 0.25 * 0.8;
    } else {
      this.domElement.requestPointerLock();
      this.domElement.style.cursor = 'none';
      this.rotateEnd.set(event.clientX, event.clientY);
    }
    this.handleApplyRotate();
  }
  handleMouseWheel(event) {
    if (event.deltaY < 0) {
      this.zoomIn(this.getZoomScale());
    } else if (event.deltaY > 0) {
      this.zoomOut(this.getZoomScale());
    }
  }
  handleTouchStartRotate() {
    if (this.cameraState.pointers.length === 1) {
      this.rotateStart.set(this.cameraState.pointers[0].pageX, this.cameraState.pointers[0].pageY);
    } else {
      const x = 0.5 * (this.cameraState.pointers[0].pageX + this.cameraState.pointers[1].pageX);
      const y = 0.5 * (this.cameraState.pointers[0].pageY + this.cameraState.pointers[1].pageY);
      this.rotateStart.set(x, y);
    }
  }
  handleTouchStartZoom() {
    const dx = this.cameraState.pointers[0].pageX - this.cameraState.pointers[1].pageX;
    const dy = this.cameraState.pointers[0].pageY - this.cameraState.pointers[1].pageY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    this.zoomStart.set(0, distance);
  }
  handleTouchStartZoomRotate() {
    if (this.enableZoom) this.handleTouchStartZoom();
    if (this.enableRotate) this.handleTouchStartRotate();
  }
  handleTouchMoveRotate(event) {
    if (this.cameraState.pointers.length === 1) {
      this.rotateEnd.set(event.pageX, event.pageY);
    } else {
      const position = this.getSecondPointerPosition(event);
      const x = 0.5 * (event.pageX + position.x);
      const y = 0.5 * (event.pageY + position.y);
      this.rotateEnd.set(x, y);
    }
    this.handleApplyRotate(1.3);
  }
  handleTouchMoveZoom(event) {
    const position = this.getSecondPointerPosition(event);
    const dx = event.pageX - position.x;
    const dy = event.pageY - position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    this.zoomEnd.set(0, distance);
    this.zoomDelta.set(0, (this.zoomEnd.y / this.zoomStart.y) ** this.zoomSpeed);
    this.zoomOut(this.zoomDelta.y);
    this.zoomStart.copy(this.zoomEnd);
  }
  handleTouchMoveZoomRotate(event) {
    if (this.enableZoom) this.handleTouchMoveZoom(event);
    if (this.enableRotate) this.handleTouchMoveRotate(event);
  }

  // Event Controllers
  onPointerDown(event) {
    if (!this.enabled) return;
    if (this.cameraState.pointers.length === 0) {
      this.domElement.setPointerCapture(event.pointerId);
    }
    this.addPointer(event);
    if (event.pointerType === 'touch') {
      this.onTouchStart(event);
    } else {
      this.onMouseDown(event);
    }
  }
  onPointerMove(event) {
    this.lastCheck = Date.now();
    if (!this.enabled) return;
    if (!this.input.isMouseLocked && !this.cameraState.pointers.length) return;
    if (!this.cameraState.pointers.find(e => e.pointerId === event.pointerId)) {
      return;
    }
    if (event.pointerType === 'touch') {
      this.onTouchMove(event);
    } else {
      this.onMouseMove(event);
    }
  }
  onPointerUp(event) {
    if (event.pointerType === 'touch') {
      this.onTouchEnd();
    } else {
      this.onMouseUp();
    }
    this.removePointer(event);
    if (this.cameraState.pointers.length === 0 && event.pointerType === 'touch') {
      this.domElement.releasePointerCapture(event.pointerId);
    }
  }

  // Touch
  onTouchStart(event) {
    this.trackPointer(event);
    switch (this.cameraState.pointers.length) {
      case 1:
        if (!this.enableRotate) return;
        this.handleTouchStartRotate();
        this.input.isMouseLooking = true;
        this.cameraState.operation = CameraControlOperation.TOUCH_ROTATE;
        break;
      case 2:
        if (!this.enableZoom && !this.enableRotate) return;
        this.handleTouchStartZoomRotate();
        this.input.isMouseLooking = true;
        this.cameraState.operation = CameraControlOperation.TOUCH_ZOOM_ROTATE;
        break;
      default:
        this.cameraState.operation = CameraControlOperation.NONE;
    }
  }
  onTouchMove(event) {
    this.trackPointer(event);
    switch (this.cameraState.operation) {
      case CameraControlOperation.TOUCH_ROTATE:
        if (!this.enableRotate) return;
        this.handleTouchMoveRotate(event);
        break;
      case CameraControlOperation.TOUCH_ZOOM_ROTATE:
        if (!this.enableZoom && !this.enableRotate) return;
        this.handleTouchMoveZoomRotate(event);
        break;
      default:
        this.cameraState.operation = CameraControlOperation.NONE;
    }
  }
  onTouchEnd() {
    this.cameraState.operation = CameraControlOperation.NONE;
  }

  // Mouse
  onPointerLockChange() {
    // do initial check to see if mouse is locked
    this.input.isMouseLocked = document.pointerLockElement === this.domElement;
    if (!this.input.isMouseLocked) {
      // wait 100ms and then check again as sometimes document.pointerLockElement
      // is null after doing a document.requestPointerLock()
      setTimeout(() => {
        this.input.isMouseLocked = document.pointerLockElement === this.domElement;
        if (!this.input.isMouseLocked) {
          this.input.isMouseLooking = false;
          this.cameraState.operation = CameraControlOperation.NONE;
        }
      }, 100);
    }
  }
  onMouseDown(event) {
    switch (event.button) {
      case 0:
        if (!this.enableRotate) return;
        this.handleMouseDownRotate(event);
        this.cameraState.operation = CameraControlOperation.ROTATE;
        break;
      case 1:
        this.cameraState.operation = CameraControlOperation.NONE;
        break;
      case 2:
        if (!this.enableRotate) return;
        this.input.isMouseLooking = true;
        this.rightClickTime = Date.now();
        this.handleMouseDownRotate(event);
        this.cameraState.operation = CameraControlOperation.ROTATE;
        break;
      default:
        this.cameraState.operation = CameraControlOperation.NONE;
    }
  }
  onMouseMove(event) {
    if (!this.enabled) return;
    if (this.cameraState.operation === CameraControlOperation.ROTATE) {
      if (!this.enableRotate) return;
      this.handleMouseMoveRotate(event);
    }
  }
  onMouseUp() {
    this.domElement.style.cursor = 'initial';
    document.exitPointerLock();
    this.input.isMouseLooking = false;
  }
  onMouseWheel(event) {
    if (!this.enabled || !this.enableZoom || this.cameraState.operation !== CameraControlOperation.NONE && this.cameraState.operation !== CameraControlOperation.ROTATE) {
      return;
    }
    this.handleMouseWheel(event);
  }

  // Pointer Utils
  getSecondPointerPosition(event) {
    const pointer = event.pointerId === this.cameraState.pointers[0].pointerId ? this.cameraState.pointers[1] : this.cameraState.pointers[0];
    return this.cameraState.pointerPositions[pointer.pointerId];
  }
  addPointer(event) {
    this.cameraState.pointers.push(event);
  }
  removePointer(event) {
    delete this.cameraState.pointerPositions[event.pointerId];
    for (let i = 0; i < this.cameraState.pointers.length; i++) {
      if (this.cameraState.pointers[i].pointerId === event.pointerId) {
        this.cameraState.pointers.splice(i, 1);
        return;
      }
    }
  }
  trackPointer(event) {
    let position = this.cameraState.pointerPositions[event.pointerId];
    if (position === undefined) {
      position = new THREE.Vector2();
      this.cameraState.pointerPositions[event.pointerId] = position;
    }
    position.set(event.pageX, event.pageY);
  }
  onPointerCancel(event) {
    this.removePointer(event);
  }
  onContextMenu(event) {
    if (!this.enabled) return;
    event.preventDefault();
  }
  reset() {
    this.cameraState.reset();
    this.domElement.style.cursor = 'initial';
    try {
      document.exitPointerLock();
    } catch (e) {
      // lol
    }
  }
  dispose() {
    // remove event listeners here
  }
}
function useThirdPersonCameraControls(_ref) {
  let {
    camera,
    domElement,
    target,
    inputManager,
    cameraOptions,
    cameraContainer
  } = _ref;
  const [controls, setControls] = useState(null);
  useEffect(() => {
    if (!target) {
      return;
    }
    const newControls = new ThirdPersonCameraControls(camera, domElement, target, inputManager, {
      yOffset: cameraOptions.yOffset || 0
    }, cameraContainer.current);
    newControls.minDistance = (cameraOptions == null ? void 0 : cameraOptions.minDistance) || 404;
    newControls.maxDistance = (cameraOptions == null ? void 0 : cameraOptions.maxDistance) || 808;
    setControls(newControls);
    return () => {
      newControls.dispose();
    };
  }, [camera, domElement, target]);
  return controls;
}

function useInputEventManager(container) {
  if (container === void 0) {
    container = window;
  }
  const [subscriptions, setSubscriptions] = useState({});
  const subscribe = (eventName, key, subscribeFn) => {
    setSubscriptions(prevState => ({
      ...prevState,
      [eventName]: {
        ...prevState[eventName],
        [key]: subscribeFn
      }
    }));
  };
  const unsubscribe = (eventName, key) => {
    setSubscriptions(prevState => {
      var _prevState$eventName;
      prevState == null ? true : (_prevState$eventName = prevState[eventName]) == null ? true : delete _prevState$eventName[key];
      return prevState;
    });
  };
  const makeEventHandler = eventName => event => {
    const handlers = subscriptions[eventName] ?? {};
    const subscribers = Object.values(handlers);
    subscribers.forEach(sub => sub(event));
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
      document.removeEventListener("pointerlockchange", pointerlockchangeHandler);
      document.removeEventListener("pointerlockerror", pointerlockerrorHandler);
    };
  };
  useEffect(setupEventListeners, [subscriptions, container]);
  return {
    subscribe,
    unsubscribe
  };
}

const defaultMap = {
  up: "w",
  down: "s",
  right: "d",
  left: "a",
  jump: " ",
  walk: "Shift"
};
const getInputFromKeyboard = (keyMap, keyPressed) => {
  let inputFound = "";
  Object.entries(keyMap).forEach(_ref => {
    let [k, v] = _ref;
    if (v === keyPressed) {
      inputFound = k;
    }
  });
  return inputFound;
};
function useKeyboardInput(inputManager, userKeyMap) {
  if (userKeyMap === void 0) {
    userKeyMap = {};
  }
  const [isMouseLooking, setIsMouseLooking] = useState(false);
  const [inputsPressed, setInputsPressed] = useState({});
  const keyMap = {
    ...defaultMap,
    ...userKeyMap
  };
  function downHandler(_ref2) {
    let {
      key
    } = _ref2;
    const input = getInputFromKeyboard(keyMap, key);
    if (input) {
      setInputsPressed(prevState => ({
        ...prevState,
        [input]: true
      }));
    }
  }
  const upHandler = _ref3 => {
    let {
      key
    } = _ref3;
    const input = getInputFromKeyboard(keyMap, key);
    if (input) {
      setInputsPressed(prevState => ({
        ...prevState,
        [input]: false
      }));
    }
  };
  function pointerdownHandler(_ref4) {
    let {
      button
    } = _ref4;
    if (button === 2) {
      setIsMouseLooking(true);
    }
  }
  const pointerupHandler = _ref5 => {
    let {
      button
    } = _ref5;
    if (button === 2) {
      setIsMouseLooking(false);
    }
  };
  useEffect(() => {
    inputManager.subscribe("keydown", "character-controls", downHandler);
    inputManager.subscribe("keyup", "character-controls", upHandler);
    inputManager.subscribe("pointerdown", "character-controls", pointerdownHandler);
    inputManager.subscribe("pointerup", "character-controls", pointerupHandler);
    return () => {
      inputManager.unsubscribe("keydown", "character-controls");
      inputManager.unsubscribe("keyup", "character-controls");
      inputManager.unsubscribe("pointerdown", "character-controls");
      inputManager.unsubscribe("pointerup", "character-controls");
    };
  }, []);
  return {
    ...inputsPressed,
    isMouseLooking
  };
}

/*
 * Based on code written by knav.eth for chainspace (https://somnet.chainrunners.xyz/chainspace)
 */

/**
 * Finds an angle between two vectors
 * @param {THREE.Vector3} v1
 * @param {THREE.Vector3} v2
 */
function getAngleBetweenVectors(v1, v2, dotThreshold) {
  if (dotThreshold === void 0) {
    dotThreshold = 0.0005;
  }
  let angle;
  const dot = v1.dot(v2);

  // If dot is close to 1, we'll round angle to zero
  if (dot > 1 - dotThreshold) {
    angle = 0;
  } else if (dot < -1 + dotThreshold) {
    // Dot too close to -1
    angle = Math.PI;
  } else {
    // Get angle difference in radians
    angle = Math.acos(dot);
  }
  return angle;
}

/**
 * Finds an angle between two vectors with a sign relative to normal vector
 */
function getSignedAngleBetweenVectors(v1, v2, normal, dotThreshold) {
  if (normal === void 0) {
    normal = new THREE.Vector3(0, 1, 0);
  }
  if (dotThreshold === void 0) {
    dotThreshold = 0.0005;
  }
  let angle = getAngleBetweenVectors(v1, v2, dotThreshold);

  // Get vector pointing up or down
  const cross = new THREE.Vector3().crossVectors(v1, v2);
  // Compare cross with normal to find out direction
  if (normal.dot(cross) < 0) {
    angle = -angle;
  }
  return angle;
}
function getRotationDirection(_ref) {
  let {
    left,
    right,
    isMouseLooking
  } = _ref;
  let direction = 0;
  if (!isMouseLooking) {
    if (left) {
      direction = -1;
    }
    if (right) {
      direction = 1;
    }
  }
  return direction;
}
function getMovementDirection(_ref2) {
  let {
    up,
    down,
    right,
    left,
    isMouseLooking
  } = _ref2;
  const positiveX = isMouseLooking && right ? -1 : 0;
  const negativeX = isMouseLooking && left ? 1 : 0;
  const positiveZ = up ? 1 : 0;
  const negativeZ = down ? -1 : 0;
  return new THREE.Vector3(positiveX + negativeX, 0, positiveZ + negativeZ).normalize();
}
const FORWARD = new THREE.Vector3(0, 0, 1);
function getModelRotation(inputs) {
  const {
    up,
    down,
    right,
    left,
    isMouseLooking
  } = inputs;
  const movementDirection = getMovementDirection(inputs);
  let modelRotation = 0;
  if ((up || down) && !(down && up) && (left || right) && isMouseLooking) {
    const rotationDirection = getRotationDirection(inputs);
    const movementAngle = getSignedAngleBetweenVectors(movementDirection, FORWARD);
    if (up) {
      modelRotation = rotationDirection === 0 ? -movementAngle : Math.PI / 8 * rotationDirection * -1;
    } else if (down) {
      if (rotationDirection === 0) {
        if (movementDirection.x > 0) {
          modelRotation = Math.PI - movementAngle;
        } else if (movementDirection.x < 0) {
          modelRotation = Math.PI - movementAngle;
        }
      } else {
        modelRotation = Math.PI / 8 * rotationDirection * -1;
      }
    }
  }
  return modelRotation;
}
function useInputMovementRotation(inputs) {
  const direction = getRotationDirection(inputs);
  const rotation = getModelRotation(inputs);
  const movement = getMovementDirection(inputs);
  return {
    model: {
      direction,
      rotation
    },
    movement
  };
}

const getAnimationFromUserInputs = inputs => {
  const {
    up,
    down,
    right,
    left,
    isMouseLooking
  } = inputs;
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
function useCharacterState(inputs, position, mixer) {
  if (inputs === void 0) {
    inputs = {};
  }
  const [characterState, setCharacterState] = useState({
    animation: 'idle',
    isJumping: false,
    inAir: false,
    isMoving: false
  });
  const [jumpPressed, setJumpPressed] = useState(false);
  const [landed, setLanded] = useState();
  const {
    up,
    down,
    right,
    left,
    jump,
    isMouseLooking
  } = inputs;
  const {
    isJumping,
    inAir,
    isLanding
  } = characterState;
  useEffect(() => {
    setJumpPressed(jump);
    setLanded(false);
  }, [jump]);
  const rayFrom = [position[0], position[1], position[2]];
  const rayTo = [position[0], position[1] - 0.2, position[2]];
  useRaycastClosest({
    from: rayFrom,
    to: rayTo,
    skipBackfaces: true
  }, e => {
    if (e.hasHit && !landed) {
      setLanded(true);
    }
  }, [position]);
  useEffect(() => {
    if (inAir && landed) {
      setCharacterState(prevState => ({
        ...prevState,
        inAir: false,
        animation: 'landing',
        isLanding: true
      }));
    }
  }, [landed, inAir]);
  useEffect(() => {
    setCharacterState(prevState => ({
      ...prevState,
      isMoving: up || down || left || right
    }));
  }, [up, down, left, right]);
  useEffect(() => {
    if (isJumping || inAir) {
      return;
    }
    const newState = {
      animation: getAnimationFromUserInputs(inputs)
    };
    if (jump && !jumpPressed) {
      newState.animation = 'jump';
      newState.isJumping = true;
    }

    // let landing animation playout if we're still landing
    if (isLanding && newState.animation === 'idle') {
      return;
    }
    setCharacterState(prevState => ({
      ...prevState,
      isLanding: false,
      ...newState
    }));
  }, [up, down, left, right, jump, isMouseLooking, isJumping, inAir]);
  useEffect(() => {
    const checker = () => {
      setCharacterState(prevState => ({
        ...prevState,
        isJumping: false,
        inAir: true,
        animation: 'inAir'
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
      setCharacterState(prevState => ({
        ...prevState,
        isJumping: false,
        inAir: false,
        isLanding: false,
        animation: 'idle'
      }));
    };
    mixer.addEventListener('finished', onMixerFinish);
    return () => {
      mixer.removeEventListener('finished', onMixerFinish);
    };
  }, [mixer]);
  return characterState;
}

function useCapsuleCollider(radius) {
  if (radius === void 0) {
    radius = 0.5;
  }
  const [, collider] = useCompoundBody(() => ({
    mass: 0.2,
    fixedRotation: true,
    linearDamping: 0,
    angularDamping: 0,
    material: {
      friction: 0,
      name: 'no-fric-zone'
    },
    shapes: [{
      type: 'Sphere',
      position: [0, radius, 0],
      args: [radius]
    }, {
      type: 'Sphere',
      position: [0, radius * 4.2, 0],
      args: [radius]
    }, {
      type: 'Sphere',
      position: [0, radius * 5 - radius * 2.3, 0],
      args: [radius]
    }],
    position: [0, 0, 0],
    rotation: [0, Math.PI, 0],
    collisionFilterGroup: 1
  }));
  return collider;
}

function useRay(_ref) {
  let {
    rayVector,
    position,
    collisionFilterMask
  } = _ref;
  const rayChecker = useRef(setTimeout);
  const from = [position[0], position[1], position[2]];
  const to = [rayVector.current.x, rayVector.current.y, rayVector.current.z];
  const [ray, setRay] = useState({});
  useRaycastClosest({
    from,
    to,
    skipBackfaces: true,
    collisionFilterMask
  }, e => {
    clearTimeout(rayChecker.current);
    setRay({
      hasHit: e.hasHit,
      distance: e.distance
    });
    // this callback only fires constantly on collision so this
    // timeout resets state once we've stopped colliding
    rayChecker.current = setTimeout(() => {
      setRay({});
    }, 100);
  }, [from, to]);
  return ray;
}

const ThirdPersonCharacterControls = _ref => {
  let {
    cameraOptions = {},
    characterObj,
    characterProps = {},
    animationPaths = {},
    onLoad
  } = _ref;
  const {
    camera,
    gl: {
      domElement
    }
  } = useThree();
  // set up refs that influence character and camera position
  const collider = useCapsuleCollider(characterProps.radius);
  const [position, setPosition] = useState([0, 0, 0]);
  const modelRef = useRef();
  const cameraContainer = useRef(new THREE.Object3D());
  const rayVector = useRef(new THREE.Vector3());
  const ray = useRay({
    position,
    rayVector,
    ...cameraOptions
  });

  // get character state based on user inputs + collider position + animations
  const inputManager = useInputEventManager(domElement);
  const inputs = useKeyboardInput(inputManager);
  const controls = useThirdPersonCameraControls({
    camera,
    domElement,
    target: modelRef.current,
    inputManager,
    cameraOptions,
    cameraContainer
  });
  const {
    actions,
    mixer
  } = useThirdPersonAnimations(characterObj, animationPaths, onLoad);
  const {
    animation,
    isMoving
  } = useCharacterState(inputs, position, mixer);

  // subscribe to collider velocity/position changes
  const charVelocity = characterProps.velocity ?? 4;
  const velocity = useRef([0, 0, 0]);
  useEffect(() => {
    collider.velocity.subscribe(v => {
      velocity.current = v;
    });
    collider.position.subscribe(p => {
      var _modelRef$current;
      // position is set on collider so we copy it to model
      (_modelRef$current = modelRef.current) == null ? void 0 : _modelRef$current.position.set(...p);
      // setState with position to  useCharacterState
      setPosition(p);
    });
  }, []);
  useFrame(() => {
    let newRotation = new THREE.Euler();
    let xVelocity = 0;
    let zVelocity = 0;
    const {
      quaternion
    } = modelRef.current;
    if (isMoving) {
      const {
        model,
        movement
      } = useInputMovementRotation(inputs);

      // first rotate the model group
      modelRef.current.rotateY(model.direction * -0.05);
      newRotation = characterObj.rotation.clone();
      newRotation.y = model.rotation;
      const mtx = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
      movement.applyMatrix4(mtx);

      // then apply velocity to collider influenced by model groups rotation
      const baseVelocity = inputs.down ? charVelocity / 2 : charVelocity;
      xVelocity = movement.x * baseVelocity;
      zVelocity = movement.z * baseVelocity;
    }
    collider.velocity.set(xVelocity, velocity.current[1], zVelocity);

    // after applying x/z velocity, apply y velocity if user has jumped while grounded
    const isGrounded = Math.abs(velocity.current[1].toFixed(2)) === 0;
    if (animation === 'jump' && isGrounded) {
      collider.velocity.set(velocity.current[0], 8, velocity.current[2]);
    }

    // rotate character model inside model group
    const newQuat = new THREE.Quaternion().setFromEuler(newRotation);
    characterObj.quaternion.slerp(newQuat, 0.1);

    // quaternion is set on model group so we copy it to collider
    collider.quaternion.copy(quaternion);
    // check camera raycast collision and pass that to controls to
    cameraContainer.current.getWorldPosition(rayVector.current);
    controls == null ? void 0 : controls.update(ray);
  });

  // Transition to new animation when loaded
  useEffect(() => {
    var _actions$animation;
    actions == null ? void 0 : (_actions$animation = actions[animation]) == null ? void 0 : _actions$animation.reset().fadeIn(0.2).play();
    return () => {
      var _actions$animation2;
      actions == null ? void 0 : (_actions$animation2 = actions[animation]) == null ? void 0 : _actions$animation2.fadeOut(0.2);
    };
  }, [animation, actions]);
  return /*#__PURE__*/jsx("group", {
    ref: modelRef,
    rotation: [0, Math.PI, 0],
    ...characterProps,
    children: /*#__PURE__*/jsx(Suspense, {
      fallback: () => null,
      children: /*#__PURE__*/jsx("primitive", {
        object: characterObj,
        dispose: null
      })
    })
  });
};

export { ThirdPersonCharacterControls as default };
