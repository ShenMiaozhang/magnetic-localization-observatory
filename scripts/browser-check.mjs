import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import * as THREE from 'three'
import { totalFieldMicroTesla } from '../src/physics.ts'

const root = path.resolve(import.meta.dirname, '..')
const qa = path.join(root, 'qa'); fs.mkdirSync(qa, { recursive: true })
let server = null
const base = process.env.OBSERVATORY_URL || 'http://127.0.0.1:4174/'
if (!process.env.OBSERVATORY_URL) {
  server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], { cwd: root, windowsHide: true, stdio: 'ignore' })
  let ready = false
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 200))
    try { if ((await fetch(base)).ok) { ready = true; break } } catch {}
    if (server.exitCode !== null) break
  }
  if (!ready) { server.kill(); throw new Error('Preview could not start on 4174') }
}
const executablePath = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined)
let browser, page
const checks = [], errors = [], requests = []
const check = (name, detail) => checks.push({ name, pass: true, detail })
try {
  browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('request', request => requests.push(request.url()))
  const exportValues = async language => {
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: language === 'zh' ? '导出数值' : 'Export values', exact: true }).click()
    const stream = await (await pending).createReadStream(), parts = []
    for await (const part of stream) parts.push(part)
    return JSON.parse(Buffer.concat(parts).toString())
  }
  const pixels = () => page.locator('.scene-viewport canvas').evaluate(canvas => {
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height
    const context = copy.getContext('2d'); context.drawImage(canvas, 0, 0)
    const rgba = context.getImageData(0, 0, copy.width, copy.height).data
    let colored = 0, dark = 0, hash = 0
    for (let i = 0; i < rgba.length; i += 16) {
      if (Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) - Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) > 30) colored++
      if (Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) < 200) dark++
      hash = (hash + (i + 1) * (rgba[i] + 3 * rgba[i + 1] + 7 * rgba[i + 2])) % 2147483647
    }
    return { colored, dark, hash, width: copy.width, height: copy.height }
  })
  await page.goto(`${base}?lang=zh`, { waitUntil: 'networkidle' })
  await page.locator('.scene-viewport canvas').waitFor()
  await page.waitForTimeout(1100)
  assert.match(await page.title(), /磁定位/)
  assert.equal(await page.getByTestId('sensor-heatmap').getByRole('button').count(), 25)
  const initial = await pixels()
  assert.ok(initial.colored > 200 && initial.dark > 400, JSON.stringify(initial))
  await page.screenshot({ path: path.join(qa, 'public-zh-desktop.png') })
  check('Synthetic-only Chinese scene is nonblank and uses 25 sensors', initial)

  await page.getByRole('button', { name: 'English', exact: true }).click()
  const before = await page.getByTestId('field-Bx').innerText()
  await page.getByRole('spinbutton', { name: 'Target x', exact: true }).fill('45')
  await page.getByRole('spinbutton', { name: 'Target x', exact: true }).press('Tab')
  await page.waitForTimeout(250)
  assert.notEqual(await page.getByTestId('field-Bx').innerText(), before)
  assert.notEqual((await pixels()).hash, initial.hash)
  const state = await exportValues('en')
  assert.equal(state.evidenceTier, 'Synthetic Demo')
  assert.deepEqual(state.physics.pitch, [40, 40])
  for (let i = 0; i < state.sensors.length; i++) {
    const expected = totalFieldMicroTesla(state.sensors[i].positionMm, [state.physics.target], state.physics.background)
    expected.forEach((v, axis) => assert.ok(Math.abs(v - state.fields[i][axis]) < 1e-9))
  }
  check('Parameters change canvas pixels; all 75 exported SI values match the analytic model')

  await page.getByRole('button', { name: 'Sensor 7', exact: true }).click()
  const selected = await exportValues('en')
  for (const [i, channel] of ['Bx', 'By', 'Bz'].entries()) assert.ok(Math.abs(Number((await page.getByTestId(`field-${channel}`).innerText()).replaceAll(',', '')) - selected.fields[6][i]) <= .0051)
  await page.getByRole('button', { name: '中文', exact: true }).click()
  assert.equal(await page.getByRole('spinbutton', { name: '目标 x', exact: true }).inputValue(), '45')
  assert.deepEqual(await exportValues('zh'), selected)
  assert.match(await page.locator('.selected-sensor').innerText(), /S07/)
  check('Heatmap/readouts share physical values; language switch preserves model and selected sensor')
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Azimuth', exact: true }).fill('85')
  const axisChanged = await exportValues('en')
  assert.notDeepEqual(axisChanged.fields, selected.fields)
  await page.getByRole('combobox', { name: 'Array rows', exact: true }).selectOption('3')
  await page.getByRole('combobox', { name: 'Array columns', exact: true }).selectOption('3')
  assert.equal(await page.getByTestId('sensor-heatmap').getByRole('button').count(), 9)
  check('Two-axis orientation and array geometry update the observations')

  await page.getByRole('button', { name: 'Reset physics', exact: true }).click()
  await page.getByRole('button', { name: 'Top view', exact: true }).click()
  await page.getByRole('button', { name: 'Drag magnet', exact: true }).click()
  await page.waitForTimeout(300)
  const bounds = await page.locator('.scene-viewport canvas').boundingBox()
  const camera = new THREE.PerspectiveCamera(41, bounds.width / bounds.height, 1, 2500)
  camera.up.set(0, 0, 1); camera.position.set(0, -.01, 420); camera.lookAt(0, 0, 45); camera.updateMatrixWorld()
  const p = new THREE.Vector3(-20, 12, 90).project(camera)
  const origin = { x: bounds.x + (p.x + 1) / 2 * bounds.width, y: bounds.y + (1 - p.y) / 2 * bounds.height }
  const drag = []
  for (const offset of [27, 38, 18, 47]) {
    const old = await page.getByRole('spinbutton', { name: 'Target x', exact: true }).inputValue()
    await page.mouse.move(origin.x + offset, origin.y)
    await page.mouse.down(); await page.mouse.move(origin.x + offset + 35, origin.y, { steps: 10 }); await page.mouse.up()
    await page.waitForTimeout(200)
    const next = await page.getByRole('spinbutton', { name: 'Target x', exact: true }).inputValue()
    drag.push({ offset, old, next })
    if (old !== next) break
  }
  assert.ok(drag.some(a => a.old !== a.next), JSON.stringify(drag))
  check('Actual Three.js gizmo dragging changes the magnet position', drag)
  await page.getByRole('button', { name: 'Drag magnet', exact: true }).click()
  await page.getByRole('button', { name: 'Reset physics', exact: true }).click()
  await page.getByRole('button', { name: 'Isometric view', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Interfering dipole', exact: true }).check()
  await page.getByRole('spinbutton', { name: 'Uniform background Bx', exact: true }).fill('15')
  await page.getByRole('checkbox', { name: 'Field section', exact: true }).check()
  const combined = await exportValues('en')
  for (let i = 0; i < combined.sensors.length; i++) {
    const b = totalFieldMicroTesla(combined.sensors[i].positionMm, [combined.physics.target, combined.physics.interferer], combined.physics.background)
    b.forEach((v, j) => assert.ok(Math.abs(v - combined.fields[i][j]) < 1e-9))
  }
  await page.screenshot({ path: path.join(qa, 'public-en-interference-section.png') })
  check('Second dipole, background, slice and exported superposition agree')

  for (const language of ['zh', 'en']) {
    await page.getByRole('button', { name: language === 'zh' ? '中文' : 'English', exact: true }).click()
    await page.getByRole('button', { name: language === 'zh' ? '模型说明' : 'Model details', exact: true }).first().click()
    const text = await page.getByRole('dialog').innerText()
    assert.match(text, language === 'zh' ? /第六自由度/ : /sixth degree of freedom/)
    assert.match(text, /5 mm/)
    await page.getByRole('button', { name: language === 'zh' ? '关闭模型说明' : 'Close model details', exact: true }).click()
  }
  check('Both language variants retain units, exclusion and 5-DoF scope')

  await page.getByRole('checkbox', { name: 'Field section', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Reset physics', exact: true }).click()
  for (const language of ['zh', 'en']) {
    await page.getByRole('button', { name: language === 'zh' ? '中文' : 'English', exact: true }).click()
    for (const view of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
      await page.setViewportSize(view); await page.waitForTimeout(350)
      const layout = await page.evaluate(() => {
        const brand = document.querySelector('.brand').getBoundingClientRect(), actions = document.querySelector('.header-actions').getBoundingClientRect()
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, headerOverlap: brand.right > actions.left }
      })
      assert.equal(layout.scrollWidth, view.width); assert.equal(layout.headerOverlap, false)
      const rendered = await pixels(); assert.ok(rendered.dark > 100 && rendered.colored > 100, JSON.stringify(rendered))
      assert.doesNotMatch(await page.locator('body').innerText(), /T-RO|NOKOV|Experimental Replay|实验回放/)
      await page.screenshot({ path: path.join(qa, `public-${language}-${view.width}.png`) })
      check(`${language} layout, nonblank canvas and public-only labels at ${view.width}px`, layout)
    }
    await page.getByRole('button', { name: language === 'zh' ? '观测' : 'Observations', exact: true }).click()
    assert.ok(await page.getByTestId('sensor-heatmap').isVisible())
    await page.getByRole('button', { name: language === 'zh' ? '参数' : 'Parameters', exact: true }).click()
    assert.ok(await page.getByRole('spinbutton', { name: language === 'zh' ? '目标 x' : 'Target x', exact: true }).isVisible())
    await page.getByRole('button', { name: language === 'zh' ? '场景' : 'Scene', exact: true }).click()
  }
  check('Both mobile variants expose observations and parameter panes')
  assert.ok(!requests.some(url => /\/data\/|\/api\//.test(url)))
  assert.deepEqual(errors, [])
  check('No data/API requests or browser errors', { requests: requests.length })
  const report = { pass: true, checks, errors }
  fs.writeFileSync(path.join(qa, 'browser-verification.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} catch (error) {
  const diagnostic = { error: String(error), errors, requests, body: await page?.locator('body').innerText().catch(() => '') }
  fs.writeFileSync(path.join(qa, 'browser-failure.json'), JSON.stringify(diagnostic, null, 2))
  await page?.screenshot({ path: path.join(qa, 'browser-failure.png'), fullPage: true }).catch(() => {})
  console.error(JSON.stringify(diagnostic))
  throw error
} finally {
  await browser?.close()
  if (server) server.kill()
}
