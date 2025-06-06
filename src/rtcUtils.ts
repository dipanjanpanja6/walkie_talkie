import { RTCPeerConnection, mediaDevices } from 'react-native-webrtc';

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export const createPeerConnection = onAddStream => {
  const pc = new RTCPeerConnection(configuration);

  pc.onaddstream = event => {
    onAddStream(event.stream);
  };

  return pc;
};

export const getLocalStream = async () => {
  const stream = await mediaDevices.getUserMedia({ audio: true, video: false });

  return stream;
};
