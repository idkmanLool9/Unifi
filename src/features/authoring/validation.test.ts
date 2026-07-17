import { describe, expect, it } from 'vitest';
import { issueCounts, validateAuthoring, type AuthoringSnapshot } from './validation';
import type { AuthoredLed, AuthoredPort, Vec3 } from './authoringModel';

const dims = { widthMm: 442, heightMm: 44, depthMm: 300 };

const port = (over: Partial<AuthoredPort> = {}): AuthoredPort => ({
  id: 'rj45-1',
  type: 'rj45',
  location: 'front',
  positionMm: [0, 0, 150],
  rotationDeg: [0, 0, 0],
  sizeMm: [15, 13],
  poe: false,
  etherlighting: false,
  visible: true,
  anchorMm: [0, 0, 22],
  ...over,
});

const led = (over: Partial<AuthoredLed> = {}): AuthoredLed => ({
  id: 'led-1',
  label: 'Status',
  kind: 'status',
  color: '#3fb970',
  positionMm: [-200, 0, 150],
  diameterMm: 2,
  intensity: 0.8,
  on: true,
  ...over,
});

const snapshot = (over: Partial<AuthoringSnapshot> = {}): AuthoringSnapshot => ({
  definition: dims,
  ports: [],
  leds: [],
  mountOffsetMm: [0, 0, 0] as Vec3,
  ...over,
});

const codes = (input: AuthoringSnapshot) =>
  validateAuthoring(input).map((i) => i.code);

describe('validation engine', () => {
  it('accepts a clean layout with only the informational no-ports note', () => {
    const issues = validateAuthoring(snapshot({ ports: [port()] }));
    expect(issues).toEqual([]);
    const empty = validateAuthoring(snapshot());
    expect(empty.map((i) => i.code)).toEqual(['no-ports']);
    expect(issueCounts(empty)).toEqual({ errors: 0, warnings: 0, infos: 1 });
  });

  it('flags duplicate port and LED ids as errors', () => {
    const result = validateAuthoring(
      snapshot({
        ports: [port(), port({ positionMm: [50, 0, 150] })],
        leds: [led(), led({ positionMm: [-190, 0, 150] })],
      }),
    );
    const errorCodes = result.filter((i) => i.level === 'error').map((i) => i.code);
    expect(errorCodes).toContain('duplicate-port-id');
    expect(errorCodes).toContain('duplicate-led-id');
  });

  it('flags non-finite transforms and non-positive sizes', () => {
    expect(codes(snapshot({ ports: [port({ positionMm: [NaN, 0, 150] })] }))).toContain(
      'invalid-transform',
    );
    expect(codes(snapshot({ ports: [port({ sizeMm: [0, 13] })] }))).toContain(
      'invalid-size',
    );
    expect(codes(snapshot({ leds: [led({ diameterMm: 0 })], ports: [port()] }))).toContain(
      'invalid-led-size',
    );
  });

  it('warns when elements leave the chassis', () => {
    expect(codes(snapshot({ ports: [port({ positionMm: [400, 0, 150] })] }))).toContain(
      'outside-chassis',
    );
    expect(codes(snapshot({ ports: [port()], leds: [led({ positionMm: [0, 60, 150] })] }))).toContain(
      'led-outside',
    );
    expect(
      codes(
        snapshot({
          ports: [port()],
          cooling: { fanPositionsMm: [[500, 0, -150]] },
        }),
      ),
    ).toContain('fan-outside');
    expect(
      codes(
        snapshot({
          ports: [port()],
          display: { lcd: true, positionMm: [400, 0, 150], widthMm: 60, heightMm: 25 },
        }),
      ),
    ).toContain('display-outside');
  });

  it('checks cable anchors and exit directions', () => {
    expect(codes(snapshot({ ports: [port({ anchorMm: [0, 0, -22] })] }))).toContain(
      'anchor-inside',
    );
    expect(codes(snapshot({ ports: [port({ anchorMm: [0, 0, 120] })] }))).toContain(
      'anchor-far',
    );
    expect(codes(snapshot({ ports: [port({ exitDirMm: [0, 0, 0] })] }))).toContain(
      'exit-zero',
    );
    expect(codes(snapshot({ ports: [port({ exitDirMm: [0, 0, -1] })] }))).toContain(
      'exit-into-panel',
    );
    // A rear port exiting -z is fine.
    expect(
      codes(
        snapshot({
          ports: [
            port({ location: 'rear', anchorMm: [0, 0, -22], exitDirMm: [0, 0, -1] }),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('detects overlapping openings on the same face only', () => {
    const overlapping = snapshot({
      ports: [port(), port({ id: 'rj45-2', positionMm: [8, 0, 150] })],
    });
    expect(codes(overlapping)).toContain('ports-overlap');
    const acrossFaces = snapshot({
      ports: [
        port(),
        port({ id: 'rj45-2', location: 'rear', positionMm: [0, 0, -150], anchorMm: [0, 0, -22] }),
      ],
    });
    expect(codes(acrossFaces)).not.toContain('ports-overlap');
    const spaced = snapshot({
      ports: [port(), port({ id: 'rj45-2', positionMm: [18, 0, 150] })],
    });
    expect(codes(spaced)).not.toContain('ports-overlap');
  });

  it('validates the mount offset', () => {
    expect(codes(snapshot({ ports: [port()], mountOffsetMm: [0, NaN, 0] }))).toContain(
      'invalid-mount',
    );
    expect(codes(snapshot({ ports: [port()], mountOffsetMm: [0, 0, 30] }))).toContain(
      'mount-large',
    );
  });
});
