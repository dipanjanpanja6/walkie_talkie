import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Button, FlatList, StyleSheet, Text, View } from 'react-native';

const channels = ['98.1', '98.3', '98.5', '99.1', '100.1', '100.5'];
export default function HomeScreen() {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select a Channel</Text>
      <FlatList
        data={channels}
        keyExtractor={item => item}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Button title={`Join Channel ${item}`} onPress={() => navigation.navigate('WalkieTalkie', { channelId: item })} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  item: { marginVertical: 10 },
});
