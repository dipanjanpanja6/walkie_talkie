import { getAuth, signOut } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useNavigation } from '@react-navigation/native';
import { Appbar } from 'react-native-paper';

export default function AppBar({ title, back }: any) {
  const navigation = useNavigation();
  return (
    <Appbar.Header>
      {back ? <Appbar.BackAction onPress={navigation.goBack} /> : null}
      <Appbar.Content title={title} />
      <Appbar.Action
        icon={'logout'}
        onPress={async () => {
          await GoogleSignin.signOut();
          await signOut(getAuth());
        }}
      />
    </Appbar.Header>
  );
}
