const {spawnSync}=require('node:child_process')
const path=require('node:path')
for(const suite of ['obstruction','package-detection','doorway-state','replay-evaluation','submission']){
 const result=spawnSync(process.execPath,[path.join(__dirname,`test-${suite}.cjs`)],{stdio:'inherit'})
 if(result.error){console.error(result.error.message);process.exit(1)}
 if(result.status!==0)process.exit(result.status||1)
}
