// 姓名名单存 localStorage，是身份的唯一权威。姓名文本本身即唯一标识：
// 不重名、改名等于新身份。存储里出现名单不存在的人，启动时会被剔除。
const KEY = 'homework-generator-people'

export function loadPeople() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}')
    const names = Array.isArray(s.names)
      ? s.names.filter(n => typeof n === 'string' && n.trim())
      : []
    const current = names.includes(s.current) ? s.current : (names[0] || null)
    return { names, current }
  } catch {
    return { names: [], current: null }
  }
}

export function savePeople(names, current) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      names,
      current: names.includes(current) ? current : null
    }))
    return true
  } catch {
    return false
  }
}

export function addPerson(name) {
  const p = loadPeople()
  const clean = (name || '').trim()
  if (!clean) return { ok: false, error: '姓名不能为空' }
  if (p.names.includes(clean)) return { ok: false, error: '该姓名已存在' }
  const names = [...p.names, clean]
  return { ok: savePeople(names, clean), error: null, state: { names, current: clean } }
}

export function selectPerson(name) {
  const p = loadPeople()
  if (!p.names.includes(name)) return p
  savePeople(p.names, name)
  return { names: p.names, current: name }
}

export function removePerson(name) {
  const p = loadPeople()
  const names = p.names.filter(n => n !== name)
  const current = p.current === name ? (names[0] || null) : p.current
  return { ok: savePeople(names, current), state: { names, current } }
}
