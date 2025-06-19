import React, { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Avatar, FAB, IconButton, List, Surface, Text } from 'react-native-paper';
import { mediaDevices } from 'react-native-webrtc';
import SignalingManager from '../services/signaling';
import { initializeUser } from '../utils/user';

export default function HomeScreen() {
  const [channel, setChannel] = useState(100.1);

  const handleMic = () => {
    if (micActive) startTalking();
    else stopTalking();
  };

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
    signalingManager.current = new SignalingManager(channel.toString(), userId.current, handleRemoteStream);
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
      <Surface style={{ padding: 20, marginVertical: 12, borderRadius: 12 }}>
        <Text style={styles.freq}>{channel.toFixed(2)}</Text>
      </Surface>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <IconButton
          icon={'arrow-left-drop-circle'}
          size={50}
          onPress={() => {
            setChannel(s => s - 0.01);
          }}
        />
        <IconButton
          icon={'shuffle-variant'}
          size={50}
          onPress={() => {
            const random = (Math.random() * 99 + 1).toFixed(2);
            setChannel(Number(random));
          }}
        />
        <IconButton
          icon={'arrow-right-drop-circle'}
          size={50}
          onPress={() => {
            setChannel(s => s + 0.01);
          }}
        />
      </View>

      <FlatList
        data={[]}
        keyExtractor={item => item}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Surface style={{ borderRadius: 12, margin: 2 }}>
            <List.Item title="Su44ee" description="__PeaCe" left={props => <Avatar.Icon {...props} color="#fff" icon="emoticon-cool-outline" />} />
          </Surface>
        )}
      />
      <View style={{ width: '100%', alignItems: 'center' }}>
        <FAB icon={micActive ? 'microphone-off' : 'microphone'} size="large" color="red" style={styles.mic} onPress={handleMic} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mic: { borderRadius: 50 },
  freq: { fontFamily: '"Matangi", sans-serif', textAlign: 'center', fontSize: 70 },
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
});
