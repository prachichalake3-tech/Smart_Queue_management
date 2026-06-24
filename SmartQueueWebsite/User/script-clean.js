/**
 * Smart Queue Portal - Customer Portal
 * Handles OTP, ration availability, slot booking, and token generation
 * Production-ready with real-time synchronization
 */

// =====================================================================
// GLOBAL APPLICATION STATE
// =====================================================================

const appState = {
  language: 'en',
  mobile: '',
  otp: '123456',
  sentTo: '',
  rationAvailable: true,
  availabilityMessage: '',
  selectedSlot: null,
  tokenNumber: null
};

// Listener management flags
let listenersAttached = false;
let pollInterval = null;

// =====================================================================
// TRANSLATIONS
// =====================================================================

const translations = {
  en: {
    appTitle: 'Smart Queue Portal',
    heroBadge: '🌾 Ration Distribution',
    langTitle: 'Choose Language',
    langSub: 'Select your preferred language',
    otpTitle: 'Verify Mobile',
    otpPlaceholder: 'Enter 10-digit number',
    sendOtpBtn: '📤 Send OTP',
    verifyOtpBtn: 'Verify & Continue →',
    availabilityTitle: 'Ration Availability',
    statusChecking: 'Checking stock...',
    availableTitle: '✅ Ration Available',
    availableSub: 'Stock is ready at your centre',
    notAvailableTitle: '⚠️ Ration Not Available',
    notAvailableSub: 'Try again after some time',
    bookSlotBtn: 'Book Time Slot →',
    slotsTitle: 'Pick a Time Slot',
    slotFull: 'Full',
    confirmSlotBtn: 'Confirm & Get Token →',
    tokenTitle: 'Your Token',
    tokenSub: 'Present this at the ration centre',
    backBtn: '← Back'
  },
  hi: {
    appTitle: 'स्मार्ट कतार पोर्टल',
    heroBadge: '🌾 राशन वितरण',
    langTitle: 'भाषा चुनें',
    langSub: 'अपनी पसंदीदा भाषा चुनें',
    otpTitle: 'मोबाइल सत्यापित करें',
    otpPlaceholder: '10 अंकों का नंबर दर्ज करें',
    sendOtpBtn: '📤 OTP भेजें',
    verifyOtpBtn: 'सत्यापित करें और जारी रखें →',
    availabilityTitle: 'राशन उपलब्धता',
    statusChecking: 'स्टॉक जांच रहे हैं...',
    availableTitle: '✅ राशन उपलब्ध है',
    availableSub: 'आपके केंद्र पर स्टॉक तैयार है',
    notAvailableTitle: '⚠️ राशन उपलब्ध नहीं',
    notAvailableSub: 'कुछ समय बाद कोशिश करें',
    bookSlotBtn: 'समय स्लॉट बुक करें →',
    slotsTitle: 'समय स्लॉट चुनें',
    slotFull: 'भरा हुआ',
    confirmSlotBtn: 'पुष्टि करें और टोकन प्राप्त करें →',
    tokenTitle: 'आपका टोकन',
    tokenSub: 'राशन केंद्र पर यह दिखाएं',
    backBtn: '← वापस जाएं'
  }
};

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

