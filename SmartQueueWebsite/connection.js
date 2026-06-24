const firebaseConfig = {
  apiKey: "AIzaSyDXGJ8EViEkKf2XEbXaBe4beQaum5FnY9g",
  authDomain: "smart-queue-management-3d8df.firebaseapp.com",
  databaseURL: "https://smart-queue-management-s-7e0d1-default-rtdb.firebaseio.com",
  projectId: "smart-queue-management-3d8df",
  storageBucket: "smart-queue-management-3d8df.firebasestorage.app",
  messagingSenderId: "567947278928",
  appId: "1:567947278928:web:fa495a7489dc2f16ea2f55",
  measurementId: "G-N0WMJ20CC6"
};

// NOTE: The Realtime Database endpoint must exist and be reachable.
// If this URL returns 404, create a Realtime Database instance in Firebase
// Console and update databaseURL accordingly.

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  window.firebase = firebase;
  window.firebaseDb = firebase.database();
  // Expose Auth and Firestore for use in pages
  try {
    window.firebaseAuth = firebase.auth();
    window.firestore = firebase.firestore();
  } catch (e) {
    console.warn('Firestore/Auth not available via compat scripts:', e);
  }
  window.serverTimestamp = firebase.database.ServerValue.TIMESTAMP;
  window.realtimeDatabaseURL = firebaseConfig.databaseURL;

  const STORAGE_KEY = 'smartQueueLocalDB';

  const loadLocalDB = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (err) {
      return {};
    }
  };

  const saveLocalDB = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const getPathParts = (path) => path.split('/').filter(Boolean);

  const getNode = (data, pathParts, create = false) => {
    let node = data;
    for (const part of pathParts) {
      if (node[part] == null) {
        if (!create) return undefined;
        node[part] = {};
      }
      node = node[part];
    }
    return node;
  };

  const setNode = (data, pathParts, value) => {
    if (pathParts.length === 0) {
      return value;
    }
    const [head, ...rest] = pathParts;
    return {
      ...data,
      [head]: setNode(data[head] || {}, rest, value)
    };
  };

  const deleteNode = (data, pathParts) => {
    if (pathParts.length === 0) return undefined;
    const [head, ...rest] = pathParts;
    if (!data || data[head] == null) return data;
    if (rest.length === 0) {
      const copy = { ...data };
      delete copy[head];
      return copy;
    }
    return {
      ...data,
      [head]: deleteNode(data[head], rest)
    };
  };

  const createSnapshot = (value, key = null) => ({
    key,
    exists: () => value !== undefined && value !== null,
    val: () => value,
    forEach: (callback) => {
      if (value && typeof value === 'object') {
        Object.entries(value).forEach(([childKey, childValue]) => {
          callback(createSnapshot(childValue, childKey));
        });
      }
    }
  });

  const createLocalRef = (path) => {
    const parts = getPathParts(path);

    return {
      set: async (value) => {
        const root = loadLocalDB();
        const updated = setNode(root, parts, value);
        saveLocalDB(updated);
      },
      once: async () => {
        const root = loadLocalDB();
        const value = getNode(root, parts, false);
        return createSnapshot(value);
      },
      remove: async () => {
        const root = loadLocalDB();
        const updated = deleteNode(root, parts);
        saveLocalDB(updated || {});
      },
      update: async (value) => {
        const root = loadLocalDB();
        const existing = getNode(root, parts, false) || {};
        const merged = { ...existing, ...value };
        const updated = setNode(root, parts, merged);
        saveLocalDB(updated);
      },
      push: async (value) => {
        const key = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const root = loadLocalDB();
        const node = getNode(root, parts, true);
        node[key] = value;
        saveLocalDB(root);
        return { key };
      },
      orderByChild: (childField) => {
        return {
          limitToLast: (limit) => ({
            once: async () => {
              const root = loadLocalDB();
              const node = getNode(root, parts, false) || {};
              const entries = Object.entries(node)
                .sort(([,a], [,b]) => (b?.[childField] || 0) - (a?.[childField] || 0))
                .slice(0, limit)
                .reduce((acc, [k,v]) => {
                  acc[k] = v;
                  return acc;
                }, {});
              return createSnapshot(entries);
            }
          })
        };
      }
    };
  };

  const createLocalDB = () => ({
    ref: createLocalRef,
    isLocal: true
  });

  const setRemoteDB = () => {
    window.db = window.firebaseDb;
    window.db.isLocal = false;
  };

  const setLocalDB = () => {
    window.db = createLocalDB();
    window.db.isLocal = true;
  };

  window.realtimeDBFetch = async function(path, options = {}) {
    const [rawPath, query] = path.split('?');
    const normalizedPath = rawPath.replace(/^\/+/, '');
    const queryString = query ? `?${query}` : '';
    const url = `${firebaseConfig.databaseURL}/${normalizedPath}.json${queryString}`;
    const response = await fetch(url, options);
    const body = await response.text();
    if (!response.ok) {
      const message = body || `${response.status} ${response.statusText}`;
      throw new Error(`Realtime DB REST request failed: ${message}`);
    }
    return body ? JSON.parse(body) : null;
  };

  setLocalDB();

  window.checkRealtimeDBConnection = async function() {
    try {
      const response = await fetch(`${firebaseConfig.databaseURL}/.json`, { method: 'GET' });
      if (response.ok) {
        setRemoteDB();
        return true;
      }
      if (response.status === 401 || response.status === 403) {
        console.warn('Realtime DB exists but is not accessible without auth or rules update. Using local fallback.');
      }
      return false;
    } catch (err) {
      console.warn('Realtime DB connectivity check error:', err);
      return false;
    }
  };

  window.checkRealtimeDBConnection().then((connected) => {
    if (!connected) {
      console.warn('Realtime DB not reachable; using local fallback database.');
      window.showToast?.('Realtime DB not reachable; using local fallback database.', 'warning');
    } else {
      console.log('Realtime DB reachable; using remote database.');
    }
  });

  console.log('✅ Firebase Realtime Database initialized');
} catch (error) {
  console.warn('⚠️ Unable to initialize Firebase Realtime Database:', error);
  window.db = null;
}
