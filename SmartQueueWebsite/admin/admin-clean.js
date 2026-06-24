/**
 * Smart Queue Portal - Admin Dashboard
 * Manages ration availability, time slots, and customer data
 * Production-ready with error handling and logging
 */

// =====================================================================
// DATABASE HELPERS
// =====================================================================

const DB_TIMEOUT = 12000;

async function dbSet(path, value) {
  if (!window.db) throw new Error('Database not initialized');
  
  return Promise.race([
    window.db.ref(path).set(value),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database write timeout')), DB_TIMEOUT)
    )
  ]);
}

async function dbOnce(path) {
  if (!window.db) throw new Error('Database not initialized');
  
  return Promise.race([
    window.db.ref(path).once('value'),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database read timeout')), DB_TIMEOUT)
    )
  ]);
}

async function dbRemove(path) {
  if (!window.db) throw new Error('Database not initialized');
  
  return Promise.race([
    window.db.ref(path).remove(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database remove timeout')), DB_TIMEOUT)
    )
  ]);
}

// =====================================================================
// AUTHENTICATION
// =====================================================================

const DEMO_CREDENTIALS = { username: 'admin', password: 'admin123' };
const CREDENTIALS_KEY = 'adminCredentials';
let currentAdmin = null;

function saveCredentials(username, password) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ username, password }));
}

function getSavedCredentials() {
  const saved = localStorage.getItem(CREDENTIALS_KEY);
  return saved ? JSON.parse(saved) : null;
}

async function handleAdminLogin(event) {
  event.preventDefault();
  
  const username = document.getElementById('adminUsername').value;
  const password = document.getElementById('adminPassword').value;
  const errorEl = document.getElementById('loginError');

  if (username === DEMO_CREDENTIALS.username && password === DEMO_CREDENTIALS.password) {
    currentAdmin = { username, role: 'admin', loginTime: new Date() };
    saveCredentials(username, password);
    
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('dashboardPage').classList.add('active');
    showSection('home');
    showToast('✅ Login successful!', 'success');
    console.log('✅ Admin logged in:', currentAdmin);
  } else {
    errorEl.textContent = '❌ Invalid credentials';
    errorEl.style.display = 'block';
    console.warn('⚠️ Invalid login attempt');
  }
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    currentAdmin = null;
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('dashboardPage').classList.remove('active');
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
    showToast('👋 Logged out', 'info');
    console.log('✅ Admin logged out');
  }
}

// =====================================================================
// UI HELPERS
// =====================================================================

function showSection(section) {
  document.querySelectorAll('.section-content').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`section-${section}`);
  if (target) target.style.display = 'block';
  
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  event?.target.classList.add('active');
  
  console.log(`📋 Showing section: ${section}`);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
    color: white;
    border-radius: 8px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// =====================================================================
// AVAILABILITY MANAGEMENT
// =====================================================================

async function setAvailability(status) {
  console.log(`🔔 Setting availability to: ${status}`);
  
  if (status !== 'available' && status !== 'unavailable') {
    showToast('Invalid status', 'error');
    return;
  }

  const payload = {
    status: status,
    lastUpdated: new Date().toLocaleString(),
    timestamp: Date.now()
  };

  try {
    // Update UI immediately (optimistic)
    const statusText = status === 'available' ? '✅ Available' : '❌ Not Available';
    const statusEl = document.getElementById('currentAvailability');
    if (statusEl) {
      statusEl.innerHTML = `Current Status: <strong>${statusText}</strong>`;
    }

    // Update radio buttons
    document.querySelectorAll('[name="availability"]').forEach(input => {
      input.checked = input.value === status;
    });

    // Save to database
    console.log('📝 Saving to database...');
    await dbSet('settings/availability', payload);
    
    // Verify write
    const verify = await dbOnce('settings/availability');
    console.log('✅ Database write verified:', verify.val());

    // Broadcast to other tabs
    localStorage.setItem('availability_broadcast', JSON.stringify({ payload, ts: Date.now() }));
    setTimeout(() => localStorage.removeItem('availability_broadcast'), 1000);

    // Sync to Firestore if available
    if (window.firestore) {
      try {
        await window.firestore.collection('settings').doc('availability').set(payload, { merge: true });
        console.log('✅ Firestore synced');
      } catch (err) {
        console.warn('⚠️ Firestore sync failed:', err.message);
      }
    }

    showToast(`✅ Availability set to: ${statusText}`, 'success');
    console.log('🎉 Availability update complete');

  } catch (error) {
    console.error('❌ Failed to set availability:', error);
    showToast('❌ Failed to update availability', 'error');
  }
}

// =====================================================================
// TIME SLOTS MANAGEMENT
// =====================================================================

async function addTimeSlot() {
  const startTime = document.getElementById('startTime')?.value;
  const endTime = document.getElementById('endTime')?.value;
  const capacity = document.getElementById('slotCapacity')?.value;

  if (!startTime || !endTime || !capacity) {
    showToast('⚠️ Please fill all fields', 'warning');
    return;
  }

  if (startTime >= endTime) {
    showToast('⚠️ End time must be after start time', 'warning');
    return;
  }

  try {
    const payload = {
      startTime,
      endTime,
      capacity: parseInt(capacity),
      availableSeats: parseInt(capacity),
      createdAt: new Date().toLocaleString()
    };

    await dbSet(`timeSlots/${Date.now()}`, payload);
    showToast('✅ Time slot added!', 'success');
    console.log('✅ Slot added:', payload);
    
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('slotCapacity').value = '';
    
    loadTimeSlots();
  } catch (error) {
    console.error('❌ Failed to add slot:', error);
    showToast('❌ Failed to add slot', 'error');
  }
}

async function deleteTimeSlot(slotId) {
  if (!confirm('Delete this slot?')) return;

  try {
    await dbRemove(`timeSlots/${slotId}`);
    showToast('✅ Slot deleted!', 'success');
    loadTimeSlots();
  } catch (error) {
    console.error('❌ Failed to delete slot:', error);
    showToast('❌ Failed to delete slot', 'error');
  }
}

async function loadTimeSlots() {
  try {
    const snapshot = await dbOnce('timeSlots');
    const list = document.getElementById('slotsList');
    
    if (!snapshot.exists()) {
      list.innerHTML = '<p class="no-data">No slots created yet</p>';
      return;
    }

    let html = '';
    snapshot.forEach(item => {
      const data = item.val();
      html += `
        <div class="slot-item">
          <span>${data.startTime} - ${data.endTime}</span>
          <span>Capacity: ${data.capacity}</span>
          <button onclick="deleteTimeSlot('${item.key}')">🗑️ Delete</button>
        </div>
      `;
    });
    
    list.innerHTML = html;
    console.log('✅ Slots loaded');
  } catch (error) {
    console.error('❌ Failed to load slots:', error);
  }
}

// =====================================================================
// PAGE INITIALIZATION
// =====================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('📄 Admin dashboard loaded');
  
  // Check saved credentials
  const saved = getSavedCredentials();
  if (saved && saved.username === DEMO_CREDENTIALS.username) {
    handleAdminLogin({ preventDefault: () => {
      document.getElementById('adminUsername').value = saved.username;
      document.getElementById('adminPassword').value = saved.password;
    }});
  }

  // Load initial data
  await loadTimeSlots();
});

console.log('✅ Admin dashboard module loaded');
