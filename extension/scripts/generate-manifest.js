#!/usr/bin/env node
// manifest.template.json から manifest.json を生成するスクリプト
// 使い方: node scripts/generate-manifest.js [development|production]
// .env.<mode> の値を読み込み、__APP_URL__ / __SUPABASE_URL__ を置換する

const fs = require('fs')
const path = require('path')

const mode = process.argv[2] ?? 'development'
const root = path.resolve(__dirname, '..')

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf8')
  const result = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    result[key] = value
  }
  return result
}

// .env.<mode> を読み込み、.env.local で上書き
const modeEnv = parseEnvFile(path.join(root, `.env.${mode}`))
const localEnv = parseEnvFile(path.join(root, '.env.local'))
const env = { ...modeEnv, ...localEnv }

const APP_URL = env['VITE_APP_URL']
const SUPABASE_URL = env['VITE_SUPABASE_URL']

if (!APP_URL || !SUPABASE_URL) {
  console.error(`[generate-manifest] Missing required env vars in .env.${mode}:`)
  if (!APP_URL) console.error('  - VITE_APP_URL')
  if (!SUPABASE_URL) console.error('  - VITE_SUPABASE_URL')
  process.exit(1)
}

// URL の末尾スラッシュを除去
const appUrl = APP_URL.replace(/\/+$/, '')
const supabaseUrl = SUPABASE_URL.replace(/\/+$/, '')

const template = fs.readFileSync(path.join(root, 'manifest.template.json'), 'utf8')
const replaced = template
  .replace(/__APP_URL__/g, appUrl)
  .replace(/__SUPABASE_URL__/g, supabaseUrl)

const parsed = JSON.parse(replaced)

// development ビルドでは localhost:5173 も content script の対象に加える
if (mode === 'development') {
  const DEV_URL = 'http://localhost:5173'
  if (!parsed.host_permissions.includes(`${DEV_URL}/*`)) {
    parsed.host_permissions.push(`${DEV_URL}/*`)
  }
  for (const cs of parsed.content_scripts) {
    if (cs.js?.includes('appContent.js') && !cs.matches.includes(`${DEV_URL}/*`)) {
      cs.matches.push(`${DEV_URL}/*`)
    }
  }
}

fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(parsed, null, 2) + '\n')
console.log(`[generate-manifest] Generated manifest.json (${mode}): APP_URL=${appUrl}`)
