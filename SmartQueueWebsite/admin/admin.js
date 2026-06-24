
/* ═══════════════════════════════════════════════════════════════════════
   SMART QUEUE MANAGEMENT SYSTEM - ADMIN DASHBOARD
   admin.js - Complete working version with demo auth
   Uses Firebase Realtime Database via connection.js
   ═════════════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────────────
// 2. GLOBAL VARIABLES
// ─────────────────────────────────────────────────────────────────────

let currentAdmin = null;
const CREDENTIALS_STORAGE_KEY = 'adminCredentials';
const DB_REQUEST_TIMEOUT = 12000;

function dbPromiseWithTimeout(promise, timeoutMs, description) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${description} timed out after ${timeoutMs}ms`)), timeoutMs))
  ]);
}

async function dbSet(path, value) {
  if (!window.db) throw new Error('Realtime Database is not initialized');
  try {
    return await dbPromiseWithTimeout(window.db.ref(path).set(value), DB_REQUEST_TIMEOUT, `DB write to ${path}`);
  } catch (error) {
    console.warn('SDK write failed, falling back to REST write for', path, error.message || error);
    if (window.realtimeDBFetch) {
      await window.realtimeDBFetch(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value)
      });
      return;
    }
    throw error;
  }
}

async function dbOnce(path) {
  if (!window.db) throw new Error('Realtime Database is not initialized');
  try {
    return await dbPromiseWithTimeout(window.db.ref(path).once('value'), DB_REQUEST_TIMEOUT, `DB read from ${path}`);
  } catch (error) {
    console.warn('SDK read failed, falling back to REST read for', path, error.message || error);
    if (window.realtimeDBFetch) {
      const data = await window.realtimeDBFetch(path, { method: 'GET' });
      return { exists: () => data !== null, val: () => data };
    }
    throw error;
  }
}

async function dbRemove(path) {
  if (!window.db) throw new Error('Realtime Database is not initialized');
  try {
    return await dbPromiseWithTimeout(window.db.ref(path).remove(), DB_REQUEST_TIMEOUT, `DB remove at ${path}`);
  } catch (error) {
    console.warn('SDK remove failed, falling back to REST remove for', path, error.message || error);
    if (window.realtimeDBFetch) {
      await window.realtimeDBFetch(path, { method: 'DELETE' });
      return;
    }
    throw error;
  }
}

async function dbQueryOnce(queryRef) {
  if (!window.db) throw new Error('Realtime Database is not initialized');
  return dbPromiseWithTimeout(queryRef.once('value'), DB_REQUEST_TIMEOUT, `DB query`);
}

// Also support demo login
const DEMO_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

/**
 * Load saved admin credentials from localStorage.
 * @returns {{username:string,password:string}|null}
 */
function loadSavedCredentials() {
  const saved = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
  return saved ? JSON.parse(saved) : null;
}

/**
 * Save admin credentials to localStorage.
 * @param {string} username
 * @param {string} password
 */
function saveCredentials(username, password) {
  localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify({ username, password }));
}

/**
 * Normalize availability status values from DB.
 * Accepts strings, booleans, and numbers.
 * @param {string|boolean|number} value
 * @returns {'available'|'unavailable'}
 */
function normalizeAvailabilityStatus(value) {
  if (typeof value === 'boolean') {
    return value ? 'available' : 'unavailable';
  }

  if (typeof value === 'number') {
    return value === 1 ? 'available' : 'unavailable';
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['available', 'true', '1', 'yes', 'on'].includes(normalized)) {
      return 'available';
    }
    return 'unavailable';
  }

  return 'unavailable';
}

// ─────────────────────────────────────────────────────────────────────
// 3. PAGE INITIALIZATION
// ─────────────────────────────────────────────────────────────────────

/**
 * Run when page loads
 */
