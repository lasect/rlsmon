import { readFileSync, writeFileSync, chmodSync } from 'fs'
const file = 'dist/index.js'
const content = readFileSync(file, 'utf-8')
if (!content.startsWith('#!/usr/bin/env bun')) {
  writeFileSync(file, '#!/usr/bin/env bun\n' + content)
}
chmodSync(file, 0o755)
