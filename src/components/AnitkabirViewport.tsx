import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAnitkabirComplex } from '../scene/anitkabirBuilder';
import { CeremonyManager } from '../scene/ceremonyManager';
import { type ProjectedLabel, VisitorManager } from '../scene/visitorManager';
import type { CameraPreset, TimeOfDay, Visitor } from '../types';

interface AnitkabirViewportProps {
  visitors: Visitor[];
  cameraPreset: CameraPreset;
  timeOfDay: TimeOfDay;
  showLabels: boolean;
  autoRotate360: boolean;
  autoFollowNew: boolean;
  ceremonyEvent: { id: number; triggeredBy: string } | null;
  saluteSignal: number;
  onUserOrbitStart: () => void;
  onAutoFollowTriggered: () => void;
}

const CAMERA_PRESETS: Record<
  Exclude<CameraPreset, 'follow'>,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [72, 42, 62], target: [8, 4, -8] },
  mozole: { pos: [0, 12, 6], target: [0, 9, -34] },
  aslanli: { pos: [118, 8.5, 6], target: [42, 3, 6] },
  plaza: { pos: [-24, 14, 34], target: [4, 5, -14] },
};

const TIME_CONFIGS: Record<
  TimeOfDay,
  {
    skyHex: number;
    fogDensity: number;
    sunColor: number;
    sunIntensity: number;
    sunPos: [number, number, number];
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    nightFactor: number;
    exposure: number;
  }
> = {
  morning: {
    skyHex: 0x8db6db,
    fogDensity: 0.0026,
    sunColor: 0xfff3db,
    sunIntensity: 2.2,
    sunPos: [65, 85, 55],
    hemiSky: 0xbfe0ff,
    hemiGround: 0x5c4d3c,
    hemiIntensity: 0.85,
    nightFactor: 0,
    exposure: 1.08,
  },
  golden: {
    skyHex: 0xd99b66,
    fogDensity: 0.0032,
    sunColor: 0xffb86b,
    sunIntensity: 2.5,
    sunPos: [-75, 28, 42],
    hemiSky: 0xffcda3,
    hemiGround: 0x3b2d26,
    hemiIntensity: 0.72,
    nightFactor: 0.25,
    exposure: 1.12,
  },
  night: {
    skyHex: 0x0d1526,
    fogDensity: 0.0038,
    sunColor: 0x7ba4d9,
    sunIntensity: 0.55,
    sunPos: [40, 70, -30],
    hemiSky: 0x223659,
    hemiGround: 0x161922,
    hemiIntensity: 0.45,
    nightFactor: 1.0,
    exposure: 1.05,
  },
};

