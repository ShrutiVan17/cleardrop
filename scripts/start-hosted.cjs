const {spawn}=require('node:child_process')
const port=Number(process.env.PORT||3000)
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT')
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-H','0.0.0.0','-p',String(port)],{
  stdio:'inherit',env:{...process.env,CLEARDROP_HOSTED:'1'},
})
child.on('error',()=>process.exit(1))
child.on('exit',code=>process.exit(code??1))
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal))
