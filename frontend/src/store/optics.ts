import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/** 牛顿环二维图样的物理显示半径（mm），圆形测量区域 */
export const NEWTON_RMAX_MM = 4
/** 判定点击位置属于暗环的光强阈值 */
const DARK_INTENSITY_LIMIT = 0.3

export interface NewtonRing {
  /** 理论暗环圈数 n（满足 r² = nλR） */
  order: number
  /** 实测半径（mm） */
  radiusMM: number
}

export interface NewtonSnapshot {
  wavelength: number
  curvatureRadius: number
  rings: NewtonRing[]
}

export interface NewtonRecord extends NewtonSnapshot {
  name: string
  createdAt: number
}

export interface MeasureMessage {
  type: 'error' | 'success' | 'info'
  text: string
}

export interface CompareRow {
  /** 按半径排序后的圈位（1 起） */
  pos: number
  a: NewtonRing
  b: NewtonRing
  deltaRMM: number
  /** 由各组自身波长反算的曲率半径（m） */
  raInferred: number
  rbInferred: number
}

const LS_RECORDS = 'optics-newton-records-v1'
const LS_DRAFT = 'optics-newton-draft-v1'

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** 反射式牛顿环径向光强：I(r) = sin²(π r² / (λR))，中心接触点为暗斑，暗环 r = √(nλR) */
export function newtonRadialIntensity(rM: number, wavelengthNM: number, R: number): number {
  const lambda = wavelengthNM * 1e-9
  return Math.max(0, Math.sin((Math.PI * rM * rM) / (lambda * R)) ** 2)
}

