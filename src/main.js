import './styles/app.css'
import './styles/print.css'

import { META } from './config/meta.js'
import { SUBJECTS } from './config/subjects.js'
import { GLOBAL_FIELDS, defaultGlobalConfig } from './config/global.js'
import { typesForSubject } from './config/types/index.js'
import { generateSheet } from './engine/generator.js'
import { renderField, renderTypeSelector } from './ui/configPanel.js'
import { renderSheets } from './ui/preview.js'
import { downloadText } from './ui/download.js'
import { downloadQuestionAnswerFile, openAnswerDialog, renderAnswerViewIfRequested } from './ui/answerShare.js'
import { saveFinalSheet, listFinalSheets, deleteFinalSheet } from './storage/history.js'
import { loadSelectionState, saveSelectionState } from './storage/selection.js'
import { loadPresetState, addCustomPreset, removeCustomPreset, removeBuiltinPreset, exportPresetsJson, importPresetsJson, presetMatchesConfig } from './ui/presets.js'

const app = document.getElementById('app')
const savedSelection = loadSelectionState()

// 全局状态：科目 + 全局配置 + 每个题型是否选中及其配置
const state = {
  subject: SUBJECTS.some(s => s.id === savedSelection.subject) ? savedSelection.subject : SUBJECTS[0].id,
  global: defaultGlobalConfig(),
  selected: {}
}

// 配置视图的预览状态：empty=未生成，draft=已生成未定稿，final=已定稿（已存档）。
const preview = { stage: 'empty', sheet: null }
// 历史视图独立保存选中记录，和配置视图互不干扰。
const historyView = { records: null, activeId: null, sheet: null, error: null }
let uiMode = 'config' // 'config' | 'history'

// 所有题型的当前预设映射（typeId → 预设数组），供全局导出使用。
// 保存/删除预设后由 rebuildPresetMap() 刷新。
const presetMap = {}

for (const sub of SUBJECTS) {
  for (const t of typesForSubject(sub.id)) {
    // 恢复预设状态：内置按原始下标过滤已删除项，自定义预设排在最前
    const st = loadPresetState(t.id)
    t.builtinPresets = t.presets
      .map((p, i) => ({ ...p, custom: false, builtinIndex: i }))
      .filter(p => !st.deletedBuiltin.includes(p.builtinIndex))
    t.presets = [
      ...st.custom.map(p => ({ ...p, custom: true })),
      ...t.builtinPresets
    ]
    // 有存档就恢复存档；没有则默认套用第一个预设。字段以默认配置补齐。
    const defaults = t.defaultConfig()
    const savedType = savedSelection.types[t.id]
    const config = { ...defaults }
    if (savedType && savedType.config && typeof savedType.config === 'object') {
      for (const key of Object.keys(defaults)) {
        if (savedType.config[key] !== undefined) config[key] = savedType.config[key]
      }
    } else if (t.presets[0]) {
      Object.assign(config, JSON.parse(JSON.stringify(t.presets[0].values)))
    }
    state.selected[t.id] = { selected: !!(savedType && savedType.selected), config }
    presetMap[t.id] = t.presets
  }
}

function persistSelections() {
  saveSelectionState(state.subject, state.selected)
}

function rebuildPresetMap() {
  for (const sub of SUBJECTS) {
    for (const t of typesForSubject(sub.id)) presetMap[t.id] = t.presets
  }
}

function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

function currentSelections() {
  return Object.entries(state.selected)
    .filter(([, s]) => s.selected)
    .map(([typeId, s]) => ({ typeId, config: s.config }))
}

