/* ============================================================
   SMART QUEUE PORTAL — script.js
   Handles: page navigation, language pick, OTP, availability,
            time slots, token generation, confirmation, reset.
   ============================================================ */

/* ──────────────────────────────────────────
   GLOBAL STATE  — stores all user choices
────────────────────────────────────────── */
const appState = {
  language:       'en',      // selected language code
  mobile:         '',        // user's mobile number
  generatedOTP:   '123456',  // demo OTP (in production this would be sent via SMS)
  sentTo:         '',        // mobile number that received last OTP
  rationAvailable: true,     // set dynamically in checkAvailability()
  availabilityMessage: '',   // optional admin message for unavailable status
  selectedSlot:   null,      // { label, index }
  tokenNumber:    null,      // generated token number
};

let availabilityListenerAttached = false;
let availabilityMessageListenerAttached = false;
let availabilityUnsubscribe = null;
let availabilityMessageUnsubscribe = null;
let availabilityDbAttached = false;
let availabilityMessageDbAttached = false;
let availabilityDbRef = null;
let availabilityMessageDbRef = null;
let availabilityPollInterval = null; // interval id for local DB polling

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

const translations = {
  en: {
    appTitle: 'Smart Queue<br/>Portal',
    heroBadge: '🌾 Ration Distribution · Rural India',
    heroDesc: 'A simple, fast, and fair digital system to book your <strong>ration collection slot</strong> from home — no more long queues under the sun.',
    chip1: '📱 OTP Verified',
    chip2: '🕐 Time Slots',
    chip3: '🎫 Token Based',
    chip4: '🌐 Bilingual',
    startButton: 'Get Started →',
    langTitle: 'Choose Language',
    langSub: 'Select your preferred language to continue',
    langLabel: 'Language',
    langContinueBtn: 'Continue →',
    langBackBtn: '← Back',
    otpTitle: 'Verify Mobile',
    otpSub: 'Enter your 10-digit mobile number to receive OTP',
    mobileLabel: 'Mobile Number',
    mobilePlaceholder: 'Enter 10-digit number',
    otpInputLabel: 'Enter OTP',
    sendOtpBtn: '📤 Send OTP',
    verifyOtpBtn: 'Verify & Continue →',
    sendOtpSentLabel: '✅ OTP Sent!',
    otpHintSent: 'OTP sent to +91 {masked}. Demo OTP: {otp}',
    otpHintPrompt: 'Enter the 6-digit code sent to your mobile.',
    resendText: 'Resend in {seconds}s',
    resendButton: '🔄 Resend OTP',
    shopTitle: 'Choose Ration Shop',
    shopSub: 'Select your ration shop before booking.',
    shopNone: 'No ration shops available yet. Please ask admin to add shops.',
    shopContinueBtn: 'Continue →',
    availabilityTitle: 'Ration Availability',
    availabilitySub: 'Checking stock at your nearest distribution centre…',
    statusChecking: 'Checking stock…',
    availableTitle: 'Ration Available',
    availableSub: 'Stock is ready at your centre.',
    notAvailableTitle: 'Ration Not Available',
    notAvailableSub: 'Try again after some time.',
    bookSlotBtn: 'Book Time Slot →',
    retryBtn: '🔄 Check Again',
    slotsTitle: 'Pick a Time Slot',
    slotsSub: 'Choose a convenient collection window',
    selectedSlotPrefix: '✅ Selected:',
    confirmSlotBtn: 'Confirm Slot →',
    tokenTitle: 'Your Token',
    tokenSub: 'Show this token at the distribution centre',
    tokenOrg: 'Government Ration Centre',
    tokenSystem: 'Smart Queue System',
    tokenNumberLabel: 'Token Number',
    tokenDateLabel: '📅 Date',
    tokenDayLabel: '📆 Day',
    tokenMobileLabel: '📱 Mobile',
    tokenSlotLabel: '⏰ Slot',
    tokenShopLabel: '🏪 Shop',
    tokenFooter: 'Please arrive 10 minutes before your slot.',
    tokenConfirmBtn: 'Confirm Booking →',
    confirmTitle: 'Booking Successful!',
    confirmThank: '🙏 Thank You',
    confirmMsg: 'Your ration slot has been booked successfully. Please carry this token and your Ration Card to the centre.',
    confirmTokenLabel: 'Token',
    confirmItem1: '📄 Carry your Ration Card',
    confirmItem2: '🕐 Arrive before your slot starts',
    confirmItem3: '😷 Follow safety protocols',
    confirmItem4: '📵 Keep your mobile handy for verification',
    doneButton: '✅ Done — Book Another',
    otpErrorIncomplete: 'Please enter all 6 digits of the OTP.',
    otpErrorInvalid: '❌ Wrong OTP. Try again.',
    otpVerified: '✅ OTP Verified Successfully!',
    mobileInvalid: 'Please enter a valid 10-digit mobile number.',
    selectSlot: 'Please select a time slot first.',
    slotSeatsLeft: 'seats left',
    slotFull: 'FULL',
  },
  mr: {
    appTitle: 'स्मार्ट क्यू<br/>पोर्टल',
    heroBadge: '🌾 धान्य वितरण · ग्रामीण भारत',
    heroDesc: 'घरबसल्या तुमची धान्य जमा वेळ बुक करण्यासाठी एक सोपी, जलद आणि न्याय्य डिजिटल प्रणाली.',
    chip1: '📱 OTP पडताळणी',
    chip2: '🕐 वेळेस्लॉट',
    chip3: '🎫 टोकन आधारित',
    chip4: '🌐 बहुभाषिक',
    startButton: 'सुरू करा →',
    langTitle: 'भाषा निवडा',
    langSub: 'संपूर्ण संकेतस्थळ कोणती भाषा वापरावी ते निवडा',
    langLabel: 'भाषा',
    langContinueBtn: 'पुढे जा →',
    langBackBtn: '← मागे',
    otpTitle: 'मोबाइल सत्यापित करा',
    otpSub: 'OTP प्राप्त करण्यासाठी तुमचा 10-अंकी मोबाइल नंबर द्या',
    mobileLabel: 'मोबाईल नंबर',
    mobilePlaceholder: '10-अंकी नंबर टाका',
    otpInputLabel: 'OTP टाका',
    sendOtpBtn: '📤 OTP पाठवा',
    verifyOtpBtn: 'सत्यापित करा आणि पुढे जा →',
    sendOtpSentLabel: '✅ OTP पाठवले गेले!',
    otpHintSent: 'OTP +91 {masked} वर पाठवला. डेमो OTP: {otp}',
    otpHintPrompt: 'मोबाइलवर पाठवलेला 6-अंकी कोड टाका.',
    resendText: '{seconds} सेकंदात पुन्हा पाठवा',
    resendButton: '🔄 पुन्हा पाठवा',
    shopTitle: 'राशन दुकान निवडा',
    shopSub: 'आपल्या जवळचे दुकान निवडा.',
    shopNone: 'कोणतेही दुकान उपलब्ध नाही. कृपया अॅडमिनशी संपर्क करा.',
    shopContinueBtn: 'पुढे जा →',
    availabilityTitle: 'धान्य उपलब्धता',
    availabilitySub: 'तुमच्या जवळच्या वितरण केंद्रातील स्टॉक तपासत आहे…',
    statusChecking: 'स्टॉक तपासला जात आहे…',
    availableTitle: 'धान्य उपलब्ध आहे',
    availableSub: 'तुमच्या केंद्रावर स्टॉक तयार आहे.',
    notAvailableTitle: 'धान्य उपलब्ध नाही',
    notAvailableSub: 'काही वेळानंतर पुन्हा प्रयत्न करा.',
    bookSlotBtn: 'वेळेस्लॉट बुक करा →',
    retryBtn: '🔄 पुन्हा तपासा',
    slotsTitle: 'वेळेस्लॉट निवडा',
    slotsSub: 'सोयीस्कर वेळ साठी निवडा',
    selectedSlotPrefix: '✅ निवडले:',
    confirmSlotBtn: 'वेळ निश्चित करा →',
    tokenTitle: 'तुमचा टोकन',
    tokenSub: 'वितरित केंद्रावर हा टोकन दाखवा',
    tokenOrg: 'सरकारी धान्य केंद्र',
    tokenSystem: 'स्मार्ट क्यू प्रणाली',
    tokenNumberLabel: 'टोकन क्रमांक',
    tokenDateLabel: '📅 दिनांक',
    tokenDayLabel: '📆 दिवस',
    tokenMobileLabel: '📱 मोबाइल',
    tokenSlotLabel: '⏰ वेळ',
    tokenShopLabel: '🏪 दुकान',
    tokenFooter: 'कृपया तुमच्या वेळेस्लॉटच्या 10 मिनिटांपूर्वी पोहोचा.',
    tokenConfirmBtn: 'बुकिंग निश्चित करा →',
    confirmTitle: 'बुकिंग यशस्वी!',
    confirmThank: '🙏 धन्यवाद',
    confirmMsg: 'तुमचा धान्य वेळेस्लॉट यशस्वीरित्या बुक झाला आहे. कृपया हा टोकन आणि राशन कार्ड केंद्रावर घेऊन या.',
    confirmTokenLabel: 'टोकन',
    confirmItem1: '📄 राशन कार्ड सोबत घ्या',
    confirmItem2: '🕐 वेळेस्लॉट सुरू होण्यापूर्वी पोहोचा',
    confirmItem3: '😷 सुरक्षा नियम पाळा',
    confirmItem4: '📵 सत्यापनासाठी मोबाइल सोबत ठेवा',
    doneButton: '✅ पूर्ण — पुन्हा बुक करा',
    otpErrorIncomplete: 'कृपया OTP चे 6 अंक पूर्ण टाका.',
    otpErrorInvalid: '❌ चुकीचा OTP. पुन्हा प्रयत्न करा.',
    otpVerified: '✅ OTP यशस्वीरित्या पडताळले गेले!',
    mobileInvalid: 'कृपया वैध 10-अंकी मोबाइल नंबर टाका.',
    selectSlot: 'कृपया प्रथम एक वेळेस्लॉट निवडा.',
    slotSeatsLeft: 'सीट उरली',
    slotFull: 'पूर्ण',
  },
  hi: {
    appTitle: 'स्मार्ट क्यू<br/>पोर्टल',
    heroBadge: '🌾 राशन वितरण · ग्रामीण भारत',
    heroDesc: 'घर पर अपने राशन संग्रह स्लॉट को बुक करने के लिए एक सरल, तेज़ और निष्पक्ष डिजिटल प्रणाली।',
    chip1: '📱 OTP सत्यापित',
    chip2: '🕐 टाइम स्लॉट',
    chip3: '🎫 टोकन आधारित',
    chip4: '🌐 द्विभाषी',
    startButton: 'शुरू करें →',
    langTitle: 'भाषा चुनें',
    langSub: 'आगे बढ़ने के लिए अपनी पसंदीदा भाषा चुनें',
    langLabel: 'भाषा',
    langContinueBtn: 'आगे →',
    langBackBtn: '← पीछे',
    otpTitle: 'मोबाइल सत्यापित करें',
    otpSub: 'OTP प्राप्त करने के लिए अपना 10 अंकीय मोबाइल नंबर दर्ज करें',
    mobileLabel: 'मोबाइल नंबर',
    mobilePlaceholder: '10 अंकीय नंबर दर्ज करें',
    otpInputLabel: 'OTP दर्ज करें',
    sendOtpBtn: '📤 OTP भेजें',
    verifyOtpBtn: 'सत्यापित करें और आगे →',
    sendOtpSentLabel: '✅ OTP भेजा गया!',
    otpHintSent: 'OTP +91 {masked} पर भेजा गया। डेमो OTP: {otp}',
    otpHintPrompt: 'मोबाइल पर भेजा गया 6 अंकीय कोड दर्ज करें।',
    resendText: '{seconds} सेकंड में फिर से भेजें',
    resendButton: '🔄 फिर से भेजें',
    shopTitle: 'राशन दुकान चुनें',
    shopSub: 'बुकिंग से पहले अपनी राशन दुकान चुनें।',
    shopNone: 'कोई राशन दुकान उपलब्ध नहीं है। कृपया व्यवस्थापक से पूछें।',
    shopContinueBtn: 'आगे जाएँ →',
    availabilityTitle: 'राशन उपलब्धता',
    availabilitySub: 'आपके निकटतम वितरण केंद्र पर स्टॉक की जांच की जा रही है…',
    statusChecking: 'स्टॉक जांचा जा रहा है…',
    availableTitle: 'राशन उपलब्ध है',
    availableSub: 'आपके केंद्र पर स्टॉक तैयार है।',
    notAvailableTitle: 'राशन उपलब्ध नहीं है',
    notAvailableSub: 'कृपया कुछ समय बाद पुन: प्रयास करें।',
    bookSlotBtn: 'टाइम स्लॉट बुक करें →',
    retryBtn: '🔄 फिर से जांचें',
    slotsTitle: 'टाइम स्लॉट चुनें',
    slotsSub: 'एक सुविधाजनक संग्रह समय चुनें',
    selectedSlotPrefix: '✅ चुना गया:',
    confirmSlotBtn: 'स्लॉट कन्फर्म करें →',
    tokenTitle: 'आपका टोकन',
    tokenSub: 'वितरण केंद्र पर यह टोकन दिखाएँ',
    tokenOrg: 'सरकारी राशन केंद्र',
    tokenSystem: 'स्मार्ट क्यू सिस्टम',
    tokenNumberLabel: 'टोकन नंबर',
    tokenDateLabel: '📅 दिनांक',
    tokenDayLabel: '📆 दिन',
    tokenMobileLabel: '📱 मोबाइल',
    tokenSlotLabel: '⏰ स्लॉट',
    tokenShopLabel: '🏪 दुकान',
    tokenFooter: 'कृपया अपने स्लॉट से 10 मिनट पहले पहुँचे।',
    tokenConfirmBtn: 'बुकिंग कन्फर्म करें →',
    confirmTitle: 'बुकिंग सफल!',
    confirmThank: '🙏 धन्यवाद',
    confirmMsg: 'आपका राशन स्लॉट सफलतापूर्वक बुक हो गया है। कृपया यह टोकन और अपना राशन कार्ड साथ लाएँ।',
    confirmTokenLabel: 'टोकन',
    confirmItem1: '📄 अपना राशन कार्ड साथ लाएँ',
    confirmItem2: '🕐 स्लॉट शुरू होने से पहले पहुँचें',
    confirmItem3: '😷 सुरक्षा नियमों का पालन करें',
    confirmItem4: '📵 सत्यापन के लिए मोबाइल साथ रखें',
    doneButton: '✅ हो गया — फिर से बुक करें',
    otpErrorIncomplete: 'कृपया OTP के सभी 6 अंक दर्ज करें।',
    otpErrorInvalid: '❌ गलत OTP। पुनः प्रयास करें।',
    otpVerified: '✅ OTP सफलतापूर्वक सत्यापित!',
    mobileInvalid: 'कृपया एक वैध 10 अंकीय मोबाइल नंबर दर्ज करें।',
    selectSlot: 'कृपया पहले एक टाइम स्लॉट चुनें।',
    slotSeatsLeft: 'सीट शेष',
    slotFull: 'पूर्ण',
  }
};

