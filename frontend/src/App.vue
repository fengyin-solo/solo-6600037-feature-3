<template>
  <div class="min-h-screen bg-slate-900 text-slate-200">
    <header class="border-b border-slate-700 px-6 py-4">
      <h1 class="text-2xl font-bold text-cyan-400">光学干涉衍射仿真实验台</h1>
      <p class="text-sm text-slate-500 mt-1">双缝干涉 · 单缝衍射 · 牛顿环 · 波长调节 · 光强热力图 · 暗环半径测量对照</p>
    </header>
    <div class="flex flex-col lg:flex-row gap-4 p-4">
      <div class="lg:w-1/4 space-y-4">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">实验类型</h3>
          <div class="space-y-1">
            <button v-for="exp in experiments" :key="exp.id" @click="store.setExperiment(exp.id)"
              :class="['w-full text-left p-2 rounded border text-sm transition-all', store.currentExperiment === exp.id ? 'border-cyan-500 bg-cyan-900/30 text-cyan-400' : 'border-slate-700 text-slate-300 hover:border-slate-500']">
              {{ exp.name }}
            </button>
          </div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
          <h3 class="text-sm font-bold text-slate-400">参数调节</h3>
          <div>
            <label class="text-xs text-slate-500">波长 λ = {{ store.params.wavelength }} nm</label>
            <input type="range" min="380" max="780" step="5" v-model.number="store.params.wavelength" @input="store.compute" class="w-full accent-cyan-500" />
            <div class="flex justify-between text-xs mt-0.5">
              <span style="color:#8b5cf6">380</span><span style="color:#06b6d4">500</span><span style="color:#22c55e">550</span><span style="color:#eab308">600</span><span style="color:#dc2626">780</span>
            </div>
          </div>
          <div v-if="store.currentExperiment !== 'newton'">
            <label class="text-xs text-slate-500">缝宽/间距 d = {{ store.params.slitWidth }} μm</label>
            <input type="range" min="10" max="200" step="5" v-model.number="store.params.slitWidth" @input="store.compute" class="w-full accent-purple-500" />
          </div>
          <div v-if="store.currentExperiment === 'double'">
            <label class="text-xs text-slate-500">缝间距 D = {{ store.params.slitSeparation }} μm</label>
            <input type="range" min="50" max="500" step="10" v-model.number="store.params.slitSeparation" @input="store.compute" class="w-full accent-green-500" />
          </div>
          <div>
            <label class="text-xs text-slate-500">屏幕距离 L = {{ store.params.screenDistance }} mm</label>
            <input type="range" min="100" max="2000" step="50" v-model.number="store.params.screenDistance" @input="store.compute" class="w-full accent-orange-500" />
          </div>
          <div v-if="store.currentExperiment === 'newton'">
            <label class="text-xs text-slate-500">透镜曲率半径 R₀ = {{ store.newtonR.toFixed(2) }} m</label>
            <input type="range" min="0.5" max="2" step="0.05" v-model.number="store.newtonR" @input="store.compute" class="w-full accent-yellow-500" />
            <div class="flex justify-between text-xs text-slate-600 mt-0.5"><span>0.5</span><span>2.0</span></div>
          </div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700 text-sm">
          <h3 class="text-sm font-bold text-slate-400 mb-3">理论公式</h3>
          <div class="space-y-2 text-xs text-slate-400">
            <div v-if="store.currentExperiment === 'double'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">双缝干涉</div>
              <div>亮纹: y = kλL/d (k=0,±1,±2...)</div>
              <div>条纹间距: Δy = λL/d</div>
              <div class="text-yellow-400 mt-1">Δy = {{ store.result.fringe?.toFixed(2) }} mm</div>
            </div>
            <div v-if="store.currentExperiment === 'single'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">单缝衍射</div>
              <div>暗纹: a·sinθ = kλ</div>
              <div>中央亮纹宽: 2λL/a</div>
              <div class="text-yellow-400 mt-1">中央宽 = {{ store.result.centralWidth?.toFixed(2) }} mm</div>
            </div>
            <div v-if="store.currentExperiment === 'newton'" class="bg-slate-900 rounded p-2">
              <div class="text-cyan-400 font-bold">牛顿环</div>
              <div>暗环半径: rₙ = √(nλR)</div>
              <div>反推曲率: R = rₙ²/(nλ)</div>
              <div>反射光中心为暗斑，暗环自中心向外依次为第 1、2…圈</div>
            </div>
          </div>
        </div>
      </div>
      <div class="lg:w-3/4 space-y-4">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">干涉/衍射图样</h3>
          <canvas ref="patternRef" class="w-full rounded" style="height: 200px; background: black;"></canvas>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">光强分布曲线</h3>
          <canvas ref="intensityRef" class="w-full rounded" style="height: 200px; background: #0f172a;"></canvas>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">2D 热力图</h3>
          <canvas ref="heatmapRef" class="w-full rounded" style="height: 200px; background: black;"></canvas>
        </div>

        <!-- 牛顿环暗环测量与对照 -->
        <div v-if="store.currentExperiment === 'newton'" class="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
          <h3 class="text-sm font-bold text-cyan-400">牛顿环暗环半径测量与对照</h3>

          <!-- 提示条：未选中 / 越界 / 重名时保留现场并说明原因 -->
          <transition name="fade">
            <div v-if="store.notice" :class="['rounded px-3 py-2 text-xs flex justify-between items-start gap-2', noticeKind === 'error' ? 'bg-red-900/40 border border-red-700 text-red-300' : 'bg-emerald-900/30 border border-emerald-700 text-emerald-300']">
              <span>{{ store.notice }}</span>
              <button @click="store.clearNotice()" class="text-slate-400 hover:text-slate-200 shrink-0">✕</button>
            </div>
          </transition>

          <div class="grid md:grid-cols-2 gap-4">
            <!-- 同心环取点 -->
            <div>
              <div class="text-xs text-slate-400 mb-2">
                在同心环图样中点击某一圈<span class="text-slate-200">暗环（黑色圆环）</span>取点，范围半径 ≤ {{ (NEWTON_R_MAX * 1e3).toFixed(1) }} mm
              </div>
              <div class="relative mx-auto" style="max-width: 440px;">
                <canvas ref="ringCanvasRef" @click="onRingClick"
                  class="w-full aspect-square rounded cursor-crosshair block"
                  style="background: black;"></canvas>
              </div>
              <div class="flex flex-wrap gap-3 text-[11px] text-slate-400 mt-2">
                <span class="flex items-center gap-1"><i class="w-3 h-3 rounded-full inline-block" style="background:#22d3ee"></i>待记录取点</span>
                <span class="flex items-center gap-1"><i class="w-3 h-3 rounded-full inline-block" style="background:#f87171"></i>甲组暗环</span>
                <span class="flex items-center gap-1"><i class="w-3 h-3 rounded-full inline-block" style="background:#60a5fa"></i>乙组暗环</span>
              </div>
            </div>

            <!-- 记录操作 -->
            <div class="space-y-3">
              <div class="bg-slate-900 rounded p-3 border border-slate-700">
                <div class="text-xs text-slate-400 mb-2">当前选中</div>
                <template v-if="pending">
                  <div class="text-sm text-cyan-300">第 {{ pending.order }} 圈暗环</div>
                  <div class="text-xs text-slate-400 mt-1">
                    半径 r = <span class="text-slate-200">{{ pending.radius.toFixed(3) }} mm</span> ·
                    λ = {{ store.params.wavelength }} nm
                  </div>
                  <div class="text-xs text-slate-400">
                    反推曲率半径 R = <span class="text-yellow-400">{{ inferredR.toFixed(3) }} m</span>
                  </div>
                </template>
                <div v-else class="text-xs text-slate-500">尚未选中暗环，请在左侧同心环上取点</div>
              </div>

              <div class="flex gap-2">
                <button v-for="g in (['A','B'] as const)" :key="g" @click="activeGroup = g"
                  :class="['flex-1 p-2 rounded border text-sm', activeGroup === g ? (g === 'A' ? 'border-red-500 bg-red-900/30 text-red-300' : 'border-blue-500 bg-blue-900/30 text-blue-300') : 'border-slate-700 text-slate-400 hover:border-slate-500']">
                  {{ g === 'A' ? '甲组' : '乙组' }}
                </button>
              </div>
              <div>
                <label class="text-xs text-slate-500">记录名称（同名不可重复）</label>
                <input v-model="recordName" type="text" maxlength="20"
                  class="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:border-cyan-500 outline-none"
                  placeholder="例如：甲-1" />
              </div>
              <button @click="confirmRecord"
                class="w-full py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="!pending">
                记录曲率半径到{{ activeGroup === 'A' ? '甲' : '乙' }}组
              </button>
              <div class="text-[11px] text-slate-500 leading-relaxed">
                未点中暗环、取点超出同心环范围或名称为空 / 重名时，不会清除当前取点与已有记录，并会给出原因。
              </div>
            </div>
          </div>

          <!-- 两组记录表（按半径排序） -->
          <div class="grid md:grid-cols-2 gap-4">
            <div v-for="g in (['A','B'] as const)" :key="g">
              <div class="flex justify-between items-center mb-2">
                <h4 :class="['text-xs font-bold', g === 'A' ? 'text-red-400' : 'text-blue-400']">
                  {{ g === 'A' ? '甲组' : '乙组' }}测量记录（按 r 升序）
                </h4>
                <button v-if="store.recordsOf(g).length" @click="store.clearGroup(g)"
                  class="text-[11px] text-slate-500 hover:text-red-400">清空本组</button>
              </div>
              <div class="overflow-x-auto rounded border border-slate-700">
                <table class="w-full text-xs">
                  <thead class="bg-slate-900 text-slate-500">
                    <tr>
                      <th class="px-2 py-1.5 text-left">名称</th>
                      <th class="px-2 py-1.5 text-right">圈序 n</th>
                      <th class="px-2 py-1.5 text-right">r (mm)</th>
                      <th class="px-2 py-1.5 text-right">λ (nm)</th>
                      <th class="px-2 py-1.5 text-right">R (m)</th>
                      <th class="px-1 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="rec in store.recordsOf(g)" :key="rec.id"
                      :class="comparisonOrder === rec.order ? 'bg-cyan-900/20' : ''">
                      <td class="px-2 py-1.5 text-slate-300">{{ rec.name }}</td>
                      <td class="px-2 py-1.5 text-right text-slate-400">{{ rec.order }}</td>
                      <td class="px-2 py-1.5 text-right text-slate-200">{{ rec.radius.toFixed(3) }}</td>
                      <td class="px-2 py-1.5 text-right text-slate-500">{{ rec.wavelength }}</td>
                      <td class="px-2 py-1.5 text-right text-yellow-400">{{ rec.radiusOfCurvature.toFixed(3) }}</td>
                      <td class="px-1 py-1.5 text-right">
                        <button @click="store.removeRingRecord(rec.id)" class="text-slate-600 hover:text-red-400">✕</button>
                      </td>
                    </tr>
                    <tr v-if="!store.recordsOf(g).length">
                      <td colspan="6" class="px-2 py-3 text-center text-slate-600">暂无记录</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="text-[11px] text-slate-500 mt-1">
                组合拟合 R<sub>{{ g === 'A' ? '甲' : '乙' }}</sub> =
                <span class="text-yellow-400">{{ store.fitCurvature(g)?.toFixed(3) ?? '—' }}</span> m
                （对 r² = nλR 过原点最小二乘）
              </div>
            </div>
          </div>

          <!-- 定位某一圈进行两组对照 -->
          <div class="bg-slate-900 rounded p-3 border border-slate-700">
            <div class="flex flex-wrap items-center gap-3">
              <h4 class="text-xs font-bold text-slate-300">按半径排序后定位暗环圈序进行两组对照：</h4>
              <select v-model.number="comparisonOrder"
                class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs outline-none focus:border-cyan-500">
                <option :value="null" disabled>选择圈序 n…</option>
                <option v-for="ring in store.comparisonOrders" :key="ring.order" :value="ring.order">
                  第 {{ ring.order }} 圈（当前 r ≈ {{ ring.radius.toFixed(3) }} mm）
                </option>
              </select>
            </div>
            <div v-if="comparisonRows" class="grid md:grid-cols-2 gap-3 mt-3">
              <div v-for="row in comparisonRows" :key="row.group"
                :class="['rounded p-3 border', row.group === 'A' ? 'border-red-800 bg-red-900/10' : 'border-blue-800 bg-blue-900/10']">
                <div :class="['text-xs font-bold mb-1', row.group === 'A' ? 'text-red-400' : 'text-blue-400']">
                  {{ row.group === 'A' ? '甲组' : '乙组' }} · 第 {{ comparisonOrder }} 圈
                </div>
                <template v-if="row.rec">
                  <div class="text-xs text-slate-400">记录：<span class="text-slate-200">{{ row.rec.name }}</span></div>
                  <div class="text-xs text-slate-400">半径 r = <span class="text-slate-200">{{ row.rec.radius.toFixed(3) }}</span> mm
                    （记录时 λ = {{ row.rec.wavelength }} nm）</div>
                  <div class="text-xs text-slate-400">曲率半径 R = <span class="text-yellow-400">{{ row.rec.radiusOfCurvature.toFixed(3) }}</span> m</div>
                </template>
                <div v-else class="text-xs text-slate-500">本组没有第 {{ comparisonOrder }} 圈的记录</div>
              </div>
            </div>
            <div v-if="comparisonRows" class="mt-3 text-xs text-slate-400 flex flex-wrap gap-x-6 gap-y-1">
              <span>ΔR = <span class="text-slate-200">{{ deltaR ?? '—' }}</span>{{ deltaR !== null ? ' m' : '' }}</span>
              <span>相对偏差 = <span class="text-slate-200">{{ relDiff ?? '—' }}</span>{{ relDiff !== null ? ' %' : '' }}</span>
              <span>Δr = <span class="text-slate-200">{{ deltaRr ?? '—' }}</span>{{ deltaRr !== null ? ' mm' : '' }}</span>
            </div>
            <div v-if="!store.comparisonOrders.length" class="text-[11px] text-slate-600 mt-2">
              甲、乙两组都记录了同一圈序的暗环后，方可在此定位该圈进行对照。
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useOpticsStore, NEWTON_R_MAX, type GroupId, type RingProbe } from './store/optics'

