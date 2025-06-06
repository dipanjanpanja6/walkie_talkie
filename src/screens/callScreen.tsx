import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, PermissionsAndroid, Platform, Text, View } from 'react-native';
import { mediaDevices, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import db from '../firebase';

const servers = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const CallScreen = ({ callId, isCaller, setStart }: any) => {
  const pc = useRef(new RTCPeerConnection(servers));
  const [status, setStatus] = useState('Initializing...');
  const localStream = useRef<MediaStream | null>(null);
  const ref = db.ref(`/calls/${callId}`);

  useEffect(() => {
    const setup = async () => {
      await requestPermissions();

      await setupMedia();

      console.log('got permissions');
      if (isCaller) {
        createOffer();
      } else {
        listenForOffer();
      }

      listenForIceCandidates();
    };
    setup().catch(error => {
      Alert.alert('Setup Error', 'Failed to setup call: ' + error.message);
    });
    return () => {
      cleanup();
    };
  }, []);

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    } catch (error) {
      Alert.alert('Permission Error', 'Failed to get audio permissions');
      console.error('Permission error:', error);
    }
  };

  const setupMedia = async () => {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    localStream.current = stream;
    stream.getTracks().forEach(track => {
      pc.current.addTrack(track, stream);
    });
    setStatus('Microphone ready');
  };

  const createOffer = async () => {
    const offer = await pc.current.createOffer({});
    await pc.current.setLocalDescription(offer);
    console.log('Offer created:', offer);

    await ref.set(offer);

    console.log(await ref.once('value'));

    setStatus('Calling...');
  };

  const listenForOffer = () => {
    db.ref(`/calls/${callId}/offer`).on('value', async snapshot => {
      const offer = snapshot.val();
      if (offer) {
        await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        await db.ref(`/calls/${callId}/answer`).set(answer);
        setStatus('Answered');
      }
    });
  };

  const listenForIceCandidates = () => {
    pc.current.onicecandidate = event => {
      if (event.candidate) {
        const type = isCaller ? 'callerCandidates' : 'calleeCandidates';
        db.ref(`/calls/${callId}/${type}`).push(event.candidate.toJSON());
      }
    };

    const remoteType = isCaller ? 'calleeCandidates' : 'callerCandidates';
    db.ref(`/calls/${callId}/${remoteType}`).on('child_added', snapshot => {
      const candidate = new RTCIceCandidate(snapshot.val());
      pc.current.addIceCandidate(candidate);
    });

    db.ref(`/calls/${callId}/answer`).on('value', async snapshot => {
      const answer = snapshot.val();
      if (answer && !isCaller) return;
      if (answer) {
        await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
        setStatus('In call');
      }
    });
  };

  const cleanup = async () => {
    try {
      console.log('call cleanup started');

      pc.current.close();
      ref.remove();
      console.log('call cleanup completed');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Status: {status}</Text>
      <Button title="Hang up" onPress={() => setStart(false)} />
    </View>
  );
};

export default CallScreen;
