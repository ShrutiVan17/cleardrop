// Mechanical build asset generation: serve executable runtime from our own origin.
const fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'..')
const vendor=path.join(root,'node_modules/@huggingface/transformers')
if(JSON.parse(fs.readFileSync(path.join(vendor,'package.json'),'utf8')).version!=='3.8.1')throw Error('Review runtime assets before changing the Transformers.js version')
const output=path.join(root,'public/inference-runtime')
fs.mkdirSync(output,{recursive:true})
for(const name of ['ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm']){
 fs.copyFileSync(path.join(vendor,'dist',name),path.join(output,name))
}
fs.copyFileSync(path.join(vendor,'LICENSE'),path.join(output,'TRANSFORMERS-LICENSE.txt'))
fs.copyFileSync(path.join(root,'docs/onnxruntime-license.txt'),path.join(output,'ONNXRUNTIME-LICENSE.txt'))
console.log('Prepared same-origin inference runtime (Transformers.js 3.8.1).')
