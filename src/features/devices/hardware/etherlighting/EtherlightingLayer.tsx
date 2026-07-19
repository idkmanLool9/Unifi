import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { useFrame } from '@react-three/fiber';
import { resolvePortLight } from './resolve';
import { useEtherlightingStore } from './etherlightingStore';
import { effectiveRuntime, usePortRuntimeStore } from './portRuntimeStore';
import {
  calibratedPort,
  useCalibrationStore,
} from '@/features/devices/hardware/connectorCalibration';
import {
  CONNECTOR_SIZES,
  resolvePhysicalPorts,
} from '@/features/devices/hardware/physicalPorts';
import { MM_TO_M } from '@/features/rack/rackMath';
import { useCableStore } from '@/stores/cableStore';
import { useCableToolStore } from '@/stores/cableToolStore';
import { useUIStore } from '@/stores/uiStore';
import type { DeviceDefinition } from '@/features/devices/deviceSchema';

/**
 * The Etherlighting renderer — an automatic emissive layer generated
 * directly from authored port metadata. There are no dedicated
 * lighting meshes and no per-device implementations: every eligible
 * port's authored opening (position, rotation, bounds, calibration)
 * becomes an instanced glow frame drawn by one shader. Zones,
 * animation modes and HDR all run on the GPU; colors ease CPU-side
 * only for instances whose target actually changed. One draw call per
 * device, any number of ports.
 */

const MODE_INDEX: Record<string, number> = {
  static: 0,
  breathing: 1,
  pulse: 2,
  wave: 3,
  sweep: 4,
  ping: 5,
  ripple: 6,
  rainbow: 7,
  activity: 8,
  traffic: 9,
};

const VERTEX = /* glsl */ `
attribute vec3 iColor;
attribute vec3 iColor2;
attribute vec4 iParams;   // brightness, mode, zoneMask, glowRadius
attribute vec4 iExtra;    // corners, frameOffset, phase, activity
attribute vec2 iAspect;   // opening size (w, h), meters

varying vec2 vUv;
varying vec3 vColor;
varying vec3 vColor2;
varying vec4 vParams;
varying vec4 vExtra;
varying vec2 vAspect;

void main() {
  vUv = uv;
  vColor = iColor;
  vColor2 = iColor2;
  vParams = iParams;
  vExtra = iExtra;
  vAspect = iAspect;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uAnimSpeed;
uniform float uIntensity;
uniform float uHdr;

varying vec2 vUv;
varying vec3 vColor;
varying vec3 vColor2;
varying vec4 vParams;
varying vec4 vExtra;
varying vec2 vAspect;

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void main() {
  float brightness = vParams.x;
  float mode = vParams.y;
  float zoneMask = vParams.z;
  float glowRadius = vParams.w;
  float corners = vExtra.x;
  float frameOffset = vExtra.y;
  float phase = vExtra.z;
  float activity = vExtra.w;

  // Quad spans the opening plus a glow margin on every side.
  float minDim = min(vAspect.x, vAspect.y);
  float pad = glowRadius * minDim;
  vec2 quad = vAspect + 2.0 * pad;
  vec2 p = (vUv - 0.5) * quad;          // meters, centered
  vec2 half0 = vAspect * 0.5;

  // Signed distance to the opening rectangle edge (outside positive).
  vec2 q = abs(p) - half0;
  float outside = length(max(q, 0.0));
  float inside = min(max(q.x, q.y), 0.0);
  float sd = outside + inside;

  // Frame band center: on the edge, pulled inside, or pushed outside.
  float band = pad * 0.55;
  float target = frameOffset * band * 0.9;
  float d = abs(sd - target);
  float glow = exp(-(d * d) / (band * band * 0.5));

  // Zone weighting: which edge does this fragment belong to?
  float wTop    = step(0.0,  p.y) * step(abs(p.x) * half0.y, abs(p.y) * half0.x + pad);
  float wBottom = step(p.y, 0.0)  * step(abs(p.x) * half0.y, abs(p.y) * half0.x + pad);
  float wLeft   = step(p.x, 0.0)  * step(abs(p.y) * half0.x, abs(p.x) * half0.y + pad);
  float wRight  = step(0.0,  p.x) * step(abs(p.y) * half0.x, abs(p.x) * half0.y + pad);
  float zone =
    wTop    * step(0.5, mod(zoneMask, 2.0)) +
    wBottom * step(0.5, mod(floor(zoneMask / 2.0), 2.0)) +
    wLeft   * step(0.5, mod(floor(zoneMask / 4.0), 2.0)) +
    wRight  * step(0.5, mod(floor(zoneMask / 8.0), 2.0));
  zone = min(zone, 1.0);
  // Corner mode: keep only fragments near the rect corners.
  float cornerNear = smoothstep(0.25, 0.9,
    (abs(p.x) / (half0.x + pad)) * (abs(p.y) / (half0.y + pad)) * 4.0);
  zone = mix(zone, zone * cornerNear, corners);

  // Animation factor + optional color morph.
  float t = uTime * uAnimSpeed;
  float anim = 1.0;
  vec3 color = vColor;
  float u = vUv.x;
  if (mode < 0.5) { anim = 1.0; }
  else if (mode < 1.5) { anim = 0.72 + 0.28 * sin(t * 1.6 + phase); }
  else if (mode < 2.5) { float s = sin(t * 2.4 + phase); anim = 0.35 + 0.65 * s * s; }
  else if (mode < 3.5) { anim = 0.55 + 0.45 * sin(t * 2.2 - phase); }
  else if (mode < 4.5) {
    float pos = fract(t * 0.35);
    anim = 0.25 + 0.75 * exp(-pow((u - pos) * 6.0, 2.0));
  }
  else if (mode < 5.5) {
    float r = length(p) / (length(half0) + pad);
    float ring = fract(t * 0.6);
    anim = 0.2 + 0.8 * exp(-pow((r - ring) * 8.0, 2.0));
  }
  else if (mode < 6.5) { anim = 0.5 + 0.5 * sin(length(p) * 260.0 - t * 4.0); }
  else if (mode < 7.5) {
    color = hsv2rgb(vec3(fract(t * 0.12 + phase * 0.05 + u * 0.35), 0.85, 1.0));
  }
  else if (mode < 8.5) {
    // Activity: each port blinks on its own pseudo-random schedule (a
    // per-port seed varies both phase and rate) so it reads as independent
    // traffic flicker, not a wave sweeping across the row.
    float seed = fract(sin(phase * 91.7) * 43758.5453);
    float rate = 3.0 + 6.0 * activity;
    float blink = step(0.5, fract(t * rate * (0.55 + 0.9 * seed) + seed));
    anim = mix(0.22, 1.0, blink * activity + (1.0 - activity) * 0.35);
    color = mix(vColor, vColor2, blink * activity);
  }
  else {
    float sweep = fract(t * (0.4 + activity * 1.2) + phase * 0.1);
    anim = 0.3 + 0.7 * exp(-pow((u - sweep) * 5.0, 2.0)) * (0.3 + 0.7 * activity);
  }

  float alpha = glow * zone * anim * brightness;
  if (alpha < 0.003) discard;
  vec3 emissive = color * uIntensity * uHdr;
  gl_FragColor = vec4(emissive * alpha, alpha);
}
`;

