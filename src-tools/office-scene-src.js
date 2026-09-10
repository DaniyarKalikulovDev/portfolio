import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import chairB64 from "./model-data/chair.js";
import deskLightB64 from "./model-data/deskLight.js";
import laptopB64 from "./model-data/laptop.js";
import newspaperB64 from "./model-data/newspaper.js";

function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const backCanvas = document.getElementById("officeModelsBack");
const frontCanvas = document.getElementById("officeModelsFront");
const officeScreen = document.querySelector(".office-screen");

if (backCanvas && frontCanvas && officeScreen && window.WebGLRenderingContext) {
  const rendererOpts = { alpha: true, antialias: true };
  const backRenderer = new THREE.WebGLRenderer({ canvas: backCanvas, ...rendererOpts });
  const frontRenderer = new THREE.WebGLRenderer({ canvas: frontCanvas, ...rendererOpts });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  backRenderer.setPixelRatio(dpr);
  frontRenderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 1.5));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
  keyLight.position.set(4, 6, 8);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xbcd4ff, 0.6);
  fillLight.position.set(-6, -2, 5);
  scene.add(fillLight);

  const items = [];

  /* Ring geometry: an ellipse tilted so half of it reads as "in front of"
     the heading and half as "behind" it, matching the reference orbit look. */
  const RING = { rx: 3.9, rz: 1.7, ry: 0.55, tilt: 0.12, speed: -0.35 };

  function frustumHeightAtZ(z) {
    const vFov = (camera.fov * Math.PI) / 180;
    return 2 * Math.tan(vFov / 2) * Math.abs(camera.position.z - z);
  }

  /* On a phone the frustum is under four world units wide. The old 0.55 floor
     swung the ring clean off both sides there, and the models — sized in world
     units and never scaled — came out wider than the heading they are meant to
     circle, so the laptop sat on top of the title. The floor drops and the
     models now take the ring's scale, so the whole orbit shrinks together. */
  function fitScale() {
    const h = frustumHeightAtZ(0);
    const w = h * camera.aspect;
    const scale = Math.min(w / 9, h / 4.4, 1.15);
    return Math.max(scale, 0.38);
  }

  let ringScale = 1;
  /* capped at 1: the desktop ring runs at 1.15 and its models are already the
     size they should be */
  let modelScale = 1;

  function resize() {
    const w = officeScreen.clientWidth;
    const h = officeScreen.clientHeight;
    if (!w || !h) return;
    backRenderer.setSize(w, h, false);
    frontRenderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ringScale = fitScale();
    modelScale = Math.min(ringScale, 1);
  }

  const loader = new GLTFLoader();
  const specs = [
    { data: chairB64, size: 1.7, spin: 0.4 },
    { data: deskLightB64, size: 1.35, spin: -0.55 },
    { data: laptopB64, size: 1.6, spin: 0.35 },
    { data: newspaperB64, size: 1.3, spin: -0.4 }
  ];
  const count = specs.length;

  specs.forEach((spec, index) => {
    loader.parse(
      base64ToArrayBuffer(spec.data),
      "",
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        model.scale.setScalar(spec.size / maxDim);

        const group = new THREE.Group();
        group.add(model);
        scene.add(group);
        items.push({
          group,
          spin: spec.spin,
          phase: (index / count) * Math.PI * 2,
          bob: 0.4 + (index % 3) * 0.18
        });
      },
      (err) => console.warn("3D model failed to parse:", err)
    );
  });

  let visible = true;
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => { visible = entries[0].isIntersecting; },
      { threshold: 0.05 }
    );
    io.observe(officeScreen);
  }

  const clock = new THREE.Clock();
  let orbitT = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;

    orbitT += dt * RING.speed;

    items.forEach((item) => {
      const angle = orbitT + item.phase;
      const x = Math.cos(angle) * RING.rx * ringScale;
      const z = Math.sin(angle) * RING.rz * ringScale;
      const y = (Math.sin(angle * 1.3 + item.phase) * RING.ry + Math.sin(orbitT * 0.6 + item.phase) * 0.15) * ringScale;
      item.group.position.set(x, y, z);
      item.group.scale.setScalar(modelScale);
      item.group.rotation.x = RING.tilt + Math.sin(angle) * 0.05;
      item.group.rotation.y += item.spin * dt;
      item.z = z;
    });

    items.forEach((item) => { item.group.visible = item.z < 0; });
    backRenderer.render(scene, camera);

    items.forEach((item) => { item.group.visible = item.z >= 0; });
    frontRenderer.render(scene, camera);
  }

  window.addEventListener("resize", resize);
  resize();
  animate();
}
