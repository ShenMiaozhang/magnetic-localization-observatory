# Magnetic Localization Observatory

[中文](README.zh-CN.md) · [Interactive demo](https://shenmiaozhang.github.io/magnetic-localization-observatory/?lang=en)

A bilingual, browser-based physics instrument for exploring how magnetic dipoles
are sampled by a three-axis sensor array. All displayed observations are
**synthetic**, computed locally from an analytic forward model.

## Explore

- Move a magnet with numeric controls or its 3D translation gizmo.
- Change position, magnetization axis and dipole moment.
- Add a second dipole or a uniform background field.
- Inspect vectors, integral field lines, field sections and the sensor heatmap.
- Inspect Bx/By/Bz contributions and array-wide scientific plots.
- Change grid dimensions, pitch and display density.
- Switch Chinese/English without resetting the model.
- Export synthetic numeric values or a 3D canvas PNG.

The presentation uses neutral scientific-tool chrome, a familiar blue/orange/
yellow plot cycle and an independently implemented blue-to-yellow intensity ramp.

## Run locally

Node 24 is recommended.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5174/?lang=en` or `?lang=zh`. A hidden background Windows
launcher is available as `node scripts/start-local.mjs`.

```sh
npm test
npm run build
npm run test:ui
```

The browser check starts a temporary production preview at port 4174. On Windows
it uses installed Chrome; elsewhere run `npx playwright install chromium` first.
Use `CHROME_PATH` to select a browser or `OBSERVATORY_URL` to test an existing URL.

## Physical conventions

The model is

\[
\mathbf B=\frac{\mu_0}{4\pi r^3}
\left[3(\mathbf m\cdot\hat{\mathbf r})\hat{\mathbf r}-\mathbf m\right].
\]

- Position: mm in the interface, converted to m for evaluation.
- Dipole moment: A·m²; field: µT.
- Right-handed array frame: X across columns, Y across rows, Z out of the plane.
- Azimuth is +X toward +Y; elevation is the XY plane toward +Z.
- Position plus the unit magnetization axis defines a 5-DoF state. Axial spin
  is not an independently observable sixth degree of freedom in this model.
- Generic default geometry: 5×5 grid, 40-mm pitch; it is not apparatus calibration.
- Values within 5 mm of a source are undefined, not clamped or zero-filled.
- RK4 field lines are integral curves, not particle trajectories. Arrow length
  is display-normalized. The shared colorbar, not arrow length, gives magnitude.
- Field-section colors use the sensor limits and clip outside that range.

## Public scope

This repository contains **only physics-playground code and synthetic examples**.
It contains no experimental recordings, private datasets, replay adapters,
registered reference trajectories, inverse-localization solver or robot-control
interface. It makes no experimental accuracy or safety claim.

`npm run build` checks an explicit source/build allowlist and rejects unreviewed
assets or known private-source signatures. `public/` contains only the favicon
and generated third-party license notices.
There is no data endpoint, upload service, analytics or hardware connection.

The Pages workflow tests and builds the app and publishes **only `dist/`**.
Relative asset paths support a project subdirectory or a static-site embed.
Link the live demo from a homepage; no research repository needs to be exposed.

## Structure

```text
src/physics.ts        SI model, axes and field-line integration
src/Scene.tsx         procedural Three.js scene
src/App.tsx           controls and scientific observations
src/visual.ts         shared color/value mappings
src/SignalPlot.tsx    uPlot scientific curves
src/i18n.tsx          Chinese/English interface
scripts/              build-release and browser checks, local launcher
```

## License

[MIT](LICENSE). Copyright 2026 Miaozhang Shen. Third-party attribution is in
[NOTICE.md](NOTICE.md); complete installed runtime-dependency notices are retained
in [THIRD_PARTY_LICENSES.txt](public/THIRD_PARTY_LICENSES.txt).