const store = useOpticsStore()
const patternRef = ref<HTMLCanvasElement | null>(null)
const intensityRef = ref<HTMLCanvasElement | null>(null)
const heatmapRef = ref<HTMLCanvasElement | null>(null)
const ringCanvasRef = ref<HTMLCanvasElement | null>(null)

const experiments = [
  { id: 'double', name: '双缝干涉 (Young实验)' },
  { id: 'single', name: '单缝衍射 (Fraunhofer)' },
  { id: 'newton', name: '牛顿环干涉' },
]

// ---- 牛顿环取点 / 记录 / 对照的本地状态（切回牛顿环时记录仍在 store 中） ----
const pending = ref<RingProbe | null>(null)
const activeGroup = ref<GroupId>('A')
const recordName = ref('')
const comparisonOrder = ref<number | null>(null)

const noticeKind = computed(() => /已记录/.test(store.notice) ? 'ok' : 'error')

const inferredR = computed(() => {
  if (!pending.value) return NaN
  const r = pending.value.radius * 1e-3
  const lambda = store.params.wavelength * 1e-9
  return r * r / (pending.value.order * lambda)
})

function suggestName(group: GroupId) {
  const n = store.recordsOf(group).length + 1
  return `${group === 'A' ? '甲' : '乙'}-${n}`
}

