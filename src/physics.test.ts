import { describe, expect, it } from 'vitest';
import {
  add, anglesFromAxis, axisFromAngles, dipoleFieldMicroTesla, dot, fieldLine,
  makeArray, norm, normalize, scale, sub, totalFieldMicroTesla, vectorInFrame,
} from './physics';
import type { Dipole, Vec3 } from './physics';

const zero: Vec3 = [0, 0, 0];
const dipole: Dipole = { positionMm: [0, 0, 0], axis: [0, 0, 1], momentAm2: 1 };

function closeVector(actual: Vec3 | null, expected: Vec3, digits = 10): void {
  expect(actual).not.toBeNull();
  expected.forEach((component, index) => expect(actual![index]).toBeCloseTo(component, digits));
}

describe('vector and angle conventions', () => {
  it('implements vector arithmetic without mutating inputs', () => {
    const a: Vec3 = [1, 2, 3];
    const b: Vec3 = [4, -2, 0];
    expect(add(a, b)).toEqual([5, 0, 3]);
    expect(sub(a, b)).toEqual([-3, 4, 3]);
    expect(scale(a, 2)).toEqual([2, 4, 6]);
    expect(dot(a, b)).toBe(0);
    expect(norm([3, 4, 0])).toBe(5);
    closeVector(normalize([0, 3, 4]), [0, 0.6, 0.8]);
    expect(a).toEqual([1, 2, 3]);
    expect(b).toEqual([4, -2, 0]);
  });

  it('normalizes extreme finite axes without overflow or underflow', () => {
    for (const magnitude of [Number.MIN_VALUE, Number.MAX_VALUE]) {
      closeVector(normalize([magnitude, magnitude, 0]), [Math.SQRT1_2, Math.SQRT1_2, 0]);
    }
  });

  it.each([[0, 0], [90, 0], [-145, 37], [20, -80], [0, 90], [0, -90]])(
    'has a unit axis and angle round trip for %s,%s degrees', (azimuth, elevation) => {
      const axis = axisFromAngles(azimuth, elevation);
      expect(norm(axis)).toBeCloseTo(1, 14);
      const angles = anglesFromAxis(scale(axis, 3));
      expect(angles.azimuthDeg).toBeCloseTo(azimuth, 10);
      expect(angles.elevationDeg).toBeCloseTo(elevation, 10);
      closeVector(axisFromAngles(angles.azimuthDeg, angles.elevationDeg), axis);
    },
  );

  it('matches right-handed +X/+Y/+Z angular convention', () => {
    closeVector(axisFromAngles(0, 0), [1, 0, 0]);
    closeVector(axisFromAngles(90, 0), [0, 1, 0]);
    closeVector(axisFromAngles(0, 90), [0, 0, 1]);
  });

  it('projects onto supplied basis without inventing registration or normalizing it', () => {
    closeVector(vectorInFrame([2, 3, 4], [[0, 1, 0], [-1, 0, 0], [0, 0, 1]]), [3, -2, 4]);
    closeVector(vectorInFrame([2, 3, 4], [[2, 0, 0], [0, 1, 0], [0, 0, 1]]), [4, 3, 4]);
  });
});

