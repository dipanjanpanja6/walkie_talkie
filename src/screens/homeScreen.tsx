import React, { useState } from 'react';
import { Button, StyleSheet, TextInput, View } from 'react-native';
import db from '../firebase';
import CallScreen from './callScreen';

export default function HomeScreen() {
  const [callId, setCallId] = useState('');
  const [start, setStart] = useState(false);
  const [isCaller, setIsCaller] = useState(true);

  if (start) return <CallScreen callId={callId} isCaller={isCaller} setStart={setStart} />;
  db.ref(`/`).on('value', snapshot => {
    console.log('ad', snapshot.val());
  });

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Enter call ID" onChangeText={setCallId} value={callId} />
      <Button
        title="Start Call"
        onPress={() => {
          setIsCaller(true);
          setStart(true);
        }}
      />
      <Button
        title="Join Call"
        onPress={() => {
          setIsCaller(false);
          setStart(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  input: { borderWidth: 1, marginBottom: 10, padding: 10 },
});
