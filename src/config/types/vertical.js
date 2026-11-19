import { randInt } from '../../engine/random.js'

// ── 题型模块：数学竖式题 ──────────────────────────────────────
// 只给横式，算式下方留出空白由孩子自己列竖式；不画任何对齐竖框。

const fields = [
  { key: 'count', label: '题目数量', type: 'number', default: 10, min: 1, max: 50 },
  { key: 'columns', label: '每行几列', type: 'number', default: 2, min: 1, max: 4 },
  { key: 'ops', label: '运算', type: 'checks',
    default: ['add', 'sub'],
    options: [
      { value: 'add', label: '加法 ＋' },
      { value: 'sub', label: '减法 －' }
    ] },
  { key: 'range', label: '数值范围', type: 'rangePair', default: [50, 200] },
  { key: 'blankLines', label: '算式下留空行数', type: 'number', default: 3, min: 1, max: 6 },
  { key: 'noNegative', label: '减法不出负数', type: 'check', default: true },
  { key: 'fullPage', label: '独占一页并自动填满', type: 'check', default: false }
]

const presets = [
  {
    name: "20 道加减",
    values: {
      count: 20,
      ops: ["add", "sub"],
      range: [50, 200],
      noNegative: true,
      blankLines: 3,
      columns: 4,
      fullPage: true,
    },
  },
  {
    name: "12 道加减",
    values: {
      count: 12,
      ops: ["add", "sub"],
      range: [50, 200],
      noNegative: true,
      blankLines: 3,
      columns: 3,
      fullPage: true,
    },
  },
];

function defaultConfig() {
  const cfg = {}
  for (const f of fields) cfg[f.key] = Array.isArray(f.default) ? [...f.default] : f.default
  return cfg
}

function generate(cfg, rng = Math.random) {
  const ops = cfg.ops.length ? cfg.ops : ['add']
  const [lo, hi] = cfg.range
  const items = []
  for (let i = 0; i < cfg.count; i++) {
    const op = ops[i % ops.length]
    let a = randInt(lo, hi, rng)
    let b = randInt(lo, hi, rng)
    if (op === 'sub' && cfg.noNegative && a < b) [a, b] = [b, a]
    const answer = op === 'add' ? a + b : a - b
    items.push({
      text: `${a} ${op === 'add' ? '+' : '−'} ${b} =`,
      answer: String(answer),
      blankLines: cfg.blankLines
    })
  }
  return items
}

export const verticalType = {
  id: 'vertical',
  name: '竖式题',
  subject: 'math',
  fields,
  presets,
  defaultConfig,
  generate
}
