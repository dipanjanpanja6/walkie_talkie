import { getAuth, GoogleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { GoogleSignin, GoogleSigninButton } from '@react-native-google-signin/google-signin';
import React from 'react';
import { Text, View } from 'react-native';

GoogleSignin.configure({ webClientId: '320347144434-638enpvstauruiv2cufqfqeo8rc7r803.apps.googleusercontent.com' });

export default function Auth() {
  async function onGoogleButtonPress() {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();

      const idToken = signInResult.data?.idToken;

      if (!idToken) throw new Error('No ID token found');

      const googleCredential = GoogleAuthProvider.credential(signInResult.data?.idToken);

      return signInWithCredential(getAuth(), googleCredential);
    } catch (error) {
      console.error('Error during Google sign-in:', error);
      //   throw error;
    }
  }

  return (
    <View>
      <Text>Welcome </Text>
      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Dark}
        onPress={onGoogleButtonPress}
        // disabled={isInProgress}
      />
    </View>
  );
}
