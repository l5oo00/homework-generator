// 记住题型选中状态与配置。题型 id 全局唯一，因此按 id 存天然按科目隔离。
const KEY = 'homework-generator-selection-state'

export function loadSelectionState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      subject: typeof s.subject === 'string' ? s.subject : null,
      types: s.types && typeof s.types === 'object' && !Array.isArray(s.types) ? s.types : {}
    }
  } catch {
    return { subject: null, types: {} }
  }
}

export function saveSelectionState(subject, selected) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ subject, types: selected }))
    return true
  } catch {
    return false
  }
}
