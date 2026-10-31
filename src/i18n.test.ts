import { describe, expect, it } from 'vitest'
import { initialLanguage, translate } from './i18n'

describe('bilingual physics interface', () => {
  it.each([['', null, 'zh'], ['', 'en', 'en'], ['?lang=zh', 'en', 'zh'], ['?lang=en', 'zh', 'en'], ['?lang=invalid', 'en', 'en']])('resolves language %s %s', (search, stored, result) => expect(initialLanguage(search!, stored)).toBe(result))
  it.each(['Target magnet', 'Field contributions', 'Export values', 'Interfering dipole', 'Model details', 'SUSTech · Department of Electronic and Electrical Engineering'])('translates %s', key => {
    expect(translate(key, 'zh')).not.toBe(key)
    expect(translate(key, 'en')).toBe(key)
  })
  it.each(['Bx', 'µT', 'mm', 'S13', 'UNKNOWN'])('preserves symbols %s', key => expect(translate(key, 'zh')).toBe(key))
})
