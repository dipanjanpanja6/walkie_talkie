import { MediaStream } from 'react-native-webrtc';
import { RTCSessionDescriptionInit } from 'react-native-webrtc/lib/typescript/RTCSessionDescription';
import { firebaseDB } from './firebaseConfig';
import { RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, rtcConfiguration } from './webrtc';

export default class SignalingManager {
  channelId: string;
  userId: string;
  onRemoteTrack: (stream: MediaStream) => void;
  peerConnections: { [key: string]: RTCPeerConnection };

  constructor(channelId: string, userId: string, onRemoteTrack: (stream: MediaStream) => void) {
    this.channelId = channelId;
    this.userId = userId;
    this.onRemoteTrack = onRemoteTrack;
    this.peerConnections = {};
  }

  async joinChannel() {
    await firebaseDB.ref(`/channels/${this.channelId}/participants/${this.userId}`).set(true);
    this.monitorParticipants();
  }

  monitorParticipants() {
    firebaseDB.ref(`/channels/${this.channelId}/participants`).on('value', async snapshot => {
      const participants = snapshot.val() || {};
      const remoteUsers = Object.keys(participants).filter(id => id !== this.userId);

      remoteUsers.forEach(remoteId => {
        if (!this.peerConnections[remoteId]) {
          this.createConnection(remoteId, true);
        }
      });
    });

    this.listenForSignals();
  }

  listenForSignals() {
    firebaseDB.ref(`/signals/${this.channelId}`).on('child_added', snapshot => {
      const senderId = snapshot.key;
      if (senderId === this.userId) return;

      firebaseDB.ref(`/signals/${this.channelId}/${senderId}/${this.userId}/offer`).on('value', async snap => {
        const offer = snap.val();
        if (offer) await this.handleOffer(senderId!, offer);
      });

      firebaseDB.ref(`/signals/${this.channelId}/${senderId}/${this.userId}/ice`).on('child_added', snap => {
        const candidate = snap.val();
        this.peerConnections[senderId!]?.addIceCandidate(new RTCIceCandidate(candidate));
      });
    });
  }

  async createConnection(remoteId: string, isCaller: boolean) {
    const pc = new RTCPeerConnection(rtcConfiguration);
    this.peerConnections[remoteId] = pc;

    pc.ontrack = event => {
      if (event.streams[0]) {
        this.onRemoteTrack(event.streams[0]);
      }
    };

    pc.onicecandidate = event => {
      if (event.candidate) {
        firebaseDB.ref(`/signals/${this.channelId}/${this.userId}/${remoteId}/ice`).push(event.candidate.toJSON());
      }
    };

    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await firebaseDB.ref(`/signals/${this.channelId}/${this.userId}/${remoteId}/offer`).set(offer);
    }
  }

  async handleOffer(remoteId: string, offer: RTCSessionDescriptionInit) {
    await this.createConnection(remoteId, false);
    const pc = this.peerConnections[remoteId];
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await firebaseDB.ref(`/signals/${this.channelId}/${this.userId}/${remoteId}/answer`).set(answer);
  }

  async addStream(stream: MediaStream) {
    Object.values(this.peerConnections).forEach(pc => {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    });
  }

  async leave() {
    await firebaseDB.ref(`/channels/${this.channelId}/participants/${this.userId}`).remove();
    Object.values(this.peerConnections).forEach(pc => pc.close());
  }
}
