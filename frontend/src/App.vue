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
            <input type="range" min="380" max="780" step="5" v-model.number="store.params.wavelength"
              :disabled="slidersLocked" @input="store.compute"
              :class="['w-full accent-cyan-500', slidersLocked ? 'opacity-40 cursor-not-allowed' : '']" />
            <div class="flex justify-between text-xs mt-0.5">
              <span style="color:#8b5cf6">380</span><span style="color:#06b6d4">500</span><span style="color:#22c55e">550</span><span style="color:#eab308">600</span><span style="color:#dc2626">780</span>
            </div>
          </div>
          <div v-if="store.currentExperiment === 'newton'">
            <label class="text-xs text-slate-500">透镜曲率半径 R = {{ store.params.curvatureRadius.toFixed(2) }} m</label>
            <input type="range" min="0.5" max="3" step="0.05" v-model.number="store.params.curvatureRadius"
              :disabled="slidersLocked" @input="store.compute"
              :class="['w-full accent-amber-500', slidersLocked ? 'opacity-40 cursor-not-allowed' : '']" />
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
          <p v-if="slidersLocked" class="text-[11px] text-amber-400/90 leading-relaxed">
            已锁定波长与曲率半径：所选暗环是在当前 λ、R 下取得的，修改会使半径与参数对不上。保存、清空或结束查看后解锁。
          </p>
        </div>

        <!-- 牛顿环暗环测量与对照 -->
        <div v-if="store.currentExperiment === 'newton'" class="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-3">
          <h3 class="text-sm font-bold text-slate-400">暗环半径测量与对照</h3>

          <div v-if="store.message"
            :class="['rounded p-2 text-xs leading-relaxed border', msgClass]">
            {{ store.message.text }}
          </div>

          <!-- 模式与当前参数 -->
          <div class="text-xs space-y-1 bg-slate-900 rounded p-2">
            <div class="flex justify-between">
              <span class="text-slate-500">当前模式</span>
              <span :class="modeTagClass">{{ modeText }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">图样参数</span>
              <span class="text-slate-300">λ = {{ activeSnapshot?.wavelength ?? store.params.wavelength }} nm，R = {{ (activeSnapshot?.curvatureRadius ?? store.params.curvatureRadius).toFixed(2) }} m</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">暗环数</span>
              <span class="text-slate-300">{{ activeSnapshot?.rings.length ?? 0 }} 圈（按半径排序）</span>
            </div>
          </div>

          <!-- 测量中：本次选取 -->
          <div v-if="!store.viewingRecord" class="space-y-2">
            <div v-if="store.newtonDraft" class="space-y-1">
              <div v-for="ring in store.newtonDraft.rings" :key="ring.order"
                class="flex items-center justify-between text-xs bg-slate-900 rounded px-2 py-1">
                <span class="text-cyan-400">第 {{ ring.order }} 圈暗环</span>
                <span class="text-slate-300">r = {{ ring.radiusMM.toFixed(2) }} mm</span>
                <button @click="store.removeDraftRing(ring.order)"
                  class="text-slate-500 hover:text-red-400 text-[11px]">移除</button>
              </div>
            </div>
            <div class="flex gap-2">
              <input v-model="recordName" type="text" placeholder="为本次测量命名"
                class="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" />
              <button @click="onSave"
                class="bg-cyan-700 hover:bg-cyan-600 text-white text-xs px-3 py-1 rounded whitespace-nowrap">保存记录</button>
            </div>
            <button v-if="store.newtonDraft" @click="store.clearDraft()"
              class="w-full text-[11px] text-slate-400 hover:text-slate-200 border border-slate-700 rounded py-1">清空本次选取（解锁参数）</button>
            <p class="text-[11px] text-slate-500 leading-relaxed">
              在右侧同心环图样中点击<strong class="text-slate-300">黑色暗环</strong>即可记录该圈半径（r = √(nλR)）；点在亮环上或圆域之外会被拒绝。
            </p>
          </div>

          <!-- 查看已保存记录 -->
          <div v-else class="space-y-2">
            <div v-for="ring in viewingSnapshot!.rings" :key="ring.order"
              class="flex items-center justify-between text-xs bg-slate-900 rounded px-2 py-1">
              <span class="text-amber-400">第 {{ ring.order }} 圈暗环</span>
              <span class="text-slate-300">r = {{ ring.radiusMM.toFixed(2) }} mm</span>
            </div>
            <button @click="store.resumeDraft()"
              class="w-full bg-slate-700 hover:bg-slate-600 text-xs py-1.5 rounded">返回测量</button>
          </div>

          <!-- 已保存记录 -->
          <div v-if="store.sortedRecords.length" class="space-y-1 pt-1 border-t border-slate-700">
            <div class="text-xs text-slate-500 pt-1">已保存记录（{{ store.sortedRecords.length }} 条）</div>
            <div v-for="rec in store.sortedRecords" :key="rec.name"
              :class="['rounded px-2 py-1.5 text-xs border', store.viewingRecord === rec.name ? 'border-amber-500 bg-amber-900/20' : 'border-slate-700 bg-slate-900']">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-200 truncate">{{ rec.name }}</span>
                <span class="text-slate-500 shrink-0 ml-2">{{ rec.rings.length }} 圈</span>
              </div>
              <div class="text-slate-500 mt-0.5">λ={{ rec.wavelength }} nm · R={{ rec.curvatureRadius.toFixed(2) }} m</div>
              <div class="text-slate-500">r: {{ rec.rings[0].radiusMM.toFixed(2) }}–{{ rec.rings[rec.rings.length - 1].radiusMM.toFixed(2) }} mm</div>
              <div class="flex gap-3 mt-1">
                <button @click="store.viewRecord(rec.name)" class="text-cyan-400 hover:text-cyan-300">查看定位</button>
                <button @click="onDelete(rec.name)" class="text-red-400 hover:text-red-300">删除</button>
              </div>
            </div>
          </div>

          <!-- 两组结果对照 -->
          <div class="space-y-2 pt-2 border-t border-slate-700">
            <div class="text-xs text-slate-500 pt-1">两组结果对照</div>
            <select v-model="compareA" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs">
              <option value="">A 组：选择记录…</option>
              <option v-for="rec in store.sortedRecords" :key="rec.name" :value="rec.name">{{ rec.name }}（{{ rec.rings.length }} 圈）</option>
            </select>
            <select v-model="compareB" class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs">
              <option value="">B 组：选择记录…</option>
              <option v-for="rec in store.sortedRecords" :key="rec.name" :value="rec.name">{{ rec.name }}（{{ rec.rings.length }} 圈）</option>
            </select>

            <template v-if="store.compareRows">
              <div class="flex items-center gap-2 text-xs">
                <span class="text-slate-500 whitespace-nowrap">定位圈位</span>
                <select :value="store.comparePos" @change="onPosChange(($event.target as HTMLSelectElement).value)"
                  class="flex-1 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-xs">
                  <option v-for="row in store.compareRows" :key="row.pos" :value="row.pos">第 {{ row.pos }} 圈（n={{ row.a.order }} / n={{ row.b.order }}）</option>
                </select>
              </div>
              <div class="text-[11px] leading-relaxed bg-slate-900 rounded p-2 border border-cyan-900 text-slate-300">
                第 <span class="text-cyan-400 font-bold">{{ store.comparePos }}</span> 圈：
                A 组 r = <span class="text-cyan-400">{{ currentCompareRow?.a.radiusMM.toFixed(2) }}</span> mm，
                B 组 r = <span class="text-fuchsia-400">{{ currentCompareRow?.b.radiusMM.toFixed(2) }}</span> mm，
                差值 B−A = <span :class="(currentCompareRow?.deltaRMM ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'">{{ signed(currentCompareRow?.deltaRMM) }}</span> mm；
                反算 R：A={{ currentCompareRow?.raInferred.toFixed(3) }} m，B={{ currentCompareRow?.rbInferred.toFixed(3) }} m。
              </div>
              <table class="w-full text-[11px]">
                <thead>
                  <tr class="text-slate-500">
                    <th class="text-left font-normal py-0.5">圈位</th>
                    <th class="text-right font-normal">A r(mm)</th>
                    <th class="text-right font-normal">B r(mm)</th>
                    <th class="text-right font-normal">Δr</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in store.compareRows" :key="row.pos"
                    @click="store.setComparePos(row.pos)"
                    :class="['cursor-pointer', row.pos === store.comparePos ? 'text-cyan-300 bg-cyan-900/20' : 'text-slate-400 hover:bg-slate-700/40']">
                    <td class="py-0.5 pl-1">{{ row.pos }}</td>
                    <td class="text-right">{{ row.a.radiusMM.toFixed(2) }}</td>
                    <td class="text-right">{{ row.b.radiusMM.toFixed(2) }}</td>
                    <td class="text-right pr-1" :class="row.deltaRMM >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'">{{ signed(row.deltaRMM) }}</td>
                  </tr>
                </tbody>
              </table>
              <p class="text-[11px] text-slate-500 leading-relaxed">两组暗环均已按半径排序，同圈位即同一排序位置；点击行或下拉可在图样上定位该圈（青/品红加粗圈）。</p>
            </template>
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
              <div class="text-cyan-400 font-bold">牛顿环（反射光）</div>
              <div>暗环半径: r = √(nλR) (n=1,2,3...)</div>
              <div>光强: I(r) = sin²(πr²/(λR))</div>
              <div>R: 平凸透镜曲率半径（当前 {{ store.params.curvatureRadius.toFixed(2) }} m）</div>
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
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-slate-400">2D 热力图</h3>
            <span v-if="store.currentExperiment === 'newton'" class="text-[11px] text-slate-500">{{ heatmapHint }}</span>
          </div>
          <div class="relative">
            <canvas ref="heatmapRef"
              :class="['w-full rounded', store.currentExperiment === 'newton' ? 'cursor-crosshair' : '']"
              style="height: 200px; background: black;"
              @click="onHeatmapClick"></canvas>
            <div v-if="store.currentExperiment === 'newton'" class="absolute top-2 left-2 text-[11px] space-y-0.5 pointer-events-none">
              <template v-if="inComparison">
                <span class="bg-slate-900/70 rounded px-1.5 py-0.5 text-cyan-400 block">A：{{ store.compareRecordA?.name }}</span>
                <span class="bg-slate-900/70 rounded px-1.5 py-0.5 text-fuchsia-400 block">B：{{ store.compareRecordB?.name }}</span>
                <span class="bg-slate-900/70 rounded px-1.5 py-0.5 text-yellow-300 block">加粗：第 {{ store.comparePos }} 圈</span>
              </template>
              <template v-else-if="store.viewingRecord">
                <span class="bg-slate-900/70 rounded px-1.5 py-0.5 text-amber-400 block">查看记录：{{ store.viewingRecord }}（只读）</span>
              </template>
              <template v-else-if="store.newtonDraft">
                <span class="bg-slate-900/70 rounded px-1.5 py-0.5 text-cyan-400 block">已选 {{ store.newtonDraft.rings.length }} 圈暗环（青色标记）</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useOpticsStore, NEWTON_RMAX_MM, newtonRadialIntensity, type NewtonSnapshot } from './store/optics'