/** Shared material — one program for every device layer. */
const MATERIAL = new ShaderMaterial({
  vertexShader: VERTEX,
  fragmentShader: FRAGMENT,
  uniforms: {
    uTime: { value: 0 },
    uAnimSpeed: { value: 1 },
    uIntensity: { value: 1 },
    uHdr: { value: 1 },
  },
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  side: DoubleSide,
  toneMapped: false,
});

/** Lift of the frame plane off the faceplate, meters (no z-fighting). */
const FACE_LIFT = 0.0011;
/** Cable-tool engagement boost. */
const BOOST = 1.9;
const BOOST_TAU = 0.055;

const TMP_MATRIX = new Matrix4();
const TMP_POS = new Vector3();
const TMP_QUAT = new Quaternion();
const TMP_SCALE = new Vector3();
const TMP_EULER_Q = new Quaternion();
const WORLD_POS = new Vector3();
const TMP_COLOR = new Color();
const TMP_COLOR2 = new Color();

/** Applies global saturation to a resolved hex color. */
function saturated(hex: string, saturation: number, out: Color): Color {
  out.set(hex);
  if (saturation !== 1) {
    const hsl = { h: 0, s: 0, l: 0 };
    out.getHSL(hsl);
    out.setHSL(hsl.h, Math.min(1, hsl.s * saturation), hsl.l);
  }
  return out;
}

