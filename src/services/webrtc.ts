import { RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';

// Replace with your TURN server (Xirsys, Twilio, or self-hosted Coturn)
export const rtcConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'your-username',
      credential: 'your-password',
    },
  ],
};

export { RTCIceCandidate, RTCPeerConnection, RTCSessionDescription };