export const useOpticsStore = defineStore('optics', () => {
  const currentExperiment = ref('double')
  const params = ref({
    wavelength: 550,
    slitWidth: 50,
    slitSeparation: 200,
    screenDistance: 1000,
    curvatureRadius: 1.0, // 牛顿环平凸透镜曲率半径 R（m），仅牛顿环使用
  })
  const intensityData = ref<number[]>([])
  const result = ref<{ fringe?: number; centralWidth?: number }>({})

  // ---- 牛顿环暗环测量状态 ----
  const newtonDraft = ref<NewtonSnapshot | null>(loadJSON<NewtonSnapshot>(LS_DRAFT))
  const newtonRecords = ref<NewtonRecord[]>(loadJSON<NewtonRecord[]>(LS_RECORDS) ?? [])
  const viewingRecord = ref<string | null>(null)
  const compareAName = ref<string | null>(null)
  const compareBName = ref<string | null>(null)
  const comparePos = ref(1)
  const message = ref<MeasureMessage | null>(null)

  const newtonLocked = computed(
    () => currentExperiment.value === 'newton' && (!!newtonDraft.value || !!viewingRecord.value),
  )

  const sortedRecords = computed(() =>
    [...newtonRecords.value].sort((a, b) => a.createdAt - b.createdAt),
  )

  const compareRecordA = computed(() =>
    newtonRecords.value.find((r) => r.name === compareAName.value) ?? null,
  )
  const compareRecordB = computed(() =>
    newtonRecords.value.find((r) => r.name === compareBName.value) ?? null,
  )

  const compareRows = computed<CompareRow[] | null>(() => {
    const A = compareRecordA.value
    const B = compareRecordB.value
    if (!A || !B || A.name === B.name) return null
    const count = Math.min(A.rings.length, B.rings.length)
    const rows: CompareRow[] = []
    for (let k = 0; k < count; k++) {
      const a = A.rings[k]
      const b = B.rings[k]
      rows.push({
        pos: k + 1,
        a,
        b,
        deltaRMM: Math.round((b.radiusMM - a.radiusMM) * 100) / 100,
        raInferred: (a.radiusMM / 1000) ** 2 / (a.order * (A.wavelength * 1e-9)),
        rbInferred: (b.radiusMM / 1000) ** 2 / (b.order * (B.wavelength * 1e-9)),
      })
    }
    return rows
  })

  function persistRecords() {
    try {
      localStorage.setItem(LS_RECORDS, JSON.stringify(newtonRecords.value))
    } catch {
      /* 忽略持久化失败 */
    }
  }

  function persistDraft() {
    try {
      if (newtonDraft.value) localStorage.setItem(LS_DRAFT, JSON.stringify(newtonDraft.value))
      else localStorage.removeItem(LS_DRAFT)
    } catch {
      /* 忽略持久化失败 */
    }
  }

  /** 进入牛顿环实验时，把波长/R 恢复为草稿或被查看记录的快照，保证所选暗环与参数对得上 */
  function restoreNewtonParams() {
    const snap = viewingRecord.value
      ? newtonRecords.value.find((r) => r.name === viewingRecord.value)
      : newtonDraft.value
    if (snap) {
      params.value.wavelength = snap.wavelength
      params.value.curvatureRadius = snap.curvatureRadius
    }
  }

  function setExperiment(id: string) {
    currentExperiment.value = id
    if (id === 'newton') restoreNewtonParams()
    compute()
  }

  function compute() {
    const { wavelength: lam, slitWidth: a, slitSeparation: d, screenDistance: L } = params.value
    const lambda = lam * 1e-9
    const aM = a * 1e-6
    const dM = d * 1e-6
    const LM = L * 1e-3
    const N = 800
    const data: number[] = []
    const xMax = 20e-3

    if (currentExperiment.value === 'double') {
      result.value.fringe = Math.round((lambda * LM) / dM * 1e3 * 100) / 100
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const delta = (Math.PI * dM * x) / (lambda * LM)
        const beta = (Math.PI * aM * x) / (lambda * LM) || 1e-10
        const single = Math.sin(beta) / beta
        const intensity = Math.cos(delta) ** 2 * single ** 2
        data.push(Math.max(0, intensity))
      }
    } else if (currentExperiment.value === 'single') {
      result.value.centralWidth = Math.round((2 * lambda * LM) / aM * 1e3 * 100) / 100
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const beta = (Math.PI * aM * x) / (lambda * LM) || 1e-10
        const intensity = (Math.sin(beta) / beta) ** 2
        data.push(Math.max(0, intensity))
      }
    } else {
      // newton：径向光强剖面 I = sin²(πr²/(λR))，暗环 r = √(nλR)
      const R = params.value.curvatureRadius
      const rMax = NEWTON_RMAX_MM * 1e-3
      for (let i = 0; i < N; i++) {
        const r = (i / N) * rMax
        data.push(newtonRadialIntensity(r, lam, R))
      }
    }

    intensityData.value = data
  }

  /**
   * 在牛顿环同心环图样上按半径选取暗环。
   * 任一校验失败都只给出原因、不动现有选取（保留现场）。
   */
  function pickDarkRing(radiusMM: number) {
    if (currentExperiment.value !== 'newton') return
    if (viewingRecord.value) {
      message.value = {
        type: 'info',
        text: '正在查看已保存记录，不能选取暗环；请点击“返回测量”后再在图样上点击。',
      }
      return
    }
    if (compareRecordA.value && compareRecordB.value) {
      message.value = {
        type: 'info',
        text: '正在进行两组结果对照，不能选取暗环；请先取消一侧的对照记录后再测量。',
      }
      return
    }
    if (!(radiusMM >= 0) || radiusMM > NEWTON_RMAX_MM) {
      message.value = {
        type: 'error',
        text: `选点越界：有效测量范围是中央圆形区域（半径 0–${NEWTON_RMAX_MM} mm），请在同心环内点击暗环，当前选取已保留。`,
      }
      return
    }

    const snap: NewtonSnapshot = newtonDraft.value
      ? { ...newtonDraft.value, rings: [...newtonDraft.value.rings] }
      : {
          wavelength: params.value.wavelength,
          curvatureRadius: params.value.curvatureRadius,
          rings: [],
        }

    const r = radiusMM * 1e-3
    const lambda = snap.wavelength * 1e-9
    const q = (r * r) / (lambda * snap.curvatureRadius)
    const order = Math.round(q)
    const intensity = Math.sin(Math.PI * q) ** 2

    if (order < 1 || intensity >= DARK_INTENSITY_LIMIT) {
      message.value = {
        type: 'error',
        text: '未选中暗环：该点击位置不在暗环上，请在同心环图样的黑色细环中点处点击，当前选取已保留。',
      }
      return
    }
    if (snap.rings.some((ring) => ring.order === order)) {
      message.value = {
        type: 'error',
        text: `第 ${order} 圈暗环已经记录过，请勿重复选取，当前选取已保留。`,
      }
      return
    }

    snap.rings.push({ order, radiusMM: Math.round(radiusMM * 100) / 100 })
    snap.rings.sort((x, y) => x.radiusMM - y.radiusMM)
    newtonDraft.value = snap
    persistDraft()
    // 锁定到首环选取时的参数快照
    params.value.wavelength = snap.wavelength
    params.value.curvatureRadius = snap.curvatureRadius
    compute()
    message.value = {
      type: 'success',
      text: `已记录第 ${order} 圈暗环，实测半径 ${snap.rings.find((rg) => rg.order === order)!.radiusMM.toFixed(2)} mm；当前共 ${snap.rings.length} 圈（已按半径排序）。`,
    }
  }

  function removeDraftRing(order: number) {
    if (!newtonDraft.value) return
    const rings = newtonDraft.value.rings.filter((r) => r.order !== order)
    newtonDraft.value = rings.length ? { ...newtonDraft.value, rings } : null
    persistDraft()
    message.value = { type: 'info', text: `已移除第 ${order} 圈暗环。` }
  }

  function clearDraft() {
    newtonDraft.value = null
    persistDraft()
    message.value = { type: 'info', text: '已清空本次选取的暗环，参数已解锁，可重新测量。' }
  }

  /** 保存一组结果；重名或无选取时拒绝并保留现场 */
  function saveRecord(rawName: string): boolean {
    const name = rawName.trim()
    if (!name) {
      message.value = { type: 'error', text: '记录名称不能为空，请填写名称后再保存，当前选取已保留。' }
      return false
    }
    if (!newtonDraft.value || newtonDraft.value.rings.length === 0) {
      message.value = { type: 'error', text: '尚未选取任何暗环，无法保存记录。' }
      return false
    }
    if (newtonRecords.value.some((r) => r.name === name)) {
      message.value = {
        type: 'error',
        text: `记录名称“${name}”与已有记录重名，请更换名称后保存；所选暗环与参数均已保留。`,
      }
      return false
    }
    const record: NewtonRecord = {
      name,
      wavelength: newtonDraft.value.wavelength,
      curvatureRadius: newtonDraft.value.curvatureRadius,
      rings: newtonDraft.value.rings.map((r) => ({ ...r })),
      createdAt: Date.now(),
    }
    newtonRecords.value.push(record)
    persistRecords()
    newtonDraft.value = null
    persistDraft()
    viewingRecord.value = name
    restoreNewtonParams()
    compute()
    message.value = { type: 'success', text: `记录“${name}”已保存（${record.rings.length} 圈暗环）。` }
    return true
  }

  function viewRecord(name: string) {
    if (!newtonRecords.value.some((r) => r.name === name)) return
    viewingRecord.value = name
    restoreNewtonParams()
    compute()
    message.value = { type: 'info', text: `正在查看记录“${name}”，图样与参数已切换为该记录保存时的状态。` }
  }

  /** 退出查看模式，回到未完成草稿（若有）继续测量 */
  function resumeDraft() {
    viewingRecord.value = null
    restoreNewtonParams()
    compute()
    message.value = newtonDraft.value
      ? { type: 'info', text: '已返回测量，可继续选取暗环。' }
      : { type: 'info', text: '已返回测量，可在图样上点击暗环开始新的选取。' }
  }

  function deleteRecord(name: string) {
    newtonRecords.value = newtonRecords.value.filter((r) => r.name !== name)
    persistRecords()
    if (viewingRecord.value === name) {
      viewingRecord.value = null
      restoreNewtonParams()
      compute()
    }
    if (compareAName.value === name) compareAName.value = null
    if (compareBName.value === name) compareBName.value = null
    message.value = { type: 'info', text: `记录“${name}”已删除。` }
  }

  function setCompare(side: 'a' | 'b', name: string | null) {
    const other = side === 'a' ? compareBName.value : compareAName.value
    if (name && other === name) {
      message.value = { type: 'error', text: '两组对照记录不能选择同一条记录，请改选其他记录。' }
      return
    }
    if (side === 'a') compareAName.value = name
    else compareBName.value = name
    const rows = compareRows.value
    comparePos.value = Math.min(comparePos.value, rows?.length ?? 1) || 1
  }

  function setComparePos(pos: number) {
    comparePos.value = pos
  }

  return {
    currentExperiment,
    params,
    intensityData,
    result,
    // newton measurement
    newtonDraft,
    newtonRecords,
    sortedRecords,
    viewingRecord,
    compareAName,
    compareBName,
    comparePos,
    compareRecordA,
    compareRecordB,
    compareRows,
    newtonLocked,
    message,
    // actions
    setExperiment,
    compute,
    pickDarkRing,
    removeDraftRing,
    clearDraft,
    saveRecord,
    viewRecord,
    resumeDraft,
    deleteRecord,
    setCompare,
    setComparePos,
  }
})
