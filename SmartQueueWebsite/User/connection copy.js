// Import the functions you need from the SDKs you want to use
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "smart-queue-management-s-7e0d1.firebaseapp.com", // This is often derived from your Project ID
  databaseURL: "https://smart-queue-management-s-7e0d1-default-rtdb.firebaseio.com", // Your provided RTDB URL
  projectId: "smart-queue-management-s-7e0d1", // Your provided Project ID
  storageBucket: "smart-queue-management-s-7e0d1.appspot.com", // This is often derived from your Project ID
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const database = getDatabase(app);

// Now 'database' is your reference to the Realtime Database.
// You can use it to read and write data.
// For example, to get a reference to a specific path:
// import { ref } from "firebase/database";
// const myDataRef = ref(database, 'path/to/your/data');
