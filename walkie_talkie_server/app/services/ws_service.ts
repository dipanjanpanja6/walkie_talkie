import server from '@adonisjs/core/services/server'
import { Server } from 'socket.io'

class WsService {
  public io: Server
  private booted = false

  public boot() {
    /**
     * Ignore multiple calls to the boot method
     */
    if (this.booted) {
      return
    }

    this.booted = true
    this.io = new Server(server.getNodeServer()!)
  }
}

export default new WsService()
