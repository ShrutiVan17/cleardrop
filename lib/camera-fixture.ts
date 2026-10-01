/** Generated pixels, not recorded Ring footage or a recognition benchmark. */
export const FIXTURE_ZONE = { x: .3, y: .5, w: .4, h: .4 }
export type FixturePlacement = 'empty' | 'beside' | 'inside'

export function drawCameraFixture(ctx: CanvasRenderingContext2D, placement: FixturePlacement, elapsed: number) {
  ctx.fillStyle = '#18352f'; ctx.fillRect(0, 0, 640, 360)
  ctx.fillStyle = '#36584c'; ctx.fillRect(206, 20, 228, 198)
  ctx.fillStyle = '#102720'; ctx.fillRect(222, 38, 196, 166)
  ctx.fillStyle = '#e0c890'; ctx.beginPath(); ctx.arc(394, 142, 5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#29463e'; ctx.fillRect(0, 218, 640, 142)
  ctx.strokeStyle = '#3d5e51'; ctx.lineWidth = 1
  for (let y = 250; y < 360; y += 38) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke() }
  if (placement !== 'empty') {
    const x = placement === 'inside' ? 254 : 512
    ctx.fillStyle = '#d7ae71'; ctx.fillRect(x, 228, 120, 76)
    ctx.fillStyle = '#a97844'; ctx.fillRect(x + 120, 228, 14, 76)
    ctx.fillStyle = '#f4dab0'; ctx.fillRect(x + 52, 228, 16, 76)
  }
  // Advancing time proves the generated video is moving, outside the tested zone.
  ctx.fillStyle = '#edf5ef'; ctx.font = '15px Arial'
  ctx.fillText('CONTROLLED TEST VIDEO · NOT RING FOOTAGE', 16, 24)
  ctx.fillText(`${elapsed.toFixed(1)} s`, 16, 47)
}
