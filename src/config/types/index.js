import { calculationType } from './calculation.js'
import { verticalType } from './vertical.js'

// 题型注册表：新增题型时在这里 import 并加进数组，页面题型清单自动出现。
export const TYPES = [calculationType, verticalType]

export function typesForSubject(subjectId) {
  return TYPES.filter(t => t.subject === subjectId)
}

export function typeById(id) {
  return TYPES.find(t => t.id === id)
}