// 固化当前配置为预设：拒绝同名或与已有配置重复
function savePreset(type, config, name) {
  if (type.presets.some(p => p.name === name)) {
    alert(`已存在同名预设「${name}」，请换一个名字`)
    return null
  }
  const same = type.presets.find(p => presetMatchesConfig(p.values, config, type.defaultConfig()))
  if (same) {
    alert(`当前配置与预设「${same.name}」相同，无需重复保存`)
    return null
  }
  try {
    const { persisted } = addCustomPreset(type.id, name, config)
    type.presets.unshift({ name, values: JSON.parse(JSON.stringify(config)), custom: true })
    rebuildPresetMap()
    return { persisted }
  } catch (e) {
    alert('固化失败：' + e.message)
    return null
  }
}

// 删除预设：内置按原始下标记入状态，刷新后也不会恢复
function deletePreset(type, preset) {
  try {
    if (preset.custom) removeCustomPreset(type.id, preset.name)
    else removeBuiltinPreset(type.id, preset.builtinIndex)
    const i = type.presets.indexOf(preset)
    if (i >= 0) type.presets.splice(i, 1)
    rebuildPresetMap()
  } catch (e) {
    alert('删除失败：' + e.message)
  }
}

// 导出选中题型的预设 JSON：按题型 id 分组
function exportPresets(typeIds) {
  if (!typeIds.length) { alert('请至少选择一个题型'); return }
  try {
    downloadText(exportPresetsJson(typeIds, presetMap), '小学生练习题生成器_预设.json')
  } catch (e) {
    alert('导出失败：' + e.message)
  }
}

// 导入预设 JSON：只覆盖文件里出现的题型的本地预设，其他题型不动。
// 导入项和内置预设同名时以导入项为准（整组替换自定义预设，内置仍留在源码里）。
function importPresets(text) {
  const validIds = Object.keys(presetMap)
  let result
  try {
    result = importPresetsJson(text, validIds)
  } catch (e) {
    alert('导入失败：' + e.message)
    return
  }
  for (const id of result.applied) {
    const t = allTypeById(id)
    if (!t) continue
    const imported = loadPresetState(id).custom.map(p => ({ ...p, custom: true }))
    t.presets = [...imported, ...t.builtinPresets]
  }
  rebuildPresetMap()
  render()
  alert(`导入完成：已更新 ${result.applied.length} 个题型的预设${result.skipped.length ? `，跳过 ${result.skipped.length} 个无效题型` : ''}${result.persisted ? '' : '（本地存储受限，仅本页有效）'}`)
}

function allTypeById(id) {
  for (const sub of SUBJECTS) {
    const t = typesForSubject(sub.id).find(x => x.id === id)
    if (t) return t
  }
  return null
}

// 打印只出题目：打印渲染期间隐藏答案页。afterprint 在关闭对话框时触发（取消也会），
// 所以复位放在这里，不依赖"是否真的打印成功"。
window.addEventListener('beforeprint', () => document.body.classList.add('print-questions-only'))
window.addEventListener('afterprint', () => document.body.classList.remove('print-questions-only'))

function render() {
  app.replaceChildren()

  // 答案链接：同一个 HTML 文件在此切换成手机端答案查看页，不渲染工具界面。
  if (renderAnswerViewIfRequested(app)) return

  const wrap = el('div', 'wrap')

  // 顶栏：标题 + 视图切换 + 版本号
  const top = el('div', 'topbar no-print')
  const topLeft = el('div', 'topbar-left')
  topLeft.appendChild(el('h1', null, META.appName))
  const tabs = el('div', 'view-tabs')
  for (const [mode, label] of [['config', '配置'], ['history', '历史记录']]) {
    const tab = el('button', 'view-tab' + (uiMode === mode ? ' on' : ''), label)
    tab.addEventListener('click', () => {
      if (uiMode === mode) return
      uiMode = mode
      if (mode === 'history') loadHistory()
      render()
    })
    tabs.appendChild(tab)
  }
  topLeft.appendChild(tabs)
  top.appendChild(topLeft)

  const verBox = el('div', 'ver-box')
  verBox.appendChild(el('span', 'ver', `v${META.version} · ${META.date}`))
  top.appendChild(verBox)
  wrap.appendChild(top)

  const layout = el('div', 'layout')
  if (uiMode === 'config') renderConfigView(layout, wrap)
  else renderHistoryView(layout)
  wrap.appendChild(layout)
  wrap.appendChild(el('div', 'foot no-print', `${META.appName} · v${META.version} · ${META.date}`))

  app.appendChild(wrap)
}