describe('ideal SI dipole field', () => {
  it('matches analytic on-axis and equatorial fields at 100 mm (1 A m^2)', () => {
    // 1e-7 * 1 / (0.1 m)^3 T = 100 uT; axial multiplier is 2.
    closeVector(dipoleFieldMicroTesla([0, 0, 100], dipole), [0, 0, 200]);
    closeVector(dipoleFieldMicroTesla([100, 0, 0], dipole), [0, 0, -100]);
    closeVector(dipoleFieldMicroTesla([0, 0, -100], dipole), [0, 0, 200]);
  });

  it('has the 2:1 axial/equatorial magnitude ratio and inverse-cube decay', () => {
    const axial = dipoleFieldMicroTesla([0, 0, 100], dipole)!;
    const equator = dipoleFieldMicroTesla([100, 0, 0], dipole)!;
    expect(norm(axial) / norm(equator)).toBeCloseTo(2, 12);
    closeVector(dipoleFieldMicroTesla([0, 0, 200], dipole), scale(axial, 1 / 8));
  });

  it('scales with moment and normalizes the supplied axis', () => {
    closeVector(dipoleFieldMicroTesla([0, 0, 100], { ...dipole, axis: [0, 0, 7], momentAm2: 2 }), [0, 0, 400]);
    closeVector(dipoleFieldMicroTesla([0, 0, 100], { ...dipole, momentAm2: 0 }), zero);
    closeVector(dipoleFieldMicroTesla([0, 0, 100], { ...dipole, axis: [0, 0, -1] }), [0, 0, -200]);
  });

  it('superposes fields and uniform background without input mutation', () => {
    const second: Dipole = { positionMm: [40, -20, 10], axis: [1, 2, 3], momentAm2: 0.3 };
    const point: Vec3 = [35, 19, 80];
    const background: Vec3 = [20, -5, 40];
    const sources = [dipole, second];
    const before = JSON.stringify({ point, sources, background });
    const expected = add(add(dipoleFieldMicroTesla(point, dipole)!, dipoleFieldMicroTesla(point, second)!), background);
    closeVector(totalFieldMicroTesla(point, sources, background), expected);
    expect(totalFieldMicroTesla(point, [], background)).toEqual(background);
    expect(totalFieldMicroTesla(point, [], background)).not.toBe(background);
    expect(JSON.stringify({ point, sources, background })).toBe(before);
  });

  it('is covariant under an arbitrary proper rotation and translation', () => {
    const rotationAxis = normalize([1, 2, -3]);
    const angle = 0.73;
    const rotate = (v: Vec3): Vec3 => {
      const [x, y, z] = rotationAxis;
      const cross: Vec3 = [y * v[2] - z * v[1], z * v[0] - x * v[2], x * v[1] - y * v[0]];
      return add(add(scale(v, Math.cos(angle)), scale(cross, Math.sin(angle))),
        scale(rotationAxis, dot(rotationAxis, v) * (1 - Math.cos(angle))));
    };
    const translation: Vec3 = [30, -60, 12];
    const source: Dipole = { positionMm: [10, 20, -5], axis: [1, -2, 3], momentAm2: 0.4 };
    const point: Vec3 = [-40, 75, 100];
    const background: Vec3 = [20, 5, -10];
    const transformed: Dipole = { ...source, positionMm: add(rotate(source.positionMm), translation), axis: rotate(source.axis) };
    closeVector(totalFieldMicroTesla(add(rotate(point), translation), [transformed], rotate(background)),
      rotate(totalFieldMicroTesla(point, [source], background)!));
  });

  it.each([0, 1, 4.999, 5])('returns null at or within exclusion, distance %s mm', (distance) => {
    const point: Vec3 = [distance, 0, 0];
    expect(dipoleFieldMicroTesla(point, dipole)).toBeNull();
    expect(totalFieldMicroTesla(point, [dipole], [20, 30, 40])).toBeNull();
  });

  it('does not clamp distances just outside exclusion', () => {
    const rMm = 5.001;
    const result = dipoleFieldMicroTesla([rMm, 0, 0], dipole)!;
    expect(result[2] / (-0.1 / (rMm * 1e-3) ** 3)).toBeCloseTo(1, 12);
  });

  it('retains exclusion for a zero-moment source and translates exclusion with source', () => {
    expect(dipoleFieldMicroTesla(zero, { ...dipole, momentAm2: 0 })).toBeNull();
    const moved: Dipole = { ...dipole, positionMm: [100, 10, 20] };
    expect(totalFieldMicroTesla([100, 10, 24], [dipole, moved], zero)).toBeNull();
  });

  it('produces finite fields on a generic 40-mm sensor grid', () => {
    const sensors = makeArray();
    expect(sensors).toHaveLength(25);
    expect(sensors[12]).toEqual({ id: 13, row: 3, col: 3, positionMm: [0, 0, 0] });
    expect(sensors.map((s) => [s.id, s.row, s.col])).toEqual(
      Array.from({ length: 25 }, (_, i) => [i + 1, Math.floor(i / 5) + 1, i % 5 + 1]),
    );
    closeVector(sensors[0]!.positionMm, [-80, -80, 0]);
    closeVector(sensors[24]!.positionMm, [80, 80, 0]);
    for (const sensor of sensors) {
      const b = dipoleFieldMicroTesla(sensor.positionMm, { ...dipole, positionMm: [0, 0, 100] });
      expect(b).not.toBeNull();
      expect(b!.every(Number.isFinite)).toBe(true);
    }
  });

  it('centers even and rectangular grids with independent pitches', () => {
    const sensors = makeArray(2, 3, 10, 20);
    expect(sensors.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sensors.map((s) => [s.row, s.col])).toEqual([[1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3]]);
    expect(sensors[0]!.positionMm).toEqual([-10, -10, 0]);
    expect(sensors[5]!.positionMm).toEqual([10, 10, 0]);
    expect(makeArray(1, 1)[0]).toEqual({ id: 1, row: 1, col: 1, positionMm: [0, 0, 0] });
  });
});

