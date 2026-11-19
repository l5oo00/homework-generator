import { randInt, shuffled } from '../../engine/random.js'

// ── 题型模块：数学计算题（横式口算） ──────────────────────────
// 新增题型照抄这个结构即可，UI 会从 fields 自动渲染控件，引擎调 generate 出题。

// 字段描述约定：
//   type: 'number'   数字输入        key / label / default / min / max
//   type: 'select'   单选下拉        key / label / default / options:[{value,label}]
//   type: 'checks'   多选勾选        key / label / default(数组) / options:[{value,label}]
//   type: 'rangePair' 数值范围(最小/最大两个数)  key / label / default:[min,max]
const fields = [
  { key: 'count', label: '题目数量', type: 'number', default: 50, min: 1, max: 200 },
  { key: 'columns', label: '每行几列', type: 'number', default: 5, min: 1, max: 10 },
  { key: 'ops', label: '运算', type: 'checks',
    default: ['add', 'sub', 'mul'],
    options: [
      { value: 'add', label: '加法 ＋' },
      { value: 'sub', label: '减法 －' },
      { value: 'mul', label: '乘法 ×' },
      { value: 'div', label: '除法 ÷' }
    ] },
  { key: 'addSubRange', label: '加减数值范围', type: 'rangePair', default: [10, 100] },
  { key: 'mulRange', label: '乘除数值范围', type: 'rangePair', default: [1, 10] },
  { key: 'operandMode', label: '参与运算的数', type: 'select', default: 2,
    options: [ { value: 2, label: '2 个数' }, { value: 3, label: '3 个数' } ] },
  { key: 'noNegative', label: '减法不出负数', type: 'check', default: true },
  { key: 'exactDiv', label: '除法整除', type: 'check', default: true },
  { key: 'fullPage', label: '独占一页并自动填满', type: 'check', default: false }
]

// 预设：固化好的一组配置，点一下即填满上面的字段。
const presets = [
  {
    name: '100 道加减乘',
    values: { count: 100, ops: ['add', 'sub', 'mul'], addSubRange: [10, 100], mulRange: [1, 10], operandMode: 2, noNegative: true, exactDiv: true, columns: 4, fullPage: true }
  },
  {
    name: '50 道加减乘',
    values: { count: 50, ops: ['add', 'sub', 'mul'], addSubRange: [10, 100], mulRange: [1, 10], operandMode: 2, noNegative: true, exactDiv: true, columns: 4, fullPage: true }
  }
]

function defaultConfig() {
  const cfg = {}
  for (const f of fields) cfg[f.key] = Array.isArray(f.default) ? [...f.default] : f.default
  return cfg
}

// 生成：返回题目数组，每项 { text, answer }。
function generate(cfg, rng = Math.random) {
  const ops = cfg.ops.length ? cfg.ops : ['add']
  const items = []
  for (let i = 0; i < cfg.count; i++) {
    const op = ops[i % ops.length]
    let a, b, answer, text

    if (op === 'add' || op === 'sub') {
      const [lo, hi] = cfg.addSubRange
      a = randInt(lo, hi, rng)
      b = randInt(lo, hi, rng)
      if (op === 'sub' && cfg.noNegative && a < b) [a, b] = [b, a]
      answer = op === 'add' ? a + b : a - b
      text = `${a} ${op === 'add' ? '+' : '−'} ${b} =`
    } else {
      const [lo, hi] = cfg.mulRange
      a = randInt(lo, hi, rng)
      b = randInt(lo, hi, rng)
      if (op === 'mul') {
        answer = a * b
        text = `${a} × ${b} =`
      } else {
        if (cfg.exactDiv) a = a * b
        answer = a / b
        text = `${a} ÷ ${b} =`
      }
    }

    // 3 个数：在两数运算基础上再拼一个操作数，保持逐项左结合，便于口算。
    if (cfg.operandMode === 3) {
      const [lo, hi] = op === 'add' || op === 'sub' ? cfg.addSubRange : cfg.mulRange
      const c = randInt(Math.max(1, lo - 5), Math.min(hi, 12), rng)
      const sign = op === 'sub' ? '-' : op === 'mul' ? '×' : op === 'div' ? '÷' : '+'
      if (sign === '+') answer += c
      else if (sign === '-') answer -= c
      else if (sign === '×') answer *= c
      else answer = answer / c
      text = `${text.slice(0, -1)} ${sign} ${c} =`
    }
    items.push({ text, answer: formatAnswer(answer) })
  }
  return items
}

function formatAnswer(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

export const calculationType = {
  id: 'calculation',
  name: '计算题',
  subject: 'math',
  fields,
  presets,
  defaultConfig,
  generate
}
