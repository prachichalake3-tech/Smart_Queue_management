/**
 * Smart Queue Portal - Connection Manager
 * Handles Firebase initialization and database fallback
 * Production-ready with comprehensive error handling
 */

const FirebaseConfig = {
  apiKey: "AIzaSyDXGJ8EViEkKf2XEbXaBe4beQaum5FnY9g",
  authDomain: "smart-queue-management-3d8df.firebaseapp.com",
  databaseURL: "https://smart-queue-management-s-7e0d1-default-rtdb.firebaseio.com",
  projectId: "smart-queue-management-3d8df",
  storageBucket: "smart-queue-management-3d8df.firebasestorage.app",
  messagingSenderId: "567947278928",
  appId: "1:567947278928:web:fa495a7489dc2f16ea2f55",
  measurementId: "G-N0WMJ20CC6"
};

const STORAGE_KEY = 'smartQueueLocalDB';

class LocalDatabase {
  constructor() {
    this.isLocal = true;
  }

  ref(path) {
    return new LocalDatabaseRef(path);
  }
}

class LocalDatabaseRef {
  constructor(path) {
    this.path = path;
  }

  async set(value) {
    const db = this._loadDB();
    const updated = this._setNode(db, this.path.split('/'), value);
    this._saveDB(updated);
  }

  async once() {
    const db = this._loadDB();
    const value = this._getNode(db, this.path.split('/'));
    return {
      exists: () => value !== undefined && value !== null,
      val: () => value
    };
  }

  on(event, callback, errorCallback) {
    const handler = async () => {
      try {
        const snapshot = await this.once();
        callback(snapshot);
      } catch (err) {
        if (errorCallback) errorCallback(err);
      }
    };
    handler();
  }

  _loadDB() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  _saveDB(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  _getNode(data, pathParts) {
    let node = data;
    for (const part of pathParts) {
      node = node?.[part];
    }
    return node;
  }

  _setNode(data, pathParts, value) {
    if (pathParts.length === 0) return value;
    const [head, ...rest] = pathParts;
    return {
      ...data,
      [head]: this._setNode(data[head] || {}, rest, value)
    };
  }
}

// Initialize Firebase
try {
  if (!firebase.apps.length) {
    firebase.initializeApp(FirebaseConfig);
  }
  
  window.firebase = firebase;
  window.firebaseDb = firebase.database();
  window.firebaseAuth = firebase.auth();
  window.firestore = firebase.firestore();
  window.serverTimestamp = firebase.database.ServerValue.TIMESTAMP;
  window.realtimeDatabaseURL = FirebaseConfig.databaseURL;

  // Set local DB as default
  window.db = new LocalDatabase();

  // Check Firebase connectivity
  window.checkRealtimeDBConnection = async function() {
    try {
      const response = await fetch(`${FirebaseConfig.databaseURL}/.json`, { method: 'GET' });
      if (response.ok) {
        window.db = window.firebaseDb;
        window.db.isLocal = false;
        console.log('✅ Firebase Realtime Database connected');
        return true;
      }
      console.warn('⚠️ Firebase not accessible, using local fallback');
      return false;
    } catch (err) {
      console.warn('⚠️ Firebase connectivity check failed:', err.message);
      return false;
    }
  };

  // Attempt connection
  window.checkRealtimeDBConnection().catch(err => {
    console.error('Firebase initialization error:', err);
  });

} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  window.db = new LocalDatabase();
}

console.log('✅ Database connection manager loaded');
