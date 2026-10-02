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
  const monitor = new ChangeMonitor(); monitor.calibrate(frame(), zone, 0, { checkedEmpty: true })
  const sample = scan(monitor, 'beside', 250, 4000)
  assert.equal(sample.blocked, false); assert.equal(sample.ratio, 0); assert.ok(sample.scans >= 16)
})
test('inside pixels alert after real contiguous samples; removal clears after repeated checks', () => {
  const monitor = new ChangeMonitor(); monitor.calibrate(frame(), zone, 0, { checkedEmpty: true })
  assert.equal(scan(monitor, 'inside', 250, 2750).blocked, false)
  assert.equal(monitor.observe(frame('inside'), 3250).blocked, true)
  assert.equal(scan(monitor, 'empty', 3500, 1750).unresolved, true)
  const removed = monitor.observe(frame(), 5500)
  assert.equal(removed.blocked, false); assert.equal(removed.unresolved, false)
})
test('video loss retains unresolved change and requires a new reference', () => {
  const monitor = new ChangeMonitor(); monitor.calibrate(frame(), zone, 0, { checkedEmpty: true })
  scan(monitor, 'inside', 250, 3250)
  assert.equal(monitor.pause().unresolved, true)
  assert.equal(monitor.observe(frame(), 9000).ready, false)
  assert.equal(monitor.snapshot().unresolved, true)
  assert.equal(monitor.calibrate(frame(), zone, 9250, { checkedEmpty: true }).unresolved, false)
})
test('a sampling gap cannot count as presence or removal', () => {
  const monitor = new ChangeMonitor(); monitor.calibrate(frame(), zone, 0, { checkedEmpty: true })
  monitor.observe(frame('inside'), 250)
  assert.equal(monitor.observe(frame('inside'), 4000).ready, false)
  assert.equal(monitor.snapshot().blocked, false)
  monitor.calibrate(frame(), zone, 5000, { checkedEmpty: true }); scan(monitor, 'inside', 5250, 3250)
  assert.equal(monitor.observe(frame(), 12000).unresolved, true)
  assert.equal(monitor.snapshot().ready, false)
})
test('duplicate timestamps do not accumulate scans and calibration copies pixels', () => {
  const monitor = new ChangeMonitor(), original = frame()
  monitor.calibrate(original, zone, 0, { checkedEmpty: true })
  original.data.fill(200)
  const first = monitor.observe(frame(), 250)
  assert.equal(first.ratio, 0)
  assert.equal(monitor.observe(frame('inside'), 250).scans, first.scans)
})
test('saving any empty reference requires explicit human confirmation', () => {
  const monitor = new ChangeMonitor()
  assert.throws(() => monitor.calibrate(frame(), zone, 0), /Check the marked area/)
  assert.throws(() => monitor.calibrate(frame(), zone, 0, { checkedEmpty: false }), /Check the marked area/)
  assert.equal(monitor.snapshot().ready, false)
})
test('a parcel already present can be reported without learning occupied pixels', () => {
  const monitor = new ChangeMonitor(), reported = monitor.reportParcel()
  assert.equal(reported.reportedParcel, true); assert.equal(reported.unresolved, true)
  assert.equal(reported.ready, false); assert.equal(reported.blocked, false)
  assert.equal(monitor.observe(frame('inside'), 1000).scans, 0)
})
test('manual parcel reports survive paused video and repeated empty-looking pixels', () => {
  const monitor = new ChangeMonitor(); monitor.reportParcel(); monitor.pause()
  for (let at = 250; at <= 20000; at += 250) monitor.observe(frame(), at)
  assert.equal(monitor.snapshot().reportedParcel, true); assert.equal(monitor.snapshot().unresolved, true)
  assert.equal(monitor.snapshot().ready, false)
})
test('generic calibration cannot erase a manually reported parcel', () => {
  const monitor = new ChangeMonitor(); monitor.reportParcel()
  assert.throws(() => monitor.calibrate(frame(), zone, 1000, { checkedEmpty: true }), /Confirm the reported parcel/)
  assert.equal(monitor.snapshot().reportedParcel, true); assert.equal(monitor.snapshot().unresolved, true)
})
test('only an explicit removal check with a valid empty reference resolves the report', () => {
  const monitor = new ChangeMonitor(); monitor.reportParcel()
  const check = { checkedEmpty: true, reportedParcelRemoved: true }
  assert.throws(() => monitor.calibrate(frame(), { ...zone, w: 0 }, 1000, check), /valid doorway/)
  assert.equal(monitor.snapshot().reportedParcel, true)
  const next = monitor.calibrate(frame(), zone, 1250, check)
  assert.equal(next.ready, true); assert.equal(next.reportedParcel, false); assert.equal(next.unresolved, false)
})
