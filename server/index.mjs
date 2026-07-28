import { createApp } from './app.mjs'
import { loadConfig, validateProductionConfig } from './config.mjs'

const config=loadConfig()
validateProductionConfig(config)
const app=createApp(config)
const server=app.listen(config.port,config.host,()=>console.log(`BOT 68 server: ${config.publicUrl}`))
const shutdown=()=>server.close(()=>{app.locals.db.close();process.exit(0)})
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown)
