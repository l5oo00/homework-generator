// 返回 [min, max] 闭区间内的随机整数
export function randInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function shuffled(arr, rng = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
