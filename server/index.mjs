import express from 'express'
import crypto from 'node:crypto'

const app = express()
app.use(express.json({ limit: '2mb' }))
const port = Number(process.env.PORT || 6868)
const verifyToken = process.env.META_VERIFY_TOKEN || 'bot68-development-token'

app.get('/health', (_, res) => res.json({ ok: true, service: 'BOT 68 Server', version: '0.1.0' }))
app.get('/webhooks/meta', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === verifyToken) return res.status(200).send(req.query['hub.challenge'])
  res.sendStatus(403)
})
app.post('/webhooks/meta', (req, res) => {
  const eventId = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex').slice(0,16)
  console.log(`[meta:${eventId}] webhook received`)
  res.sendStatus(200)
})
app.get('/oauth/meta/start', (_, res) => res.status(501).json({ error: 'META_APP_ID is required before OAuth can be enabled' }))
app.listen(port, '127.0.0.1', () => console.log(`BOT 68 server: http://127.0.0.1:${port}`))