const store = useOpticsStore()
const patternRef = ref<HTMLCanvasElement | null>(null)
const intensityRef = ref<HTMLCanvasElement | null>(null)
const heatmapRef = ref<HTMLCanvasElement | null>(null)
const recordName = ref('')

const experiments = [
  { id: 'double', name: '双缝干涉 (Young实验)' },
  { id: 'single', name: '单缝衍射 (Fraunhofer)' },
  { id: 'newton', name: '牛顿环干涉' },
]

const inComparison = computed(() => !!(store.compareRecordA && store.compareRecordB))
const slidersLocked = computed(() => store.newtonLocked || inComparison.value)

const activeSnapshot = computed<NewtonSnapshot | null>(() => {
  if (inComparison.value) return store.compareRecordA
  if (store.viewingRecord) return store.sortedRecords.find((r) => r.name === store.viewingRecord) ?? null
  return store.newtonDraft
})

const viewingSnapshot = computed(() =>
  store.viewingRecord ? store.sortedRecords.find((r) => r.name === store.viewingRecord) ?? null : null,
)

const modeText = computed(() => {
  if (inComparison.value) return '两组对照'
  if (store.viewingRecord) return '查看记录（只读）'
  if (store.newtonDraft) return '测量中'
  return '待选取'
})
const modeTagClass = computed(() => {
  if (inComparison.value) return 'text-fuchsia-400'
  if (store.viewingRecord) return 'text-amber-400'
  if (store.newtonDraft) return 'text-cyan-400'
  return 'text-slate-400'
})

