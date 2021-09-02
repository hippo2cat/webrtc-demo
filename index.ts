import { createServer as createHttpsServer } from 'https'
import { createServer as createHttpServer, RequestListener } from 'http'
import { readFileSync } from 'fs'
import path from 'path'
import ejs from 'ejs'
import signalServer from './signal'

const staticListener: RequestListener = (req, res) => {
  if (req.url === '/') {
    const content = readFileSync(path.join(__dirname, './static/index.html'), { encoding: 'utf-8' })
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(content)
    return
  }
  if (req.url === '/webrtc-chat') {
    const content = readFileSync(path.join(__dirname, './static/webrtc-chat.ejs'), { encoding: 'utf-8' })
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(ejs.render(content, { host: req.headers.host }))
    return
  }
  if (req.url === '/hls-video') {
    const content = readFileSync(path.join(__dirname, './static/hls-video.html'), { encoding: 'utf-8' })
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(content)
    return
  }
  res.writeHead(404)
  res.end()
}

const httpsServer = createHttpsServer({
  cert: readFileSync(path.join(__dirname, './server.crt')),
  key: readFileSync(path.join(__dirname, './ca.key')),
}, staticListener)

const httpServer = createHttpServer(staticListener)

httpServer.listen(80)

httpsServer.listen(443)

signalServer.listen(9000)