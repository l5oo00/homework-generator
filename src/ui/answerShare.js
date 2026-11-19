// 答案分享：答案编码进 URL 的 # 片段（不上传服务器、不过第三方），
// 通过「扫码 / 复制链接 / 系统分享面板」把链接送到父母手机；同一个 HTML 文件
// 检测到 #ans= 时自动切换成手机端答案查看页。答案临时、对完即弃、不打印。

import qrcode from 'qrcode-generator'
import printCss from '../styles/print.css?raw'
import { downloadText } from './download.js'

function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

function stamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

// ── 答案 <-> URL 片段 编解码 ────────────────────────────────────
// 用 UTF-8 字节 → base64url，天然支持中文题型名；fragment 不会发到服务器。
function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// 紧凑载荷：题型名:答案,答案,...|题型名:答案,...
// 题型名是中文、答案是数字，都不会与分隔符 : , | 冲突。比 JSON 短 1/3，二维码更可扫。
function encodeAnswer(sheet) {
  const text = sheet.sections
    .map(sec => `${sec.typeName}:${sec.items.map(it => it.answer).join(',')}`)
    .join('|')
  return toBase64Url(text)
}
function decodeAnswer(code) {
  const text = fromBase64Url(code)
  const groups = text.split('|').filter(Boolean).map(seg => {
    const i = seg.indexOf(':')
    if (i < 0) throw new Error('答案数据格式不正确')
    return [seg.slice(0, i), seg.slice(i + 1).split(',').map(x => x.trim())]
  })
  if (!groups.length) throw new Error('答案数据为空')
  return { t: groups }
}

// 分享链接的基础地址：优先当前页面的 协议+主机+路径（去掉 hash/query），
// 这样部署后自动就是线上地址；本地 file:// 打开时返回 null，交给 UI 提示。
function shareBaseUrl() {
  const u = new URL(window.location.href)
  if (u.protocol === 'http:' || u.protocol === 'https:') {
    return u.origin + u.pathname
  }
  return null
}

export function answerShareUrl(sheet) {
  const base = shareBaseUrl()
  if (!base) return null
  return `${base}#ans=${encodeAnswer(sheet)}`
}