const msgClass = computed(() => {
  const t = store.message?.type
  if (t === 'error') return 'border-red-800 bg-red-900/30 text-red-300'
  if (t === 'success') return 'border-emerald-800 bg-emerald-900/30 text-emerald-300'
  return 'border-slate-700 bg-slate-900 text-slate-400'
})

const heatmapHint = computed(() => {
  if (inComparison.value) return '对照模式：A 组青色 / B 组品红，加粗为当前定位圈位（只读）'
  if (store.viewingRecord) return '只读：查看的是记录保存时的同心环与暗环，“返回测量”后可继续选取'
  return `点击同心环中的黑色暗环选取（有效区域：中央圆域，半径 0–${NEWTON_RMAX_MM} mm）`
})

const currentCompareRow = computed(() =>
  store.compareRows?.find((r) => r.pos === store.comparePos) ?? null,
)

function signed(v?: number) {
  if (v === undefined) return '-'
  return (v >= 0 ? '+' : '') + v.toFixed(2)
}

// 两个 select 的双向绑定（同名选择由 store 拦截并说明原因）
const compareA = computed({
  get: () => store.compareAName ?? '',
  set: (v: string) => store.setCompare('a', v || null),
})
const compareB = computed({
  get: () => store.compareBName ?? '',
  set: (v: string) => store.setCompare('b', v || null),
})

