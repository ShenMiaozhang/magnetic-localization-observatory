/**
 * Ideal point-dipole visualization only, not a fitted scene or validated apparatus.
 * Right-handed XY array; azimuth +X to +Y, elevation toward +Z.
 * Uses SI moment, converts mm to m and T to uT, and excludes the near pole.
 */
export type Vec3 = [number, number, number];
export type Dipole = { positionMm: Vec3; axis: Vec3; momentAm2: number };
export type Sensor = { id: number; row: number; col: number; positionMm: Vec3 };

const EXCLUSION_MM = 5;
const MU0_OVER_4PI = 1e-7;
const DEG = Math.PI / 180;

function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function vector(v: Vec3, name = 'vector'): Vec3 {
  if (!Array.isArray(v) || v.length !== 3
      || !Number.isFinite(v[0]) || !Number.isFinite(v[1]) || !Number.isFinite(v[2])) {
    throw new RangeError(`${name} must have three finite components`);
  }
  return v;
}

export function add(a: Vec3, b: Vec3): Vec3 {
  vector(a); vector(b);
  return vector([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  vector(a); vector(b);
  return vector([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
}

export function scale(v: Vec3, s: number): Vec3 {
  vector(v); finite(s, 'scale');
  return vector([v[0] * s, v[1] * s, v[2] * s]);
}

export function norm(v: Vec3): number {
  vector(v);
  const result = Math.hypot(...v);
  finite(result, 'norm');
  return result;
}

export function dot(a: Vec3, b: Vec3): number {
  vector(a); vector(b);
  const result = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  finite(result, 'dot product');
  return result;
}

export function normalize(v: Vec3): Vec3 {
  vector(v);
  // Rescale first to handle both very small and very large finite axes.
  const largest = Math.max(...v.map(Math.abs));
  if (largest === 0) throw new RangeError('axis must be nonzero');
  const w: Vec3 = [v[0] / largest, v[1] / largest, v[2] / largest];
  const length = Math.hypot(...w);
  return [w[0] / length, w[1] / length, w[2] / length];
}

/** Azimuth: +X toward +Y; elevation: XY plane toward +Z, in degrees. */
export function axisFromAngles(azimuthDeg: number, elevationDeg: number): Vec3 {
  finite(azimuthDeg, 'azimuthDeg'); finite(elevationDeg, 'elevationDeg');
  const azimuth = (azimuthDeg % 360) * DEG;
  const elevation = (elevationDeg % 360) * DEG;
  return normalize([
    Math.cos(elevation) * Math.cos(azimuth),
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
  ]);
}

/** Canonical elevation [-90,90], azimuth [-180,180]; polar azimuth is zero. */
export function anglesFromAxis(v: Vec3): { azimuthDeg: number; elevationDeg: number } {
  const axis = normalize(v);
  const horizontal = Math.hypot(axis[0], axis[1]);
  return {
    azimuthDeg: horizontal < 1e-15 ? 0 : Math.atan2(axis[1], axis[0]) / DEG,
    elevationDeg: Math.atan2(axis[2], horizontal) / DEG,
  };
}

/** Centered XY array, z=0; row-major one-based IDs and row/col. */
export function makeArray(rows = 5, cols = 5, pitchXmm = 40, pitchYmm = 40): Sensor[] {
  if (!Number.isSafeInteger(rows) || rows < 1 || !Number.isSafeInteger(cols) || cols < 1
      || rows * cols > 1_000_000) {
    throw new RangeError('array dimensions must be positive integers, at most 1000000 sensors');
  }
  finite(pitchXmm, 'pitchXmm'); finite(pitchYmm, 'pitchYmm');
  if (pitchXmm <= 0 || pitchYmm <= 0) throw new RangeError('pitches must be positive');
  return Array.from({ length: rows * cols }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      id: index + 1, row: row + 1, col: col + 1,
      positionMm: vector([(col - (cols - 1) / 2) * pitchXmm,
        (row - (rows - 1) / 2) * pitchYmm, 0]),
    };
  });
}

function prepare(dipole: Dipole): Dipole {
  if (!dipole) throw new RangeError('dipole is required');
  vector(dipole.positionMm, 'positionMm');
  finite(dipole.momentAm2, 'momentAm2');
  if (dipole.momentAm2 < 0) throw new RangeError('momentAm2 must be nonnegative; reverse axis for polarity');
  return { positionMm: [...dipole.positionMm], axis: normalize(dipole.axis), momentAm2: dipole.momentAm2 };
}

function field(pointMm: Vec3, dipole: Dipole): Vec3 | null {
  const r = sub(pointMm, dipole.positionMm);
  const distanceMm = norm(r);
  if (distanceMm <= EXCLUSION_MM) return null;
  const direction = normalize(r);
  const distanceM = distanceMm * 1e-3;
  // B[T] = (mu0/4pi) * m[A m^2] / r[m]^3 * (3(a.rhat)rhat - a).
  const factorUt = MU0_OVER_4PI * 1e6 * dipole.momentAm2 / distanceM ** 3;
  return scale(sub(scale(direction, 3 * dot(dipole.axis, direction)), dipole.axis), factorUt);
}

/** Axis is normalized; moment is its nonnegative magnitude in A m^2. */
export function dipoleFieldMicroTesla(pointMm: Vec3, dipole: Dipole): Vec3 | null {
  vector(pointMm, 'pointMm');
  return field(pointMm, prepare(dipole));
}

function total(pointMm: Vec3, dipoles: readonly Dipole[], backgroundUt: Vec3): Vec3 | null {
  let result: Vec3 = [...backgroundUt];
  for (const dipole of dipoles) {
    const contribution = field(pointMm, dipole);
    if (contribution === null) return null;
    result = add(result, contribution);
  }
  return result;
}

/** Linear SI superposition; null if any source's exclusion region is reached. */
export function totalFieldMicroTesla(
  pointMm: Vec3, dipoles: readonly Dipole[], backgroundUt: Vec3,
): Vec3 | null {
  vector(pointMm, 'pointMm'); vector(backgroundUt, 'backgroundUt');
  return total(pointMm, dipoles.map(prepare), backgroundUt);
}

/** Prevent an accepted display segment from jumping through an excluded sphere. */
function crossesPole(a: Vec3, b: Vec3, dipoles: readonly Dipole[]): boolean {
  const delta = sub(b, a);
  const lengthSquared = dot(delta, delta);
  return dipoles.some((dipole) => {
    const offset = sub(dipole.positionMm, a);
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, dot(offset, delta) / lengthSquared));
    return norm(sub(add(a, scale(delta, t)), dipole.positionMm)) <= EXCLUSION_MM;
  });
}

