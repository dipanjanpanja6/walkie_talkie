import { getApp } from '@react-native-firebase/app';
import { getDatabase } from '@react-native-firebase/database';

const app = getApp();
console.log('Firebase App:', app.name);

const db = getDatabase(app);

export default db;
