import ws_service from '#services/ws_service'
import { randomUUID } from 'crypto'
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
ws_service.io.on('connection', (socket) => {
  const peerId = randomUUID()
  socket.emit('welcome', { id: peerId })

  // Send router capabilities
  socket.on('getRouterRtpCapabilities', () => {
    socket.emit('routerRtpCapabilities', router.rtpCapabilities)
  })

  // Create Transport
  socket.on('createTransport', async () => {
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: 'YOUR_PUBLIC_IP' }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    })

    transports.set(transport.id, { transport, peerId })
    socket.emit('transportCreated', {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    })
  })

  // Connect Transport
  socket.on('connectTransport', async ({ transportId, dtlsParameters }) => {
    const { transport } = transports.get(transportId)
    await transport.connect({ dtlsParameters })
  })

  // Produce Audio
  socket.on('produce', async ({ transportId, kind, rtpParameters }) => {
    const { transport } = transports.get(transportId)
    const producer = await transport.produce({ kind, rtpParameters })

    producers.set(peerId, producer)

    // Notify all clients new producer exists
    socket.broadcast.emit('newProducer', { producerPeerId: peerId })
  })

  // Consume Audio
  socket.on('consume', async ({ consumerPeerId, rtpCapabilities, transportId }) => {
    const { transport } = transports.get(transportId)
    const producer = producers.get(consumerPeerId)

    if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
      return
    }

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: false,
    })

    consumers.set(consumer.id, consumer)

    consumer.on('transportclose', () => consumers.delete(consumer.id))

    socket.emit('consumerCreated', {
      id: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    })
  })

  socket.on('disconnect', () => {
    console.log('Peer disconnected', peerId)
  })
})