/**
 * Forward RK4 integration of dx/ds = B/|B| with x,s in mm. Not a particle path,
 * optimizer, gate or registration. Radius is measured from coordinate origin.
 * Defaults: 2 mm step, 500 steps, 500 mm radius. Requested steps are capped at
 * 5 mm; at most 10000 steps are allowed. Null/zero field or unsafe RK stages stop
 * the path. An inadmissible seed yields []; otherwise the seed is the first point.
 */
export function fieldLine(
  seedMm: Vec3,
  dipoles: readonly Dipole[],
  backgroundUt: Vec3,
  options: { stepMm?: number; maxSteps?: number; maxRadiusMm?: number } = {},
): Vec3[] {
  vector(seedMm, 'seedMm'); vector(backgroundUt, 'backgroundUt');
  const sources = dipoles.map(prepare);
  const { stepMm = 2, maxSteps = 500, maxRadiusMm = 500 } = options;
  finite(stepMm, 'stepMm'); finite(maxRadiusMm, 'maxRadiusMm');
  if (stepMm <= 0 || maxRadiusMm <= 0 || !Number.isSafeInteger(maxSteps)
      || maxSteps < 0 || maxSteps > 10000) {
    throw new RangeError('positive step/radius and integer maxSteps in [0,10000] required');
  }
  const step = Math.min(stepMm, EXCLUSION_MM);
  const admissible = (p: Vec3): boolean => norm(p) <= maxRadiusMm
    && sources.every((d) => norm(sub(p, d.positionMm)) > EXCLUSION_MM);
  const tangent = (p: Vec3): Vec3 | null => {
    if (!admissible(p)) return null;
    const b = total(p, sources, backgroundUt);
    return b === null || b.every((component) => component === 0) ? null : normalize(b);
  };
  if (!admissible(seedMm)) return [];
  const path: Vec3[] = [[...seedMm]];
  let point: Vec3 = [...seedMm];
  for (let i = 0; i < maxSteps; i++) {
    const k1 = tangent(point);
    if (k1 === null) break;
    const k2 = tangent(add(point, scale(k1, step / 2)));
    if (k2 === null) break;
    const k3 = tangent(add(point, scale(k2, step / 2)));
    if (k3 === null) break;
    const k4 = tangent(add(point, scale(k3, step)));
    if (k4 === null) break;
    const delta = scale(add(add(k1, scale(k2, 2)), add(scale(k3, 2), k4)), step / 6);
    const next = add(point, delta);
    if (!admissible(next) || crossesPole(point, next, sources)
        || next.every((component, index) => component === point[index])) break;
    path.push(next);
    point = next;
  }
  return path;
}

/** Dot with exactly the supplied basis, assumed orthonormal; no world transform. */
export function vectorInFrame(v: Vec3, basis: readonly Vec3[]): Vec3 {
  vector(v);
  if (basis.length !== 3) throw new RangeError('basis must contain three vectors');
  return [dot(v, basis[0]!), dot(v, basis[1]!), dot(v, basis[2]!)];
}
