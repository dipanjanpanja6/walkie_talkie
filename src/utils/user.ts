import { firebaseAuth } from '../services/firebaseConfig';

export const initializeUser = async () => {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    const user = await firebaseAuth.signInAnonymously();
    return user.user.uid;
  }
  return currentUser.uid;
};