function onRingClick(e: MouseEvent) {
  const canvas = ringCanvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const cx = rect.width / 2, cy = rect.height / 2
  const px = (e.clientX - rect.left) - cx
  const py = (e.clientY - rect.top) - cy
  const rPx = Math.hypot(px, py)
  const pxPerMm = cx / (NEWTON_R_MAX * 1e3)
  const radiusMm = rPx / pxPerMm

  const res = store.probeRing(radiusMm)
  if (res.ok && res.ring) {
    // 选中暗环：更新待记录点，保留当前名称输入
    pending.value = { order: res.ring.order, radius: res.ring.radius }
  }
  // 未选中 / 越界：pending 现场保留不动，store.notice 已说明原因
  drawRings()
}

function confirmRecord() {
  if (!pending.value) {
    store.probeRing(-1) // 触发“未选中暗环”提示，现场保留
    return
  }
  const ok = store.addRingRecord(recordName.value || suggestName(activeGroup.value), activeGroup.value, pending.value)
  if (ok) {
    recordName.value = suggestName(activeGroup.value)
    pending.value = null
    drawRings()
  }
  // 重名 / 空名：取点、输入与全部记录保留不动
}

const comparisonRows = computed(() => {
  if (comparisonOrder.value === null) return null
  const find = (group: GroupId) =>
    store.recordsOf(group).find(rec => rec.order === comparisonOrder.value) ?? null
  return [
    { group: 'A' as GroupId, rec: find('A') },
    { group: 'B' as GroupId, rec: find('B') },
  ]
})

