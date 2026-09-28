/** Mechanical pipeline fixture only. It is not package-validation footage. */
export async function createPipelineClip():Promise<File> {
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360
  const ctx=canvas.getContext('2d')!
  const stream=canvas.captureStream(10)
  const mime=['video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))
  if(!mime){stream.getTracks().forEach(t=>t.stop());throw new Error('This browser cannot create the synthetic test clip.')}
  return new Promise((resolve,reject)=>{
    const recorder=new MediaRecorder(stream,{mimeType:mime})
    const chunks:BlobPart[]=[];const started=performance.now()
    const draw=()=>{ctx.fillStyle='#0f172a';ctx.fillRect(0,0,640,360);ctx.fillStyle='#5eead4';ctx.font='26px sans-serif';ctx.fillText('SYNTHETIC PIPELINE CHECK',40,120);ctx.font='18px sans-serif';ctx.fillStyle='#ffffff';ctx.fillText('Not real footage. Not a package accuracy test.',40,170);ctx.fillText(`${((performance.now()-started)/1000).toFixed(1)} seconds`,40,220)}
    draw();const interval=setInterval(draw,100)
    const cleanup=()=>{clearInterval(interval);clearTimeout(timeout);stream.getTracks().forEach(t=>t.stop())}
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
    recorder.onerror=()=>{cleanup();reject(new Error('Could not record the pipeline check.'))}
    recorder.onstop=()=>{cleanup();resolve(new File(chunks,'synthetic-pipeline-check.webm',{type:'video/webm'}))}
    const timeout=setTimeout(()=>recorder.stop(),4100)
    recorder.start()
  })
}
