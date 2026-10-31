import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const projectDir = join(__dirname, '..', '..', '..', '..')
const featuresDir = join(projectDir, 'src', 'features')

function lintedFeatures(): string[] {
  const source = readFileSync(join(projectDir, 'eslint.config.js'), 'utf8')
  const declaration = source.match(/const features = \[([\s\S]*?)\]/)
  if (!declaration) throw new Error('eslint.config.js ya no declara `const features = [...]`')
  return [...declaration[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort()
}

function featureFolders(): string[] {
  return readdirSync(featuresDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

describe('reglas del repositorio', () => {
  it('lists every feature folder in the eslint features array', () => {
    expect(lintedFeatures()).toEqual(featureFolders())
  })

  it('gives every feature its public index.ts', () => {
    const withoutIndex = featureFolders().filter(
      (feature) => !existsSync(join(featuresDir, feature, 'index.ts')),
    )
    expect(withoutIndex).toEqual([])
  })

  it('leaves no loose file in the root of presentation/', () => {
    const looseFiles = featureFolders().flatMap((feature) => {
      const presentation = join(featuresDir, feature, 'presentation')
      if (!existsSync(presentation)) return []
      return readdirSync(presentation, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => `${feature}/presentation/${entry.name}`)
    })
    expect(looseFiles).toEqual([])
  })
})