export function EtherlightingLayer({
  definition,
  instanceId,
}: {
  definition: DeviceDefinition;
  instanceId?: string;
}) {
  const settings = useEtherlightingStore((s) => s.settings);
  const calibrationVersion = useCalibrationStore((s) => s.version);
  const runtimeStates = usePortRuntimeStore((s) => s.states);
  const cables = useCableStore((s) => s.cables);
  const meshRef = useRef<InstancedMesh>(null);

  // The frame set: geometry + static per-instance data. Rebuilt only
  // when the definition, calibration or port count changes.
  const frames = useMemo(() => {
    const ports = resolvePhysicalPorts(definition).filter((p) => p.visible);
    if (ports.length === 0) return null;
    const xs = ports.map((p) => p.positionMm[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    return ports.map((port, index) => {
      const calibrated = calibratedPort(definition.id, port.ref);
      const catalog = CONNECTOR_SIZES[port.type] ?? CONNECTOR_SIZES.other;
      const widthMm =
        calibrated?.widthMm ?? port.sizeMm?.[0] ?? catalog.widthMm;
      const heightMm =
        calibrated?.heightMm ?? port.sizeMm?.[1] ?? catalog.heightMm;
      const positionMm = calibrated?.positionMm ?? port.positionMm;
      return {
        port,
        index,
        positionMm,
        widthM: widthMm * MM_TO_M,
        heightM: heightMm * MM_TO_M,
        out: port.location === 'front' ? 1 : -1,
        xNorm: maxX > minX ? (port.positionMm[0] - minX) / (maxX - minX) : 0.5,
        phase: positionMm[0] * MM_TO_M * 18,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition, calibrationVersion]);

  const count = frames?.length ?? 0;

  // Instanced geometry owns the per-instance attributes.
  const geometry = useMemo(() => {
    if (count === 0) return null;
    const g = new PlaneGeometry(1, 1);
    g.setAttribute('iColor', new InstancedBufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('iColor2', new InstancedBufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('iParams', new InstancedBufferAttribute(new Float32Array(count * 4), 4));
    g.setAttribute('iExtra', new InstancedBufferAttribute(new Float32Array(count * 4), 4));
    g.setAttribute('iAspect', new InstancedBufferAttribute(new Float32Array(count * 2), 2));
    return g;
  }, [count]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  // Target colors for CPU-side transitions + resolved base brightness
  // (the boost multiplies over it without re-resolving).
  const targets = useRef<Float32Array>(new Float32Array(0));
  const eased = useRef<Float32Array>(new Float32Array(0));
  const baseBrightness = useRef<Float32Array>(new Float32Array(0));
  // True when at least one frame is lit — a fully dark device layer (e.g.
  // an unconnected device in Activity mode) skips all per-frame work.
  const anyLit = useRef(true);

  // Static + resolved per-instance data. Runs when settings, cables,
  // runtime states or the frame set change — never per frame.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !frames || !geometry) return;
    if (targets.current.length !== count * 6) {
      targets.current = new Float32Array(count * 6);
      eased.current = new Float32Array(count * 6);
      eased.current.fill(-1); // force initial snap
      baseBrightness.current = new Float32Array(count);
    }
    const iParams = geometry.getAttribute('iParams') as InstancedBufferAttribute;
    const iExtra = geometry.getAttribute('iExtra') as InstancedBufferAttribute;
    const iAspect = geometry.getAttribute('iAspect') as InstancedBufferAttribute;

    frames.forEach((frame, i) => {
      const resolved = resolvePortLight({
        settings,
        definition,
        port: frame.port,
        runtime: effectiveRuntime(
          runtimeStates,
          cables,
          instanceId,
          frame.port.ref,
        ),
        xNorm: frame.xNorm,
      });

      // Transform: authored position + rotation, lifted off the face.
      const pad = resolved.glowRadius * Math.min(frame.widthM, frame.heightM);
      TMP_POS.set(
        frame.positionMm[0] * MM_TO_M,
        frame.positionMm[1] * MM_TO_M,
        frame.positionMm[2] * MM_TO_M + frame.out * FACE_LIFT,
      );
      TMP_QUAT.set(0, 0, 0, 1);
      if (frame.out === -1) {
        TMP_QUAT.setFromAxisAngle(TMP_SCALE.set(0, 1, 0), Math.PI);
      }
      if (
        frame.port.rotationDeg[0] || frame.port.rotationDeg[1] || frame.port.rotationDeg[2]
      ) {
        TMP_EULER_Q.setFromAxisAngle(
          TMP_SCALE.set(0, 0, 1),
          (frame.port.rotationDeg[2] * Math.PI) / 180,
        );
        TMP_QUAT.multiply(TMP_EULER_Q);
      }
      TMP_SCALE.set(frame.widthM + 2 * pad, frame.heightM + 2 * pad, 1);
      TMP_MATRIX.compose(TMP_POS, TMP_QUAT, TMP_SCALE);
      mesh.setMatrixAt(i, TMP_MATRIX);

      // Color targets (saturation applied here, eased in useFrame).
      saturated(resolved.color, settings.saturation, TMP_COLOR);
      saturated(resolved.color2, settings.saturation, TMP_COLOR2);
      targets.current[i * 6] = TMP_COLOR.r;
      targets.current[i * 6 + 1] = TMP_COLOR.g;
      targets.current[i * 6 + 2] = TMP_COLOR.b;
      targets.current[i * 6 + 3] = TMP_COLOR2.r;
      targets.current[i * 6 + 4] = TMP_COLOR2.g;
      targets.current[i * 6 + 5] = TMP_COLOR2.b;

      baseBrightness.current[i] = resolved.enabled ? resolved.brightness : 0;
      iParams.setXYZW(
        i,
        baseBrightness.current[i],
        MODE_INDEX[resolved.mode] ?? 0,
        resolved.zoneMask,
        resolved.glowRadius,
      );
      iExtra.setXYZW(
        i,
        resolved.corners ? 1 : 0,
        resolved.frameOffset,
        frame.phase + frame.index * 0.37,
        resolved.activity,
      );
      iAspect.setXY(i, frame.widthM, frame.heightM);
    });
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    iParams.needsUpdate = true;
    iExtra.needsUpdate = true;
    iAspect.needsUpdate = true;
    anyLit.current = baseBrightness.current.some((b) => b > 0.001);
  }, [frames, geometry, count, settings, definition, instanceId, runtimeStates, cables]);

  // Per-frame: time uniform, eased color transitions, cable-tool boost,
  // and distance culling. Settled instances cost one comparison.
  const boosts = useRef(new Map<number, number>());
  useFrame(({ clock, camera }, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !frames || !geometry) return;

    MATERIAL.uniforms.uTime.value = clock.elapsedTime;
    MATERIAL.uniforms.uAnimSpeed.value = settings.animationSpeed;
    MATERIAL.uniforms.uIntensity.value = settings.intensity;
    MATERIAL.uniforms.uHdr.value = settings.enableHdr ? settings.hdrStrength : 1;

    // Render-distance culling per device layer, and a fast skip for a
    // fully dark layer (no lit ports — e.g. unconnected in Activity mode).
    mesh.getWorldPosition(WORLD_POS);
    const visible =
      anyLit.current &&
      WORLD_POS.distanceTo(camera.position) < settings.renderDistanceM;
    if (mesh.visible !== visible) mesh.visible = visible;
    if (!visible) return;

    const iColor = geometry.getAttribute('iColor') as InstancedBufferAttribute;
    const iColor2 = geometry.getAttribute('iColor2') as InstancedBufferAttribute;
    const iParams = geometry.getAttribute('iParams') as InstancedBufferAttribute;

    const cableActive = useUIStore.getState().activeTool === 'cable';
    const { hoverEnd, sourceEnd } = useCableToolStore.getState();
    const kBoost = 1 - Math.exp(-delta / BOOST_TAU);
    const kColor =
      settings.quality === 'performance'
        ? 1
        : Math.min(1, delta * 6 * settings.transitionSpeed);

    let colorsDirty = false;
    let paramsDirty = false;
    for (let i = 0; i < frames.length; i++) {
      // Color transition easing toward the resolved target.
      for (let c = 0; c < 6; c++) {
        const target = targets.current[i * 6 + c];
        const current = eased.current[i * 6 + c];
        if (current !== target) {
          const next =
            current < 0 || Math.abs(target - current) < 0.004
              ? target
              : current + (target - current) * kColor;
          eased.current[i * 6 + c] = next;
          colorsDirty = true;
        }
      }
      iColor.setXYZ(
        i,
        eased.current[i * 6],
        eased.current[i * 6 + 1],
        eased.current[i * 6 + 2],
      );
      iColor2.setXYZ(
        i,
        eased.current[i * 6 + 3],
        eased.current[i * 6 + 4],
        eased.current[i * 6 + 5],
      );

      // Cable-tool engagement boost multiplies the resolved brightness.
      const ref = frames[i].port.ref;
      const engaged =
        cableActive &&
        instanceId !== undefined &&
        ((hoverEnd?.deviceInstanceId === instanceId && hoverEnd.portRef === ref) ||
          (sourceEnd?.deviceInstanceId === instanceId &&
            sourceEnd.portRef === ref));
      const goal = engaged ? BOOST : 1;
      const current = boosts.current.get(i) ?? 1;
      if (current !== goal) {
        const next =
          Math.abs(goal - current) < 0.01
            ? goal
            : current + (goal - current) * kBoost;
        boosts.current.set(i, next);
        iParams.setX(i, baseBrightness.current[i] * next);
        paramsDirty = true;
      }
    }
    if (colorsDirty) {
      iColor.needsUpdate = true;
      iColor2.needsUpdate = true;
    }
    if (paramsDirty) iParams.needsUpdate = true;
  });

  if (!frames || !geometry || count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, MATERIAL, count]}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}