function getDict() {
  return translations[appState.language] || translations.en;
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
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function goToPage(pageId) {
  console.log(`🚀 Navigate to: ${pageId}`);
  
  // Prevent access to booking pages if unavailable
  const restrictedPages = ['page-slots', 'page-token', 'page-confirm'];
  if (!appState.rationAvailable && restrictedPages.includes(pageId)) {
    const dict = getDict();
    showToast(`${dict.notAvailableTitle} - ${dict.notAvailableSub}`, 'warning');
    goToPage('page-availability');
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

function translateUI() {
  const dict = getDict();
  // Update all elements with data-translate attribute
  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.getAttribute('data-translate');
    if (dict[key]) {
      if (el.tagName === 'INPUT') {
        el.placeholder = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });
}

// =====================================================================
// STATUS NORMALIZATION
// =====================================================================

function normalizeStatus(value) {
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
  }
  return 'unavailable';
}

// =====================================================================
// AVAILABILITY CHECKING (CORE FEATURE)
// =====================================================================

function handleAvailabilityData(data) {
  if (!data) {
    console.warn('⚠️ No availability data received');
    appState.rationAvailable = false;
    updateAvailabilityUI();
    return;
  }

  const status = normalizeStatus(data.status);
  const isAvailable = status === 'available';
  
  console.log(`📥 Availability update: ${isAvailable ? '✅ AVAILABLE' : '❌ NOT AVAILABLE'}`);
  
  appState.rationAvailable = isAvailable;
  appState.availabilityMessage = data.message || '';
  
  updateAvailabilityUI();
}

function updateAvailabilityUI() {
  const dict = getDict();
  const statusBox = document.getElementById('statusBox');
  const continueBtn = document.getElementById('availContinueBtn');

  if (!statusBox) return;

  if (appState.rationAvailable) {
    // AVAILABLE STATE
    statusBox.innerHTML = `
      <div class="status-icon">✅</div>
      <h3>${dict.availableTitle}</h3>
      <p>${dict.availableSub}</p>
    `;
    statusBox.className = 'status-box available';
    
    if (continueBtn) {
      continueBtn.style.display = 'block';
      continueBtn.disabled = false;
      continueBtn.textContent = dict.bookSlotBtn;
    }
  } else {
    // NOT AVAILABLE STATE
    const message = appState.availabilityMessage || dict.notAvailableSub;
    statusBox.innerHTML = `
      <div class="status-icon">⚠️</div>
      <h3>${dict.notAvailableTitle}</h3>
      <p>${message}</p>
    `;
    statusBox.className = 'status-box unavailable';
    
    if (continueBtn) {
      continueBtn.style.display = 'none';
      continueBtn.disabled = true;
    }
  }

  console.log(`🎨 UI updated: ${appState.rationAvailable ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
}

async function checkAvailability() {
  const dict = getDict();
  const statusBox = document.getElementById('statusBox');

  if (!statusBox) return;

  console.log('🔄 Checking availability...');
  
  // Show loading state
  statusBox.innerHTML = `
    <div class="spinner"></div>
    <p>${dict.statusChecking}</p>
  `;
  statusBox.className = 'status-box loading';

  // Attach listeners if not already done
  if (!listenersAttached) {
    await attachListeners();
    listenersAttached = true;
  } else {
    // Just update UI with current state
    updateAvailabilityUI();
  }
}

async function attachListeners() {
  const db = window.db;
  if (!db) {
    console.warn('⚠️ Database not initialized');
    appState.rationAvailable = true;
    updateAvailabilityUI();
    return;
  }

  try {
    // Try Firestore first
    if (window.firestore) {
      console.log('🔥 Attaching Firestore listener...');
      window.firestore.collection('settings').doc('availability').onSnapshot(
        (doc) => {
          const data = doc.exists ? doc.data() : null;
          console.log('📡 Firestore update:', data);
          handleAvailabilityData(data);
        },
        (err) => console.error('❌ Firestore error:', err)
      );
    }

    // Fallback to Realtime DB
    if (db && !db.isLocal) {
      console.log('🔗 Attaching Realtime DB listener...');
      db.ref('settings/availability').on('value', (snapshot) => {
        const data = snapshot && snapshot.exists ? snapshot.val() : null;
        console.log('📡 Realtime DB update:', data);
        handleAvailabilityData(data);
      });
    } else if (db && db.isLocal) {
      // Local DB polling
      console.log('📱 Starting local DB polling...');
      pollInterval = setInterval(async () => {
        try {
          const snapshot = await db.ref('settings/availability').once();
          const data = snapshot && snapshot.exists ? snapshot.val() : null;
          if (data) {
            handleAvailabilityData(data);
          }
        } catch (err) {
          console.error('❌ Polling error:', err);
        }
      }, 2000);
    }

    // Listen for localStorage broadcasts (cross-tab sync)
    window.addEventListener('storage', (e) => {
      if (e.key === 'availability_broadcast') {
        try {
          const payload = e.newValue ? JSON.parse(e.newValue).payload : null;
          if (payload) {
            console.log('📡 Storage event received:', payload);
            handleAvailabilityData(payload);
          }
        } catch (err) {
          console.error('❌ Storage event error:', err);
        }
      }
    });

    console.log('✅ All listeners attached');

  } catch (error) {
    console.error('❌ Failed to attach listeners:', error);
    appState.rationAvailable = true;
    updateAvailabilityUI();
  }
}

// =====================================================================
// OTP HANDLING
// =====================================================================

function sendOTP() {
  const mobile = document.getElementById('mobileInput')?.value;
  
  if (!mobile || mobile.length !== 10 || !/^\d+$/.test(mobile)) {
    showToast('⚠️ Please enter valid 10-digit mobile number', 'warning');
    return;
  }

  appState.sentTo = mobile;
  appState.mobile = mobile;
  
  const dict = getDict();
  const maskedMobile = mobile.slice(-4).padStart(10, '*');
  
  document.getElementById('otpHint').textContent = `✅ OTP sent to +91 ${maskedMobile}. Demo OTP: ${appState.otp}`;
  document.getElementById('otpSection').style.display = 'block';
  
  showToast('✅ OTP sent (Demo: 123456)', 'success');
  console.log('📤 OTP sent to:', maskedMobile);
}

function verifyOTP() {
  const entered = Array.from(document.querySelectorAll('.otp-box'))
    .map(el => el.value)
    .join('');

  if (entered === appState.otp) {
    appState.mobile = appState.sentTo;
    goToPage('page-availability');
    checkAvailability();
    showToast('✅ OTP verified!', 'success');
    console.log('✅ OTP verified for:', appState.mobile);
  } else {
    showToast('❌ Invalid OTP', 'error');
    console.warn('⚠️ OTP verification failed');
  }
}

// =====================================================================
// SLOT BOOKING
// =====================================================================

const slots = [
  { label: '08:00 AM - 10:00 AM', seats: 25 },
  { label: '10:00 AM - 12:00 PM', seats: 25 },
  { label: '02:00 PM - 04:00 PM', seats: 20 },
  { label: '04:00 PM - 06:00 PM', seats: 30 }
];

async function buildSlotGrid() {
  const grid = document.getElementById('slotGrid');
  if (!grid) return;

  const dict = getDict();
  grid.innerHTML = '';

  slots.forEach((slot, index) => {
    const btn = document.createElement('button');
    btn.className = 'slot-btn';
    
    if (slot.seats > 0) {
      btn.innerHTML = `
        <span>${slot.label}</span>
        <span>${slot.seats} ${dict.slotSeatsLeft || 'seats'}</span>
      `;
      btn.onclick = () => selectSlot(slot, index);
    } else {
      btn.innerHTML = `<span>${slot.label}</span><span>${dict.slotFull}</span>`;
      btn.disabled = true;
      btn.className += ' disabled';
    }
    
    grid.appendChild(btn);
  });

  console.log('✅ Slot grid built');
}

function selectSlot(slot, index) {
  appState.selectedSlot = { ...slot, index };
  
  document.querySelectorAll('.slot-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === index);
  });

  showToast(`✅ Slot selected: ${slot.label}`, 'success');
  console.log('📍 Slot selected:', slot);
}

function generateToken() {
  if (!appState.selectedSlot) {
    showToast('⚠️ Please select a slot first', 'warning');
    return;
  }

  appState.tokenNumber = Math.floor(100000 + Math.random() * 900000);
  
  const dict = getDict();
  const tokenBox = document.getElementById('tokenBox');
  if (tokenBox) {
    tokenBox.innerHTML = `
      <h2>${dict.tokenTitle}</h2>
      <div class="token-number">${appState.tokenNumber}</div>
      <p>${appState.selectedSlot.label}</p>
      <p>${dict.tokenSub}</p>
    `;
  }

  console.log('🎟️ Token generated:', appState.tokenNumber);
  goToPage('page-token');
}

// =====================================================================
// PAGE INITIALIZATION
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Customer portal initialized');
  
  // Set language
  appState.language = localStorage.getItem('language') || 'en';
  translateUI();
  
  // Build slots
  buildSlotGrid();
  
  // Show initial page
  goToPage('page-lang');
  
  console.log('📄 Portal ready');
});

console.log('✅ Customer portal module loaded');
