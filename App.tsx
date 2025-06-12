import { FirebaseAuthTypes, getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import WalkieTalkieScreen from './src/screens/callScreen';
import HomeScreen from './src/screens/homeScreen';

const Stack = createStackNavigator();

export default function App() {
  // Set an initializing state whilst Firebase connects
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  // Handle user state changes
  function handleAuthStateChanged(user: FirebaseAuthTypes.User | null) {
    setUser(user);
    if (initializing) setInitializing(false);
  }

  useEffect(() => {
    const subscriber = onAuthStateChanged(getAuth(), handleAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, []);

  if (initializing) return null;

  // if (!user) return <Auth />;

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="ChannelList">
        <Stack.Screen name="ChannelList" component={HomeScreen} />
        <Stack.Screen name="WalkieTalkie" component={WalkieTalkieScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
