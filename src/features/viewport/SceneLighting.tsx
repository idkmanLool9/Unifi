/**
 * Studio-style lighting rig: soft ambient base, a shadow-casting key light,
 * and a cool fill from the opposite side. Fully local — no HDR environment
 * fetches — so the app works offline and loads instantly.
 */
export function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#b8c4d6', '#3a3f47', 0.5]} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.35} />
    </>
  );
}