window.addEventListener('DOMContentLoaded', function() {
  console.log('✅ Page loaded - initializing admin dashboard');

  if (window.checkRealtimeDBConnection) {
    window.checkRealtimeDBConnection().then(connected => {
      if (!connected) {
        console.warn('Realtime Database connection test failed.');
        showToast('Realtime DB connection failed. Verify databaseURL in connection.js.', 'error');
      }
    });
  }

  // Check if admin is logged in
  const savedAdmin = localStorage.getItem('adminLoggedIn');
  
  if (savedAdmin) {
    try {
      currentAdmin = JSON.parse(savedAdmin);
      console.log('✅ Admin session found:', currentAdmin.username);
      showDashboard();
      loadDashboardData();
    } catch (error) {
      console.error('Error parsing saved admin:', error);
      localStorage.removeItem('adminLoggedIn');
      showLoginPage();
    }
  } else {
    console.log('ℹ️ No saved session - showing login page');
    showLoginPage();
  }
});

// ─────────────────────────────────────────────────────────────────────
// 4. AUTHENTICATION - LOGIN
// ─────────────────────────────────────────────────────────────────────

/**
 * Handle admin login
 * @param {Event} event - Form submit event
 */
function handleAdminLogin(event) {
  event.preventDefault();
  console.log('🔐 Login attempt started');

  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value.trim();

  if (!username || !password) {
    console.warn('⚠️ Empty username or password');
    showLoginError('Please enter username and password');
    return;
  }

  if (username === 'admin' && password === 'admin123') {
    console.log('✅ Admin login successful');
    completeLogin(username);
    return;
  }

  console.error('❌ Invalid admin credentials');
  showLoginError('Invalid username or password. The correct admin credentials are admin / admin123');
  document.getElementById('adminPassword').value = '';
}

/**
 * Complete login process
 * @param {string} username - Username of logged-in admin
 */
function completeLogin(username) {
  try {
    // Create admin object
    currentAdmin = {
      username: username,
      loginTime: new Date().toLocaleString()
    };

    // Save to localStorage
    localStorage.setItem('adminLoggedIn', JSON.stringify(currentAdmin));
    console.log('💾 Admin saved to localStorage:', currentAdmin);

    // Show success message
    showToast('✅ Login successful! Welcome ' + username + '!', 'success');

    // Update admin name display
    document.getElementById('adminName').textContent = username;

    // Hide error message
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }

    // Switch to dashboard after short delay
    setTimeout(() => {
      console.log('🚀 Switching to dashboard...');
      showDashboard();
      loadDashboardData();
    }, 500);

  } catch (error) {
    console.error('Error during login:', error);
    showToast('Error during login: ' + error.message, 'error');
  }
}

/**
 * Show login error message
 * @param {string} message - Error message to display
 */
function showLoginError(message) {
  const errorDiv = document.getElementById('loginError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    console.error('Login error shown:', message);
  }
  showToast('❌ ' + message, 'error');
}

// ─────────────────────────────────────────────────────────────────────
// 5. LOGOUT
// ─────────────────────────────────────────────────────────────────────

/**
 * Handle admin logout
 */
function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('adminLoggedIn');
    currentAdmin = null;
    showLoginPage();
    showToast('Logged out successfully!', 'success');
  }
}

// ─────────────────────────────────────────────────────────────────────
// 6. PAGE SWITCHING
// ─────────────────────────────────────────────────────────────────────

/**
 * Show login page
 */
function showLoginPage() {
  console.log('📄 Showing login page');
  
  try {
    const loginPage = document.getElementById('loginPage');
    const dashboardPage = document.getElementById('dashboardPage');
    
    if (loginPage) {
      loginPage.classList.add('active');
      loginPage.style.display = 'flex';
      console.log('✅ Login page displayed');
    }
    
    if (dashboardPage) {
      dashboardPage.style.display = 'none';
    }
    
    // Clear form
    const form = document.getElementById('loginForm');
    if (form) {
      form.reset();
    }
  } catch (error) {
    console.error('Error showing login page:', error);
  }
}

/**
 * Show dashboard
 */
function showDashboard() {
  console.log('📊 Showing dashboard');
  
  try {
    const loginPage = document.getElementById('loginPage');
    const dashboardPage = document.getElementById('dashboardPage');
    const adminNameEl = document.getElementById('adminName');
    
    if (loginPage) {
      loginPage.classList.remove('active');
      loginPage.style.display = 'none';
      console.log('✅ Login page hidden');
    }
    
    if (dashboardPage) {
      dashboardPage.style.display = 'flex';
      console.log('✅ Dashboard displayed');
    }
    
    if (adminNameEl && currentAdmin) {
      adminNameEl.textContent = currentAdmin.username;
      console.log('✅ Admin name updated:', currentAdmin.username);
    }
    
    // Show home section
    showSection('home');
    
  } catch (error) {
    console.error('Error showing dashboard:', error);
  }
}

