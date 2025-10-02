import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBKQyWn8RlQ47f1PA9BQSP1OiIG6dON6XU",
  authDomain: "ghost-hunting-gallery.firebaseapp.com",
  databaseURL: "https://ghost-hunting-gallery-default-rtdb.firebaseio.com",
  projectId: "ghost-hunting-gallery",
  storageBucket: "ghost-hunting-gallery.firebasestorage.app",
  messagingSenderId: "486607492909",
  appId: "1:486607492909:web:57a9e8c026e48bb1bb25a4"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);