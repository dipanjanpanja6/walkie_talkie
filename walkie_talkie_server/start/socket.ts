import SignalingsController from '#controllers/signalings_controller'
import ws_service from '#services/ws_service'
import logger from '@adonisjs/core/services/logger'
import mediasoup from 'mediasoup'

ws_service.boot()

/** Mediasoup SFU Setup **/
let worker: mediasoup.types.Worker
let router: mediasoup.types.Router
const transports = new Map()
const producers = new Map()
const consumers = new Map()

async function setupMediasoup() {
  worker = await mediasoup.createWorker()
  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
    ],
  })
}

setupMediasoup()

/**
 * Listen for incoming socket connections
 */
ws_service.io.on('connection', async (socket) => {
  const signalingController = new SignalingsController(socket)

  try {
    // Handle connection
    await signalingController.onConnected()

    // Handle channel joining
    socket.on('joinChannel', async (data) => {
      await signalingController.joinChannel(data)
    })

    // Handle transport creation
    socket.on('createTransport', async (data) => {
      await signalingController.createTransport(data)
    })

    // Handle transport connection
    socket.on('connectTransport', async (data) => {
      await signalingController.connectTransport(data)
    })

    // Handle producer creation
    socket.on('produce', async (data) => {
      await signalingController.produce(data)
    })

    // Handle consumer creation
    socket.on('consume', async (data) => {
      await signalingController.consume(data)
    })

    // Handle ICE candidates
    socket.on('ice-candidate', async (data) => {
      await signalingController.handleIceCandidate(data)
    })

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`)
      await signalingController.onDisconnected()
    })

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error)
    })
  } catch (error) {
    logger.error('Error handling socket connection:', error)
    socket.emit('error', { message: 'Connection failed' })
  }
})
