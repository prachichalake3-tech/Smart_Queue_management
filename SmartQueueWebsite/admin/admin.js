/* ════════════════════════════════════════════════════════════════
   SMART QUEUE MANAGEMENT SYSTEM - ADMIN DASHBOARD
   admin.js - Complete working version with demo auth
   Uses Firebase Realtime Database via connection.js
   ════════════════════════════════════════════════════════════════ */

// ... (file start unchanged up to setAvailability)

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
      message: document.getElementById('availabilityMessage') ? document.getElementById('availabilityMessage').value : '',
      lastUpdated: new Date().toLocaleString(),
      timestamp: Date.now()
    };

    console.log('📦 Payload to save:', payload);

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
    const previewEl = document.getElementById('customerPreview');
    if (previewEl) {
      if (status === 'available') {
        previewEl.innerHTML = '<p>✅ Ration is currently available</p>';
      } else {
        const msgText = payload.message || 'Ration Not Available. Please try after some time.';
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
      // Broadcast the exact payload; payload already contains a numeric `timestamp`.
      // Using the payload directly keeps event shape consistent across admin/customer code.
      localStorage.setItem('availability_broadcast', JSON.stringify(payload));
      console.log('📡 Broadcast payload via localStorage:', payload);

      // Remove after short delay to keep storage clean (triggers storage event)
      setTimeout(() => {
        try {
          localStorage.removeItem('availability_broadcast');
          console.log('🧹 Cleaned up localStorage broadcast key');
        } catch (e) {
          console.warn('Could not remove localStorage broadcast key:', e);
        }
      }, 1200);

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
    // Expose last write timestamp for debugging / cross-tab checks
    try { window.lastAvailabilityWrite = payload.timestamp; } catch (e) { /* ignore */ }
    console.log('🎉 Availability update complete. Customers will see changes within 1-2 seconds.');

  } catch (error) {
    console.error('❌ CRITICAL ERROR in setAvailability():', error);
    console.error('Stack:', error.stack);
    showToast('❌ Error updating availability. Please try again.', 'error');
  }
}

// ... (rest of file unchanged)