describe('bounded forward unit-B RK4 field lines', () => {
  it('follows a uniform field with unit tangents and bounded path length', () => {
    const seed: Vec3 = [0, 0, 0];
    const path = fieldLine(seed, [], [3, 4, 0], { stepMm: 2, maxSteps: 10 });
    expect(path).toHaveLength(11);
    closeVector(path[10]!, [12, 16, 0]);
    for (let i = 1; i < path.length; i++) {
      const delta = sub(path[i]!, path[i - 1]!);
      expect(norm(delta)).toBeCloseTo(2, 12);
      closeVector(normalize(delta), [0.6, 0.8, 0]);
    }
    expect(seed).toEqual(zero);
    expect(path[0]).not.toBe(seed);
  });

  it('follows the axial field forward, not its negative', () => {
    const path = fieldLine([0, 0, 20], [dipole], zero, { stepMm: 1, maxSteps: 5 });
    expect(path).toHaveLength(6);
    closeVector(path[5]!, [0, 0, 25]);
  });

  it('has a local tangent parallel to B away from the axis', () => {
    const seed: Vec3 = [30, 0, 40];
    const path = fieldLine(seed, [dipole], zero, { stepMm: 0.001, maxSteps: 1 });
    expect(path).toHaveLength(2);
    const tangent = normalize(sub(path[1]!, seed));
    expect(norm(tangent)).toBeCloseTo(1, 12);
    expect(dot(tangent, normalize(dipoleFieldMicroTesla(seed, dipole)!))).toBeGreaterThan(0.99999999);
  });

  it('converges under RK4 step refinement on a curved path', () => {
    const trace = (stepMm: number, maxSteps: number): Vec3 =>
      fieldLine([30, 0, 40], [dipole], zero, { stepMm, maxSteps }).at(-1)!;
    const fine = trace(0.125, 80);
    const coarseError = norm(sub(trace(2, 5), fine));
    const refinedError = norm(sub(trace(1, 10), fine));
    expect(coarseError).toBeGreaterThan(1e-10);
    expect(refinedError).toBeLessThan(coarseError / 8);
  });

  it('stops at null fields, exact cancellation, zero field and invalid seeds', () => {
    expect(fieldLine(zero, [dipole], zero)).toEqual([]);
    expect(fieldLine([501, 0, 0], [], [1, 0, 0])).toEqual([]);
    expect(fieldLine(zero, [], zero)).toEqual([zero]);
    expect(fieldLine([0, 0, 20], [dipole, { ...dipole, axis: [0, 0, -1] }], zero))
      .toEqual([[0, 0, 20]]);
    expect(fieldLine(zero, [], [1, 0, 0], { maxSteps: 0 })).toEqual([zero]);
  });

  it('terminates before entering a pole, without storing a clamped point', () => {
    const path = fieldLine([0, 0, -20], [dipole], zero, { stepMm: 2, maxSteps: 100 });
    expect(path.length).toBeGreaterThan(1);
    expect(path.length).toBeLessThan(101);
    for (const point of path) expect(norm(point)).toBeGreaterThan(5);
    expect(path.at(-1)![2]).toBeLessThan(-5);
  });

  it('caps large requested steps and never leaves the radius bound', () => {
    const path = fieldLine(zero, [], [1, 0, 0], { stepMm: 100, maxSteps: 100, maxRadiusMm: 12 });
    expect(path).toEqual([[0, 0, 0], [5, 0, 0], [10, 0, 0]]);
    expect(path.every((p) => norm(p) <= 12)).toBe(true);
  });
});

