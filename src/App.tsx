import { Component, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDownToLine, Axis3D, Box, Crosshair, Download, Expand, Github, Info, Layers3, Magnet, Move3D, Radio, RotateCcw, Settings2, X } from 'lucide-react'
import Scene from './Scene'
import SignalPlot from './SignalPlot'
import { axisFromAngles, anglesFromAxis, dipoleFieldMicroTesla, makeArray, norm, totalFieldMicroTesla, type Vec3 } from './physics'
import { colorFor, component, format, lineColors, scaleGradient, valueRange } from './visual'
import type { Channel, PlaygroundSettings, SceneSettings } from './types'
import { useI18n } from './i18n'

const initialPhysics = (): PlaygroundSettings => ({
  target: { positionMm: [-20, 12, 90], axis: axisFromAngles(35, 65), momentAm2: .12 },
  interferer: { positionMm: [130, 70, 110], axis: axisFromAngles(155, -35), momentAm2: .22 },
  interference: false, background: [0, 0, 0], pitch: [40, 40], rows: 5, cols: 5,
})
const initialScene: SceneSettings = { vectors: true, lines: true, slice: false, arrayAxes: true, magnetAxes: false, sensorLabels: true, vectorDensity: 1, sliceZ: 25, drag: false }

function IconButton({ label, active, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  const { t } = useI18n()
  return <button {...props} type="button" title={t(label)} aria-label={t(label)} className={`icon-button ${active ? 'active' : ''} ${props.className ?? ''}`}>{children}</button>
}
function Section({ icon, title, children, extra }: { icon?: ReactNode; title: string; children: ReactNode; extra?: ReactNode }) {
  const { t } = useI18n()
  return <section className="section"><div className="section-heading"><span>{icon}{t(title)}</span>{extra}</div>{children}</section>
}
function Range({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void }) {
  const { t } = useI18n()
  return <label className="range-control"><span className="control-line"><span>{t(label)}</span><span className="numeric-control"><input aria-label={t(label)} type="number" min={min} max={max} step={step} value={Number(value.toFixed(4))} onChange={e => { const v = e.currentTarget.valueAsNumber; if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v))) }} /><span>{unit}</span></span></span><input aria-label={`${t(label)} ${t('slider')}`} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} /></label>
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const { t } = useI18n()
  return <label className="toggle-line"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{t(label)}</span></label>
}
function SceneFailure() {
  const { t } = useI18n()
  return <div className="scene-error"><Box size={28} /><strong>{t('3D renderer unavailable')}</strong><span>{t('Numeric values remain available.')}</span></div>
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <SceneFailure /> : this.props.children }
}

