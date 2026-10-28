import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

const project = path.resolve(import.meta.dirname, '..')
const qa = path.join(project, 'qa')
fs.mkdirSync(qa, { recursive: true })
const vite = path.join(project, 'node_modules/vite/bin/vite.js')
if (!fs.existsSync(vite)) throw new Error('Dependencies missing. Run npm ci first.')
let port = Number(process.argv[2] || 5174)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port.')
const available = value => new Promise(resolve => {
  const probe = net.createServer()
  probe.once('error', () => resolve(false))
  probe.listen(value, '127.0.0.1', () => probe.close(() => resolve(true)))
})
const first = port
while (!(await available(port))) {
  port++
  if (port - first > 20) throw new Error('No free local port in the next 20 ports.')
}
const out = fs.openSync(path.join(qa, 'server.stdout.log'), 'a')
const err = fs.openSync(path.join(qa, 'server.stderr.log'), 'a')
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: project, detached: true, windowsHide: true, stdio: ['ignore', out, err],
})
server.unref(); fs.closeSync(out); fs.closeSync(err)
const url = `http://127.0.0.1:${port}/`
let ready = false
for (let i = 0; i < 40; i++) {
  await new Promise(resolve => setTimeout(resolve, 250))
  try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) { ready = true; break } } catch {}
}
if (!ready) throw new Error('Server did not become ready; inspect qa/server.stderr.log.')
fs.writeFileSync(path.join(qa, 'server.json'), JSON.stringify({ pid: server.pid, url, project }, null, 2))
console.log(`Magnetic Localization Observatory: ${url}\nBackground PID: ${server.pid}`)
