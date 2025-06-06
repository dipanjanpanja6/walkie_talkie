import database from '@react-native-firebase/database';
import { RTCIceCandidate, RTCPeerConnection, mediaDevices } from 'react-native-webrtc';

const servers = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const pc = new RTCPeerConnection(servers);

// 1. Get local audio stream
const stream = await mediaDevices.getUserMedia({ audio: true });
pc.addStream(stream);

// 2. Create offer
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

// 3. Save offer to Firebase
await database().ref(`/calls/${callId}/offer`).set(offer);

// 4. Listen for answer
database()
  .ref(`/calls/${callId}/answer`)
  .on('value', async snapshot => {
    const answer = snapshot.val();
    if (answer) {
      await pc.setRemoteDescription(answer);
    }
  });

// 5. Exchange ICE candidates
pc.onicecandidate = event => {
  if (event.candidate) {
    database().ref(`/calls/${callId}/callerCandidates`).push(event.candidate);
  }
};

// 6. Listen for callee ICE candidates
database()
  .ref(`/calls/${callId}/calleeCandidates`)
  .on('child_added', snapshot => {
    const candidate = new RTCIceCandidate(snapshot.val());
    pc.addIceCandidate(candidate);
  });
