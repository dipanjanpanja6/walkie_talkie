// import type { HttpContext } from '@adonisjs/core/http'
import MediasoupService from "#services/mediasoup_service"
import logger from "@adonisjs/core/services/logger"

export default class SignalingsController {
  private mediasoupService = new MediasoupService()
  //   private signalingService = new SignalingService()
  constructor(private socket: any) {
    this.socket = socket
  }

  public async onConnected() {
    logger.info(`Client connected: ${this.socket.id}`)

    // Store client connection information
    this.socket.data = { userId: null, channelId: null, isConnected: true, joinedAt: new Date() }
  }

  public async onDisconnected() {
    logger.info(`Client disconnected: ${this.socket.id}`)

    try {
      // Clean up user session and mediasoup resources
      if (this.socket.data.userId && this.socket.data.channelId) {
        await this.handleUserLeave()
      }
    } catch (error) {
      logger.error("Error during disconnect cleanup:", error)
    }
  }

  public async joinChannel(data: any) {
    try {
      const { channelId, userId, displayName } = data

      // Validate channel exists and is active
      //   const isValidChannel = await this.signalingService.validateChannel(channelId)
      //   if (!isValidChannel) {
      //     this.socket.emit("error", { message: "Invalid or inactive channel" })
      //     return
      //   }

      // Create or update user session
      const userSession = await UserSession.updateOrCreate({ userId, channelId }, { socketId: this.socket.id, displayName, isActive: true, lastSeen: new Date() })

      // Update socket data
      this.socket.data.userId = userId
      this.socket.data.channelId = channelId
      this.socket.data.displayName = displayName

      // Join socket room for this channel
      await this.socket.join(`channel:${channelId}`)

      // Get mediasoup router capabilities for this channel
      const routerCapabilities = await this.mediasoupService.getRouterCapabilities(channelId)

      // Notify client about successful join
      this.socket.emit("joined-channel", { channelId, userId, routerCapabilities, sessionId: userSession.id })

      // Notify other users in the channel
      this.socket.to(`channel:${channelId}`).emit("user-joined", { userId, displayName, joinedAt: new Date() })

      logger.info(`User ${userId} joined channel ${channelId}`)
    } catch (error) {
      logger.error("Error joining channel:", error)
      this.socket.emit("error", { message: "Failed to join channel", error: error.message })
    }
  }

  public async createTransport(data: any) {
    try {
      const { channelId, direction } = data // direction: 'send' or 'recv'

      if (!this.socket.data.channelId || this.socket.data.channelId !== channelId) {
        this.socket.emit("error", { message: "Not authorized for this channel" })
        return
      }

      // Create WebRTC transport using Mediasoup
      const transportOptions = await this.mediasoupService.createWebRtcTransport(channelId, this.socket.data.userId, direction)

      this.socket.emit("transport-created", { direction, transportOptions })

      logger.info(`Transport created for user ${this.socket.data.userId} in channel ${channelId}`)
    } catch (error) {
      logger.error("Error creating transport:", error)
      this.socket.emit("error", { message: "Failed to create transport", error: error.message })
    }
  }

  public async connectTransport(data: any) {
    try {
      const { transportId, dtlsParameters } = data

      await this.mediasoupService.connectTransport(this.socket.data.channelId, this.socket.data.userId, transportId, dtlsParameters)

      this.socket.emit("transport-connected", { transportId })
      logger.info(`Transport connected: ${transportId}`)
    } catch (error) {
      logger.error("Error connecting transport:", error)
      this.socket.emit("error", { message: "Failed to connect transport", error: error.message })
    }
  }

  public async produce(data: any) {
    try {
      const { transportId, kind, rtpParameters } = data

      const producerId = await this.mediasoupService.createProducer(this.socket.data.channelId, this.socket.data.userId, transportId, kind, rtpParameters)

      this.socket.emit("produced", { producerId })

      // Notify other users about new producer
      this.socket.to(`channel:${this.socket.data.channelId}`).emit("new-producer", { userId: this.socket.data.userId, producerId, kind })

      logger.info(`Producer created: ${producerId} for user ${this.socket.data.userId}`)
    } catch (error) {
      logger.error("Error creating producer:", error)
      this.socket.emit("error", { message: "Failed to create producer", error: error.message })
    }
  }

  public async consume(data: any) {
    try {
      const { transportId, producerId, rtpCapabilities } = data

      const consumerParams = await this.mediasoupService.createConsumer(this.socket.data.channelId, this.socket.data.userId, transportId, producerId, rtpCapabilities)

      this.socket.emit("consumed", consumerParams)
      logger.info(`Consumer created for producer ${producerId}`)
    } catch (error) {
      logger.error("Error creating consumer:", error)
      this.socket.emit("error", { message: "Failed to create consumer", error: error.message })
    }
  }

  public async handleIceCandidate(data: any) {
    try {
      const { candidate, targetUserId } = data

      // Forward ICE candidate to target user
      this.socket.to(`channel:${this.socket.data.channelId}`).emit("ice-candidate", { candidate, fromUserId: this.socket.data.userId })

      logger.debug(`ICE candidate forwarded from ${this.socket.data.userId}`)
    } catch (error) {
      logger.error("Error handling ICE candidate:", error)
    }
  }

  private async handleUserLeave() {
    try {
      const { userId, channelId } = this.socket.data

      // Clean up mediasoup resources
      await this.mediasoupService.cleanupUserResources(channelId, userId)

      // Update user session
      await UserSession.query().where("userId", userId).where("channelId", channelId).update({ isActive: false, leftAt: new Date() })

      // Leave socket room
      await this.socket.leave(`channel:${channelId}`)

      // Notify other users
      this.socket.to(`channel:${channelId}`).emit("user-left", { userId, leftAt: new Date() })

      logger.info(`User ${userId} left channel ${channelId}`)
    } catch (error) {
      logger.error("Error handling user leave:", error)
    }
  }
}