/* ──────────────────────────────────────────
   TIME SLOTS DATA
   Each slot has: label, seats, isBreak
────────────────────────────────────────── */
const slots = [
  { label: '11 AM – 12 PM', seats: 12, isBreak: false },
  { label: '12 PM – 1 PM',  seats: 8,  isBreak: false },
  { label: '☕ Break 1 PM – 2 PM', seats: 0, isBreak: true  },
  { label: '2 PM – 3 PM',   seats: 15, isBreak: false },
  { label: '3 PM – 4 PM',   seats: 3,  isBreak: false },
  { label: '4 PM – 5 PM',   seats: 0,  isBreak: false },  // 0 = full
];

/* ──────────────────────────────────────────
   1. PAGE NAVIGATION
   Shows the target page and hides all others.
   Triggers any setup needed for that page.
────────────────────────────────────────── */
/**
 * goTo(pageId) — IMPROVED VERSION
 * 
 * Navigate to a page with availability-based route blocking.
 * 
 * BLOCKED PAGES (when rationAvailable === false):
 * - page-slots: Time slot selection
 * - page-token: Token display
 * - page-confirm: Booking confirmation
 * 
 * These pages redirect back to page-availability. Customers cannot proceed
 * until the admin toggles the status back to available.
 * 
 * ALLOWED PAGES (always accessible):
 * - page-lang: Language selection
 * - page-auth: Authentication
 * - page-otp: OTP verification
 * - page-availability: Availability check (always allowed)
 * 
 * @param {string} pageId - Target page ID to navigate to
 * @returns {void}
 */
