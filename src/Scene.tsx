import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Dipole, Sensor, Vec3 } from './physics'
import { add, norm, normalize, scale, fieldLine, totalFieldMicroTesla } from './physics'
import { colorFor, component } from './visual'
import type { Channel, Pose, SceneSettings } from './types'

type Props = {
  sensors: Sensor[]
  fields: (Vec3 | null)[]
  channel: Channel
  range: [number, number]
  target: Pose | null
  dipoles: Dipole[]
  background: Vec3
  selected: number
  onSensor: (id: number) => void
  onMove: (position: Vec3) => void
  settings: SceneSettings
  cameraView: string
  cameraReset: number
}

function Camera({ view, reset }: { view: string; reset: number }) {
  const { camera } = useThree()
  useEffect(() => {
    camera.up.set(0, 0, 1)
    camera.position.set(...(view === 'top' ? [0, -0.01, 420] : view === 'front' ? [0, -430, 90] : [255, -330, 265]) as Vec3)
    camera.lookAt(0, 0, 45)
    camera.updateProjectionMatrix()
  }, [camera, view, reset])
  return null
}

function Axis({ position = [0, 0, 0], length = 45 }: { position?: Vec3; length?: number }) {
  return <group position={position}>
    {([[length, 0, 0], [0, length, 0], [0, 0, length]] as Vec3[]).map((end, i) => <group key={i}>
      <Line points={[[0, 0, 0], end]} color={['#c65855', '#3c986d', '#4672aa'][i]} lineWidth={1.4} />
      <Html position={end} center><span className="axis-label" style={{ color: ['#ac4844', '#378362', '#40628c'][i] }}>{'XYZ'[i]}</span></Html>
    </group>)}
  </group>
}

function Magnet({ pose, opacity = 1 }: { pose: Pose; opacity?: number }) {
  const axis = pose.axis ? normalize(pose.axis) : null
  const quaternion = useMemo(() => axis ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...axis)) : new THREE.Quaternion(), [axis?.[0], axis?.[1], axis?.[2]])
  if (!axis) return <mesh position={pose.positionMm}><sphereGeometry args={[4, 20, 16]} /><meshStandardMaterial color="#d18b3d" /></mesh>
  return <group position={pose.positionMm} quaternion={quaternion}>
    {[1, -1].map(sign => <mesh key={sign} position={[0, sign * 5, 0]}>
      <cylinderGeometry args={[5.2, 5.2, 10, 40]} />
      <meshStandardMaterial color={sign === 1 ? '#cd5753' : '#466c9f'} metalness={.25} roughness={.42} transparent={opacity < 1} opacity={opacity} />
    </mesh>)}
    <mesh rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[5.3, .35, 8, 40]} /><meshStandardMaterial color="#e6e7e7" /></mesh>
    <Html position={[0, 15, 0]} center><span className="pole-label north">N</span></Html>
    <Html position={[0, -15, 0]} center><span className="pole-label south">S</span></Html>
  </group>
}

function DraggableTarget({ pose, onMove, drag }: { pose: Pose; onMove: Props['onMove']; drag: boolean }) {
  const object = useRef<THREE.Group>(null)
  const controls = useRef<React.ComponentRef<typeof TransformControls>>(null)
  useEffect(() => { object.current?.position.set(...pose.positionMm) }, [pose.positionMm])
  return <>
    <group ref={object} position={pose.positionMm}>
      <Magnet pose={{ ...pose, positionMm: [0, 0, 0] }} />
    </group>
    {drag && <TransformControls ref={controls} object={object as React.RefObject<THREE.Object3D>} mode="translate" size={.65} onObjectChange={() => {
      const p = object.current?.position
      if (p) onMove([Math.max(-180, Math.min(180, p.x)), Math.max(-180, Math.min(180, p.y)), Math.max(10, Math.min(260, p.z))])
    }} />}
  </>
}

function Arrow({ field, position, color, max }: { field: Vec3; position: Vec3; color: string; max: number }) {
  const object = useMemo(() => {
    const helper = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1)
    // Vector annotations remain visible when negative Bz points below the board.
    for (const child of [helper.line, helper.cone]) {
      child.renderOrder = 5
      for (const material of [child.material].flat()) {
        material.depthTest = false; material.depthWrite = false
        material.transparent = true; material.opacity = .82
      }
    }
    return helper
  }, [])
  useEffect(() => {
    const magnitude = norm(field)
    object.visible = magnitude >= 1e-12
    object.position.set(...position)
    if (object.visible) {
      object.setDirection(new THREE.Vector3(...normalize(field)))
      object.setLength(7 + 29 * Math.min(1, magnitude / max), 5, 2.4)
      object.setColor(new THREE.Color(color))
    }
  }, [field[0], field[1], field[2], position[0], position[1], position[2], color, max])
  // ArrowHelper shares its geometries across instances; only own materials expire.
  useEffect(() => () => {
    for (const material of [object.line.material, object.cone.material].flat()) material.dispose()
  }, [object])
  return <primitive object={object} />
}