export default function App() {
  const { language, setLanguage, t } = useI18n()
  const [physics, setPhysics] = useState(initialPhysics)
  const [settings, setSettings] = useState<SceneSettings>(initialScene)
  const [channel, setChannel] = useState<Channel>('norm')
  const [selected, setSelected] = useState(13)
  const [cameraView, setCameraView] = useState('iso')
  const [cameraReset, setCameraReset] = useState(0)
  const [details, setDetails] = useState(false)
  const [mobilePane, setMobilePane] = useState<'scene' | 'controls' | 'observations'>('scene')
  const viewport = useRef<HTMLDivElement>(null)
  const dipoles = useMemo(() => physics.interference ? [physics.target, physics.interferer] : [physics.target], [physics.target, physics.interferer, physics.interference])
  const sensors = useMemo(() => makeArray(physics.rows, physics.cols, ...physics.pitch), [physics.rows, physics.cols, physics.pitch])
  const fields = useMemo(() => sensors.map(s => totalFieldMicroTesla(s.positionMm, dipoles, physics.background)), [sensors, dipoles, physics.background])
  const range = useMemo(() => valueRange(fields.map(v => component(v, channel)), channel !== 'norm'), [fields, channel])
  const sensor = sensors.find(s => s.id === selected) ?? sensors[0]
  const sensorField = fields[sensor.id - 1]
  const angles = anglesFromAxis(physics.target.axis), sourceAngles = anglesFromAxis(physics.interferer.axis)
  const plotX = useMemo(() => sensors.map(s => s.id), [sensors])
  const series = useMemo(() => ['Bx', 'By', 'Bz'].map((label, i) => ({ label, color: lineColors[i], values: fields.map(v => v?.[i] ?? null) })), [fields])
  const magnitude = useMemo(() => [{ label: '|B|', color: '#7e2f8e', values: fields.map(v => v ? norm(v) : null) }], [fields])
  const contributions = [
    { label: 'Target', field: dipoleFieldMicroTesla(sensor.positionMm, physics.target) },
    ...(physics.interference ? [{ label: 'Interferer', field: dipoleFieldMicroTesla(sensor.positionMm, physics.interferer) }] : []),
    { label: 'Background', field: physics.background },
  ]
  const updatePosition = (i: number, v: number) => setPhysics(p => ({ ...p, target: { ...p.target, positionMm: p.target.positionMm.map((x, j) => i === j ? v : x) as Vec3 } }))
  const updateAngles = (azimuth: number, elevation: number) => setPhysics(p => ({ ...p, target: { ...p.target, axis: axisFromAngles(azimuth, elevation) } }))
  const updateScene = <K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) => setSettings(s => ({ ...s, [key]: value }))
  const downloadValues = () => {
    const blob = new Blob([JSON.stringify({ evidenceTier: 'Synthetic Demo', coordinateFrame: 'Array = World', positionUnit: 'mm', fieldUnit: 'uT', physics, sensors, fields }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'magnetic-physics-synthetic.json'; a.click(); URL.revokeObjectURL(url)
  }
  const capture = () => { const canvas = viewport.current?.querySelector('canvas'); if (canvas) { const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'magnetic-physics-scene.png'; a.click() } }

  return <div className="app-shell">
    <header className="header">
      <div className="identity-block">
        <div className="brand"><Magnet size={23} /><h1>{t('Magnetic Localization')} <strong>{t('Observatory')}</strong></h1></div>
        <div className="workspace-meta"><span className="workspace-label">{t('Physics Playground')}</span><span className="synthetic-tag">{t('Synthetic Demo')}</span></div>
      </div>
      <div className="institutional-branding">
        <a href="https://eee.sustech.edu.cn/" target="_blank" rel="noreferrer" title={t('SUSTech · Department of Electronic and Electrical Engineering')}>
          <img className="institution-logo" src="./branding/sustech-eee.png" width="473" height="64" alt={t('SUSTech · Department of Electronic and Electrical Engineering')} decoding="async" />
        </a>
      </div>
      <div className="header-actions"><IconButton label="Model details" onClick={() => setDetails(true)}><Info size={17} /></IconButton><a className="icon-button" href="https://github.com/ShenMiaozhang/magnetic-localization-observatory" title={t('Source code')} aria-label={t('Source code')} target="_blank" rel="noreferrer"><Github size={17} /></a><div className="language-switch" role="group" aria-label={t('Interface language')}><button aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中文</button><button aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button></div></div>
    </header>
    <div className="mobile-switch"><button className={mobilePane === 'controls' ? 'active' : ''} onClick={() => setMobilePane('controls')}><Settings2 size={14} />{t('Parameters')}</button><button className={mobilePane === 'scene' ? 'active' : ''} onClick={() => setMobilePane('scene')}><Box size={14} />{t('Scene')}</button><button className={mobilePane === 'observations' ? 'active' : ''} onClick={() => setMobilePane('observations')}><Radio size={14} />{t('Observations')}</button></div>
    <main className={`workbench mobile-${mobilePane}`}>
      <aside className="left-panel">
        <Section title="Target magnet" icon={<Magnet size={14} />} extra={<IconButton label="Reset physics" onClick={() => setPhysics(initialPhysics())}><RotateCcw size={14} /></IconButton>}>
          <div className="section-caption">{t('Position')}<span>{t('Array frame · mm')}</span></div>
          {['x', 'y', 'z'].map((a, i) => <Range key={a} label={`Target ${a}`} value={physics.target.positionMm[i]} min={i === 2 ? 10 : -180} max={i === 2 ? 260 : 180} unit="mm" onChange={v => updatePosition(i, v)} />)}
          <div className="section-caption offset">{t('Magnetization axis')}<span>5-DoF</span></div>
          <Range label="Azimuth" value={angles.azimuthDeg} min={-180} max={180} unit="°" onChange={v => updateAngles(v, angles.elevationDeg)} />
          <Range label="Elevation" value={angles.elevationDeg} min={-90} max={90} unit="°" onChange={v => updateAngles(angles.azimuthDeg, v)} />
          <Range label="Dipole moment" value={physics.target.momentAm2} min={.005} max={.6} step={.005} unit="A·m²" onChange={v => setPhysics(p => ({ ...p, target: { ...p.target, momentAm2: v } }))} />
        </Section>
        <Section title="External field" icon={<Layers3 size={14} />}>
          <Toggle label="Interfering dipole" checked={physics.interference} onChange={v => setPhysics(p => ({ ...p, interference: v }))} />
          {physics.interference && <div className="source-controls">{['x', 'y', 'z'].map((a, i) => <Range key={a} label={`Source ${a}`} value={physics.interferer.positionMm[i]} min={i === 2 ? 10 : -250} max={250} unit="mm" onChange={v => setPhysics(p => ({ ...p, interferer: { ...p.interferer, positionMm: p.interferer.positionMm.map((x, j) => i === j ? v : x) as Vec3 } }))} />)}<Range label="Source moment" value={physics.interferer.momentAm2} min={.01} max={1} step={.01} unit="A·m²" onChange={v => setPhysics(p => ({ ...p, interferer: { ...p.interferer, momentAm2: v } }))} /><Range label="Source azimuth" value={sourceAngles.azimuthDeg} min={-180} max={180} unit="°" onChange={v => setPhysics(p => ({ ...p, interferer: { ...p.interferer, axis: axisFromAngles(v, sourceAngles.elevationDeg) } }))} /><Range label="Source elevation" value={sourceAngles.elevationDeg} min={-90} max={90} unit="°" onChange={v => setPhysics(p => ({ ...p, interferer: { ...p.interferer, axis: axisFromAngles(sourceAngles.azimuthDeg, v) } }))} /></div>}
          {['x', 'y', 'z'].map((a, i) => <Range key={a} label={`Uniform background B${a}`} value={physics.background[i]} min={-60} max={60} unit="µT" onChange={v => setPhysics(p => ({ ...p, background: p.background.map((x, j) => i === j ? v : x) as Vec3 }))} />)}
        </Section>
        <Section title="Array geometry"><div className="geometry-dimensions"><label>{t('Rows')}<select aria-label={t('Array rows')} value={physics.rows} onChange={e => setPhysics(p => ({ ...p, rows: +e.target.value }))}>{[3, 5, 7].map(v => <option value={v} key={v}>{v}</option>)}</select></label><label>{t('Columns')}<select aria-label={t('Array columns')} value={physics.cols} onChange={e => setPhysics(p => ({ ...p, cols: +e.target.value }))}>{[3, 5, 7].map(v => <option value={v} key={v}>{v}</option>)}</select></label></div><Range label="Column pitch" value={physics.pitch[0]} min={15} max={60} unit="mm" onChange={v => setPhysics(p => ({ ...p, pitch: [v, p.pitch[1]] }))} /><Range label="Row pitch" value={physics.pitch[1]} min={15} max={60} unit="mm" onChange={v => setPhysics(p => ({ ...p, pitch: [p.pitch[0], v] }))} /></Section>
      </aside>
      <div className="center-panel"><div className="scene-toolbar"><span>{t('Ideal point dipole')}</span><div className="camera-tools"><IconButton label="Isometric view" active={cameraView === 'iso'} onClick={() => { setCameraView('iso'); setCameraReset(v => v + 1) }}><Box size={15} /></IconButton><IconButton label="Top view" active={cameraView === 'top'} onClick={() => { setCameraView('top'); setCameraReset(v => v + 1) }}><ArrowDownToLine size={15} /></IconButton><IconButton label="Reset camera" onClick={() => setCameraReset(v => v + 1)}><RotateCcw size={15} /></IconButton><i /><IconButton label="Drag magnet" active={settings.drag} onClick={() => updateScene('drag', !settings.drag)}><Move3D size={16} /></IconButton><IconButton label="Export scene image" onClick={capture}><Download size={15} /></IconButton><IconButton label="Expand scene" onClick={() => { void viewport.current?.requestFullscreen() }}><Expand size={15} /></IconButton></div></div>
        <div className="scene-viewport" ref={viewport}><SceneBoundary><Scene sensors={sensors} fields={fields} channel={channel} range={range} target={physics.target} dipoles={dipoles} background={physics.background} selected={sensor.id} onSensor={setSelected} onMove={positionMm => setPhysics(p => ({ ...p, target: { ...p.target, positionMm } }))} settings={settings} cameraView={cameraView} cameraReset={cameraReset} /></SceneBoundary><div className="scene-corner"><span>{sensors.length} × 3 · SI</span><span>{t('Array = World')} · mm</span></div><div className="scene-key"><span><b className="key-magnet" />{t('Target')}</span>{physics.interference && <span><b className="key-source" />{t('Interferer')}</span>}<span className="vector-note">{t('Normalized vector length')}</span></div></div>
        <div className="scene-bottom"><span>{t(settings.slice ? 'Section: sensor color limits' : 'Right-handed XYZ · Z up')}</span><button onClick={downloadValues}><Download size={13} />{t('Export values')}</button></div>
      </div>
      <aside className="right-panel"><Section title="Sensor observations" icon={<Radio size={14} />} extra={<span className="small-label">µT</span>}><div className="heatmap-toolbar"><span>{t('Array top view')}</span><div className="channel-switch" aria-label={t('Field component')}>{(['norm', 'x', 'y', 'z'] as Channel[]).map(c => <button key={c} title={t(c === 'norm' ? 'Field magnitude' : `Field B${c}`)} aria-pressed={channel === c} className={channel === c ? 'active' : ''} onClick={() => setChannel(c)}>{c === 'norm' ? '|B|' : `B${c}`}</button>)}</div></div>
        <div className="heatmap" style={{ gridTemplateColumns: `repeat(${physics.cols}, 1fr)` }} data-testid="sensor-heatmap">{sensors.map((s, i) => { const v = component(fields[i], channel), fraction = v === null ? 0 : (v - range[0]) / (range[1] - range[0]); return <button key={s.id} title={`${t('Sensor')} ${s.id} · ${t('row')} ${s.row}, ${t('col')} ${s.col} · ${format(v, 4)} µT`} aria-label={`${t('Sensor')} ${s.id}`} className={sensor.id === s.id ? 'selected' : ''} style={{ background: colorFor(v, ...range), color: fraction > .45 ? '#202020' : '#fff' }} onClick={() => setSelected(s.id)}><small>{String(s.id).padStart(2, '0')}</small><span>{v === null ? '—' : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1)}</span></button> })}</div>
        <div className="heatmap-coordinate"><span>{t('−X ← columns → +X')}</span><span>{t('Rows: −Y → +Y ↓')}</span></div><div className="color-scale"><div style={{ background: scaleGradient }} /><span>{format(range[0], 1)}</span><span>{channel === 'norm' ? '|B|' : `B${channel}`} / µT</span><span>{format(range[1], 1)}</span></div>
        <div className="selected-sensor"><strong>S{String(sensor.id).padStart(2, '0')}</strong><span>{t('row')} {sensor.row} / {t('col')} {sensor.col}</span></div><code className="sensor-position">({sensor.positionMm.map(v => format(v, 1)).join(', ')}) mm</code><div className="field-readouts">{['Bx', 'By', 'Bz'].map((a, i) => <span key={a}><small style={{ color: lineColors[i] }}>{a}</small><strong data-testid={`field-${a}`}>{sensorField ? format(sensorField[i], 2) : '—'}</strong></span>)}</div>
        <div className="magnitude-readout"><span>|B|</span><strong>{sensorField ? format(norm(sensorField), 2) : '—'} <small>µT</small></strong></div>
        </Section><Section title="Field contributions"><table className="contributions"><thead><tr><th>µT</th><th>Bx</th><th>By</th><th>Bz</th></tr></thead><tbody>{contributions.map(c => <tr key={c.label}><th>{t(c.label)}</th>{[0, 1, 2].map(i => <td key={i}>{format(c.field?.[i], 1)}</td>)}</tr>)}</tbody></table></Section>
        <Section title="Scene layers" icon={<Axis3D size={14} />}><div className="layer-grid"><Toggle label="Field vectors" checked={settings.vectors} onChange={v => updateScene('vectors', v)} /><Toggle label="Field lines" checked={settings.lines} onChange={v => updateScene('lines', v)} /><Toggle label="Field section" checked={settings.slice} onChange={v => updateScene('slice', v)} /><Toggle label="Sensor IDs" checked={settings.sensorLabels} onChange={v => updateScene('sensorLabels', v)} /><Toggle label="Array axes" checked={settings.arrayAxes} onChange={v => updateScene('arrayAxes', v)} /><Toggle label="Magnet axes" checked={settings.magnetAxes} onChange={v => updateScene('magnetAxes', v)} /></div>{settings.slice && <Range label="Section height" value={settings.sliceZ} min={0} max={180} unit="mm" onChange={v => updateScene('sliceZ', v)} />}<label className="inline-select">{t('Vector density')}<select aria-label={t('Vector density')} value={settings.vectorDensity} onChange={e => updateScene('vectorDensity', +e.target.value)}><option value={1}>{t('All sensors')}</option><option value={2}>{t('Every second')}</option><option value={5}>{t('Every fifth')}</option></select></label></Section>
      </aside>
    </main>
    <div className="plots-row"><section className="signal-panel"><div className="signal-heading"><span>{t('Array field profile')}</span><div className="plot-legend">{series.map(s => <span key={s.label}><b style={{ background: s.color }} />{s.label}</span>)}</div><span className="x-domain">{t('Sensor ID')}</span></div><SignalPlot x={plotX} series={series} xLabel="Sensor" unit="µT" /></section><section className="signal-panel magnitude-panel"><div className="signal-heading"><span>{t('Field magnitude')}</span><div className="plot-legend"><span><b style={{ background: '#7e2f8e' }} />|B|</span></div><span className="x-domain">{t('Sensor ID')}</span></div><SignalPlot x={plotX} series={magnitude} xLabel="Sensor" unit="µT" /></section></div>
    <footer className="footer"><span>{t('Synthetic Demo')}<i />{t('Ideal point dipole')}<i />5-DoF</span><span>mm · A·m² · µT</span><button onClick={() => setDetails(true)}><Info size={13} />{t('Model details')}</button></footer>
    {details && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDetails(false) }}><section className="model-dialog" role="dialog" aria-modal="true" aria-label={t('Model details')}><div className="dialog-heading"><h2>{t('Ideal point dipole')}</h2><IconButton label="Close model details" onClick={() => setDetails(false)}><X size={17} /></IconButton></div><div className="dialog-body"><p className="equation">{t('B = μ₀/(4πr³) [3(m·r̂)r̂ − m].')}</p>{['Positions are in mm; calculations use m, A·m² and µT. Values within 5 mm of a point source are undefined.', 'The unit magnetization axis has two orientation degrees of freedom. Axial spin is not an independently observable sixth degree of freedom.', 'The array is a generic synthetic grid. Array and World coincide here; source glyph dimensions are illustrative.', 'Field lines are RK4 integral curves, not particle trajectories. Section colors are clipped to the sensor color limits.', 'Only analytic synthetic fields are included. No experimental recordings, inverse solver, hardware control or accuracy claims are included.'].map(text => <p key={text}>{t(text)}</p>)}</div></section></div>}
  </div>
}