// ── 手机端答案查看页 ────────────────────────────────────────────
// 返回 true 表示当前 URL 是答案链接、已渲染查看页（调用方应停止渲染工具界面）。
export function renderAnswerViewIfRequested(app) {
  const m = location.hash.match(/^#ans=(.+)$/)
  // 工具界面在大屏上限高一屏、body 不滚动；答案页要能滚动看完全部答案。
  if (!m) { document.body.classList.remove('answer-page'); return false }
  document.body.classList.add('answer-page')

  app.replaceChildren()
  const wrap = el('div', 'answer-view')
  let data
  try { data = decodeAnswer(m[1]) }
  catch (e) {
    wrap.appendChild(el('div', 'answer-view-error', '答案链接已损坏或不完整：' + e.message))
    app.appendChild(wrap)
    return true
  }

  const head = el('div', 'answer-view-head')
  head.appendChild(el('h1', null, '答案'))
  head.appendChild(el('div', 'answer-view-date', '临时答案 · 对完即可关闭本页'))
  wrap.appendChild(head)

  for (const [name, answers] of data.t) {
    const card = el('div', 'answer-view-card')
    card.appendChild(el('h2', null, name))
    const grid = el('div', 'answer-view-grid')
    answers.forEach((a, i) => {
      const cell = el('div', 'answer-view-item')
      cell.appendChild(el('span', 'k', `${i + 1}.`))
      cell.appendChild(el('span', 'v', String(a)))
      grid.appendChild(cell)
    })
    card.appendChild(grid)
    wrap.appendChild(card)
  }

  const foot = el('div', 'answer-view-foot')
  foot.appendChild(el('span', null, '本页数据全部包含在链接里，未上传到任何服务器'))
  wrap.appendChild(foot)
  app.appendChild(wrap)
  return true
}

// ── 二维码 ─────────────────────────────────────────────────────
function qrSvg(text) {
  // L 纠错：容量比 M 大，码点更少更好扫；答案链接是临时的，容错要求不高。
  const qr = qrcode(0, 'L')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  const quiet = 2
  const total = n + quiet * 2
  // 码点越多，图片同步放大，保证每格 ≥4px；题量小时也不小于 300px。
  const px = Math.max(300, Math.min(560, total * 4))
  const cells = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) cells.push(`<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${cells.join('')}</g></svg>`
}

// ── 保存题目 + 答案的自包含 HTML ────────────────────────────────
export function downloadQuestionAnswerFile(sheetsHTML) {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>作业题与答案</title>
<style>${printCss}</style>
</head>
<body>
${sheetsHTML}
</body>
</html>`
  downloadText(html, `作业题与答案_${stamp()}.html`)
}

// ── 分享面板：扫码 / 复制链接 / 系统分享 / 下载 TXT ─────────────
export function openAnswerDialog(sheet) {
  document.querySelector('.answer-dialog')?.remove()

  const mask = el('div', 'answer-dialog no-print')
  const panel = el('div', 'answer-dialog-panel')

  const head = el('div', 'answer-dialog-head')
  head.appendChild(el('h2', null, '分享答案到手机'))
  const close = el('button', 'btn subtle btn-mini', '关闭')
  close.addEventListener('click', () => mask.remove())
  head.appendChild(close)
  panel.appendChild(head)

  const url = answerShareUrl(sheet)

  // 文字版答案（下载 TXT / 系统分享兜底用）
  let allText = ''
  for (const sec of sheet.sections) {
    const lines = sec.items.map((it, k) => `${k + 1}.${it.answer}`)
    allText += `${sec.typeName}\n${lines.join('  ')}\n\n`
  }

  if (!url) {
    panel.appendChild(el('p', 'hint', '检测到你是用本地文件方式打开（file://），手机无法访问这个地址。请先部署到 GitHub Pages，用线上地址打开后再分享；或直接下载下方答案文件用微信发送。'))
  } else {
    panel.appendChild(el('p', 'hint', '答案在链接里，不上传服务器；父母扫码或复制链接即可在手机上看，对完即弃。'))
    if (url.length > 800) {
      panel.appendChild(el('p', 'hint', '题量较大、二维码较密，建议优先复制链接发送，或下载下方答案 TXT。'))
    }

    // 二维码
    const qrCard = el('div', 'qr-card qr-main')
    qrCard.appendChild(el('h3', null, '① 手机相机扫一扫'))
    const qrBox = el('div', 'qr-box')
    qrBox.innerHTML = qrSvg(url)
    qrCard.appendChild(qrBox)
    panel.appendChild(qrCard)

    // 链接 + 复制
    const linkCard = el('div', 'share-card')
    linkCard.appendChild(el('h3', null, '② 或复制链接，粘贴到微信发给自己'))
    const linkRow = el('div', 'link-row')
    const input = document.createElement('input')
    input.type = 'text'
    input.readOnly = true
    input.value = url
    input.addEventListener('focus', () => input.select())
    linkRow.appendChild(input)
    const copyBtn = el('button', 'btn ghost btn-mini', '复制')
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url)
        copyBtn.textContent = '已复制'
        setTimeout(() => { copyBtn.textContent = '复制' }, 1500)
      } catch {
        input.select()
        document.execCommand('copy')
        copyBtn.textContent = '已复制'
        setTimeout(() => { copyBtn.textContent = '复制' }, 1500)
      }
    })
    linkRow.appendChild(copyBtn)
    linkCard.appendChild(linkRow)
    panel.appendChild(linkCard)

    // 系统分享面板（Windows/Safari 可用，能调起系统里安装的应用）
    if (navigator.share) {
      const sysCard = el('div', 'share-card')
      sysCard.appendChild(el('h3', null, '③ 或调起系统分享面板'))
      const sysBtn = el('button', 'btn ghost btn-mini', '用其他应用分享…')
      sysBtn.addEventListener('click', async () => {
        try {
          await navigator.share({ title: '作业答案', text: '今天的作业答案', url })
        } catch (e) {
          if (e.name !== 'AbortError') alert('系统分享失败：' + e.message)
        }
      })
      sysCard.appendChild(sysBtn)
      sysCard.appendChild(el('span', 'hint', '  （受浏览器和系统支持限制，可能无法直接分享到微信）'))
      panel.appendChild(sysCard)
    }
  }

  const foot = el('div', 'answer-dialog-foot')
  const dlTxt = el('button', 'btn ghost btn-mini', '下载答案 TXT')
  dlTxt.addEventListener('click', () => downloadText(allText.trim(), `答案_${stamp()}.txt`))
  foot.appendChild(dlTxt)
  foot.appendChild(el('span', 'hint', '需要留档可在「历史记录」中导出 HTML'))
  panel.appendChild(foot)

  mask.appendChild(panel)
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove() })
  document.body.appendChild(mask)
}
