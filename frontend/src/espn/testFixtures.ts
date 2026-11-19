import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FIX_DIR = resolve(__dirname, '../../../backend/tests/fixtures')

/** Respostas reais da ESPN gravadas em backend/tests/fixtures (só para testes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fixture = (name: string): any => JSON.parse(readFileSync(resolve(FIX_DIR, name), 'utf-8'))