function ComputedField({ dipoles, background, settings, range, channel }: Pick<Props, 'dipoles' | 'background' | 'settings' | 'range' | 'channel'>) {
  const paths = useMemo(() => {
    if (!settings.lines) return []
    const target = dipoles[0]
    if (!target) return []
    const axis = new THREE.Vector3(...normalize(target.axis))
    const tangent = new THREE.Vector3(1, 0, 0)
    if (Math.abs(axis.dot(tangent)) > .9) tangent.set(0, 1, 0)
    tangent.cross(axis).normalize()
    const bitangent = new THREE.Vector3().crossVectors(axis, tangent).normalize()
    return Array.from({ length: 24 }, (_, i) => {
      const phi = i * Math.PI / 8
      const radial = [6, 9, 13][Math.floor(i / 8)]
      const offset = tangent.clone().multiplyScalar(Math.cos(phi) * radial).addScaledVector(bitangent, Math.sin(phi) * radial).addScaledVector(axis, 22)
      return fieldLine(add(target.positionMm, offset.toArray() as Vec3), dipoles, background, { stepMm: 2.4, maxSteps: 320, maxRadiusMm: 350 })
    }).filter(p => p.length > 2)
  }, [dipoles, background, settings.lines])
  const slice = useMemo(() => {
    if (!settings.slice) return []
    const values = []
    for (let r = 0; r < 21; r++) for (let c = 0; c < 21; c++) {
      const p: Vec3 = [(c - 10) * 12, (r - 10) * 12, settings.sliceZ]
      const b = totalFieldMicroTesla(p, dipoles, background)
      values.push({ p, value: component(b, channel) })
    }
    return values.map(v => ({ ...v, color: colorFor(v.value, ...range) }))
  }, [dipoles, background, settings.slice, settings.sliceZ, range, channel])
  return <>
    {paths.map((points, i) => <Line key={i} points={points} color="#0072bd" transparent opacity={.42} lineWidth={1} />)}
    {slice.map(({ p, color }, i) => <mesh key={i} position={p}><planeGeometry args={[11.6, 11.6]} /><meshBasicMaterial color={color} transparent opacity={.30} side={THREE.DoubleSide} depthWrite={false} /></mesh>)}
  </>
}

function Objects(p: Props) {
  const maxMagnitude = Math.max(1e-12, ...p.fields.map(v => v ? norm(v) : 0))
  const width = Math.max(...p.sensors.map(s => Math.abs(s.positionMm[0]))) * 2 + 28
  const height = Math.max(...p.sensors.map(s => Math.abs(s.positionMm[1]))) * 2 + 28
  return <>
    <Camera view={p.cameraView} reset={p.cameraReset} />
    <ambientLight intensity={1.6} />
    <directionalLight position={[160, -150, 300]} intensity={2.2} />
    <directionalLight position={[-180, 100, 150]} intensity={.8} />
    <gridHelper args={[440, 22, '#b9b9b9', '#dedede']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -6]} />
    <mesh position={[0, 0, -3.5]}><boxGeometry args={[width, height, 4]} /><meshStandardMaterial color="#d9d9d9" roughness={.72} metalness={.05} /></mesh>
    {p.sensors.map((sensor, index) => <group key={sensor.id} position={sensor.positionMm}>
      <mesh position={[0, 0, .5]} onClick={e => { e.stopPropagation(); p.onSensor(sensor.id) }}>
        <boxGeometry args={[9, 9, 3]} />
        <meshStandardMaterial color={p.selected === sensor.id ? '#edb120' : '#51555a'} roughness={.55} metalness={.3} />
      </mesh>
      <mesh position={[0, 0, 2.1]}><planeGeometry args={[5.5, 5.5]} /><meshBasicMaterial color={colorFor(component(p.fields[index], p.channel), ...p.range)} toneMapped={false} /></mesh>
      {p.settings.sensorLabels && <Html position={[0, -8, 2]} center><span className={`sensor-tag ${p.selected === sensor.id ? 'selected' : ''}`}>{String(sensor.id).padStart(2, '0')}</span></Html>}
    </group>)}
    {p.settings.vectors && p.sensors.map((s, i) => p.fields[i] && i % p.settings.vectorDensity === 0 ? <Arrow key={s.id} position={add(s.positionMm, [0, 0, 4])} field={p.fields[i]!} color={colorFor(component(p.fields[i], p.channel), ...p.range)} max={maxMagnitude} /> : null)}
    <ComputedField dipoles={p.dipoles} background={p.background} settings={p.settings} range={p.range} channel={p.channel} />
    {p.target && <DraggableTarget pose={p.target} onMove={p.onMove} drag={p.settings.drag} />}
    {p.dipoles.length > 1 && <Magnet pose={{ positionMm: p.dipoles[1].positionMm, axis: p.dipoles[1].axis }} opacity={.8} />}
    {p.settings.arrayAxes && <Axis length={50} />}
    {p.settings.magnetAxes && p.target?.axis && <group position={p.target.positionMm} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...normalize(p.target.axis)))}><Axis length={25} /></group>}
    <OrbitControls makeDefault target={[0, 0, 45]} minDistance={100} maxDistance={900} enableDamping dampingFactor={.12} />
  </>
}

export default function Scene(props: Props) {
  return <Canvas data-testid="magnetic-canvas" dpr={[1, 1.6]} camera={{ position: [255, -330, 265], fov: 41, near: 1, far: 2500, up: [0, 0, 1] }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
    <color attach="background" args={['#ffffff']} />
    <Suspense fallback={null}><Objects {...props} /></Suspense>
  </Canvas>
}
