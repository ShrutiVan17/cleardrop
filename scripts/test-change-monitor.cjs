const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), ts = require('typescript')
function load(name) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, Uint8ClampedArray, require: relative => load(relative.replace('./', '')) })
  return exports
}
const { ChangeMonitor } = load('change-monitor')
const zone = { x: .3, y: .5, w: .4, h: .4 }
function frame(placement = 'empty') {
  const width = 100, height = 100, data = new Uint8ClampedArray(width * height * 4).fill(40)
  if (placement !== 'empty') {
    const start = placement === 'inside' ? 40 : 80
    for (let y = 60; y < 80; y++) for (let x = start; x < start + 20; x++) {
      const offset = (y * width + x) * 4
      data[offset] = data[offset + 1] = data[offset + 2] = 200
    }
  }
  return { width, height, data }
}
function scan(monitor, placement, start, duration) {
  let sample
  for (let at = start; at <= start + duration; at += 250) sample = monitor.observe(frame(placement), at)
  return sample
}
test('actual outside pixels do not trigger the production monitor', () => {
  const monitor = new ChangeMonitor(); monitor.calibrate(frame(), zone, 0)
  const sample = scan(monitor, 'beside', 250, 4000)
  assert.equal(sample.blocked, false); assert.equal(sample.ratio, 0); assert.ok(sample.scans >= 16)
})
test('inside pixels alert after real contiguous samples; removal clears after repeated checks', () => {
  const monitor = new ChangeMonitor(); monitor.calibrate(frame(), zone, 0)
  assert.equal(scan(monitor, 'inside', 250, 2750).blocked, false)
  assert.equal(monitor.observe(frame('inside'), 3250).blocked, true)
  assert.equal(scan(monitor, 'empty', 3500, 1750).unresolved, true)
  const removed = monitor.observe(frame(), 5500)
  assert.equal(removed.blocked, false); assert.equal(removed.unresolved, false)
})
test('video loss retains unresolved change and requires a new reference', () => {
  const monitor = new ChangeMonitor(); monitor.calibrate(frame(), zone, 0)
  scan(monitor, 'inside', 250, 3250)
  assert.equal(monitor.pause().unresolved, true)
  assert.equal(monitor.observe(frame(), 9000).ready, false)
  assert.equal(monitor.snapshot().unresolved, true)
  assert.equal(monitor.calibrate(frame(), zone, 9250).unresolved, false)
})
test('a sampling gap cannot count as presence or removal', () => {
  const monitor = new ChangeMonitor(); monitor.calibrate(frame(), zone, 0)
  monitor.observe(frame('inside'), 250)
  assert.equal(monitor.observe(frame('inside'), 4000).ready, false)
  assert.equal(monitor.snapshot().blocked, false)
  monitor.calibrate(frame(), zone, 5000); scan(monitor, 'inside', 5250, 3250)
  assert.equal(monitor.observe(frame(), 12000).unresolved, true)
  assert.equal(monitor.snapshot().ready, false)
})
test('duplicate timestamps do not accumulate scans and calibration copies pixels', () => {
  const monitor = new ChangeMonitor(), original = frame()
  monitor.calibrate(original, zone, 0)
  original.data.fill(200)
  const first = monitor.observe(frame(), 250)
  assert.equal(first.ratio, 0)
  assert.equal(monitor.observe(frame('inside'), 250).scans, first.scans)
})
