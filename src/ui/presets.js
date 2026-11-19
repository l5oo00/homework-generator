// 预设状态存 localStorage：自定义预设 + 已删除的内置预设。
// 浏览器限制存储时降级为当前页面有效，不影响使用。
const KEY = 'homework-generator-preset-state'

function readAll() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { custom: s.custom || {}, deletedBuiltin: s.deletedBuiltin || {} }
  } catch {
    return { custom: {}, deletedBuiltin: {} }
  }
}

function writeAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); return true }
  catch { return false }
}

export function loadPresetState(typeId) {
  const all = readAll()
  return {
    custom: all.custom[typeId] || [],
    deletedBuiltin: all.deletedBuiltin[typeId] || []
  }
}

// 新增自定义预设放第一位
export function addCustomPreset(typeId, name, values) {
  const all = readAll()
  const list = all.custom[typeId] || []
  list.unshift({ name, values: JSON.parse(JSON.stringify(values)) })
  all.custom[typeId] = list
  return { persisted: writeAll(all) }
}

export function removeCustomPreset(typeId, name) {
  const all = readAll()
  all.custom[typeId] = (all.custom[typeId] || []).filter(p => p.name !== name)
  return { persisted: writeAll(all) }
}

// 内置预设按原始下标记录删除，刷新后不再出现
export function removeBuiltinPreset(typeId, builtinIndex) {
  const all = readAll()
  const set = new Set(all.deletedBuiltin[typeId] || [])
  set.add(builtinIndex)
  all.deletedBuiltin[typeId] = [...set]
  return { persisted: writeAll(all) }
}

// 比较当前配置是否等于某个预设。预设可能省略部分字段，用默认值补齐再比。
// 这样内置预设即使没写 noNegative/fullPage 等字段，也能正确匹配与高亮。
export function presetMatchesConfig(presetValues, config, defaults) {
  const full = { ...defaults, ...presetValues }
  const keys = new Set([...Object.keys(full), ...Object.keys(config)])
  for (const k of keys) {
    const a = full[k], b = config[k]
    if (Array.isArray(a) && Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) return false
    } else if (a !== b) return false
  }
  return true
}

// 导出预设 JSON：按题型 id 分组，只包含 typeIds 里指定的题型。
// 结构是 { typeId: [{ name, values }, ...] }，其中 values 为该题型的完整配置。
// 内置预设带 builtin: true 标记，方便区分；导入后统一作为该题型预设落本地。
export function exportPresetsJson(typeIds, presetMap) {
  const out = {}
  for (const id of typeIds) {
    out[id] = (presetMap[id] || []).map(p => ({ name: p.name, values: p.values }))
  }
  return JSON.stringify(out, null, 2)
}

// 导入预设 JSON：只覆盖 JSON 里出现的题型的本地预设，其他题型原样保留。
// 导入的预设整组替换该题型的自定义预设（内置预设是源码里的，不受影响）。
// 返回 { applied: [typeId...], skipped: [...] }，供 UI 提示。
export function importPresetsJson(text, validTypeIds) {
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON 根节点必须是对象')
  }
  const all = readAll()
  const applied = [], skipped = []
  for (const [id, list] of Object.entries(parsed)) {
    if (!validTypeIds.includes(id) || !Array.isArray(list)) { skipped.push(id); continue }
    // 只保留结构合法的项：名字 + 配置对象
    const clean = list
      .filter(p => p && typeof p.name === 'string' && p.values && typeof p.values === 'object' && !Array.isArray(p.values))
      .map(p => ({ name: p.name, values: JSON.parse(JSON.stringify(p.values)) }))
    all.custom[id] = clean
    applied.push(id)
  }
  const persisted = writeAll(all)
  return { applied, skipped, persisted }
}