// ── 配置视图：左配置、右预览（生成 → 定稿 → 打印/查看答案）────────
function renderConfigView(layout, wrap) {
  const configCol = el('div', 'config-col no-print')

  const configToggle = el('button', 'btn subtle btn-mini config-toggle', '全局配置')
  configCol.appendChild(configToggle)

  const configPanel = el('div', 'card config-panel')
  configPanel.style.display = 'none'
  configToggle.addEventListener('click', () => {
    configPanel.style.display = configPanel.style.display === 'none' ? '' : 'none'
  })
  configPanel.appendChild(el('h2', null, '全局配置'))
  const globalFields = el('div', 'fields')
  globalFields.replaceChildren(...GLOBAL_FIELDS.map(f => renderField(f, state.global)))
  configPanel.appendChild(globalFields)

  // 预设管理：勾选要导出的题型 → 导出；导入 JSON 只覆盖文件里出现的题型
  configPanel.appendChild(el('div', 'config-sub', '预设管理'))
  const allTypes = SUBJECTS.flatMap(sub => typesForSubject(sub.id))
  const pickBox = el('div', 'preset-pick')
  const picks = {}
  for (const t of allTypes) {
    const label = el('label', 'check-line')
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = true
    cb.addEventListener('change', () => { picks[t.id] = cb.checked })
    picks[t.id] = true
    label.appendChild(cb)
    label.appendChild(el('span', null, `${SUBJECTS.find(s => s.id === t.subject).name} · ${t.name}`))
    pickBox.appendChild(label)
  }
  configPanel.appendChild(pickBox)
  const presetOps = el('div', 'preset-ops')
  const exportBtn = el('button', 'btn subtle btn-mini', '导出所选预设 JSON')
  exportBtn.addEventListener('click', () => exportPresets(Object.keys(picks).filter(id => picks[id])))
  presetOps.appendChild(exportBtn)

  const importBtn = el('button', 'btn subtle btn-mini', '导入预设 JSON')
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = '.json,application/json'
  fileInput.style.display = 'none'
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0]
    if (!file) return
    try { importPresets(await file.text()) }
    catch (e) { alert('读取文件失败：' + e.message) }
    fileInput.value = ''
  })
  importBtn.addEventListener('click', () => fileInput.click())
  presetOps.appendChild(importBtn)
  presetOps.appendChild(fileInput)
  configPanel.appendChild(presetOps)
  configPanel.appendChild(el('div', 'hint', '导出勾选的题型预设为 JSON；导入时只覆盖文件里出现的题型，其余题型不变。'))
  configCol.appendChild(configPanel)

  const subjectCard = el('div', 'card')
  const sh = el('h2')
  sh.appendChild(el('span', 'step', '①'))
  sh.appendChild(document.createTextNode('选择科目'))
  subjectCard.appendChild(sh)
  const subChips = el('div', 'chips')
  for (const sub of SUBJECTS) {
    const chip = el('div', 'chip', sub.name)
    if (sub.id === state.subject) chip.classList.add('on')
    chip.addEventListener('click', () => {
      state.subject = sub.id
      persistSelections()
      render()
    })
    subChips.appendChild(chip)
  }
  subjectCard.appendChild(subChips)
  configCol.appendChild(subjectCard)

  const typeCard = el('div', 'card')
  const th = el('h2')
  th.appendChild(el('span', 'step', '②'))
  th.appendChild(document.createTextNode('选择题型并配置（可多选）'))
  typeCard.appendChild(th)
  const types = typesForSubject(state.subject)
  if (!types.length) {
    typeCard.appendChild(el('div', 'hint', '该科目暂无题型，后续迭代会加入。'))
  }
  for (const t of types) {
    typeCard.appendChild(renderTypeSelector(t, state.selected[t.id], persistSelections, savePreset, deletePreset))
  }
  configCol.appendChild(typeCard)
  layout.appendChild(configCol)

  // 右栏：按 empty / draft / final 三态显示按钮
  const previewCol = el('div', 'preview-col')
  const bar = el('div', 'preview-toolbar no-print')
  const genBtn = el('button', 'btn gen-btn', preview.stage === 'empty' ? '生成预览' : '重新生成预览')
  genBtn.addEventListener('click', () => {
    const selections = currentSelections()
    if (!selections.length) { alert('请至少选择一个题型'); return }
    preview.sheet = generateSheet(selections, state.global)
    preview.stage = 'draft'
    render()
  })
  bar.appendChild(genBtn)

  const actions = el('span', 'preview-actions')
  if (preview.stage === 'draft') {
    const finalBtn = el('button', 'btn', '定稿')
    finalBtn.addEventListener('click', async () => {
      try { await saveFinalSheet(preview.sheet) }
      catch (e) { alert('本地存档失败：' + e.message) }
      preview.stage = 'final'
      historyView.records = null // 下次进历史视图重新读
      render()
    })
    actions.appendChild(finalBtn)
    actions.appendChild(el('span', 'hint', '定稿后才会出现打印 / 查看答案，并自动存档 7 天'))
  } else if (preview.stage === 'final') {
    const printBtn = el('button', 'btn', '打印题目')
    printBtn.addEventListener('click', () => window.print())
    actions.appendChild(printBtn)

    const ansBtn = el('button', 'btn ghost', '查看答案')
    ansBtn.addEventListener('click', () => openAnswerDialog(preview.sheet))
    actions.appendChild(ansBtn)

    actions.appendChild(el('span', 'hint', '已存档，可在「历史记录」中找回或导出 HTML'))
  }
  bar.appendChild(actions)
  previewCol.appendChild(bar)

  const previewHost = el('div')
  previewHost.id = 'preview-host'
  if (preview.sheet) {
    const shadow = el('div', 'sheet-shadow')
    shadow.appendChild(renderSheets(preview.sheet, false))
    previewHost.appendChild(shadow)
  }
  previewCol.appendChild(previewHost)
  layout.appendChild(previewCol)
}

