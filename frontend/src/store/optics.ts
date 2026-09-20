import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type GroupId = 'A' | 'B'

// 牛顿环扫描范围（米），与径向光强分布一一对应
export const NEWTON_R_MAX = 5e-3

export interface RingRecord {
  id: number
  name: string
  group: GroupId
  order: number        // 暗环圈序 n（从中心向外第 n 圈）
  radius: number       // 暗环半径 r，单位 mm
  wavelength: number   // 记录时的波长快照，单位 nm
  radiusOfCurvature: number // 由 r 与 n 反推的曲率半径 R
}

export interface RingProbe {
  order: number
  radius: number // mm
}

export const useOpticsStore = defineStore('optics', () => {
  const currentExperiment = ref('double')
  const params = ref({ wavelength: 550, slitWidth: 50, slitSeparation: 200, screenDistance: 1000 })
  const intensityData = ref<number[]>([])
  const result = ref<{ fringe?: number; centralWidth?: number }>({})

  // 牛顿环曲率半径 R（米），牛顿环实验专用参数
  const newtonR = ref(1.0)
  // 两组测量记录（切换实验后仍保留）
  const ringRecords = ref<RingRecord[]>([])
  const notice = ref('')
  let nextId = 1

  function setExperiment(id: string) { currentExperiment.value = id; compute() }

  // 牛顿环径向光强（与 compute 中牛顿环分支保持同一公式，二维同心环与一维分布共用）
  // 反射光干涉：I = 0.5(1 - cos(2π r²/(λR)))，中心为暗斑，第 n 圈暗环 rₙ = √(nλR)
  function newtonIntensity(rM: number, wavelengthNm: number = params.value.wavelength, R: number = newtonR.value): number {
    const lambda = wavelengthNm * 1e-9
    const phi = 2 * Math.PI * rM * rM / (lambda * R)
    return Math.max(0, 0.5 * (1 - Math.cos(phi)))
  }

  // 数值寻找 [0, NEWTON_R_MAX] 内的暗环（光强局部极小），返回半径(mm)与圈序
  const darkRings = computed<{ order: number; radius: number }[]>(() => {
    const N = 4000
    const step = NEWTON_R_MAX / N
    const rings: { order: number; radius: number }[] = []
    let order = 0
    let vv = newtonIntensity(0)
    let prev = newtonIntensity(step)
    for (let i = 2; i <= N; i++) {
      const r = i * step
      const v = newtonIntensity(r)
      if (prev <= vv && prev <= v && prev < 0.02) {
        // prev（位于 (i-1)·step）为局部极小且足够暗 => 暗环；三点抛物线细化位置
        const denom = vv - 2 * prev + v
        const delta = denom !== 0 ? 0.5 * (vv - v) / denom : 0
        order += 1
        rings.push({ order, radius: ((i - 1 + delta) * step) * 1e3 })
      }
      vv = prev
      prev = v
    }
    return rings
  })

  // 由暗环圈序与半径反推曲率半径：rₙ² = n λ R => R = rₙ²/(nλ)
  function inferCurvature(order: number, radiusMm: number, wavelengthNm: number): number {
    const r = radiusMm * 1e-3
    const lambda = wavelengthNm * 1e-9
    return r * r / (order * lambda)
  }

  // 在点击半径处探测暗环；未选中 / 越界时返回 null 并给出原因
  function probeRing(radiusMm: number): { ok: boolean; reason?: string; ring?: RingProbe } {
    if (!Number.isFinite(radiusMm) || radiusMm < 0) {
      notice.value = '未选中暗环：请在同心环的暗环（黑色圆环）上取点'
      return { ok: false, reason: notice.value }
    }
    if (radiusMm > NEWTON_R_MAX * 1e3) {
      notice.value = `选点越界：测量范围仅限半径 ${(NEWTON_R_MAX * 1e3).toFixed(1)} mm 以内的同心环区域`
      return { ok: false, reason: notice.value }
    }
    const rings = darkRings.value
    if (!rings.length) {
      notice.value = '未选中暗环：当前参数下范围内没有可识别的暗环'
      return { ok: false, reason: notice.value }
    }
    let nearest = rings[0]
    let best = Math.abs(rings[0].radius - radiusMm)
    for (const ring of rings) {
      const d = Math.abs(ring.radius - radiusMm)
      if (d < best) { best = d; nearest = ring }
    }
    // 容许偏差按内、外两侧分别取相邻环间距的 45%；第一环内侧按到中心距离计，
    // 因此点在环间分界线附近（两环正中间）必然判为“未选中”
    const inner = nearest.order > 1 ? rings[nearest.order - 2].radius : 0
    const outer = nearest.order < rings.length ? rings[nearest.order].radius : Infinity
    const innerLimit = (nearest.radius - inner) * 0.45
    const outerLimit = isFinite(outer) ? (outer - nearest.radius) * 0.45 : Infinity
    const off = radiusMm - nearest.radius
    if (off < 0 ? -off > innerLimit : off > outerLimit) {
      notice.value = `未选中暗环：取点偏离第 ${nearest.order} 圈暗环过远，请在黑色暗环上重新取点`
      return { ok: false, reason: notice.value }
    }
    return { ok: true, ring: { order: nearest.order, radius: nearest.radius } }
  }

  function addRingRecord(name: string, group: GroupId, probe: RingProbe): boolean {
    const trimmed = name.trim()
    if (!trimmed) {
      notice.value = '记录名称不能为空，请先填写名称后再记录'
      return false
    }
    if (ringRecords.value.some(rec => rec.name === trimmed)) {
      notice.value = `记录重名：“${trimmed}” 已存在，请更换名称（现有记录与现场均已保留）`
      return false
    }
    const record: RingRecord = {
      id: nextId++,
      name: trimmed,
      group,
      order: probe.order,
      radius: probe.radius,
      wavelength: params.value.wavelength,
      radiusOfCurvature: inferCurvature(probe.order, probe.radius, params.value.wavelength),
    }
    ringRecords.value.push(record)
    notice.value = `已记录 ${group === 'A' ? '甲' : '乙'}组“${trimmed}”：第 ${probe.order} 圈暗环，r = ${probe.radius.toFixed(3)} mm`
    return true
  }

  function removeRingRecord(id: number) {
    const idx = ringRecords.value.findIndex(rec => rec.id === id)
    if (idx >= 0) ringRecords.value.splice(idx, 1)
  }

  function clearGroup(group: GroupId) {
    ringRecords.value = ringRecords.value.filter(rec => rec.group !== group)
  }

  const sortedRecords = computed(() =>
    [...ringRecords.value].sort((a, b) => a.radius - b.radius || a.order - b.order),
  )

  function recordsOf(group: GroupId) {
    return sortedRecords.value.filter(rec => rec.group === group)
  }

  // 对一组记录做 r_i² = λ_i R · n_i 的过原点最小二乘拟合，得到组曲率半径
  function fitCurvature(group: GroupId): number | null {
    const recs = ringRecords.value.filter(rec => rec.group === group)
    if (!recs.length) return null
    let sx = 0, sy = 0
    for (const rec of recs) {
      const lambda = rec.wavelength * 1e-9
      const x = lambda * rec.order // r² = R · x
      const y = (rec.radius * 1e-3) ** 2
      sx += x * x
      sy += x * y
    }
    return sx > 0 ? sy / sx : null
  }

  // 两组都出现过的暗环圈序，按当前图样的半径排序后供对照选择
  const comparisonOrders = computed(() => {
    const a = new Set(ringRecords.value.filter(r => r.group === 'A').map(r => r.order))
    const b = new Set(ringRecords.value.filter(r => r.group === 'B').map(r => r.order))
    return darkRings.value.filter(ring => a.has(ring.order) && b.has(ring.order))
  })

  function clearNotice() { notice.value = '' }

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
      result.value.fringe = Math.round(lambda * LM / dM * 1e3 * 100) / 100
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const delta = Math.PI * dM * x / (lambda * LM)
        const beta = Math.PI * aM * x / (lambda * LM) || 1e-10
        const single = Math.sin(beta) / beta
        const intensity = Math.cos(delta) ** 2 * single ** 2
        data.push(Math.max(0, intensity))
      }
    } else if (currentExperiment.value === 'single') {
      result.value.centralWidth = Math.round(2 * lambda * LM / aM * 1e3 * 100) / 100
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const beta = Math.PI * aM * x / (lambda * LM) || 1e-10
        const intensity = (Math.sin(beta) / beta) ** 2
        data.push(Math.max(0, intensity))
      }
    } else { // newton
      for (let i = 0; i < N; i++) {
        const r = (i / N) * NEWTON_R_MAX
        data.push(newtonIntensity(r))
      }
    }

    intensityData.value = data
  }

  return {
    currentExperiment, params, intensityData, result,
    newtonR, ringRecords, notice, darkRings, sortedRecords, comparisonOrders,
    setExperiment, compute, newtonIntensity, probeRing, addRingRecord,
    removeRingRecord, clearGroup, recordsOf, fitCurvature, clearNotice,
  }
})
