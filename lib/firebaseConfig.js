import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDKqtWAQ0ot_gaVeblNQuaqIyN7QE3vGm0",
    authDomain: "dsr-1-839c3.firebaseapp.com",
    projectId: "dsr-1-839c3",
    storageBucket: "dsr-1-839c3.firebasestorage.app",
    messagingSenderId: "541917740492",
    appId: "1:541917740492:web:4f8e288c44715ad380b169"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);