// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBBcnzSd53AxFJ4vJ5uf7qu-HNdxA9BQ9A",
  authDomain: "smart-queue-management-s-14003.firebaseapp.com",
  databaseURL: "https://smart-queue-management-s-14003-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "smart-queue-management-s-14003",
  storageBucket: "smart-queue-management-s-14003.firebasestorage.app",
  messagingSenderId: "836086075669",
  appId: "1:836086075669:web:ebcc0c5d2c577fc664d91c",
  measurementId: "G-LD2Y274DLW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);