// ── 历史视图：左列表、右只读预览（无生成/重新生成）────────────
function renderHistoryView(layout) {
  const historyCol = el('div', 'config-col no-print')
  const card = el('div', 'card history-card')
  card.appendChild(el('h2', null, '历史记录（最近 7 天）'))
  const list = el('div', 'history-list')
  renderHistoryInto(list)
  card.appendChild(list)
  card.appendChild(el('div', 'hint', '定稿的题自动存档，7 天后清理；导出 HTML 可长期留档。'))
  historyCol.appendChild(card)
  layout.appendChild(historyCol)

  const previewCol = el('div', 'preview-col')
  const bar = el('div', 'preview-toolbar no-print')
  if (historyView.sheet) {
    const printBtn = el('button', 'btn', '打印题目')
    printBtn.addEventListener('click', () => window.print())
    bar.appendChild(printBtn)
    const ansBtn = el('button', 'btn ghost', '查看答案')
    ansBtn.addEventListener('click', () => openAnswerDialog(historyView.sheet))
    bar.appendChild(ansBtn)
    bar.appendChild(el('span', 'hint', '来自历史记录 · 只读预览'))
  } else {
    bar.appendChild(el('span', 'hint', historyView.records && !historyView.records.length
      ? '暂无历史记录，去「配置」定稿一份吧'
      : '从左侧选择一条记录查看'))
  }
  previewCol.appendChild(bar)

  const previewHost = el('div')
  previewHost.id = 'preview-host'
  if (historyView.sheet) {
    const shadow = el('div', 'sheet-shadow')
    shadow.appendChild(renderSheets(historyView.sheet, false))
    previewHost.appendChild(shadow)
  }
  previewCol.appendChild(previewHost)
  layout.appendChild(previewCol)
}

