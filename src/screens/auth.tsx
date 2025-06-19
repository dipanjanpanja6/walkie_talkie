import { getAuth, GoogleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import React from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

GoogleSignin.configure({ webClientId: '320347144434-638enpvstauruiv2cufqfqeo8rc7r803.apps.googleusercontent.com' });
export default function Auth() {
  const handleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const idToken = response.data?.idToken;

        if (!idToken) throw new Error('No ID token found');

        const googleCredential = GoogleAuthProvider.credential(response.data?.idToken);

        return signInWithCredential(getAuth(), googleCredential);
      } else {
        // sign in was cancelled by user
      }
    } catch (error) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.IN_PROGRESS:
            // operation (eg. sign in) already in progress
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            // Android only, play services not available or outdated
            break;
          default:
          // some other error happened
        }
      } else {
        // an error that's not related to google sign in occurred
      }
    }
  };
  return (
    <View style={{ padding: 24, flex: 1 }}>
      <Text variant="titleLarge">Welcome to WalkieTalkie</Text>
      <Text variant="titleMedium" style={{ paddingBottom: 24 }}>
        Join your team. Stay in sync.
      </Text>
      <View style={{ flex: 1 }} />
      <Button mode="contained" onPress={handleSignIn} icon={'google'}>
        Continue with Google
      </Button>
      <Text style={{ paddingTop: 12 }}>Quick and secure Google sign-in. No passwords, just push-to-talk.</Text>
    </View>
  );
}
