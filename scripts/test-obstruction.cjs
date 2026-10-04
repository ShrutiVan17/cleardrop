const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '../lib/obstruction.ts'), 'utf8')
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { compareZone, validFrame, validZone, advanceDetection, emptyPersistence } = context.exports
const zone = { x: .25, y: .25, w: .5, h: .5 }
function frame(value = 50) {
  const data = new Uint8ClampedArray(100 * 100 * 4)
  for (let i = 0; i < data.length; i += 4) { data[i] = data[i+1] = data[i+2] = value; data[i+3] = 255 }
  return { width: 100, height: 100, data }
}
function rectangle(image, x0, y0, x1, y1) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * image.width + x) * 4
    image.data[i] = image.data[i+1] = image.data[i+2] = 180
  }
  return image
}
test('validates saved zone bounds and minimum size', () => {
  assert.equal(validZone(zone), true)
  assert.equal(validZone({ ...zone, x: .9 }), false)
  assert.equal(validZone({ ...zone, w: .001 }), false)
  assert.equal(validZone(null), false)
})
test('identical frames and uniform exposure changes are not obstruction', () => {
  assert.equal(compareZone(frame(), frame(), zone), 0)
  assert.equal(compareZone(frame(), frame(95), zone), 0)
})
test('detects an object inside the zone but ignores objects outside', () => {
  assert.ok(compareZone(frame(), rectangle(frame(), 35, 35, 60, 60), zone) > .12)
  assert.equal(compareZone(frame(), rectangle(frame(), 0, 0, 20, 20), zone), 0)
})
test('rejects mismatched reference dimensions', () => {
  assert.throws(() => compareZone(frame(), { ...frame(), width: 99 }, zone))
})

test('frame contracts reject truncated, invalid or unbounded RGBA samples', () => {
  assert.equal(validFrame(frame()), true)
  for (const value of [null, { ...frame(), width: 0 }, { ...frame(), height: NaN }, { ...frame(), width: 1.5 },
    { ...frame(), data: new Uint8ClampedArray(4) }, { ...frame(), data: new Uint8Array(40000) },
    { width: 10000, height: 10000, data: new Uint8ClampedArray(4) }]) assert.equal(validFrame(value), false)
  assert.throws(() => compareZone(frame(), { ...frame(), data: new Uint8ClampedArray(4) }, zone))
})
test('requires three seconds and clears after two seconds', () => {
  let state = advanceDetection(emptyPersistence(), .3, 0)
  state = advanceDetection(state, .3, 2999); assert.equal(state.active, false)
  state = advanceDetection(state, .3, 3000); assert.equal(state.active, true)
  state = advanceDetection(state, 0, 4000); assert.equal(state.active, true)
  state = advanceDetection(state, 0, 6000); assert.equal(state.active, false)
})
test('short passing motion does not alert; intermediate scores do not accumulate time', () => {
  let state = advanceDetection(emptyPersistence(), .3, 0)
  state = advanceDetection(state, .08, 2500)
  state = advanceDetection(state, .3, 3500)
  assert.equal(state.active, false)
})