function onPosChange(v: string) {
  store.setComparePos(Number(v))
}

function onSave() {
  if (store.saveRecord(recordName.value)) recordName.value = ''
}

function onDelete(name: string) {
  if (window.confirm(`确定删除记录“${name}”？`)) store.deleteRecord(name)
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
    const idx = Math.round((x / W) * (data.length - 1))
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
    const x = (i / (data.length - 1)) * W
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
  ctx.fillText('0', W / 2, H - 2); ctx.fillText('光强 I', 30, 12); ctx.fillText(store.currentExperiment === 'newton' ? '半径 r' : '位置 x', W - 20, H - 2)
}

/** 在牛顿环热力图上叠加某一快照的暗环标记 */
function drawRingOverlay(ctx: CanvasRenderingContext2D, cx: number, cy: number, pxPerMM: number,
  snapshot: NewtonSnapshot, color: string, boldOrders: Set<number>, labelSide: number) {
  for (const ring of snapshot.rings) {
    const px = ring.radiusMM * pxPerMM
    const bold = boldOrders.has(ring.order)
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.globalAlpha = bold ? 1 : 0.65
    ctx.lineWidth = bold ? 2.5 : 1
    ctx.arc(cx, cy, px, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    // 圈数标签：A 组放左上，B 组放右上，避免重叠
    const ang = labelSide < 0 ? -Math.PI * 0.75 : -Math.PI * 0.25
    const lx = cx + px * Math.cos(ang)
    const ly = cy + px * Math.sin(ang)
    ctx.font = bold ? 'bold 10px monospace' : '9px monospace'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.fillText(String(ring.order), lx, ly)
  }
}

function drawNewtonHeatmap(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const cx = W / 2, cy = H / 2
  const pxPerMM = H / 2 / NEWTON_RMAX_MM
  const rMaxPx = H / 2

  // 背景图样所用参数：对照模式固定用 A 组参数；其余用当前（已恢复的快照）参数
  const bgWavelength = inComparison.value ? store.compareRecordA!.wavelength : store.params.wavelength
  const bgR = inComparison.value ? store.compareRecordA!.curvatureRadius : store.params.curvatureRadius
  const [r, g, b] = wavelengthToRGB(bgWavelength)

  // 径向光强查找表（同心对称，按半径取一次即可）
  const lut = new Float32Array(rMaxPx + 1)
  for (let rp = 0; rp <= rMaxPx; rp++) {
    lut[rp] = newtonRadialIntensity(rp / pxPerMM * 1e-3, bgWavelength, bgR)
  }

  const imgData = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    const dy = y - cy
    for (let x = 0; x < W; x++) {
      const dx = x - cx
      const rp = Math.round(Math.sqrt(dx * dx + dy * dy))
      const pos = (y * W + x) * 4
      if (rp <= rMaxPx) {
        const intensity = lut[rp]
        imgData.data[pos] = r
        imgData.data[pos + 1] = g
        imgData.data[pos + 2] = b
        imgData.data[pos + 3] = Math.min(255, intensity * 255 + 12)
      }
      // 圆域外保持纯黑
    }
  }
  ctx.putImageData(imgData, 0, 0)

  // 圆域边界
  ctx.beginPath()
  ctx.strokeStyle = '#475569'
  ctx.setLineDash([4, 4])
  ctx.lineWidth = 1
  ctx.arc(cx, cy, rMaxPx, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // 暗环标记
  const currentPos = store.comparePos
  if (inComparison.value) {
    const row = store.compareRows?.find((rw) => rw.pos === currentPos)
    const boldA = new Set(row ? [row.a.order] : [])
    const boldB = new Set(row ? [row.b.order] : [])
    drawRingOverlay(ctx, cx, cy, pxPerMM, store.compareRecordA!, '#22d3ee', boldA, -1)
    drawRingOverlay(ctx, cx, cy, pxPerMM, store.compareRecordB!, '#e879f9', boldB, 1)
  } else if (viewingSnapshot.value) {
    drawRingOverlay(ctx, cx, cy, pxPerMM, viewingSnapshot.value, '#fbbf24', new Set(), -1)
  } else if (store.newtonDraft) {
    drawRingOverlay(ctx, cx, cy, pxPerMM, store.newtonDraft, '#22d3ee', new Set(), -1)
  }
}

function drawHeatmap() {
  const canvas = heatmapRef.value
  if (!canvas || !store.intensityData.length) return
  canvas.width = canvas.clientWidth
  canvas.height = 200
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height

  if (store.currentExperiment === 'newton') {
    drawNewtonHeatmap(ctx, W, H)
    return
  }

  // 双缝/单缝：保持原有水平条纹二维图样
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, W, H)
  const [r, g, b] = wavelengthToRGB(store.params.wavelength)
  const data = store.intensityData
  const imgData = ctx.createImageData(W, H)
  for (let x = 0; x < W; x++) {
    const idx = Math.round((x / W) * (data.length - 1))
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

function renderAll() { drawPattern(); drawIntensity(); drawHeatmap() }

function onHeatmapClick(e: MouseEvent) {
  if (store.currentExperiment !== 'newton') return
  const canvas = heatmapRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  // CSS 尺寸与画布像素尺寸换算
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)
  const y = (e.clientY - rect.top) * (canvas.height / rect.height)
  const rPx = Math.hypot(x - canvas.width / 2, y - canvas.height / 2)
  const pxPerMM = canvas.height / 2 / NEWTON_RMAX_MM
  store.pickDarkRing(rPx / pxPerMM)
}

onMounted(() => {
  store.compute()
  setTimeout(renderAll, 100)
  window.addEventListener('resize', renderAll)
})

watch(
  [
    () => store.intensityData,
    () => store.currentExperiment,
    () => store.newtonDraft,
    () => store.viewingRecord,
    () => store.compareAName,
    () => store.compareBName,
    () => store.comparePos,
    () => store.params.wavelength,
    () => store.params.curvatureRadius,
  ],
  () => renderAll(),
  { deep: true },
)
</script>
