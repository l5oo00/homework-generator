// 预设状态存 localStorage，按「姓名 → 题型 id」两层隔离。
// v2 key：v1 全局无主人数据不再读取（直接丢弃）。浏览器限制存储时降级为当前页面有效。
const KEY = 'homework-generator-preset-state-v2'

function readAll() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}')
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {}
  } catch {
    return {}
  }
}

function writeAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); return true }
  catch { return false }
}

function bucket(all, person) {
  if (!all[person] || typeof all[person] !== 'object') all[person] = { custom: {}, deletedBuiltin: {} }
  return all[person]
}

export function loadPresetState(person, typeId) {
  const all = readAll()
  const p = all[person] || {}
  return {
    custom: (p.custom && p.custom[typeId]) || [],
    deletedBuiltin: (p.deletedBuiltin && p.deletedBuiltin[typeId]) || []
  }
}

// 新增自定义预设放第一位
export function addCustomPreset(person, typeId, name, values) {
  const all = readAll()
  const b = bucket(all, person)
  const list = b.custom[typeId] || []
  list.unshift({ name, values: JSON.parse(JSON.stringify(values)) })
  b.custom[typeId] = list
  return { persisted: writeAll(all) }
}

export function removeCustomPreset(person, typeId, name) {
  const all = readAll()
  const b = bucket(all, person)
  b.custom[typeId] = (b.custom[typeId] || []).filter(p => p.name !== name)
  return { persisted: writeAll(all) }
}

// 内置预设按原始下标记录删除，刷新后不再出现
export function removeBuiltinPreset(person, typeId, builtinIndex) {
  const all = readAll()
  const b = bucket(all, person)
  const set = new Set(b.deletedBuiltin[typeId] || [])
  set.add(builtinIndex)
  b.deletedBuiltin[typeId] = [...set]
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
// 导出的是「当前选中人」的预设，JSON 本身不含姓名；导入给谁由导入时当前选中人决定。
export function exportPresetsJson(typeIds, presetMap) {
  const out = {}
  for (const id of typeIds) {
    out[id] = (presetMap[id] || []).map(p => ({ name: p.name, values: p.values }))
  }
  return JSON.stringify(out, null, 2)
}

// 导入预设 JSON：只覆盖 JSON 里出现的题型的本地预设，其他题型原样保留。
// 写入当前选中人的存储；导入项整组替换该题型的自定义预设（内置不受影响）。
export function importPresetsJson(person, text, validTypeIds) {
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON 根节点必须是对象')
  }
  const all = readAll()
  const b = bucket(all, person)
  const applied = [], skipped = []
  for (const [id, list] of Object.entries(parsed)) {
    if (!validTypeIds.includes(id) || !Array.isArray(list)) { skipped.push(id); continue }
    const clean = list
      .filter(p => p && typeof p.name === 'string' && p.values && typeof p.values === 'object' && !Array.isArray(p.values))
      .map(p => ({ name: p.name, values: JSON.parse(JSON.stringify(p.values)) }))
    b.custom[id] = clean
    applied.push(id)
  }
  const persisted = writeAll(all)
  return { applied, skipped, persisted }
}

export function deletePresetState(person) {
  const all = readAll()
  delete all[person]
  return writeAll(all)
}

// 名单是权威：剔除存储里名单已不存在的人。
export function prunePresetStates(validNames) {
  const all = readAll()
  const removed = Object.keys(all).filter(name => !validNames.includes(name))
  if (removed.length) {
    removed.forEach(name => delete all[name])
    writeAll(all)
  }
  return removed
}
