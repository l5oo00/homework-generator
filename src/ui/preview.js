// 把引擎输出渲染成可打印的多页：普通题型顺次排版，独占题型各自一张 A4，答案最后一张。

function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

// 标题由调用方传入：题目页 / 答案页共用同一套页眉，只留做题后手填的「用时」。
function sheetHead(title) {
  const head = el('div', 'sheet-head')
  head.appendChild(el('div', 'sheet-title', title))
  const meta = el('div', 'sheet-meta')
  meta.appendChild(el('span', null, '用时：____________'))
  head.appendChild(meta)
  return head
}

// 「姓名 科目 课后练习题(日期)」，答案页在末尾追加「答案」。
export function sheetTitle(sheet) {
  const base = `${sheet.person} ${sheet.subjectName} 课后练习题(${sheet.date})`
  return base
}

function renderQuestionSection(sec, sheet) {
  const box = el('div', 'q-section')
  box.appendChild(el('div', 'q-section-title', sec.typeName))

  // 独占页时行数由题量和列数推导，行高交给 CSS 的 1fr 均分填满整页。
  const fullPage = !!sec.config.fullPage
  const rows = Math.ceil(sec.items.length / sec.config.columns)

  if (sec.typeId === 'vertical') {
    const grid = el('div', 'v-grid')
    grid.style.gridTemplateColumns = `repeat(${sec.config.columns}, 1fr)`
    grid.style.fontSize = sheet.fontSize + 'pt'
    if (fullPage) {
      grid.classList.add('fill-grid')
      grid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`
    }
    sec.items.forEach((item, i) => {
      const cell = el('div', 'v-item')
      const expr = el('div', 'v-expr')
      expr.appendChild(el('span', 'idx', `${i + 1}.`))
      expr.appendChild(document.createTextNode(item.text))
      cell.appendChild(expr)
      for (let k = 0; k < item.blankLines; k++) cell.appendChild(el('div', 'v-blank'))
      grid.appendChild(cell)
    })
    box.appendChild(grid)
  } else {
    const grid = el('div', 'q-grid')
    grid.style.gridTemplateColumns = `repeat(${sec.config.columns}, 1fr)`
    grid.style.fontSize = sheet.fontSize + 'pt'
    if (fullPage) {
      grid.classList.add('fill-grid')
      grid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`
    }
    sec.items.forEach((item, i) => {
      const cell = el('div', 'q-item')
      cell.appendChild(el('span', 'idx', `${i + 1}.`))
      cell.appendChild(document.createTextNode(item.text))
      grid.appendChild(cell)
    })
    box.appendChild(grid)
  }
  return box
}

function renderAnswerSection(sec) {
  const box = el('div', 'answer-section')
  box.appendChild(el('div', 'answer-section-title', sec.typeName))
  const grid = el('div', 'answer-grid')
  sec.items.forEach((item, i) => {
    const cell = el('div', 'ans-item')
    cell.appendChild(el('span', 'k', `${i + 1}.`))
    cell.appendChild(document.createTextNode(item.answer))
    grid.appendChild(cell)
  })
  box.appendChild(grid)
  return box
}

// includeAnswers：屏幕预览传 false 只显示题目页；留档导出用默认 true 保留答案页。
export function renderSheets(sheet, includeAnswers = true) {
  const frag = document.createDocumentFragment()
  let current = null

  // 独占题型各自一张纸；其余题型顺次排进同一张纸。
  for (const sec of sheet.sections) {
    if (sec.config.fullPage) {
      if (current) { frag.appendChild(current); current = null }
      const page = el('div', 'sheet full-page-sheet')
      page.appendChild(sheetHead(sheetTitle(sheet)))
      page.appendChild(renderQuestionSection(sec, sheet))
      frag.appendChild(page)
    } else {
      if (!current) {
        current = el('div', 'sheet')
        current.appendChild(sheetHead(sheetTitle(sheet)))
      }
      current.appendChild(renderQuestionSection(sec, sheet))
    }
  }
  if (current) frag.appendChild(current)

  if (includeAnswers) {
    const answerSheet = el('div', 'sheet answer-sheet')
    answerSheet.appendChild(sheetHead(sheetTitle(sheet) + ' 答案'))
    sheet.sections.forEach(sec => answerSheet.appendChild(renderAnswerSection(sec)))
    frag.appendChild(answerSheet)
  }

  return frag
}
