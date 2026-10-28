import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = path.resolve(import.meta.dirname, '..')
export const publicFiles = [
  '.gitignore', '.github/workflows/pages.yml', 'LICENSE', 'NOTICE.md',
  'README.md', 'README.zh-CN.md', 'index.html', 'package.json', 'package-lock.json',
  'tsconfig.json', 'vite.config.ts', 'public/favicon.svg', 'public/THIRD_PARTY_LICENSES.txt',
  'src/App.tsx', 'src/Scene.tsx', 'src/SignalPlot.tsx', 'src/main.tsx',
  'src/i18n.tsx', 'src/i18n.test.ts', 'src/physics.ts', 'src/physics.test.ts',
  'src/styles.css', 'src/types.ts', 'src/visual.ts', 'src/visual.test.ts',
  'scripts/check-release.mjs', 'scripts/browser-check.mjs', 'scripts/start-local.mjs', 'scripts/generate-notices.mjs',
]
const localOnly = new Set(['node_modules', '.git', 'dist', 'qa', 'task_plan.md', 'notes.md', 'RELEASE_REVIEW.md'])
function files(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), `No release symlinks: ${prefix}${entry.name}`)
    if (!prefix && localOnly.has(entry.name)) return []
    const relative = `${prefix}${entry.name}`
    return entry.isDirectory() ? files(path.join(directory, entry.name), `${relative}/`) : [relative]
  })
}
const patterns = [
  /TRO_experiments|A_FORMAL_|ARRAY_MODEL_LEGACY|NOKOV|FrameDecoder|rec1_live|magnetic_audit\.csv/i,
  /ReplayDataset|validateReplay|outputAvailable|candidateErrorMm|releasedErrorMm|sourceTime|frameSeq/,
  /data\d+_(?:mag|medical)_infer/,
  /[A-Z]:[\\/]Users[\\/]|gh[pous]_[A-Za-z0-9_]{30,}/,
]
const source = files(root)
for (const file of source) assert.ok(publicFiles.includes(file), `Unreviewed file in public tree: ${file}`)
for (const file of publicFiles) assert.ok(source.includes(file), `Required public file missing: ${file}`)
const publicAssets = files(path.join(root, 'public'))
assert.deepEqual(publicAssets.sort(), ['THIRD_PARTY_LICENSES.txt', 'favicon.svg'])
const distRoot = path.join(root, 'dist')
assert.ok(fs.existsSync(path.join(distRoot, 'index.html')), 'Build first')
const built = files(distRoot)
for (const file of built) {
  assert.ok(file === 'index.html' || file === 'favicon.svg' || file === 'THIRD_PARTY_LICENSES.txt' || /^assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(file), `Unreviewed build asset: ${file}`)
}
const scanned = [...publicFiles.filter(file => /^(src\/|public\/)|^(index\.html|README)/.test(file)).map(file => [file, path.join(root, file)]), ...built.map(file => [`dist/${file}`, path.join(distRoot, file)])]
for (const [name, file] of scanned) {
  const text = fs.readFileSync(file, 'utf8')
  for (const pattern of patterns) assert.ok(!pattern.test(text), `Private-source signature in ${name}: ${pattern}`)
}
assert.ok(!source.some(file => /\.(csv|mat|npz|mp4|webm|pdf|png|jpg|jpeg|tiff)$/i.test(file)))
console.log(JSON.stringify({ pass: true, publicFiles: source.length, builtFiles: built.length, allowedPublicAssets: publicAssets, scope: 'Explicit source/build allowlist and private-signature checks; no experimental files or adapters.' }, null, 2))
