import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCuACKBe7UMFPjXr2CYFqIvJDjwn4czFA",
  authDomain: "rmstu-bus-booking.firebaseapp.com",
  projectId: "rmstu-bus-booking",
  storageBucket: "rmstu-bus-booking.firebasestorage.app",
  messagingSenderId: "260527346078",
  appId: "1:260527346078:web:4acc4368b32bbe5ff0868f",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);