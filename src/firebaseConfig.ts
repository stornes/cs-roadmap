import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  projectId: "cs-roadmap-p-940d50",
  appId: "1:768594322364:web:217a456597df24d4e241b9",
  storageBucket: "cs-roadmap-p-940d50.firebasestorage.app",
  apiKey: "AIzaSyC7QFDKJXD6D4alRcFG3EQKJGTAw9LLHkw",
  authDomain: "cs-roadmap-p-940d50.firebaseapp.com",
  messagingSenderId: "768594322364",
  projectNumber: "768594322364",
  version: "2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
export const db = getFirestore(app);
export const storage = getStorage(app);