const deltaR = computed<number | null>(() => {
  if (!comparisonRows.value) return null
  const a = comparisonRows.value[0].rec, b = comparisonRows.value[1].rec
  if (!a || !b) return null
  return Math.round((a.radiusOfCurvature - b.radiusOfCurvature) * 1000) / 1000
})

const relDiff = computed<number | null>(() => {
  if (!comparisonRows.value) return null
  const a = comparisonRows.value[0].rec, b = comparisonRows.value[1].rec
  if (!a || !b) return null
  const avg = (a.radiusOfCurvature + b.radiusOfCurvature) / 2
  if (avg === 0) return null
  return Math.round(Math.abs(a.radiusOfCurvature - b.radiusOfCurvature) / avg * 1000) / 10
})

const deltaRr = computed<number | null>(() => {
  if (!comparisonRows.value) return null
  const a = comparisonRows.value[0].rec, b = comparisonRows.value[1].rec
  if (!a || !b) return null
  return Math.round((a.radius - b.radius) * 1000) / 1000
})

// 同心环暗环画布：与径向光强分布共用同一光强公式
function drawRings() {
  const canvas = ringCanvasRef.value
  if (!canvas) return
  const size = Math.max(200, Math.min(440, canvas.clientWidth))
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const S = size, cx = S / 2, cy = S / 2
  const pxPerM = cx / NEWTON_R_MAX

  const img = ctx.createImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x - cx) / pxPerM
      const dy = (y - cy) / pxPerM
      const r = Math.hypot(dx, dy)
      const pos = (y * S + x) * 4
      if (r > NEWTON_R_MAX) {
        img.data[pos + 3] = 255
        continue
      }
      const intensity = Math.min(1, store.newtonIntensity(r))
      const v = Math.round(intensity * 255)
      img.data[pos] = v
      img.data[pos + 1] = v
      img.data[pos + 2] = Math.round(v * 0.9)
      img.data[pos + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // 范围边界
  ctx.strokeStyle = 'rgba(148,163,184,0.35)'
  ctx.setLineDash([4, 4]); ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(cx, cy, cx - 0.5, 0, Math.PI * 2); ctx.stroke()
  ctx.setLineDash([])

  // 暗环圈序标注（淡显，随当前参数变化，与记录快照区分）
  ctx.fillStyle = 'rgba(148,163,184,0.55)'
  ctx.font = '10px monospace'
  ctx.textAlign = 'left'
  for (const ring of store.darkRings) {
    ctx.fillText(`${ring.order}`, cx + ring.radius * pxPerM * 0.7071 + 2, cy - ring.radius * pxPerM * 0.7071 - 2)
  }

  // 已记录暗环标记（切换实验后重新进入时，按记录时的圈序与参数快照重新定位）
  for (const rec of store.ringRecords) {
    // 用记录时的波长快照 + 当时反推的 R 复原暗环半径 rₙ = √(nλR)
    const rM = Math.sqrt(rec.order * rec.wavelength * 1e-9 * rec.radiusOfCurvature)
    const rr = rM * pxPerM
    ctx.strokeStyle = rec.group === 'A' ? 'rgba(248,113,113,0.9)' : 'rgba(96,165,250,0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke()
  }

  // 待记录取点
  if (pending.value) {
    const rr = pending.value.radius * 1e-3 * pxPerM
    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx - rr, cy); ctx.lineTo(cx + rr, cy)
    ctx.moveTo(cx, cy - rr); ctx.lineTo(cx, cy + rr); ctx.stroke()
  }
}

function wavelengthToRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1.0 }
  else if (nm >= 440 && nm < 490) { g = (nm - 440) / 50; b = 1.0 }
  else if (nm >= 490 && nm < 510) { g = 1.0; b = -(nm - 510) / 20 }
  else if (nm >= 510 && nm < 580) { r = (nm - 510) / 70; g = 1.0 }
  else if (nm >= 580 && nm < 645) { r = 1.0; g = -(nm - 645) / 65 }
  else if (nm >= 645 && nm <= 780) { r = 1.0 }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function drawPattern() {
  const canvas = patternRef.value
  if (!canvas || !store.intensityData.length) return
  canvas.width = canvas.clientWidth
  canvas.height = 200
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, W, H)
  const [r, g, b] = wavelengthToRGB(store.params.wavelength)
  const data = store.intensityData
  for (let x = 0; x < W; x++) {
    const idx = Math.round(x / W * (data.length - 1))
    const intensity = data[idx] || 0
    const alpha = Math.min(1, intensity)
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.fillRect(x, 0, 1, H)
  }
}

function drawIntensity() {
  const canvas = intensityRef.value
  if (!canvas || !store.intensityData.length) return
  canvas.width = canvas.clientWidth
  canvas.height = 200
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, W, H)
  const [r, g, b] = wavelengthToRGB(store.params.wavelength)
  const data = store.intensityData
  ctx.beginPath()
  ctx.strokeStyle = `rgb(${r},${g},${b})`
  ctx.lineWidth = 2
  data.forEach((v, i) => {
    const x = i / (data.length - 1) * W
    const y = H - v * (H - 10) - 5
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
  // Fill
  ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
  ctx.lineTo(W, H); ctx.lineTo(0, H)
  ctx.closePath(); ctx.fill()
  // Axes
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace'; ctx.textAlign = 'center'
  ctx.fillText('0', W / 2, H - 2); ctx.fillText('光强 I', 30, 12); ctx.fillText('位置 x / 半径 r', W - 30, H - 2)
}

function drawHeatmap() {
  const canvas = heatmapRef.value
  if (!canvas || !store.intensityData.length) return
  canvas.width = canvas.clientWidth
  canvas.height = 200
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const [r, g, b] = wavelengthToRGB(store.params.wavelength)
  const data = store.intensityData
  const imgData = ctx.createImageData(W, H)
  for (let x = 0; x < W; x++) {
    const idx = Math.round(x / W * (data.length - 1))
    const intensity = Math.min(1, data[idx] || 0)
    for (let y = 0; y < H; y++) {
      const dist = Math.abs(y - H / 2) / (H / 2)
      const alpha = intensity * (1 - dist * 0.8) * 255
      const pos = (y * W + x) * 4
      imgData.data[pos] = r; imgData.data[pos + 1] = g; imgData.data[pos + 2] = b; imgData.data[pos + 3] = alpha
    }
  }
  ctx.putImageData(imgData, 0, 0)
}

function renderAll() { drawPattern(); drawIntensity(); drawHeatmap(); drawRings() }

watch(activeGroup, (g) => { if (!recordName.value) recordName.value = suggestName(g) })

// 参数变化（含曲率半径）：重新计算并重绘；记录按快照参数自行复原，不随当前参数漂移
watch(() => [store.params.wavelength, store.params.slitWidth, store.params.slitSeparation, store.params.screenDistance, store.newtonR, store.currentExperiment],
  () => { store.compute(); renderAll() })

watch(() => store.ringRecords, () => drawRings(), { deep: true })

onMounted(() => {
  store.compute()
  recordName.value = suggestName('A')
  nextTick(() => setTimeout(renderAll, 100))
})
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