function formatTime(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function subjectPrefix(typeId) {
  const t = allTypeById(typeId)
  if (!t) return ''
  const sub = SUBJECTS.find(s => s.id === t.subject)
  return sub ? sub.name : ''
}

function sheetSummary(sheet) {
  const subjects = [...new Set(sheet.sections.map(s => subjectPrefix(s.typeId)).filter(Boolean))]
  const prefix = subjects.length ? subjects.join('/') + ' · ' : ''
  return prefix + sheet.sections.map(s => `${s.typeName} ${s.items.length} 道`).join(' · ')
}

function exportSheetHtml(sheet) {
  const tmp = document.createElement('div')
  tmp.appendChild(renderSheets(sheet))
  downloadQuestionAnswerFile(tmp.innerHTML)
}

// 同步渲染列表：数据来自 historyView.records 缓存，因此打开记录后重建界面列表不会空。
function renderHistoryInto(container) {
  container.replaceChildren()
  if (historyView.error) {
    container.appendChild(el('div', 'hint', '读取本地记录失败：' + historyView.error))
    return
  }
  if (!historyView.records) {
    container.appendChild(el('div', 'hint', '读取中…'))
    return
  }
  if (!historyView.records.length) {
    container.appendChild(el('div', 'hint', '还没有定稿记录。去「配置」生成预览并定稿后会自动存档。'))
    return
  }
  for (const rec of historyView.records) {
    const row = el('div', 'history-item' + (rec.id === historyView.activeId ? ' active' : ''))
    const info = el('div', 'history-info')
    info.appendChild(el('div', 'history-time', formatTime(rec.createdAt)))
    info.appendChild(el('div', 'history-summary', sheetSummary(rec.sheet)))
    row.appendChild(info)

    const ops = el('div', 'history-ops')
    const openBtn = el('button', 'btn ghost btn-mini', '打开')
    openBtn.addEventListener('click', () => {
      historyView.activeId = rec.id
      historyView.sheet = rec.sheet
      render()
    })
    ops.appendChild(openBtn)

    const htmlBtn = el('button', 'btn subtle btn-mini', '导出 HTML')
    htmlBtn.addEventListener('click', () => exportSheetHtml(rec.sheet))
    ops.appendChild(htmlBtn)

    const delBtn = el('button', 'btn subtle btn-mini danger', '删除')
    delBtn.addEventListener('click', async () => {
      if (!confirm(`删除 ${formatTime(rec.createdAt)}「${sheetSummary(rec.sheet)}」这条定稿记录？`)) return
      try { await deleteFinalSheet(rec.id) }
      catch (e) { alert('删除失败：' + e.message); return }
      if (historyView.activeId === rec.id) {
        historyView.activeId = null
        historyView.sheet = null
      }
      await loadHistory()
    })
    ops.appendChild(delBtn)
    row.appendChild(ops)
    container.appendChild(row)
  }
}

// 从 IndexedDB 读取记录并刷新；进入历史视图、定稿后、删除后调用。
async function loadHistory() {
  try {
    historyView.records = await listFinalSheets()
    historyView.error = null
  } catch (e) {
    historyView.records = []
    historyView.error = e.message
  }
  // 首次进入自动打开最新一条，让右栏直接可用
  const found = historyView.records.find(r => r.id === historyView.activeId)
  if (!found && historyView.records.length) {
    historyView.activeId = historyView.records[0].id
    historyView.sheet = historyView.records[0].sheet
  } else if (!found) {
    historyView.activeId = null
    historyView.sheet = null
  }
  if (uiMode === 'history') render()
}

// 首次渲染；同页 hash 变化（粘贴答案链接 / 关闭答案页）也要切换视图。
render()
window.addEventListener('hashchange', () => render())
