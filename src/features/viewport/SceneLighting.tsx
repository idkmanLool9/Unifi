import { Environment, Lightformer } from '@react-three/drei';
import { useViewSettingsStore } from '@/stores/viewSettingsStore';

/**
 * Studio lighting rig: soft ambient base, a shadow-casting key light, a
 * cool rim fill, and a procedural studio environment built from
 * light-formers (real image-based lighting with zero network fetches).
 * Intensities follow the inspector's lighting sliders.
 */
export function SceneLighting() {
  const keyIntensity = useViewSettingsStore((s) => s.keyLightIntensity);
  const ambientIntensity = useViewSettingsStore((s) => s.ambientIntensity);
  const shadowsEnabled = useViewSettingsStore((s) => s.shadowsEnabled);

  return (
    <>
      <ambientLight intensity={0.3 * ambientIntensity} />
      <hemisphereLight
        args={['#b8c4d6', '#3a3f47']}
        intensity={0.4 * ambientIntensity}
      />

      <directionalLight
        position={[6, 10, 6]}
        intensity={1.3 * keyIntensity}
        castShadow={shadowsEnabled}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0002}
      />
      <directionalLight
        position={[-8, 6, -6]}
        intensity={0.28 * keyIntensity}
      />

      {/* Procedural studio environment for image-based reflections. The
          background fill matters: metallic surfaces reflect the whole
          environment, so without it they read nearly black. */}
      <Environment resolution={128} frames={1}>
        <color attach="background" args={['#4b5058']} />
        {/* Overhead softbox */}
        <Lightformer
          form="rect"
          intensity={3}
          position={[0, 9, 0]}
          rotation-x={Math.PI / 2}
          scale={[14, 14, 1]}
        />
        {/* Side strips for long highlights along the uprights */}
        <Lightformer
          form="rect"
          intensity={1}
          position={[-9, 3.5, -2]}
          rotation-y={Math.PI / 2}
          scale={[10, 2.6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.85}
          position={[9, 3.5, 2]}
          rotation-y={-Math.PI / 2}
          scale={[10, 2.6, 1]}
        />
        {/* Low front fill so faces toward camera never go dead */}
        <Lightformer
          form="rect"
          intensity={0.5}
          position={[0, 2.5, 10]}
          scale={[12, 3, 1]}
        />
      </Environment>
    </>
  );
}
