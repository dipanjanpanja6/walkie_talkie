const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mediasoup = require('mediasoup');
const { v4: uuid } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let worker, router;
const transports = new Map();
const producers = new Map();
const consumers = new Map();
const peers = new Map();

(async () => {
  worker = await mediasoup.createWorker();
  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
    ],
  });
})();

wss.on('connection', ws => {
  const peerId = uuid();
  peers.set(peerId, ws);
  ws.send(JSON.stringify({ type: 'welcome', id: peerId }));

  ws.on('message', async msg => {
    const data = JSON.parse(msg);

    if (data.type === 'getRouterRtpCapabilities') {
      ws.send(
        JSON.stringify({
          type: 'routerRtpCapabilities',
          data: router.rtpCapabilities,
        }),
      );
    }

    if (data.type === 'createTransport') {
      const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: 'YOUR_PUBLIC_IP' }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      transports.set(transport.id, { transport, peerId });

      ws.send(
        JSON.stringify({
          type: 'transportCreated',
          data: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          },
        }),
      );
    }

    if (data.type === 'connectTransport') {
      const { transportId, dtlsParameters } = data.data;
      await transports.get(transportId).transport.connect({ dtlsParameters });
    }

    if (data.type === 'produce') {
      const { transportId, kind, rtpParameters } = data.data;
      const { transport, peerId } = transports.get(transportId);
      const producer = await transport.produce({ kind, rtpParameters });
      producers.set(peerId, producer);

      // Notify others to consume
      for (const [otherPeerId, otherWs] of peers.entries()) {
        if (otherPeerId !== peerId) {
          otherWs.send(JSON.stringify({ type: 'newProducer', producerPeerId: peerId }));
        }
      }
    }

    if (data.type === 'consume') {
      const { consumerPeerId, rtpCapabilities, transportId } = data.data;
      const producer = producers.get(consumerPeerId);
      const { transport } = transports.get(transportId);

      if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
        console.error('Cannot consume');
        return;
      }

      const consumer = await transport.consume({
        producerId: producer.id,
        rtpCapabilities,
        paused: false,
      });

      consumers.set(consumer.id, consumer);

      consumer.on('transportclose', () => {
        consumers.delete(consumer.id);
      });

      ws.send(
        JSON.stringify({
          type: 'consumerCreated',
          data: {
            id: consumer.id,
            producerId: producer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          },
        }),
      );
    }
  });

  ws.on('close', () => {
    peers.delete(peerId);
  });
});

server.listen(3000, () => {
  console.log('SFU Server running on port 3000');
});
