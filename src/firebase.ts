import { getApp } from '@react-native-firebase/app';
import { getDatabase } from '@react-native-firebase/database';

const app = getApp();
console.log('Firebase App:', app.name);

const db = getDatabase(app);
console.log({ db });

const setup = async () => {
  try {
    await db.ref('/test').set({ initialized: true });
    console.log('Database initialized successfully.');
    db.ref('/test').on('value', snapshot => {
      console.log('Database snapshot:', snapshot.val());
    });
  } catch (error) {
    console.error('Firebase App Error:', error);
  }
};

setup().catch(error => {
  console.error('Setup Error:', error);
});

export default db;
