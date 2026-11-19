// 根据题型的 fields 描述自动生成配置控件，并从 presets 生成预设按钮。
// 新增题型只要写好 fields/presets，这里无需改动。

import { presetMatchesConfig } from './presets.js'

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v
    else if (k === 'text') n.textContent = v
    else n.setAttribute(k, v)
  }
  for (const c of children) n.appendChild(c)
  return n
}

// 渲染单个字段，返回控件 DOM。读/写都直接操作 config[key]。
// onChange 用于让预设按钮的高亮跟随字段变化；全局配置不需要传。
export function renderField(field, config, onChange) {
  const wrap = el('div', { class: `field field-${field.type}` })
  const changed = () => { if (onChange) onChange() }

  if (field.type === 'number') {
    wrap.appendChild(el('label', { text: field.label }))
    const input = el('input', { type: 'number', class: 'num-input', value: config[field.key] })
    if (field.min != null) input.min = field.min
    if (field.max != null) input.max = field.max
    input.addEventListener('input', () => { config[field.key] = Number(input.value); changed() })
    wrap.appendChild(input)
  }

  else if (field.type === 'select') {
    wrap.appendChild(el('label', { text: field.label }))
    const sel = el('select')
    for (const o of field.options) {
      const opt = el('option', { value: o.value, text: o.label })
      if (o.value === config[field.key]) opt.selected = true
      sel.appendChild(opt)
    }
    sel.addEventListener('change', () => {
      const raw = sel.value
      config[field.key] = field.options.find(o => String(o.value) === raw).value
      changed()
    })
    wrap.appendChild(sel)
  }

  else if (field.type === 'checks') {
    wrap.appendChild(el('label', { text: field.label }))
    const box = el('div', { class: 'checks' })
    for (const o of field.options) {
      const label = el('label')
      const cb = el('input', { type: 'checkbox' })
      cb.checked = config[field.key].includes(o.value)
      cb.addEventListener('change', () => {
        const set = new Set(config[field.key])
        cb.checked ? set.add(o.value) : set.delete(o.value)
        config[field.key] = field.options.filter(x => set.has(x.value)).map(x => x.value)
        changed()
      })
      label.appendChild(cb)
      label.appendChild(el('span', { text: o.label }))
      box.appendChild(label)
    }
    wrap.appendChild(box)
  }

  else if (field.type === 'check') {
    const label = el('label', { class: 'check-line' })
    const cb = el('input', { type: 'checkbox' })
    cb.checked = !!config[field.key]
    cb.addEventListener('change', () => { config[field.key] = cb.checked; changed() })
    label.appendChild(cb)
    label.appendChild(el('span', { text: field.label }))
    wrap.replaceChildren(label)
  }

  else if (field.type === 'rangePair') {
    wrap.appendChild(el('label', { text: field.label }))
    const row = el('div', { class: 'range-pair' })
    const lo = el('input', { type: 'number', value: config[field.key][0] })
    const hi = el('input', { type: 'number', value: config[field.key][1] })
    lo.addEventListener('input', () => { config[field.key][0] = Number(lo.value); changed() })
    hi.addEventListener('input', () => { config[field.key][1] = Number(hi.value); changed() })
    row.appendChild(lo)
    row.appendChild(el('span', { text: '—' }))
    row.appendChild(hi)
    wrap.appendChild(row)
  }

  return wrap
}

// 主要参数排网格；次要的单个复选框聚合成一行，不各自占一个宽格子。
function renderFields(type, config, onChange) {
  const frag = document.createDocumentFragment()
  const main = type.fields.filter(f => f.type !== 'check')
  const checks = type.fields.filter(f => f.type === 'check')

  const grid = el('div', { class: 'fields' })
  grid.replaceChildren(...main.map(f => renderField(f, config, onChange)))
  frag.appendChild(grid)

  if (checks.length) {
    const box = el('div', { class: 'secondary-checks' })
    box.appendChild(el('span', { class: 'secondary-label', text: '其他选项' }))
    const row = el('div', { class: 'secondary-row' })
    row.replaceChildren(...checks.map(f => renderField(f, config, onChange)))
    box.appendChild(row)
    frag.appendChild(box)
  }
  return frag
}

// 渲染一个题型的可选配置区（勾选框 + 预设 + 字段）。
// 预设可一键套用、可删除；当前配置等于某预设时该按钮高亮。
export function renderTypeSelector(type, state, onChange, onSavePreset, onDeletePreset) {
  const block = el('div', { class: 'type-block' })
  const defaults = type.defaultConfig()

  const head = el('div', { class: 'type-head' })
  const nameLabel = el('label', { class: 'type-name' })
  const cb = el('input', { type: 'checkbox' })
  cb.checked = state.selected
  cb.addEventListener('change', () => {
    state.selected = cb.checked
    body.style.display = cb.checked ? '' : 'none'
    onChange()
  })
  nameLabel.appendChild(cb)
  nameLabel.appendChild(el('span', { text: type.name }))
  head.appendChild(nameLabel)
  block.appendChild(head)

  const body = el('div')

  const presetRow = el('div', { class: 'preset-row' })

  // 高亮当前配置命中的预设；字段任何变化都会回调这里。
  function updateHighlights() {
    presetRow.querySelectorAll('.preset-btn[data-pidx]').forEach(btn => {
      const p = type.presets[Number(btn.dataset.pidx)]
      btn.classList.toggle('on', !!p && presetMatchesConfig(p.values, state.config, defaults))
    })
  }

  function repaintPresets() {
    presetRow.replaceChildren()
    type.presets.forEach((p, idx) => {
      const item = el('div', { class: 'preset-item' })
      const btn = el('button', { type: 'button', class: 'preset-btn', text: p.name })
      btn.dataset.pidx = String(idx)
      btn.addEventListener('click', () => {
        // 预设是一份完整配置：先回默认值再套用，保证与预设严格一致（高亮才准）。
        Object.assign(state.config, type.defaultConfig(), JSON.parse(JSON.stringify(p.values)))
        paintFields()
        updateHighlights()
        onChange()
      })
      item.appendChild(btn)
      const del = el('button', { type: 'button', class: 'preset-del', text: '×', title: '删除预设' })
      del.addEventListener('click', () => {
        if (!confirm(`删除预设「${p.name}」？`)) return
        onDeletePreset(type, p)
        repaintPresets()
      })
      item.appendChild(del)
      presetRow.appendChild(item)
    })
    const saveBtn = el('button', { type: 'button', class: 'preset-btn save-preset', text: '+ 存为预设' })
    saveBtn.addEventListener('click', () => {
      const name = (prompt('给这份配置起个名字：', `${type.name} 预设 ${type.presets.length + 1}`) || '').trim()
      if (!name) return
      const result = onSavePreset(type, state.config, name)
      if (!result) return
      repaintPresets()
      alert(result.persisted
        ? `已固化为预设「${name}」，刷新后仍可用`
        : `已固化为预设「${name}」（本地文件模式下仅本页有效）`)
    })
    presetRow.appendChild(saveBtn)
    updateHighlights()
  }
  body.appendChild(presetRow)

  const fieldsBox = el('div')
  function paintFields() {
    fieldsBox.replaceChildren(renderFields(type, state.config, () => {
      updateHighlights()
      onChange()
    }))
  }
  paintFields()
  body.appendChild(fieldsBox)

  repaintPresets()

  block.appendChild(body)
  body.style.display = state.selected ? '' : 'none'
  return block
}
