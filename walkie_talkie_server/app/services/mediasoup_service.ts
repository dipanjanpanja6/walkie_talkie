import env from "#start/env"
import logger from "@adonisjs/core/services/logger"
import mediasoup, { types } from "mediasoup"

export default class MediasoupService {
  private workers: types.Worker[] = []
  private routers: Map<string, types.Router> = new Map() // channelId -> Router
  private transports: Map<string, Map<string, types.WebRtcTransport>> = new Map() // channelId -> userId -> Transport
  private producers: Map<string, Map<string, types.Producer[]>> = new Map() // channelId -> userId -> Producers
  private consumers: Map<string, Map<string, types.Consumer[]>> = new Map() // channelId -> userId -> Consumers

  public async initialize() {
    try {
      // Create multiple workers for load balancing
      const numWorkers = env.get("MEDIASOUP_WORKERS", 4)

      for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker({ logLevel: "warn", rtcMinPort: 10000 + i * 1000, rtcMaxPort: 10000 + (i + 1) * 1000 - 1 })

        worker.on("died", (error: any) => {
          logger.error(`Mediasoup worker died: ${error}`)
          process.exit(1)
        })

        this.workers.push(worker)
        logger.info(`Mediasoup worker ${i + 1} created`)
      }

      logger.info("Mediasoup service initialized successfully")
    } catch (error) {
      logger.error("Failed to initialize Mediasoup service:", error)
      throw error
    }
  }

  public async getRouterCapabilities(channelId: string) {
    try {
      let router = this.routers.get(channelId)

      if (!router) router = await this.createRouter(channelId)

      return router.rtpCapabilities
    } catch (error) {
      logger.error(`Error getting router capabilities for channel ${channelId}:`, error)
      throw error
    }
  }

  private async createRouter(channelId: string): Promise<types.Router> {
    try {
      // Select worker with least load (round-robin for simplicity)
      const worker = this.workers[Math.floor(Math.random() * this.workers.length)]

      const router = await worker.createRouter({
        mediaCodecs: [
          { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
          { kind: "video", mimeType: "video/VP8", clockRate: 90000, parameters: { "x-google-start-bitrate": 1000 } },
          { kind: "video", mimeType: "video/VP9", clockRate: 90000, parameters: { "profile-id": 2, "x-google-start-bitrate": 1000 } },
          {
            kind: "video",
            mimeType: "video/h264",
            clockRate: 90000,
            parameters: { "packetization-mode": 1, "profile-level-id": "4d0032", "level-asymmetry-allowed": 1, "x-google-start-bitrate": 1000 },
          },
        ],
      })

      this.routers.set(channelId, router)
      logger.info(`Router created for channel: ${channelId}`)

      return router
    } catch (error) {
      logger.error(`Failed to create router for channel ${channelId}:`, error)
      throw error
    }
  }

  public async createWebRtcTransport(channelId: string, userId: string, direction: "send" | "recv") {
    try {
      const router = this.routers.get(channelId)
      if (!router) {
        throw new Error(`No router found for channel: ${channelId}`)
      }

      // WebRTC transport options
      const transportOptions = {
        listenIps: [{ ip: process.env.MEDIASOUP_LISTEN_IP || "127.0.0.1", announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1" }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        maxIncomingBitrate: 1500000,
      }

      const transport = await router.createWebRtcTransport(transportOptions)

      // Store transport reference
      if (!this.transports.has(channelId)) {
        this.transports.set(channelId, new Map())
      }

      const userTransports = this.transports.get(channelId)!
      const transportKey = `${userId}_${direction}`
      userTransports.set(transportKey, transport)

      // Handle transport events
      transport.on("dtlsstatechange", (dtlsState: any) => {
        if (dtlsState === "closed") {
          logger.info(`Transport closed for user ${userId} in channel ${channelId}`)
        }
      })

      transport.on("close", () => {
        logger.info(`Transport closed for user ${userId} in channel ${channelId}`)
      })

      return { id: transport.id, iceParameters: transport.iceParameters, iceCandidates: transport.iceCandidates, dtlsParameters: transport.dtlsParameters }
    } catch (error) {
      logger.error(`Error creating WebRTC transport:`, error)
      throw error
    }
  }

  public async connectTransport(channelId: string, userId: string, transportId: string, dtlsParameters: any) {
    try {
      const userTransports = this.transports.get(channelId)
      if (!userTransports) {
        throw new Error(`No transports found for channel: ${channelId}`)
      }

      // Find the transport by ID
      let transport: types.WebRtcTransport | undefined
      for (const [key, t] of userTransports) {
        if (t.id === transportId) {
          transport = t
          break
        }
      }

      if (!transport) {
        throw new Error(`Transport not found: ${transportId}`)
      }

      await transport.connect({ dtlsParameters })
      logger.info(`Transport connected: ${transportId}`)
    } catch (error) {
      logger.error(`Error connecting transport:`, error)
      throw error
    }
  }

  public async createProducer(channelId: string, userId: string, transportId: string, kind: "audio" | "video", rtpParameters: any): Promise<string> {
    try {
      const userTransports = this.transports.get(channelId)
      if (!userTransports) throw new Error(`No transports found for channel: ${channelId}`)

      // Find the send transport
      const transport = userTransports.get(`${userId}_send`)
      if (!transport) throw new Error(`Send transport not found for user: ${userId}`)

      const producer = await transport.produce({ kind, rtpParameters })

      // Store producer reference
      if (!this.producers.has(channelId)) this.producers.set(channelId, new Map())

      const channelProducers = this.producers.get(channelId)!
      if (!channelProducers.has(userId)) channelProducers.set(userId, [])

      channelProducers.get(userId)!.push(producer)

      // Handle producer events
      producer.on("transportclose", () => {
        logger.info(`Producer transport closed: ${producer.id}`)
      })

      logger.info(`Producer created: ${producer.id} for user ${userId}`)
      return producer.id
    } catch (error) {
      logger.error(`Error creating producer:`, error)
      throw error
    }
  }

  public async createConsumer(channelId: string, userId: string, transportId: string, producerId: string, rtpCapabilities: any) {
    try {
      const router = this.routers.get(channelId)
      if (!router) throw new Error(`No router found for channel: ${channelId}`)

      const userTransports = this.transports.get(channelId)
      if (!userTransports) throw new Error(`No transports found for channel: ${channelId}`)

      // Find the receive transport
      const transport = userTransports.get(`${userId}_recv`)
      if (!transport) throw new Error(`Receive transport not found for user: ${userId}`)

      // Check if we can consume
      if (!router.canConsume({ producerId, rtpCapabilities })) throw new Error("Cannot consume producer")

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // Start paused, client will resume
      })

      // Store consumer reference
      if (!this.consumers.has(channelId)) this.consumers.set(channelId, new Map())

      const channelConsumers = this.consumers.get(channelId)!
      if (!channelConsumers.has(userId)) channelConsumers.set(userId, [])

      channelConsumers.get(userId)!.push(consumer)

      // Handle consumer events
      consumer.on("transportclose", () => {
        logger.info(`Consumer transport closed: ${consumer.id}`)
      })

      consumer.on("producerclose", () => {
        logger.info(`Consumer producer closed: ${consumer.id}`)
      })

      return { id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters, type: consumer.type, producerPaused: consumer.producerPaused }
    } catch (error) {
      logger.error(`Error creating consumer:`, error)
      throw error
    }
  }

  public async cleanupUserResources(channelId: string, userId: string) {
    try {
      // Close producers
      const channelProducers = this.producers.get(channelId)
      if (channelProducers && channelProducers.has(userId)) {
        const userProducers = channelProducers.get(userId)!
        for (const producer of userProducers) {
          producer.close()
        }
        channelProducers.delete(userId)
      }

      // Close consumers
      const channelConsumers = this.consumers.get(channelId)
      if (channelConsumers && channelConsumers.has(userId)) {
        const userConsumers = channelConsumers.get(userId)!
        for (const consumer of userConsumers) {
          consumer.close()
        }
        channelConsumers.delete(userId)
      }

      // Close transports
      const userTransports = this.transports.get(channelId)
      if (userTransports) {
        for (const [key, transport] of userTransports) {
          if (key.startsWith(userId)) {
            transport.close()
            userTransports.delete(key)
          }
        }
      }

      logger.info(`Cleaned up resources for user ${userId} in channel ${channelId}`)
    } catch (error) {
      logger.error(`Error cleaning up user resources:`, error)
    }
  }
}
