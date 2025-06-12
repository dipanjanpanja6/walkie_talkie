import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Button, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { mediaDevices, MediaStream, RTCView } from 'react-native-webrtc';
import SignalingManager from '../services/signaling';
import { } from '../services/webrtc';
import { initializeUser } from '../utils/user';

const WalkieTalkieScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const { channelId } = route.params;

  const userId = useRef<string>(null);
  const signalingManager = useRef<SignalingManager>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micActive, setMicActive] = useState(false);

  useEffect(() => {
    init();
    return () => {
      signalingManager.current?.leave();
    };
  }, []);

  const init = async () => {
    await requestPermissions();
    userId.current = await initializeUser();
    signalingManager.current = new SignalingManager(channelId, userId.current, handleRemoteStream);
    await signalingManager.current.joinChannel();
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    }
  };

  const handleRemoteStream = (stream: MediaStream) => {
    setRemoteStream(stream);
  };

  const startTalking = async () => {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    setLocalStream(stream);
    await signalingManager.current?.addStream(stream);
    setMicActive(true);
  };

  const stopTalking = () => {
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    setMicActive(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Channel: {channelId}</Text>

      <TouchableOpacity style={[styles.button, micActive ? styles.active : {}]} onPressIn={startTalking} onPressOut={stopTalking}>
        <Text style={styles.buttonText}>{micActive ? 'Talking...' : 'Push to Talk'}</Text>
      </TouchableOpacity>

      {remoteStream && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={{ width: 1, height: 1 }} // silent playing remote stream
        />
      )}

      <Button title="Leave Channel" onPress={() => navigation.goBack()} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, marginBottom: 30 },
  button: { padding: 30, backgroundColor: '#555', borderRadius: 100 },
  active: { backgroundColor: 'red' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});

export default WalkieTalkieScreen;