describe('invalid parameter handling', () => {
  it('rejects nonfinite vectors, zero axes, moments and angle parameters', () => {
    expect(() => normalize(zero)).toThrow(RangeError);
    expect(() => normalize(new Array(3) as Vec3)).toThrow(RangeError);
    expect(() => anglesFromAxis(zero)).toThrow(RangeError);
    expect(() => add([NaN, 0, 0], zero)).toThrow(RangeError);
    expect(() => sub(zero, [0, Infinity, 0])).toThrow(RangeError);
    expect(() => dot([Infinity, 0, 0], zero)).toThrow(RangeError);
    expect(() => scale(zero, NaN)).toThrow(RangeError);
    expect(() => axisFromAngles(Infinity, 0)).toThrow(RangeError);
    expect(() => axisFromAngles(0, NaN)).toThrow(RangeError);
    expect(() => dipoleFieldMicroTesla([NaN, 0, 0], dipole)).toThrow(RangeError);
    expect(() => dipoleFieldMicroTesla([10, 0, 0], { ...dipole, axis: zero })).toThrow(RangeError);
    for (const momentAm2 of [-1, NaN, Infinity]) {
      expect(() => dipoleFieldMicroTesla([10, 0, 0], { ...dipole, momentAm2 })).toThrow(RangeError);
    }
    expect(() => totalFieldMicroTesla(zero, [], [0, 0, Infinity])).toThrow(RangeError);
    // Validate every source even if an earlier one would return exclusion null.
    expect(() => totalFieldMicroTesla(zero, [dipole, { ...dipole, momentAm2: -1 }], zero)).toThrow(RangeError);
    expect(() => vectorInFrame(zero, [])).toThrow(RangeError);
    expect(() => vectorInFrame(zero, [[1, 0, 0], [0, NaN, 0], [0, 0, 1]])).toThrow(RangeError);
  });

  it('rejects invalid dimensions, pitches and unbounded integration options', () => {
    for (const rows of [0, -1, 1.5, NaN, Infinity, 1_000_001]) {
      expect(() => makeArray(rows)).toThrow(RangeError);
    }
    expect(() => makeArray(2, 0)).toThrow(RangeError);
    expect(() => makeArray(2, 2, 0)).toThrow(RangeError);
    expect(() => makeArray(2, 2, 1, -1)).toThrow(RangeError);
    expect(() => makeArray(2, 2, Infinity)).toThrow(RangeError);
    for (const stepMm of [0, -1, NaN, Infinity]) {
      expect(() => fieldLine(zero, [], [1, 0, 0], { stepMm })).toThrow(RangeError);
    }
    for (const maxSteps of [-1, 0.5, NaN, Infinity, 10001]) {
      expect(() => fieldLine(zero, [], [1, 0, 0], { maxSteps })).toThrow(RangeError);
    }
    for (const maxRadiusMm of [0, -1, NaN, Infinity]) {
      expect(() => fieldLine(zero, [], [1, 0, 0], { maxRadiusMm })).toThrow(RangeError);
    }
  });
});
