import '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

export const firebaseAuth = auth();
export const firebaseDB = database();
