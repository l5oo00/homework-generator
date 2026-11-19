// 引擎：读一组 { typeId, config } 的选择，输出可渲染的题目与答案。
// 引擎不认识具体题型，只调题型自带的 generate —— 这样新增题型无需改引擎。
import { typeById } from '../config/types/index.js'

export function generateSheet(selections, globalConfig = { fontSize: 14 }, meta = {}) {
  const sections = selections.map(sel => {
    const type = typeById(sel.typeId)
    return {
      typeId: type.id,
      typeName: type.name,
      config: sel.config,
      items: type.generate(sel.config)
    }
  })
  // 字号是全局配置，不随题型各自设置；渲染层统一读这里。
  // person/subjectName/date 写死进题目数据，日后从历史重打保持原样。
  return {
    sections,
    fontSize: globalConfig.fontSize,
    person: meta.person,
    subjectName: meta.subjectName,
    date: meta.date
  }
}