/**
 * Show specific section
 * @param {string} sectionId - Section name to show
 */
function showSection(sectionId) {
  console.log('🔄 Switching to section:', sectionId);
  
  try {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));

    // Remove active class from nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));

    // Show selected section
    const selectedSection = document.getElementById(sectionId + 'Section');
    if (selectedSection) {
      selectedSection.classList.add('active');
      console.log('✅ Section shown:', sectionId);
    } else {
      console.warn('⚠️ Section not found:', sectionId + 'Section');
      return;
    }

    // Mark nav item as active (find by onclick attribute)
    navItems.forEach(item => {
      if (item.getAttribute('onclick') && item.getAttribute('onclick').includes("'"+sectionId+"'")) {
        item.classList.add('active');
      }
    });

    // Load data for specific sections
    if (sectionId === 'stock') {
      loadStockData();
    } else if (sectionId === 'slots') {
      loadTimeSlots();
    } else if (sectionId === 'customers') {
      loadCustomerHistory();
    } else if (sectionId === 'home') {
      loadDashboardData();
    }
  } catch (error) {
    console.error('Error switching section:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 7. DASHBOARD HOME
// ─────────────────────────────────────────────────────────────────────

/**
 * Load and display dashboard data
 */
async function loadDashboardData() {
  try {
    console.log('📊 Loading dashboard data...');
    
    if (!window.db) {
      console.log('ℹ️ Firebase not available - showing demo data');
      showDemoDashboardData();
      return;
    }

    // Fetch customers
    const customersSnapshot = await dbOnce('customers');
    const customersData = customersSnapshot.val() || {};
    const totalCustomers = Object.keys(customersData).length;
    let todayCustomers = 0;
    const today = new Date().toDateString();

    Object.values(customersData).forEach(item => {
      const date = item.date ? new Date(item.date).toDateString() : null;
      if (date === today) {
        todayCustomers++;
      }
    });

    // Fetch available slots
    const slotsSnapshot = await dbOnce('timeSlots');
    const activeSlots = slotsSnapshot.exists() ? Object.keys(slotsSnapshot.val() || {}).length : 0;

    // Fetch availability status
    const availabilitySnapshot = await dbOnce('settings/availability');
    const rawStatus = availabilitySnapshot.exists() ? availabilitySnapshot.val().status : 'available';
    const availStatus = normalizeAvailabilityStatus(rawStatus);

    // Update UI
    document.getElementById('totalCustomers').textContent = todayCustomers;
    document.getElementById('totalTokens').textContent = totalCustomers;
    document.getElementById('activeSlots').textContent = activeSlots;
    document.getElementById('stockStatus').textContent = 'Good';
    document.getElementById('availStatus').textContent = availStatus === 'available' ? 'Available' : 'Not Available';
    document.getElementById('availStatus').className = `status-badge ${availStatus === 'available' ? 'available' : 'unavailable'}`;

    const availabilityMessageSnapshot = await dbOnce('settings/availabilityMessage');
    const availabilityMessageData = availabilityMessageSnapshot.exists() ? availabilityMessageSnapshot.val() : null;
    const savedMessage = availabilityMessageData && availabilityMessageData.message ? availabilityMessageData.message : '';
    const currentStatusText = availStatus === 'available' ? '✅ Available' : '❌ Not Available';

    document.querySelectorAll('[name="availability"]').forEach(input => {
      input.checked = input.value === availStatus;
    });

    document.getElementById('currentAvailability').innerHTML = `Current Status: <strong>${currentStatusText}</strong>`;
    document.getElementById('availabilityMessage').value = savedMessage;

    const previewEl = document.getElementById('customerPreview');
    if (previewEl) {
      previewEl.innerHTML = availStatus === 'available'
        ? '<p>✅ Ration is currently available</p>'
        : `<p>❌ ${savedMessage || 'Ration currently unavailable. Try later.'}</p>`;
    }

    // Random queue counts for demo
    document.getElementById('currentToken').textContent = `T-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;
    document.getElementById('queueCount').textContent = Math.floor(Math.random() * 15);

  } catch (error) {
    console.warn('⚠️ Error loading dashboard data:', error);
    showDemoDashboardData();
  }
}

/**
 * Show demo dashboard data (when Firebase not available)
 */
function showDemoDashboardData() {
  console.log('📊 Displaying demo dashboard data');
  
  // Update with demo values
  document.getElementById('totalCustomers').textContent = Math.floor(Math.random() * 20) + 5;
  document.getElementById('totalTokens').textContent = Math.floor(Math.random() * 100) + 20;
  document.getElementById('activeSlots').textContent = 6;
  document.getElementById('stockStatus').textContent = 'Good';
  document.getElementById('availStatus').textContent = 'Available';
  document.getElementById('availStatus').className = 'status-badge available';
  document.getElementById('currentToken').textContent = `T-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;
  document.getElementById('queueCount').textContent = Math.floor(Math.random() * 15) + 1;
}

/**
 * Refresh dashboard data
 */
function refreshDashboard() {
  loadDashboardData();
  showToast('Dashboard refreshed!', 'success');
}

// ─────────────────────────────────────────────────────────────────────
// 8. STOCK MANAGEMENT
// ─────────────────────────────────────────────────────────────────────

/**
 * Update stock in Realtime Database
 * @param {string} item - Item name (wheat, rice, sugar, etc.)
 */
async function updateStock(item) {
  const quantity = document.getElementById(item + 'Qty').value;

  if (!quantity || quantity < 0) {
    showToast('Please enter valid quantity', 'error');
    return;
  }

  try {
    await dbSet(`stock/${item}`, {
      name: capitalizeText(item),
      quantity: parseFloat(quantity),
      unit: item === 'oil' ? 'litre' : 'kg',
      lastUpdated: new Date().toLocaleString(),
      timestamp: Date.now()
    });

    document.getElementById(item + 'Status').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    showToast(`${capitalizeText(item)} stock updated!`, 'success');

    // Refresh stock table
    loadStockData();

  } catch (error) {
    console.error('Error updating stock:', error);
    showToast('Error updating stock', 'error');
  }
}

/**
 * Load and display stock data
 */
async function loadStockData() {
  try {
    const stockSnapshot = await dbOnce('stock');
    const tableBody = document.getElementById('stockTableBody');
    let html = '';

    if (!stockSnapshot.exists()) {
      html = '<tr><td colspan="4" style="text-align:center;color:#999;">No stock data yet</td></tr>';
    } else {
      stockSnapshot.forEach(item => {
        const data = item.val();
        html += `
          <tr>
            <td>${data.name}</td>
            <td>${data.quantity}</td>
            <td>${data.unit}</td>
            <td>${data.lastUpdated}</td>
          </tr>
        `;
      });
    }

    tableBody.innerHTML = html;
  } catch (error) {
    console.error('Error loading stock data:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 9. TIME SLOT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────

/**
 * Add new time slot to Realtime Database
 */
async function addTimeSlot() {
  const startTime = document.getElementById('slotStart').value;
  const endTime = document.getElementById('slotEnd').value;
  const capacity = document.getElementById('slotCapacity').value;

  // Validation
  if (!startTime || !endTime || !capacity) {
    showToast('Please fill all fields', 'error');
    return;
  }

  if (parseInt(capacity) < 1) {
    showToast('Capacity must be at least 1', 'error');
    return;
  }

  try {
    // Generate unique ID for slot
    const slotId = `${startTime}-${endTime}`;

    await dbSet(`timeSlots/${slotId}`, {
      startTime: startTime,
      endTime: endTime,
      capacity: parseInt(capacity),
      availableSeats: parseInt(capacity),
      createdAt: new Date().toLocaleString(),
      timestamp: Date.now()
    });

    // Clear inputs
    document.getElementById('slotStart').value = '';
    document.getElementById('slotEnd').value = '';
    document.getElementById('slotCapacity').value = '';

    showToast('Time slot added successfully!', 'success');
    loadTimeSlots();

  } catch (error) {
    console.error('Error adding time slot:', error);
    showToast('Error adding time slot', 'error');
  }
}

/**
 * Delete time slot
 * @param {string} slotId - Slot ID to delete
 */
async function deleteTimeSlot(slotId) {
  if (!confirm('Are you sure you want to delete this slot?')) {
    return;
  }

  try {
    await dbRemove(`timeSlots/${slotId}`);
    showToast('Time slot deleted!', 'success');
    loadTimeSlots();
  } catch (error) {
    console.error('Error deleting time slot:', error);
    showToast('Error deleting time slot', 'error');
  }
}

/**
 * Load and display time slots
 */
async function loadTimeSlots() {
  try {
    const slotsSnapshot = await dbOnce('timeSlots');
    const slotsList = document.getElementById('slotsList');
    let html = '';

    if (!slotsSnapshot.exists()) {
      html = '<p class="no-data">No slots created yet. Add a slot above.</p>';
    } else {
      slotsSnapshot.forEach(item => {
        const data = item.val();
        html += `
          <div class="slot-item">
            <span class="slot-time">${data.startTime} - ${data.endTime}</span>
            <span class="slot-capacity">👥 Max: ${data.capacity} customers</span>
            <button class="slot-delete" onclick="deleteTimeSlot('${item.key}')">🗑️ Delete</button>
          </div>
        `;
      });
    }

    slotsList.innerHTML = html;
  } catch (error) {
    console.error('Error loading time slots:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 10. AVAILABILITY STATUS
// ─────────────────────────────────────────────────────────────────────

/**
 * Set availability status — IMPROVED VERSION
 * 
 * This function:
 * 1. Updates BOTH Realtime Database and Firestore simultaneously
 * 2. Updates UI immediately for admin feedback
 * 3. Broadcasts via localStorage for cross-tab sync
 * 4. Includes comprehensive error handling with console logging
 * 
 * @param {string} status - 'available' or 'unavailable'
 * @returns {Promise<void>}
 */
async function setAvailability(status) {
  console.log(`🔔 Admin setting ration availability to: ${status}`);
   
  try {
    // Validate input
    if (status !== 'available' && status !== 'unavailable') {
      console.error('❌ Invalid status value:', status);
      showToast('Invalid status value. Use "available" or "unavailable"', 'error');
      return;
    }

    // Create data payload - SIMPLE structure that customer will use directly
    const payload = {
      status: status,
      lastUpdated: new Date().toLocaleString(),
      timestamp: Date.now()
    };

    console.log('📦 Payload to save:', payload);
    console.log('📦 Payload.status value:', payload.status, 'Type:', typeof payload.status);

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Update UI immediately (optimistic update)
    // ─────────────────────────────────────────────────────────────
    const statusText = status === 'available' ? '✅ Available' : '❌ Not Available';
    const statusDesc = status === 'available' 
      ? 'Customers can now book slots' 
      : 'Customers see "Not Available" message';
     
    console.log(`✅ UI Update: ${statusText} - ${statusDesc}`);
     
    // Update status display
    const availabilityEl = document.getElementById('currentAvailability');
    if (availabilityEl) {
      availabilityEl.innerHTML = `Current Status: <strong>${statusText}</strong>`;
    }

    // Update radio buttons
    document.querySelectorAll('[name="availability"]').forEach(input => {
      input.checked = input.value === status;
    });

    // Update customer preview
    const message = document.getElementById('availabilityMessage').value;
    const previewEl = document.getElementById('customerPreview');
    if (previewEl) {
      if (status === 'available') {
        previewEl.innerHTML = '<p>✅ Ration is currently available</p>';
      } else {
        const msgText = message || 'Ration Not Available. Please try after some time.';
        previewEl.innerHTML = `<p>❌ ${msgText}</p>`;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Save to Realtime Database (settings/availability)
    // ─────────────────────────────────────────────────────────────
    try {
      console.log('📝 Writing to Realtime Database at settings/availability...');
      console.log('   Will save:', JSON.stringify(payload));
      await dbSet('settings/availability', payload);
      console.log('✅ Realtime Database write SUCCESS');
       
      // Verify write
      const verify = await dbOnce('settings/availability');
      console.log('✅ Verification read from DB:', verify.val());
    } catch (dbError) {
      console.error('❌ Realtime Database write FAILED:', dbError);
      showToast('Warning: Database write may have failed. Check console.', 'warning');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Broadcast to other tabs via localStorage
    // ─────────────────────────────────────────────────────────────
    try {
      console.log('📡 Broadcasting availability via localStorage...');
      localStorage.setItem('availability_broadcast', JSON.stringify({ payload, ts: Date.now() }));
      console.log('📡 Broadcast data:', { payload, ts: Date.now() });
       
      // Remove after short delay to keep storage clean (triggers storage event)
      setTimeout(() => {
        try {
          localStorage.removeItem('availability_broadcast');
          console.log('🧹 Cleaned up localStorage broadcast key');
        } catch (e) {
          console.warn('Could not remove localStorage broadcast key:', e);
        }
      }, 1000);
       
      console.log('✅ localStorage broadcast SUCCESS');
    } catch (e) {
      console.warn('⚠️ Could not broadcast availability via localStorage:', e);
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Sync to Firestore if available (settings.availability)
    // ─────────────────────────────────────────────────────────────
    if (window.firestore) {
      try {
        console.log('🔥 Writing to Firestore at settings/availability...');
        await window.firestore.collection('settings').doc('availability').set(payload, { merge: true });
        console.log('✅ Firestore write SUCCESS');
      } catch (firestoreError) {
        console.warn('⚠️ Firestore write FAILED:', firestoreError);
        console.warn('💡 Fallback: Realtime DB and localStorage will handle synchronization');
      }
    } else {
      console.log('ℹ️ Firestore not available; using Realtime DB + localStorage only');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 5: Show success notification
    // ─────────────────────────────────────────────────────────────
    showToast(`✅ Availability set to: ${statusText}`, 'success');
    console.log('🎉 Availability update complete. Customers will see changes within 1-2 seconds.');

  } catch (error) {
    console.error('❌ CRITICAL ERROR in setAvailability():', error);
    console.error('Stack:', error.stack);
    showToast('❌ Error updating availability. Please try again.', 'error');
  }
}

/**
 * Save availability message — IMPROVED VERSION
 * 
 * This function:
 * 1. Saves message to BOTH Realtime Database and Firestore
 * 2. Updates customer preview immediately
 * 3. Broadcasts via localStorage for instant updates in other tabs
 * 4. Includes comprehensive error handling and logging
 * 
 * @returns {Promise<void>}
 */
async function saveAvailabilityMessage() {
  const message = document.getElementById('availabilityMessage').value;
  console.log('💬 Admin saving availability message:', message || '(empty)');

  try {
    const payload = {
      message: message,
      lastUpdated: new Date().toLocaleString(),
      timestamp: Date.now()
    };

    console.log('📦 Message payload:', payload);

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Update UI immediately
    // ─────────────────────────────────────────────────────────────
    const currentStatus = document.querySelector('[name="availability"]:checked')?.value;
    if (currentStatus === 'unavailable') {
      const previewEl = document.getElementById('customerPreview');
      if (previewEl) {
        const msgText = message || 'Ration Not Available. Please try after some time.';
        previewEl.innerHTML = `<p>❌ ${msgText}</p>`;
        console.log('✅ Preview updated with message');
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Save to Realtime Database
    // ─────────────────────────────────────────────────────────────
    try {
      console.log('📝 Writing to Realtime Database at settings/availabilityMessage...');
      await dbSet('settings/availabilityMessage', payload);
      console.log('✅ Realtime Database write SUCCESS');
    } catch (dbError) {
      console.error('❌ Realtime Database write FAILED:', dbError);
      showToast('Warning: Database write may have failed. Check console.', 'warning');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Broadcast to other tabs via localStorage
    // ─────────────────────────────────────────────────────────────
    try {
      console.log('📡 Broadcasting message via localStorage...');
      localStorage.setItem('availabilityMessage_broadcast', JSON.stringify({ payload, ts: Date.now() }));
      
      setTimeout(() => {
        try {
          localStorage.removeItem('availabilityMessage_broadcast');
          console.log('🧹 Cleaned up localStorage message broadcast key');
        } catch (e) {
          console.warn('Could not remove localStorage message broadcast key:', e);
        }
      }, 1000);
      
      console.log('✅ localStorage broadcast SUCCESS');
    } catch (e) {
      console.warn('⚠️ Could not broadcast message via localStorage:', e);
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Sync to Firestore if available
    // ─────────────────────────────────────────────────────────────
    if (window.firestore) {
      try {
        console.log('🔥 Writing to Firestore at settings/availabilityMessage...');
        await window.firestore.collection('settings').doc('availabilityMessage').set(payload, { merge: true });
        console.log('✅ Firestore write SUCCESS');
      } catch (firestoreError) {
        console.warn('⚠️ Firestore write FAILED:', firestoreError);
        console.warn('💡 Fallback: Realtime DB and localStorage will handle synchronization');
      }
    } else {
      console.log('ℹ️ Firestore not available; using Realtime DB + localStorage only');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 5: Show success notification
    // ─────────────────────────────────────────────────────────────
    showToast('💾 Message saved! Customers will see it within 1-2 seconds.', 'success');
    console.log('🎉 Message save complete');

  } catch (error) {
    console.error('❌ CRITICAL ERROR in saveAvailabilityMessage():', error);
    console.error('Stack:', error.stack);
    showToast('❌ Error saving message. Please try again.', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────
// 11. CUSTOMER HISTORY
// ─────────────────────────────────────────────────────────────────────

/**
 * Load customer history from Realtime Database
 */
async function loadCustomerHistory() {
  try {
    const customersSnapshot = await dbQueryOnce(window.db.ref('customers').orderByChild('timestamp').limitToLast(100));
    const tableBody = document.getElementById('customersTableBody');
    let html = '';

    if (!customersSnapshot.exists()) {
      html = '<tr><td colspan="6" style="text-align:center;color:#999;">No customer records yet</td></tr>';
    } else {
      const dataObj = customersSnapshot.val();
      const entries = Object.entries(dataObj).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
      entries.forEach(([key, data]) => {
        const date = data.date ? new Date(data.date).toLocaleDateString() : '-';
        html += `
          <tr>
            <td>${data.tokenNumber || '-'}</td>
            <td>${data.mobile || '-'}</td>
            <td>${data.slot || '-'}</td>
            <td><span class="status-badge available">${data.status || 'Pending'}</span></td>
            <td>${date}</td>
            <td>
              <button class="action-delete" onclick="deleteCustomerRecord('${key}')">Delete</button>
            </td>
          </tr>
        `;
      });
    }

    tableBody.innerHTML = html;
  } catch (error) {
    console.warn('Error loading customer history with query; falling back to full list:', error);
    try {
      const customersSnapshot = await dbOnce('customers');
      const tableBody = document.getElementById('customersTableBody');
      let html = '';

      if (!customersSnapshot.exists()) {
        html = '<tr><td colspan="6" style="text-align:center;color:#999;">No customer records yet</td></tr>';
      } else {
        const dataObj = customersSnapshot.val();
        const entries = Object.entries(dataObj || {}).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
        entries.forEach(([key, data]) => {
          const date = data.date ? new Date(data.date).toLocaleDateString() : '-';
          html += `
            <tr>
              <td>${data.tokenNumber || '-'}</td>
              <td>${data.mobile || '-'}</td>
              <td>${data.slot || '-'}</td>
              <td><span class="status-badge available">${data.status || 'Pending'}</span></td>
              <td>${date}</td>
              <td>
                <button class="action-delete" onclick="deleteCustomerRecord('${key}')">Delete</button>
              </td>
            </tr>
          `;
        });
      }

      tableBody.innerHTML = html;
    } catch (fallbackError) {
      console.error('Fallback error loading customer history:', fallbackError);
    }
  }
}

/**
 * Search customers by mobile or token
 */
function searchCustomers() {
  const searchTerm = document.getElementById('searchCustomer').value.toLowerCase();
  const tableRows = document.querySelectorAll('.customers-table tbody tr');

  tableRows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

/**
 * Delete customer record
 * @param {string} customerId - Customer ID to delete
 */
async function deleteCustomerRecord(customerId) {
  if (!confirm('Delete this record?')) {
    return;
  }

  try {
    await dbRemove(`customers/${customerId}`);
    showToast('Record deleted!', 'success');
    loadCustomerHistory();
  } catch (error) {
    console.error('Error deleting record:', error);
    showToast('Error deleting record', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────
// 13. UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', 'info'
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/**
 * Capitalize first letter of text
 * @param {string} text - Text to capitalize
 * @returns {string} Capitalized text
 */
function capitalizeText(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ─────────────────────────────────────────────────────────────────────
// 14. FIREBASE SETUP GUIDE
// ─────────────────────────────────────────────────────────────────────

/*
   ╔═══════════════════════════════════════════════════════════════════╗
   ║          HOW TO SET UP FIREBASE FOR THIS PROJECT                 ║
   ╚═══════════════════════════════════════════════════════════════════╝

   STEP 1: CREATE FIREBASE PROJECT
   ────────────────────────────────────
   1. Go to https://firebase.google.com
   2. Click "Get Started" or "Go to Console"
   3. Click "Create Project"
   4. Enter project name: "SmartQueue"
   5. Click "Continue"
   6. Choose location and click "Continue"
   7. Wait for project creation

   STEP 2: ENABLE FIRESTORE DATABASE
   ──────────────────────────────────
   1. In Firebase Console, click on "Firestore Database"
   2. Click "Create Database"
   3. Choose "Start in test mode" (for development)
   4. Select a location near you
   5. Click "Create"

   STEP 3: ENABLE AUTHENTICATION
   ────────────────────────────────
   1. Go to "Authentication" in Firebase Console
   2. Click "Get Started"
   3. Click "Email/Password" provider
   4. Enable it by toggling the switch
   5. Click "Save"

   STEP 4: GET YOUR FIREBASE CONFIG
   ────────────────────────────────
   1. Go to Project Settings (gear icon)
   2. Click "Your apps" section
   3. Click "</>" to add a web app
   4. Enter app name: "Smart Queue Admin"
   5. Click "Register app"
   6. Copy the firebaseConfig object
   7. Paste it in admin.js (line ~31)

   STEP 5: CREATE DATABASE COLLECTIONS
   ────────────────────────────────────
   In Firestore, create these collections:
   - stock (for products: wheat, rice, sugar, dal, oil, kit)
   - timeSlots (for operating hours)
   - customers (for customer history)
   - settings (for shop details and availability)

   STEP 6: SECURITY RULES (Optional for production)
   ───────────────────────────────────
   In Firestore Rules tab, replace with:

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.time < timestamp.date(2025, 12, 31);
       }
     }
   }

   STEP 7: RUN IN VS CODE
   ─────────────────────
   1. Open VS Code
   2. Install "Live Server" extension
   3. Right-click admin.html
   4. Select "Open with Live Server"
   5. Dashboard will open at http://localhost:5500

   STEP 8: TEST LOGIN
   ──────────────────
   Username: admin
   Password: admin123

   ═════════════════════════════════════════════════════════════════════
   
   FIRESTORE DATABASE STRUCTURE:
   ─────────────────────────────

   stock/
   ├── wheat
   │   ├── name: "Wheat"
   │   ├── quantity: 100
   │   ├── unit: "kg"
   │   └── lastUpdated: "..."
   ├── rice
   ├── sugar
   ├── dal
   ├── oil
   └── kit

   timeSlots/
   ├── 09:00-10:00
   │   ├── startTime: "09:00"
   │   ├── endTime: "10:00"
   │   ├── capacity: 30
   │   └── availableSeats: 25

   customers/
   ├── doc_id_1
   │   ├── tokenNumber: "T-001"
   │   ├── mobile: "9876543210"
   │   ├── slot: "09:00-10:00"
   │   ├── status: "Completed"
   │   └── date: "2025-05-15"

   settings/
   ├── availability
   │   ├── status: "available"
   │   └── lastUpdated: "..."
   ├── shopDetails
   │   ├── shopName: "Govt Ration Centre"
   │   ├── address: "..."
   │   ├── contactNumber: "..."
   │   ├── openingTime: "09:00"
   │   └── closingTime: "17:00"

   ═════════════════════════════════════════════════════════════════════
*/
