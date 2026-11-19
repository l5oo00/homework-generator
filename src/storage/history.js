// 定稿记录：IndexedDB 存结构化 sheet（题目+答案+配置），保留最近 7 天。
// 存结构而非打印好的 PDF：可以随时重打印、重新看答案、导出排版 HTML，
// 浏览器端绕开打印弹框直出 PDF 反而要引大体积库、中文字体也难保真。

const DB_NAME = 'homework-generator'
const STORE = 'final-sheets'
const KEEP_MS = 7 * 24 * 60 * 60 * 1000

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function run(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req ? req.result : undefined)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('存储事务中断'))
  })
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function prune(db) {
  const cutoff = Date.now() - KEEP_MS
  await run(db, 'readwrite', store => {
    const req = store.openCursor()
    req.onsuccess = () => {
      const cur = req.result
      if (!cur) return
      if (cur.value.createdAt < cutoff) cur.delete()
      cur.continue()
    }
  })
}

// 定稿时调用；存完顺手清掉过期记录。记录带姓名，按人隔离。
export async function saveFinalSheet(person, sheet) {
  const db = await openDb()
  const record = { id: makeId(), person, createdAt: Date.now(), sheet }
  await run(db, 'readwrite', store => store.put(record))
  await prune(db)
  return record.id
}

// 列出某个人 7 天内的定稿记录，最新在前。无主人（旧数据）记录不返回。
export async function listFinalSheets(person) {
  const db = await openDb()
  const all = await run(db, 'readonly', store => store.getAll())
  const cutoff = Date.now() - KEEP_MS
  return all.filter(r => r.person === person && r.createdAt >= cutoff)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteFinalSheet(id) {
  const db = await openDb()
  await run(db, 'readwrite', store => store.delete(id))
}

// 删除某人的全部定稿记录（删人名时调用）。返回删除条数。
export async function deleteFinalSheetsOfPerson(person) {
  const db = await openDb()
  const all = await run(db, 'readonly', store => store.getAll())
  const ids = all.filter(r => r.person === person).map(r => r.id)
  if (ids.length) {
    await run(db, 'readwrite', store => { ids.forEach(id => store.delete(id)) })
  }
  return ids.length
}

// 名单是权威：剔除存储里名单已不存在的人（含旧数据无 person 的记录）。返回剔除条数。
export async function pruneFinalSheets(validNames) {
  const db = await openDb()
  const all = await run(db, 'readonly', store => store.getAll())
  const ids = all.filter(r => !validNames.includes(r.person)).map(r => r.id)
  if (ids.length) {
    await run(db, 'readwrite', store => { ids.forEach(id => store.delete(id)) })
  }
  return ids.length
}
