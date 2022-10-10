# react-three-third-person

Third person controls for driving a character model inside a `@react-three/fiber` app driven by `@react-three/cannon` physics.

## Dependencies

- `react` v16.14.0 or higher
- `@react-three/fiber` v7.0.26 or higher
- `@react-three/drei` v8.7.3 or higher
- `@react-three/cannon` v6.3.0 or higher

## Installation

```bash
npm install react-three-third-person
```

## Usage

```js
import ThirdPersonCharacterControls from "react-three-third-person";
import { useGLTF } from "@react-three/drei";

const PATH = "https://yourhost.com/animations";

const animationPaths = {
  idle: `${PATH}/idle.glb`,
  walk: `${PATH}/walk.glb`,
  run: `${PATH}/run.glb`,
  jump: `${PATH}/jump.glb`,
  landing: `${PATH}/landing.glb`,
  inAir: `${PATH}/falling_idle.glb`,
  backpedal: `${PATH}/backpedal.glb`,
  turnLeft: `${PATH}/turn_left.glb`,
  turnRight: `${PATH}/turn_right.glb`,
  strafeLeft: `${PATH}/strafe_left.glb`,
  strafeRight: `${PATH}/strafe_right.glb`,
};

function ThirdPersonCharacter() {
  const characterObj = useGLTF(`${PATH}/your_model.glb`);
  const characterProps = {
    scale: 1.75,
    velocity: 8,
    radius: 0.5,
  };

  return (
    <ThirdPersonCharacterControls
      cameraOptions={{
        yOffset: 1.6,
        minDistance: 0.6,
        maxDistance: 7,
        collisionFilterMask: 2,
      }}
      characterObj={characterObj}
      characterProps={characterProps}
      animationPaths={animationPaths}
    />
  );
}
```

## Configuration

| Prop           | Type           | Default   | Description                                       |
| -------------- | -------------- | --------- | ------------------------------------------------- |
| cameraOptions  | object         | {}        | configuration object for control's camera options |
| characterProps  | object         | {}        | configuration object for character |
| characterObj   | THREE.Object3D | undefined | three.js object for character model               |
| animationPaths | object         | {}        | object for animation clip configuration           |
| onLoad | function         | () => {}        | called when animation clips are done loading           |

#### cameraOptions

| Prop                | Type    | Default | Description                                                          |
| ------------------- | ------- | ------- | -------------------------------------------------------------------- |
| yOffset             | float   | 1.6     | amount of y added to the camera following the character model        |
| minDistance         | float   | 0.6     | maximum zoom in capability of camera                                 |
| maxDistance         | float   | 7       | maximum zoom out capability of camera                                |
| collisionFilterMask | integer | 2       | the cannon.js group given to "world" objects for collision detection |
| cameraCollisionOn | boolean | off       | if turned on, will use colllisionFilterMask to add collision to the camera (experimental and unoptimized) |

#### characterProps

| Prop                | Type    | Default | Description                                                          |
| ------------------- | ------- | ------- | -------------------------------------------------------------------- |
| scale             | float   | 1     | amount to scale the character model        |
| radius         | float   | 0.3     | value used for creating character capsule collider                                |
| velocity         | float   | 4       | speed at which character moves                                |

#### characterObj

