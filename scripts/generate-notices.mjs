import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const seen = new Set(), notices = []
function resolvePackage(name, from) {
  let directory = from
  while (true) {
    const candidate = path.join(directory, 'node_modules', name)
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate
    const parent = path.dirname(directory)
    if (parent === directory) return null
    directory = parent
  }
}
function visit(name, from) {
  const directory = resolvePackage(name, from)
  if (!directory || seen.has(directory)) return
  seen.add(directory)
  const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
  const licenseFiles = fs.readdirSync(directory).filter(file => /^(licen[cs]e|copying)(?:[.-].*)?$/i.test(file) && fs.statSync(path.join(directory, file)).isFile())
  const text = licenseFiles.map(file => fs.readFileSync(path.join(directory, file), 'utf8')).join('\n\n')
  notices.push({ id: `${pkg.name}@${pkg.version}`, text: text || `Upstream license declaration: ${JSON.stringify(pkg.license ?? 'not specified')}. Refer to the upstream distribution.` })
  for (const dependency of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })) visit(dependency, directory)
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
for (const name of Object.keys(pkg.dependencies)) visit(name, root)
notices.sort((a, b) => a.id.localeCompare(b.id, 'en'))
const text = 'THIRD-PARTY LICENSE NOTICES\nGenerated from the installed runtime dependency closure.\n\n'
  + notices.map(n => `${'='.repeat(72)}\n${n.id}\n${'='.repeat(72)}\n${n.text.trim()}\n`).join('\n')
fs.writeFileSync(path.join(root, 'public/THIRD_PARTY_LICENSES.txt'), text)
console.log(`Retained upstream notices for ${notices.length} installed packages.`)