function goTo(pageId) {
  console.log(`🚀 Navigation request to: ${pageId}`);
  console.log(`📊 Current availability state: ${appState.rationAvailable ? 'AVAILABLE ✅' : 'NOT AVAILABLE ❌'}`);
  
  const restrictedPages = ['page-slots', 'page-token', 'page-confirm'];

  // Check if trying to access restricted page when unavailable
  if (!appState.rationAvailable && restrictedPages.includes(pageId)) {
    const dict = translations[appState.language] || translations.en;
    console.warn(`⛔ BLOCKED: Attempting to access restricted page "${pageId}" while ration is NOT available`);
    showToast(`${dict.notAvailableTitle}. ${dict.notAvailableSub}`, 'warning');
    
    // Force redirect to availability page
    pageId = 'page-availability';
    console.log(`↩️ Redirected to: ${pageId}`);
  } else if (restrictedPages.includes(pageId)) {
    console.log(`✅ ALLOWED: "${pageId}" is accessible (ration available)`);
  } else {
    console.log(`✅ ALLOWED: "${pageId}" is always accessible`);
  }

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show target page
  const target = document.getElementById(pageId);
  if (target) {
    target.classList.add('active');
    console.log(`✅ Page rendered: ${pageId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    console.error(`❌ Page element not found: ${pageId}`);
  }

  // Trigger page-specific setup
  if (pageId === 'page-availability') {
    console.log('📋 Running page-availability setup...');
    checkAvailability();
  }
  if (pageId === 'page-slots') {
    console.log('📋 Running page-slots setup...');
    buildSlotGrid();
  }
  if (pageId === 'page-token') {
    console.log('📋 Running page-token setup...');
    generateToken();
  }
  if (pageId === 'page-confirm') {
    console.log('📋 Running page-confirm setup...');
    fillConfirmation();
  }
}

function selectLang(lang) {
  appState.language = lang;
  translateUI();
  document.querySelectorAll('.lang-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.lang === lang);
  });
}

function continueFromLang() {
  if (!appState.language) appState.language = 'en';
  translateUI();
  goTo('page-otp');
}

/* ──────────────────────────────────────────
   DOM READY
────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Build slot grid once DOM is ready
  buildSlotGrid();
  translateUI();
  goTo('page-lang');
});

/* ──────────────────────────────────────────
   3. OTP — SEND
   Validates mobile length, shows OTP section,
   starts 30-second countdown.
────────────────────────────────────────── */
function sendOTP() {
  const mob = document.getElementById('mobileInput').value.trim();
  const dict = translations[appState.language] || translations.en;

  // Validate: must be exactly 10 digits
  if (mob.length !== 10) {
    shakeElement('mobileInput');
    showToast(dict.mobileInvalid);
    return;
  }

  appState.mobile = mob;
  appState.sentTo = mob;
  appState.generatedOTP = String(Math.floor(100000 + Math.random() * 900000));

  // Show OTP input section with animation
  const otpSection = document.getElementById('otpSection');
  otpSection.style.display = 'flex';
  otpSection.style.flexDirection = 'column';
  otpSection.style.gap = '12px';

  // Update OTP hint
  updateOtpHint();

  // Show verify button
  const continueBtn = document.getElementById('continueOtpBtn');
  continueBtn.style.display = 'block';

  // Disable send button to avoid duplicate
  const sendBtn = document.getElementById('sendOtpBtn');
  sendBtn.disabled = true;
  sendBtn.textContent = dict.sendOtpSentLabel || '✅ OTP Sent!';

  // Start countdown timer (30 seconds)
  startCountdown();

  // Clear previous OTP input values
  document.querySelectorAll('.otp-box').forEach(b => {
    b.value = '';
    b.classList.remove('filled');
  });

  // Focus first OTP box
  document.querySelectorAll('.otp-box')[0]?.focus();
}

function updateOtpHint() {
  const hint = document.getElementById('otpHint');
  const dict = translations[appState.language] || translations.en;
  const masked = appState.mobile ? maskMobile(appState.mobile) : '******';
  if (hint) {
    hint.textContent = dict.otpHintSent
      .replace('{masked}', masked)
      .replace('{otp}', appState.generatedOTP);
  }
}


/* ──────────────────────────────────────────
   3b. OTP BOX — auto-focus next box
────────────────────────────────────────── */
function otpMove(input, index) {
  // Keep only digits
  input.value = input.value.replace(/\D/, '');

  // Mark filled
  input.classList.toggle('filled', input.value !== '');

  // Move to next box automatically
  const boxes = document.querySelectorAll('.otp-box');
  if (input.value && index < boxes.length - 1) {
    boxes[index + 1].focus();
  }
}

/* ──────────────────────────────────────────
   3c. OTP — VERIFY
   Reads all 6 boxes, compares with demo OTP.
────────────────────────────────────────── */
function verifyOTP() {
  const boxes = document.querySelectorAll('.otp-box');
  let enteredOTP = '';
  boxes.forEach(b => enteredOTP += b.value);
  const dict = translations[appState.language] || translations.en;

  if (enteredOTP.length < 6) {
    showToast(dict.otpErrorIncomplete);
    return;
  }

  if (enteredOTP === appState.generatedOTP) {
    showToast(dict.otpVerified, 'success');
    setTimeout(() => goTo('page-availability'), 700);
  } else {
    shakeElement('page-otp');
    showToast(dict.otpErrorInvalid);
    // Clear boxes on wrong OTP
    boxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });
    boxes[0].focus();
  }
}



function renderShopOptions(snapshot) {}

function selectShop(id, name) {}

/* ──────────────────────────────────────────
   3d. COUNTDOWN TIMER for OTP resend
───────────────────────────────────────── */
function startCountdown() {
  let seconds = 30;
  const countdownEl = document.getElementById('countdown');
  const resendText  = document.getElementById('resendText');
  const dict = translations[appState.language] || translations.en;

  const timer = setInterval(() => {
    seconds--;
    if (countdownEl) countdownEl.textContent = seconds;

    if (seconds <= 0) {
      clearInterval(timer);
      if (resendText) resendText.innerHTML =
        `<button class="btn btn-ghost" onclick="resetOTP()">${dict.resendButton}</button>`;
    }
  }, 1000);
}

/* Re-enable the send OTP flow */
function resetOTP() {
  const sendBtn = document.getElementById('sendOtpBtn');
  const dict = translations[appState.language] || translations.en;
  sendBtn.disabled = false;
  sendBtn.textContent = dict.sendOtpBtn;
  document.getElementById('resendText').innerHTML =
    dict.resendText.replace('{seconds}', '30').replace('{otp}', '');
  document.querySelectorAll('.otp-box').forEach(b => {
    b.value = '';
    b.classList.remove('filled');
  });
  document.getElementById('otpHint').textContent = dict.otpHintPrompt;
}


/* ──────────────────────────────────────────
   4. RATION AVAILABILITY CHECK
   Simulates an API call with a random result
   (70 % chance available, 30 % not available).
────────────────────────────────────────── */
/**
 * checkAvailability()
 * 
 * Set up real-time Firestore listener for availability status.
 * When admin changes availability status, UI updates automatically.
 * 
 * Flow:
 * - On page load, show loading spinner
 * - Listen to Firestore 'config' collection, 'availability' document
 * - Update appState.rationAvailable with real-time data
 * - Disable Continue button if unavailable
 * - Re-enable button when admin updates to available
 * 
 * @returns {void}
 */
/**
 * updateAvailabilityUI() — IMPROVED VERSION
 * 
 * Updates all UI elements based on availability status.
 * 
 * WHEN AVAILABLE:
 * - Shows green checkmark
 * - Displays "Ration Available"
 * - Shows ENABLED Continue button
 * - Customer can proceed to slot booking
 * 
 * WHEN NOT AVAILABLE:
 * - Shows orange warning icon
 * - Displays "Ration Not Available" + custom message
 * - Hides Continue button
 * - Shows custom message from admin
 * - Prevents customer from proceeding
 * 
 * @param {boolean} isAvailable - Availability status
 * @param {string} message - Optional custom message for unavailable state
 */
function updateAvailabilityUI(isAvailable, message = '') {
  const dict = translations[appState.language] || translations.en;
  const statusBox  = document.getElementById('statusBox');
  const availIcon  = document.getElementById('availIcon');
  const continueBtn = document.getElementById('availContinueBtn');
  const retryBtn = document.getElementById('retryBtn');
  const availBtns = document.getElementById('availButtons');

  console.log(`🎨 Updating UI for availability: ${isAvailable ? 'AVAILABLE ✅' : 'NOT AVAILABLE ❌'}`);
  console.log(`📝 Custom message: ${message || '(none)'}`);

  // Show buttons container
  availBtns.style.display = 'flex';
  availBtns.style.flexDirection = 'column';
  availBtns.style.gap = '10px';

  if (isAvailable) {
    // ─────────────────────────────────────────────────────────────
    // AVAILABLE STATE - Customer can book
    // ─────────────────────────────────────────────────────────────
    console.log('✅ Rendering AVAILABLE state');
    
    statusBox.className = 'status-box available';
    statusBox.innerHTML = `
      <div class="status-icon-big">✅</div>
      <p class="status-text" style="color:#1b5e20;font-size:1.2rem;">
        ${dict.availableTitle}
      </p>
      <p style="font-size:.85rem;color:#388e3c;">
        ${dict.availableSub}
      </p>`;
    availIcon.textContent = '🌾';

    // Show and ENABLE Continue button
    if (continueBtn) {
      continueBtn.style.display = 'block';
      continueBtn.disabled = false;
      continueBtn.style.opacity = '1';
      continueBtn.style.cursor = 'pointer';
      console.log('✅ Continue button ENABLED');
    }

    // Hide retry button
    if (retryBtn) retryBtn.style.display = 'none';

    console.log('✅ UI ready - customer can proceed to slot booking');

  } else {
    // ─────────────────────────────────────────────────────────────
    // NOT AVAILABLE STATE - Customer cannot book
    // ─────────────────────────────────────────────────────────────
    console.log('❌ Rendering NOT AVAILABLE state');
    
    const customText = message || dict.notAvailableSub;
    statusBox.className = 'status-box not-available';
    statusBox.innerHTML = `
      <div class="status-icon-big">⚠️</div>
      <p class="status-text" style="color:#e65100;font-size:1.2rem;">
        ${dict.notAvailableTitle}
      </p>
      <p style="font-size:.85rem;color:#bf360c;">
        ${customText}
      </p>`;
    availIcon.textContent = '⚠️';

    // Hide Continue button (prevent booking when unavailable)
    if (continueBtn) {
      continueBtn.style.display = 'none';
      continueBtn.disabled = true;
      console.log('❌ Continue button HIDDEN and DISABLED');
    }

    // Hide retry button
    if (retryBtn) retryBtn.style.display = 'none';

    console.log('⚠️ UI shows unavailable - customer blocked from proceeding');
  }

  console.log('🎉 UI update complete');
}

/**
 * handleAvailabilityValue() — IMPROVED VERSION with DEBUG LOGGING
 * 
 * Processes availability data from any source (Firestore, Realtime DB, localStorage).
 * Normalizes the status and updates the global state and UI.
 * 
 * @param {Object} data - Data object containing status field
 */
function handleAvailabilityValue(data) {
  console.log('📥 handleAvailabilityValue() called');
  console.log('   Raw data object:', data);
  
  // Safety check: if data is null/undefined, default to unavailable
  if (!data) {
    console.warn('⚠️ Data is null/undefined, defaulting to unavailable');
    data = { status: 'unavailable' };
  }
  
  const rawStatus = data.status !== undefined ? data.status : 'unavailable';
  console.log(`   📊 Raw status from data: "${rawStatus}" (type: ${typeof rawStatus})`);
  
  // Debug: Show what normalize function does
  const normalized = normalizeAvailabilityStatus(rawStatus);
  console.log(`   🔄 After normalizeAvailabilityStatus(): "${normalized}"`);
  
  const available = normalized === 'available';
  console.log(`   ✅ Boolean result: ${available ? 'AVAILABLE ✅' : 'NOT AVAILABLE ❌'}`);
  
  // Update global state - CRITICAL: Make sure this happens
  const oldState = appState.rationAvailable;
  appState.rationAvailable = available;
  console.log(`   💾 State updated: ${oldState} → ${available}`);
  
  if (oldState !== available) {
    console.log(`   🔔 STATE CHANGED - Updating UI...`);
  } else {
    console.log(`   ℹ️ State unchanged (was already ${available})`);
  }
  
  // Update UI immediately
  console.log(`   🎨 Calling updateAvailabilityUI(${available}, "${appState.availabilityMessage}")`);
  updateAvailabilityUI(available, appState.availabilityMessage);
  
  console.log('   ✅ handleAvailabilityValue() complete\n');
}

/**
 * handleAvailabilityMessageValue() — IMPROVED VERSION with DEBUG LOGGING
 * 
 * Processes availability message data from any source.
 * Updates the global state and re-renders the UI with the message.
 * 
 * @param {Object} data - Data object containing message field
 */
function handleAvailabilityMessageValue(data) {
  console.log('📥 handleAvailabilityMessageValue() called');
  console.log('   Raw data object:', data);
  
  const oldMessage = appState.availabilityMessage;
  appState.availabilityMessage = data && data.message ? data.message : '';
  
  console.log(`   💬 Message updated: "${oldMessage}" → "${appState.availabilityMessage}"`);
  
  // Re-render UI to show new message if currently unavailable
  console.log(`   🎨 Calling updateAvailabilityUI(${appState.rationAvailable}, "${appState.availabilityMessage}")`);
  updateAvailabilityUI(appState.rationAvailable, appState.availabilityMessage);
  
  console.log('   ✅ handleAvailabilityMessageValue() complete\n');
}

/**
 * checkAvailability() — FIXED VERSION
 *
 * Set up REAL-TIME listeners for ration availability.
 * When admin changes availability status, UI updates automatically within 1-2 seconds.
 * 
 * PRIORITY ORDER:
 * 1. Firestore (real-time listener) — fastest
 * 2. Realtime Database (real-time or polling) — fallback
 * 3. localStorage broadcast events — cross-tab sync
 * 
 * FEATURES:
 * - Shows spinner while checking
 * - Displays appropriate message based on status
 * - Disables/enables Continue button automatically
 * - Handles all error cases gracefully
 * - Comprehensive logging for debugging
 */
function checkAvailability() {
  const dict = translations[appState.language] || translations.en;
  const statusBox  = document.getElementById('statusBox');
  const availIcon  = document.getElementById('availIcon');
  const availBtns  = document.getElementById('availButtons');

  console.log('🔄 Checking ration availability...');

  // Show loading state
  statusBox.className = 'status-box';
  statusBox.innerHTML = `
    <div class="status-spinner" id="statusSpinner"></div>
    <p class="status-text" id="statusText">${dict.statusChecking}</p>`;
  availBtns.style.display = 'none';
  availIcon.textContent = '⏳';

  const firestore = window.firestore;
  const realtimeDb = window.db || null;

  // If listeners already attached, just update UI immediately
  if (availabilityListenerAttached && availabilityMessageListenerAttached) {
    console.log('✅ Listeners already attached, updating UI with current state...');
    updateAvailabilityUI(appState.rationAvailable, appState.availabilityMessage);
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // PRIORITY 1: Firestore Listeners (REAL-TIME)
  // ─────────────────────────────────────────────────────────────
  if (firestore) {
    console.log('🔥 Setting up Firestore real-time listeners...');
     
    // Listen to availability status
    const docRef = firestore.collection('settings').doc('availability');
    availabilityUnsubscribe = docRef.onSnapshot(
      (doc) => {
        console.log('📡 Firestore availability update received');
        const data = doc.exists ? doc.data() : null;
        console.log('📊 Data from Firestore:', data);
        handleAvailabilityValue(data);
      },
      (error) => {
        console.error('❌ Firestore availability listener error:', error);
        if (!realtimeDb) {
          console.error('❌ No fallback database available!');
          showToast('Unable to load availability status. Please try later.', 'error');
          appState.rationAvailable = false;
          updateAvailabilityUI(false);
        } else {
          console.warn('⚠️ Firestore failed but Realtime DB available as fallback');
        }
      }
    );
    console.log('✅ Firestore availability listener attached');

    // Listen to availability message
    const msgRef = firestore.collection('settings').doc('availabilityMessage');
    availabilityMessageUnsubscribe = msgRef.onSnapshot(
      (doc) => {
        console.log('📡 Firestore availabilityMessage update received');
        const data = doc.exists ? doc.data() : null;
        console.log('📊 Message data from Firestore:', data);
        handleAvailabilityMessageValue(data);
      },
      (error) => {
        console.error('❌ Firestore availability message listener error:', error);
      }
    );
    console.log('✅ Firestore message listener attached');
     
    availabilityListenerAttached = true;
    availabilityMessageListenerAttached = true;
  } else {
    console.warn('⚠️ Firestore not available, skipping Firestore listeners');
  }

  // ─────────────────────────────────────────────────────────────
  // PRIORITY 2: Realtime Database (LOCAL POLLING)
  // ─────────────────────────────────────────────────────────────
  if (realtimeDb && realtimeDb.isLocal && !availabilityDbAttached) {
    console.log('📱 Setting up local Realtime DB polling (2-second interval)...');
     
    const poll = async () => {
      try {
        console.log('🔍 Polling local DB for availability...');
         
        // Check availability status
        const snapshot = await realtimeDb.ref('settings/availability').once();
        const data = snapshot && snapshot.exists ? snapshot.exists() ? snapshot.val() : null : null;
        console.log('📊 Polled availability data:', data);
        if (data) {
          handleAvailabilityValue(data);
        }

        // Check availability message
        const msgSnapshot = await realtimeDb.ref('settings/availabilityMessage').once();
        const msgData = msgSnapshot && msgSnapshot.exists ? msgSnapshot.exists() ? msgSnapshot.val() : null : null;
        console.log('📊 Polled message data:', msgData);
        if (msgData) {
          handleAvailabilityMessageValue(msgData);
        }
      } catch (err) {
        console.error('❌ Local DB polling error for availability:', err);
      }
    };

    // Run immediately, then every 2 seconds
    poll();
    availabilityPollInterval = setInterval(poll, 2000);
    availabilityDbAttached = true;
    console.log('✅ Local DB polling started');
  }

  // ─────────────────────────────────────────────────────────────
  // PRIORITY 3: Realtime Database (REMOTE - REAL-TIME LISTENERS)
  // ─────────────────────────────────────────────────────────────
  if (realtimeDb && !realtimeDb.isLocal && !availabilityDbAttached) {
    console.log('🔥 Setting up Realtime DB real-time listeners...');
     
    availabilityDbRef = realtimeDb.ref('settings/availability');
    availabilityDbRef.on('value', (snapshot) => {
      console.log('📡 Realtime DB availability update received');
      const data = snapshot.exists() ? snapshot.val() : null;
      console.log('📊 Data from Realtime DB:', data);
      if (data) {
        handleAvailabilityValue(data);
      }
    }, (error) => {
      console.error('❌ Realtime DB availability listener error:', error);
      if (!firestore) {
        console.error('❌ No Firestore fallback available!');
        showToast('Unable to load availability status. Please try later.', 'error');
        appState.rationAvailable = false;
        updateAvailabilityUI(false);
      }
    });
    console.log('✅ Realtime DB availability listener attached');

    availabilityMessageDbRef = realtimeDb.ref('settings/availabilityMessage');
    availabilityMessageDbRef.on('value', (snapshot) => {
      console.log('📡 Realtime DB availabilityMessage update received');
      const data = snapshot.exists() ? snapshot.val() : null;
      console.log('📊 Message data from Realtime DB:', data);
      if (data) {
        handleAvailabilityMessageValue(data);
      }
    }, (error) => {
      console.error('❌ Realtime DB availability message listener error:', error);
    });
    console.log('✅ Realtime DB message listener attached');
     
    availabilityDbAttached = true;
  }

  // ─────────────────────────────────────────────────────────────
  // FINAL FALLBACK: Load from localStorage or Default to Available
  // ─────────────────────────────────────────────────────────────
  if (!firestore && !realtimeDb) {
    console.warn('⚠️ No Firestore or Realtime DB available!');
    try {
      const stored = localStorage.getItem('smartQueueLocalDB');
      if (stored) {
        const db = JSON.parse(stored);
        if (db.settings && db.settings.availability) {
          handleAvailabilityValue(db.settings.availability);
        } else {
          appState.rationAvailable = true;
          updateAvailabilityUI(true);
        }
      } else {
        appState.rationAvailable = true;
        updateAvailabilityUI(true);
      }
    } catch (e) {
      console.warn('⚠️ Could not load from localStorage, using default (AVAILABLE):', e);
      appState.rationAvailable = true;
      updateAvailabilityUI(true);
    }
    showToast('Firebase unavailable; using local database.', 'warning');
  }

  availabilityListenerAttached = true;
  console.log('✅ checkAvailability() complete - listeners are now active');
}

// Listen for cross-tab availability broadcasts (admin triggers localStorage event)
window.addEventListener('storage', (e) => {
  try {
    if (!e.key) return;
    if (e.key === 'availability_broadcast') {
      const payload = e.newValue ? JSON.parse(e.newValue) : null;
      if (payload && payload.payload) {
        handleAvailabilityValue(payload.payload);
      }
    }
    if (e.key === 'availabilityMessage_broadcast') {
      const payload = e.newValue ? JSON.parse(e.newValue) : null;
      if (payload && payload.payload) {
        handleAvailabilityMessageValue(payload.payload);
      }
    }
  } catch (err) {
    console.error('Error handling storage event for availability:', err);
  }
});

// Clean up polling on page unload
window.addEventListener('beforeunload', () => {
  if (availabilityPollInterval) clearInterval(availabilityPollInterval);
  if (availabilityDbRef && availabilityDbRef.off) availabilityDbRef.off();
});

/* ──────────────────────────────────────────
   5. BUILD TIME SLOT GRID
   Dynamically creates slot buttons from the
   slots[] array above.
────────────────────────────────────────── */
async function buildSlotGrid() {
  const grid = document.getElementById('slotGrid');
  if (!grid) return;
  const dict = translations[appState.language] || translations.en;

  grid.innerHTML = ''; // clear old buttons

  let slotItems = slots;
  try {
    if (window.db) {
      const snapshot = await window.db.ref('timeSlots').once('value');
      if (snapshot.exists()) {
        slotItems = [];
        snapshot.forEach(item => {
          const data = item.val();
          slotItems.push({
            label: `${data.startTime} - ${data.endTime}`,
            seats: data.availableSeats != null ? data.availableSeats : (data.capacity != null ? data.capacity : 0),
            isBreak: false,
            docId: item.key
          });
        });
      }
    }
  } catch (error) {
    console.warn('Could not load slots from DB, using local defaults', error);
  }

  slotItems.forEach((slot, index) => {
    const btn = document.createElement('button');
    btn.className = 'slot-btn';

    if (slot.isBreak) {
      btn.classList.add('break-slot');
      btn.innerHTML = `<span class="slot-time">${slot.label}</span>`;
      btn.disabled = true;
    } else if (slot.seats === 0) {
      btn.classList.add('disabled');
      btn.innerHTML = `
        <span class="slot-time">${slot.label}</span>
        <span class="slot-seats full">${dict.slotFull}</span>`;
      btn.disabled = true;
    } else {
      btn.innerHTML = `
        <span class="slot-time">${slot.label}</span>
        <span class="slot-seats">${slot.seats} ${dict.slotSeatsLeft}</span>`;
      btn.onclick = () => pickSlot(btn, slot, index);
    }

    grid.appendChild(btn);
  });
}

/* Called when a slot button is clicked */
function pickSlot(btn, slot, index) {
  // Deselect all slot buttons
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  // Select clicked
  btn.classList.add('selected');

  // Save to state
  appState.selectedSlot = {
    label: slot.label,
    index,
    docId: slot.docId || null,
    availableSeats: slot.seats
  };

  // Show selected info bar
  const infoBar = document.getElementById('selectedSlotInfo');
  const labelEl = document.getElementById('selectedSlotLabel');
  infoBar.style.display = 'block';
  labelEl.textContent = slot.label;

  // Enable confirm button
  document.getElementById('slotContinueBtn').disabled = false;
}

/* Validate slot selection before moving on */
function confirmSlot() {
  const dict = translations[appState.language] || translations.en;
  if (!appState.selectedSlot) {
    showToast(dict.selectSlot);
    return;
  }
  goTo('page-token');
}

async function confirmBooking() {
  if (!appState.tokenNumber || !appState.selectedSlot) {
    showToast('Booking data is incomplete', 'error');
    return;
  }

  const saved = await saveBookingToDB();
  if (saved) {
    goTo('page-confirm');
  }
}

async function saveBookingToDB() {
  if (!window.db) {
    showToast('Booking saved locally (demo mode). Admin dashboard will show demo data.', 'info');
    return true;
  }

  try {
    if (appState.selectedSlot?.docId) {
      const slotRef = window.db.ref(`timeSlots/${appState.selectedSlot.docId}`);
      const slotSnapshot = await slotRef.once('value');
      if (slotSnapshot.exists()) {
        const slotData = slotSnapshot.val();
        const remainingSeats = (slotData.availableSeats != null ? slotData.availableSeats : (slotData.capacity != null ? slotData.capacity : 0)) - 1;
        if (remainingSeats < 0) {
          showToast('Selected slot is no longer available', 'error');
          return false;
        }
        await slotRef.update({ availableSeats: remainingSeats });
      }
    }

    await window.db.ref('customers').push({
      mobile: appState.mobile,
      language: appState.language,
      tokenNumber: appState.tokenNumber,
      slot: appState.selectedSlot.label,
      slotId: appState.selectedSlot.docId || null,
      status: 'Booked',
      date: new Date().toISOString(),
      createdAt: Date.now()
    });

    showToast('Booking confirmed and saved!', 'success');
    return true;
  } catch (error) {
    console.error('Error saving booking:', error);
    showToast('Unable to save booking. Please try again.', 'error');
    return false;
  }
}

/* ──────────────────────────────────────────
   6. TOKEN GENERATION
   Creates a unique token and fills the card.
────────────────────────────────────────── */
function generateToken() {
  // Generate a random 3-digit token (e.g., T-047)
  const num = Math.floor(Math.random() * 900) + 100;
  appState.tokenNumber = `T-${num}`;

  // Get current date info
  const now  = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];

  const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  const dayStr  = days[now.getDay()];

  // Fill token card fields
  document.getElementById('tokenNumber').textContent = appState.tokenNumber;
  document.getElementById('tDate').textContent       = dateStr;
  document.getElementById('tDay').textContent        = dayStr;
  document.getElementById('tMobile').textContent     = '+91 ' + maskMobile(appState.mobile);
  document.getElementById('tSlot').textContent       = appState.selectedSlot?.label || '—';
}

/* Mask middle digits of mobile for privacy: 98****7890 */
function maskMobile(mob) {
  if (!mob || mob.length < 10) return mob || '—';
  return mob.slice(0, 2) + '****' + mob.slice(6);
}

/* ──────────────────────────────────────────
   7. CONFIRMATION PAGE — fill summary
────────────────────────────────────────── */
function fillConfirmation() {
  const dict = translations[appState.language] || translations.en;
  document.getElementById('confirmToken').textContent =
    dict.confirmTokenLabel + ' ' + (appState.tokenNumber || '—');
  document.getElementById('confirmSlot').textContent =
    appState.selectedSlot?.label || '—';
}

/* ──────────────────────────────────────────
   RESET — go back to welcome & clear state
────────────────────────────────────────── */
function resetApp() {
  // Clear state
  appState.language     = 'en';
  appState.mobile       = '';
  appState.sentTo       = '';
  appState.selectedSlot = null;
  appState.tokenNumber  = null;

  // Reset mobile input
  const mob = document.getElementById('mobileInput');
  if (mob) mob.value = '';

  // Reset OTP boxes
  document.querySelectorAll('.otp-box').forEach(b => {
    b.value = '';
    b.classList.remove('filled');
  });

  // Hide OTP section
  const otpSection = document.getElementById('otpSection');
  if (otpSection) otpSection.style.display = 'none';
  const continueBtn = document.getElementById('continueOtpBtn');
  if (continueBtn) continueBtn.style.display = 'none';

  // Reset send OTP button
  const sendBtn = document.getElementById('sendOtpBtn');
  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = translations[appState.language]?.sendOtpBtn || translations.en.sendOtpBtn; }

  translateUI();

  // Rebuild slot grid (to deselect)
  buildSlotGrid();
  const infoBar = document.getElementById('selectedSlotInfo');
  if (infoBar) infoBar.style.display = 'none';
  const slotBtn = document.getElementById('slotContinueBtn');
  if (slotBtn) slotBtn.disabled = true;

  // Navigate to language selection page
  goTo('page-lang');
}

/* ──────────────────────────────────────────
   HELPER — TOAST NOTIFICATION
   Shows a small notification at the bottom.
────────────────────────────────────────── */
function showToast(message, type = 'info') {
  // Remove existing toast
  const old = document.getElementById('toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = message;

  // Inline styles so no extra CSS class needed
  Object.assign(toast.style, {
    position:     'fixed',
    bottom:       '32px',
    left:         '50%',
    transform:    'translateX(-50%)',
    background:   type === 'success' ? '#2e7d32' : '#333',
    color:        '#fff',
    padding:      '12px 24px',
    borderRadius: '99px',
    fontSize:     '.9rem',
    fontWeight:   '700',
    fontFamily:   "'Nunito', sans-serif",
    zIndex:       '9999',
    boxShadow:    '0 6px 24px rgba(0,0,0,.3)',
    animation:    'toastIn .3s ease',
    whiteSpace:   'nowrap',
    maxWidth:     '90vw',
    textAlign:    'center',
  });

  // Inject keyframe if not present
  if (!document.getElementById('toastStyle')) {
    const style = document.createElement('style');
    style.id = 'toastStyle';
    style.textContent = `
      @keyframes toastIn {
        from { opacity:0; transform:translateX(-50%) translateY(16px); }
        to   { opacity:1; transform:translateX(-50%) translateY(0); }
      }`;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Auto-remove after 2.8 seconds
  setTimeout(() => toast.remove(), 2800);
}

/* ──────────────────────────────────────────
   HELPER — SHAKE ANIMATION
   Briefly shakes an element on error.
────────────────────────────────────────── */
function translateUI() {
  const dict = translations[appState.language] || translations.en;

  setText('appTitle', dict.appTitle);
  setText('heroBadge', dict.heroBadge);
  setText('heroDesc', dict.heroDesc);
  setText('chip1', dict.chip1);
  setText('chip2', dict.chip2);
  setText('chip3', dict.chip3);
  setText('chip4', dict.chip4);
  setText('startButton', dict.startButton);

  setText('langTitle', dict.langTitle);
  setText('langSub', dict.langSub);
  setText('langLabel', dict.langLabel);
  setText('langContinueBtn', dict.langContinueBtn);
  setText('langBackBtn', dict.langBackBtn);

  setText('otpTitle', dict.otpTitle);
  setText('otpSub', dict.otpSub);
  setText('mobileLabel', dict.mobileLabel);
  setText('otpInputLabel', dict.otpInputLabel);
  setText('sendOtpBtn', dict.sendOtpBtn);
  setText('continueOtpBtn', dict.verifyOtpBtn);
  setText('otpBackBtn', dict.langBackBtn);
  const mobileInput = document.getElementById('mobileInput');
  if (mobileInput) mobileInput.placeholder = dict.mobilePlaceholder;

  setText('availTitle', dict.availabilityTitle);
  setText('availSub', dict.availabilitySub);
  setText('availContinueBtn', dict.bookSlotBtn);
  setText('retryBtn', dict.retryBtn);

  setText('slotsTitle', dict.slotsTitle);
  setText('slotsSub', dict.slotsSub);
  setText('selectedSlotPrefix', dict.selectedSlotPrefix);
  setText('slotContinueBtn', dict.confirmSlotBtn);
  setText('slotsBackBtn', dict.langBackBtn);

  setText('tokenTitle', dict.tokenTitle);
  setText('tokenSub', dict.tokenSub);
  setText('tokenOrg', dict.tokenOrg);
  setText('tokenSystem', dict.tokenSystem);
  setText('tokenNumberLabel', dict.tokenNumberLabel);
  setText('tokenDateLabel', dict.tokenDateLabel);
  setText('tokenDayLabel', dict.tokenDayLabel);
  setText('tokenMobileLabel', dict.tokenMobileLabel);
  setText('tokenSlotLabel', dict.tokenSlotLabel);
  setText('tokenFooter', dict.tokenFooter);
  setText('tokenConfirmBtn', dict.tokenConfirmBtn);

  setText('confirmTitle', dict.confirmTitle);
  setText('confirmThank', dict.confirmThank);
  setText('confirmMsg', dict.confirmMsg);
  setText('confirmItem1', dict.confirmItem1);
  setText('confirmItem2', dict.confirmItem2);
  setText('confirmItem3', dict.confirmItem3);
  setText('confirmItem4', dict.confirmItem4);
  setText('doneButton', dict.doneButton);

  // Rebuild dynamic slot labels in case language changed
  buildSlotGrid();

  if (document.getElementById('otpSection')?.style.display === 'flex') {
    updateOtpHint();
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  if (value.includes('<br/>')) {
    element.innerHTML = value;
  } else {
    element.textContent = value;
  }
}

function shakeElement(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.style.animation = 'none';
  // Force reflow then apply shake
  void el.offsetWidth;
  el.style.animation = 'shake .4s ease';

  // Inject keyframe if not present
  if (!document.getElementById('shakeStyle')) {
    const style = document.createElement('style');
    style.id = 'shakeStyle';
    style.textContent = `
      @keyframes shake {
        0%,100% { transform:translateX(0); }
        20%      { transform:translateX(-8px); }
        40%      { transform:translateX(8px); }
        60%      { transform:translateX(-6px); }
        80%      { transform:translateX(6px); }
      }`;
    document.head.appendChild(style);
  }

  // Remove animation after it finishes
  setTimeout(() => el.style.animation = '', 450);
}

// Expose functions used by inline HTML onclick handlers
window.goTo = goTo;
window.selectLang = selectLang;
window.sendOTP = sendOTP;
window.otpMove = otpMove;
window.verifyOTP = verifyOTP;
window.resetOTP = resetOTP;
window.checkAvailability = checkAvailability;
window.confirmSlot = confirmSlot;
window.confirmBooking = confirmBooking;
window.resetApp = resetApp;

/* ──────────────────────────────────────────
   KEYBOARD SUPPORT for OTP boxes
   Backspace moves to previous box.
────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Backspace' && e.target.classList.contains('otp-box')) {
    const boxes = Array.from(document.querySelectorAll('.otp-box'));
    const idx = boxes.indexOf(e.target);
    if (e.target.value === '' && idx > 0) {
      boxes[idx - 1].focus();
    }
  }
});
