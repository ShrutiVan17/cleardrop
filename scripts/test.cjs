const {spawnSync}=require('node:child_process')
const path=require('node:path')
for(const suite of ['obstruction','change-monitor','delivery-review','review-notifier','review-sync','review-api','camera-test-evidence','package-detection','inference-evidence','inference-runtime','inference-worker','doorway-state','replay-evaluation','product','interface','preview-access','public-access','account-policy','account-rate-limit','phone-camera','ring-session']){
 const result=spawnSync(process.execPath,[path.join(__dirname,`test-${suite}.cjs`)],{stdio:'inherit'})
 if(result.error){console.error(result.error.message);process.exit(1)}
 if(result.status!==0)process.exit(result.status||1)
}
