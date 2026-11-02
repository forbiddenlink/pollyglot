// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { builtinModules } from 'module'
import { dirname, resolve } from 'path'

const root = resolve(__dirname, '..')
const declared = JSON.parse(readFileSync(resolve(root, 'api/package.json'), 'utf8')).dependencies

// Walks the local files api/index.js loads. Vercel installs the function from
// api/package.json, so a package declared only at the repo root crashes it at startup.
function bareRequires(file, seen = new Set(), found = new Set()) {
  if (seen.has(file)) return found
  seen.add(file)
  const source = readFileSync(file, 'utf8')
  for (const [, name] of source.matchAll(/require\("([^"]+)"\)/g)) {
    if (name.startsWith('.')) {
      const target = resolve(dirname(file), name)
      bareRequires(target.endsWith('.js') ? target : `${target}.js`, seen, found)
    } else if (!builtinModules.includes(name.replace(/^node:/, ''))) {
      found.add(name)
    }
  }
  return found
}

describe('api runtime dependencies', () => {
  it('declares every package the function loads in api/package.json', () => {
    const missing = [...bareRequires(resolve(root, 'api/index.js'))].filter((name) => !declared[name])
    expect(missing).toEqual([])
  })
})