const _targetSky = new THREE.Color();
const _followTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function AnitkabirViewport({
  visitors,
  cameraPreset,
  timeOfDay,
  showLabels,
  autoRotate360,
  autoFollowNew,
  ceremonyEvent,
  saluteSignal,
  onUserOrbitStart,
  onAutoFollowTriggered,
}: AnitkabirViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const visitorManagerRef = useRef<VisitorManager | null>(null);
  const ceremonyManagerRef = useRef<CeremonyManager | null>(null);
  const presetRef = useRef<CameraPreset>(cameraPreset);
  const presetActiveRef = useRef<boolean>(true);
  const timeOfDayRef = useRef<TimeOfDay>(timeOfDay);
  const showLabelsRef = useRef<boolean>(showLabels);
  const autoRotateRef = useRef<boolean>(autoRotate360);
  const autoFollowRef = useRef<boolean>(autoFollowNew);
  const onUserOrbitStartRef = useRef(onUserOrbitStart);
  const onAutoFollowTriggeredRef = useRef(onAutoFollowTriggered);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const [labels, setLabels] = useState<ProjectedLabel[]>([]);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    presetRef.current = cameraPreset;
    presetActiveRef.current = true;
  }, [cameraPreset]);

  useEffect(() => {
    timeOfDayRef.current = timeOfDay;
  }, [timeOfDay]);

  useEffect(() => {
    showLabelsRef.current = showLabels;
    if (!showLabels) setLabels([]);
  }, [showLabels]);

  useEffect(() => {
    autoRotateRef.current = autoRotate360;
  }, [autoRotate360]);

  useEffect(() => {
    autoFollowRef.current = autoFollowNew;
  }, [autoFollowNew]);

  useEffect(() => {
    onUserOrbitStartRef.current = onUserOrbitStart;
  }, [onUserOrbitStart]);

  useEffect(() => {
    onAutoFollowTriggeredRef.current = onAutoFollowTriggered;
  }, [onAutoFollowTriggered]);

  useEffect(() => {
    if (ceremonyEvent && ceremonyEvent.id > 0) {
      ceremonyManagerRef.current?.startWreathCeremony(ceremonyEvent.triggeredBy);
    }
  }, [ceremonyEvent]);

  useEffect(() => {
    if (saluteSignal > 0) {
      ceremonyManagerRef.current?.triggerSalute(4.0);
    }
  }, [saluteSignal]);

  // Sync visitors prop into VisitorManager
  useEffect(() => {
    const mgr = visitorManagerRef.current;
    if (!mgr) return;

    const incomingIds = new Set(visitors.map((v) => v.id));
    for (const id of Array.from(knownIdsRef.current)) {
      if (!incomingIds.has(id)) {
        mgr.removeVisitor(id);
        knownIdsRef.current.delete(id);
      }
    }

    const isInitialBatch = knownIdsRef.current.size === 0 && visitors.length > 6;
    let newArrivalDetected = false;
    visitors.forEach((v, idx) => {
      const isNew = !knownIdsRef.current.has(v.id);
      if (isNew && !isInitialBatch) {
        newArrivalDetected = true;
      }
      const skipWalk = isInitialBatch && idx < visitors.length - 5;
      mgr.addOrUpdateVisitor(v, skipWalk);
      knownIdsRef.current.add(v.id);
    });

    if (newArrivalDetected && autoFollowRef.current) {
      presetRef.current = 'follow';
      presetActiveRef.current = true;
      onAutoFollowTriggeredRef.current();
    }
  }, [visitors]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const containerEl = container;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const initCfg = TIME_CONFIGS[timeOfDayRef.current];
    scene.background = new THREE.Color(initCfg.skyHex);
    scene.fog = new THREE.FogExp2(initCfg.skyHex, initCfg.fogDensity);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 480);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.overview.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 1.4;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 8;
    controls.maxDistance = 190;
    controls.addEventListener('start', () => {
      if (presetRef.current !== 'follow') {
        presetActiveRef.current = false;
      }
      onUserOrbitStartRef.current();
    });

    // 3-Point Outdoor Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      initCfg.hemiSky,
      initCfg.hemiGround,
      initCfg.hemiIntensity,
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(initCfg.sunColor, initCfg.sunIntensity);
    sunLight.position.set(...initCfg.sunPos);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 260;
    sunLight.shadow.camera.left = -85;
    sunLight.shadow.camera.right = 85;
    sunLight.shadow.camera.top = 85;
    sunLight.shadow.camera.bottom = -85;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xc7dcff, 0.35);
    rimLight.position.set(-45, 30, -65);
    scene.add(rimLight);

    // Build Anitkabir Complex
    const anitkabir = buildAnitkabirComplex(renderer, isSoftwareGl);
    scene.add(anitkabir.root);

    // Build Visitor Manager
    const visitorMgr = new VisitorManager();
    visitorManagerRef.current = visitorMgr;
    scene.add(visitorMgr.root);

    // Build Honor Guard Ceremony Manager
    const ceremonyMgr = new CeremonyManager();
    ceremonyManagerRef.current = ceremonyMgr;
    scene.add(ceremonyMgr.root);

    // Sync any visitors already present before mount
    visitors.forEach((v) => {
      visitorMgr.addOrUpdateVisitor(v, true);
      knownIdsRef.current.add(v.id);
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let labelAccum = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // 1. Animate Turkish Flag waving
      const flagPos = anitkabir.flagMesh.geometry.attributes.position;
      const base = anitkabir.flagBasePositions;
      for (let i = 0; i < flagPos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const factor = Math.max(0, (bx + 3.6) / 7.2);
        const wave =
          Math.sin(bx * 0.9 - elapsed * 4.2) * 0.35 * factor +
          Math.cos(by * 0.8 - elapsed * 3.1) * 0.12 * factor;
        flagPos.setZ(i, wave);
      }
      flagPos.needsUpdate = true;

      // 2. Smooth Time-of-Day atmosphere damping
      const tCfg = TIME_CONFIGS[timeOfDayRef.current];
      _targetSky.setHex(tCfg.skyHex);
      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(_targetSky, 1 - Math.exp(-3.5 * delta));
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(scene.background as THREE.Color);
        scene.fog.density = THREE.MathUtils.damp(scene.fog.density, tCfg.fogDensity, 3.5, delta);
      }
      sunLight.intensity = THREE.MathUtils.damp(sunLight.intensity, tCfg.sunIntensity, 3.5, delta);
      sunLight.position.x = THREE.MathUtils.damp(sunLight.position.x, tCfg.sunPos[0], 3, delta);
      sunLight.position.y = THREE.MathUtils.damp(sunLight.position.y, tCfg.sunPos[1], 3, delta);
      sunLight.position.z = THREE.MathUtils.damp(sunLight.position.z, tCfg.sunPos[2], 3, delta);
      hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, tCfg.hemiIntensity, 3.5, delta);
      renderer.toneMappingExposure = THREE.MathUtils.damp(
        renderer.toneMappingExposure,
        tCfg.exposure,
        3.5,
        delta,
      );

      for (const nl of anitkabir.nightLights) {
        nl.intensity = THREE.MathUtils.damp(nl.intensity, tCfg.nightFactor * 42, 3.5, delta);
      }
      for (const flame of anitkabir.brazierFlames) {
        flame.visible = tCfg.nightFactor > 0.15;
        if (flame.visible) {
          flame.scale.y = 0.85 + Math.sin(elapsed * 12 + flame.position.x) * 0.2;
        }
      }

      // 3. Update Visitor Avatars & Honor Guard Ceremony
      visitorMgr.update(delta, elapsed);
      ceremonyMgr.update(delta);

      // 4. Smooth Camera Preset Damping & 360 Auto-Rotate
      const activePreset = presetRef.current;
      controls.autoRotate = autoRotateRef.current && activePreset !== 'follow';
      controls.autoRotateSpeed = 1.4;

      if (presetActiveRef.current) {
        if (activePreset === 'follow') {
          const { yaw, found } = visitorMgr.getLatestVisitorTransform(_followTarget);
          if (found) {
            const backX = -Math.sin(yaw);
            const backZ = -Math.cos(yaw);
            const rightX = Math.cos(yaw);
            const rightZ = -Math.sin(yaw);
            _desiredLookAt.set(_followTarget.x, _followTarget.y + 1.35, _followTarget.z);
            _desiredCamPos.set(
              _followTarget.x + backX * 7.5 + rightX * 2.4,
              _followTarget.y + 4.3,
              _followTarget.z + backZ * 7.5 + rightZ * 2.4,
            );
            camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, 3.2, delta);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, 3.2, delta);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, 3.2, delta);
            controls.target.x = THREE.MathUtils.damp(controls.target.x, _desiredLookAt.x, 4.5, delta);
            controls.target.y = THREE.MathUtils.damp(controls.target.y, _desiredLookAt.y, 4.5, delta);
            controls.target.z = THREE.MathUtils.damp(controls.target.z, _desiredLookAt.z, 4.5, delta);
          }
        } else {
          const p = CAMERA_PRESETS[activePreset];
          camera.position.x = THREE.MathUtils.damp(camera.position.x, p.pos[0], 4, delta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, p.pos[1], 4, delta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, p.pos[2], 4, delta);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, p.target[0], 4.5, delta);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, p.target[1], 4.5, delta);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, p.target[2], 4.5, delta);

          if (
            camera.position.distanceTo(_desiredCamPos.set(...p.pos)) < 0.25 &&
            controls.target.distanceTo(_desiredLookAt.set(...p.target)) < 0.25
          ) {
            presetActiveRef.current = false;
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);

      // Update projected HTML labels at ~15fps
      labelAccum += delta;
      if (showLabelsRef.current && labelAccum >= 0.065) {
        labelAccum = 0;
        const w = containerEl.clientWidth || window.innerWidth;
        const h = containerEl.clientHeight || window.innerHeight;
        setLabels(visitorMgr.projectLabels(camera, w, h, 32));
      }

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    const onResize = () => {
      const w = containerEl.clientWidth || window.innerWidth;
      const h = containerEl.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      visitorMgr.dispose();
      ceremonyMgr.dispose();
      anitkabir.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      visitorManagerRef.current = null;
      ceremonyManagerRef.current = null;
      knownIdsRef.current.clear();
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0e1116]">
      {/* Dedicated WebGL Mount Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Projected Floating Visitor Nameplates */}
      {showLabels && !contextLost && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-10">
          {labels.map((lbl) => (
            <div
              key={lbl.id}
              style={{
                transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
              }}
              className="absolute left-0 top-0 flex flex-col items-center gap-0.5 will-change-transform"
            >
              {(lbl.message || lbl.giftName) && (
                <div
                  className={`max-w-[180px] truncate px-2 py-0.5 rounded text-[11px] font-medium shadow-sm ${
                    lbl.giftTier >= 2
                      ? 'bg-amber-500/90 text-stone-950'
                      : 'bg-stone-950/85 text-stone-100 border border-white/15'
                  }`}
                >
                  {lbl.giftName ? `${lbl.giftName}` : lbl.message}
                </div>
              )}
              <div className="px-2 py-0.5 rounded bg-stone-950/75 text-white text-[11px] font-semibold tracking-tight whitespace-nowrap border border-white/10">
                {lbl.username}
              </div>
            </div>
          ))}
        </div>
      )}

      {contextLost && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-950/90 text-stone-200">
          <div className="text-center space-y-2 px-6">
            <p className="font-display text-lg">WebGL Bağlantısı Yenileniyor</p>
            <p className="text-sm text-stone-400">3D sahne kısa süre içinde geri yüklenecektir.</p>
          </div>
        </div>
      )}
    </div>
  );
}
