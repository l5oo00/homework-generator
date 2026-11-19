// 全局配置：所有题型共用的参数。
// 字段约定与题型 fields 完全一致，因此复用同一套自动渲染控件。
export const GLOBAL_FIELDS = [
  { key: 'fontSize', label: '统一字号(pt)', type: 'number', default: 14, min: 10, max: 24 }
]

export function defaultGlobalConfig() {
  const cfg = {}
  for (const f of GLOBAL_FIELDS) cfg[f.key] = f.default
  return cfg
}