you can use any model here compatible with the [mixamo](https://www.mixamo.com) rig. For best results, use a model sized to the default mixamo character.

#### animationPaths

this prop expects an object with key/value pairs pointing to a complete set of animations to use on your character model. Refer to the object below for the full list of animations needed, all of which are available as free animations on [mixamo](https://www.mixamo.com).

```
{
  idle: 'idle.glb',
  walk: 'walk.glb',
  run: 'run.glb',
  jump: 'jump.glb',
  landing: 'landing.glb',
  inAir: 'falling_idle.glb',
  backpedal: 'backpedal.glb',
  turnLeft: 'turn_left.glb',
  turnRight: 'turn_right.glb',
  strafeLeft: 'strafe_left.glb',
  strafeRight: 'strafe_right.glb',
}
```

## Example App Usage

```js
import React from "react";
import ReactDOM from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import { Physics, useBox } from "@react-three/cannon";
import manny from "manny";
import ThirdPersonCharacterControls from "react-three-third-person";

const BASE_ANIMATIONS_PATH =
  "https://mannys-game.s3.amazonaws.com/third-person/animations";

const animationPaths = {
  idle: `${BASE_ANIMATIONS_PATH}/idle.glb`,
  walk: `${BASE_ANIMATIONS_PATH}/walk.glb`,
  run: `${BASE_ANIMATIONS_PATH}/run.glb`,
  jump: `${BASE_ANIMATIONS_PATH}/jump.glb`,
  landing: `${BASE_ANIMATIONS_PATH}/landing.glb`,
  inAir: `${BASE_ANIMATIONS_PATH}/falling_idle.glb`,
  backpedal: `${BASE_ANIMATIONS_PATH}/backpedal.glb`,
  turnLeft: `${BASE_ANIMATIONS_PATH}/turn_left.glb`,
  turnRight: `${BASE_ANIMATIONS_PATH}/turn_right.glb`,
  strafeLeft: `${BASE_ANIMATIONS_PATH}/strafe_left.glb`,
  strafeRight: `${BASE_ANIMATIONS_PATH}/strafe_right.glb`,
};

function ThirdPersonCharacter() {
  const mannyObj = manny();

  return (
    <ThirdPersonCharacterControls
      cameraOptions={{
        yOffset: 1.6,
        minDistance: 0.6,
        maxDistance: 7,
        collisionFilterMask: 2,
      }}
      characterObj={mannyObj}
      animationPaths={animationPaths}
    />
  );
}

function Lighting() {
  return (
    <>
      <hemisphereLight
        skyColor={0xffffff}
        groundColor={0x444444}
        position={[0, 0, 0]}
      />
      <directionalLight
        color={0xffffff}
        intensity={0.25}
        castShadow
        position={[0, 200, 100]}
      />
    </>
  );
}

function Floor() {
  const [ref] = useBox(() => ({
    type: "Static",
    args: [25, 0.2, 25],
    mass: 0,
    material: {
      friction: 0,
      name: "floor",
    },
    collisionFilterGroup: 2,
  }));
  return (
    <group>
      <mesh ref={ref}>
        <boxGeometry name="floor-box" />
        <meshPhongMaterial opacity={0} transparent />
      </mesh>
      <gridHelper args={[25, 25]} />
    </group>
  );
}

function Wall({ args, ...props }) {
  const [ref] = useBox(() => ({
    type: "Static",
    args,
    mass: 0,
    material: {
      friction: 0.3,
      name: "wall",
    },
    collisionFilterGroup: 2,
    ...props,
  }));
  return (
    <mesh receiveShadow ref={ref} {...props}>
      <boxGeometry args={args} />
      <meshPhongMaterial color="white" opacity={0.8} transparent />
    </mesh>
  );
}

function App() {
  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <Canvas
        flat
        camera={{
          fov: 75,
          near: 0.1,
          far: 3800,
          position: [0, 11, 11],
        }}
      >
        <Physics gravity={[0, -35, 0]}>
          <ThirdPersonCharacter />
          <Wall args={[25, 3, 0.2]} position={[0, 1.4, -12.6]} />
          <Wall args={[25, 3, 0.2]} position={[0, 1.4, 12.6]} />
          <Wall
            args={[25, 3, 0.2]}
            rotation={[0, -Math.PI / 2, 0]}
            position={[12.6, 1.4, 0]}
          />
          <Wall
            args={[25, 3, 0.2]}
            rotation={[0, -Math.PI / 2, 0]}
            position={[-12.6, 1.4, 0]}
          />
          <Floor />
        </Physics>
        <Lighting />
      </Canvas>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Running Locally

```bash
npm run dev
```

Go to `localhost:3000` to see the local test application.
