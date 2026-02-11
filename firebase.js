// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDp1xll_VkiCQcJhxkMa7ggYpfgAbZFXds",
  authDomain: "q-autolux.firebaseapp.com",
  projectId: "q-autolux",
  storageBucket: "q-autolux.firebasestorage.app",
  messagingSenderId: "958237455585",
  appId: "1:958237455585:web:7f8eb1848dd7de8fe0b3a0",
  measurementId: "G-WTET9LS8G6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);

// Export for use in other JS files
export { app, analytics, auth, db };