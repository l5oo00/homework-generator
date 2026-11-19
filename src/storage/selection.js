// 每个姓名独立记住科目、题型勾选与配置。v2 按人分组；v1 的无主人数据不再读取（直接丢弃）。
const KEY = 'homework-generator-selection-state-v2'

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

export function loadSelectionState(person) {
  const all = readAll()
  const s = all[person]
  if (!s || typeof s !== 'object') return { subject: null, types: {} }
  return {
    subject: typeof s.subject === 'string' ? s.subject : null,
    types: s.types && typeof s.types === 'object' && !Array.isArray(s.types) ? s.types : {}
  }
}

export function saveSelectionState(person, subject, selected) {
  if (!person) return false
  const all = readAll()
  all[person] = { subject, types: selected }
  return writeAll(all)
}

export function deleteSelectionState(person) {
  const all = readAll()
  delete all[person]
  return writeAll(all)
}

// 名单是权威：剔除存储里名单已不存在的人。返回被剔除的姓名数组。
export function pruneSelectionStates(validNames) {
  const all = readAll()
  const removed = Object.keys(all).filter(name => !validNames.includes(name))
  if (removed.length) {
    removed.forEach(name => delete all[name])
    writeAll(all)
  }
  return removed
}
