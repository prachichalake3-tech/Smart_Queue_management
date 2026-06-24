Fix my Smart Queue Portal ration availability system.

Current problem:

* Admin changes ration status to "Available" or "Not Available".
* But customer panel does not show the updated status correctly.

Requirements:

1. When admin selects "Ration Available":

   * Save the status properly.
   * Customer panel should immediately show "Ration Available".

2. When admin selects "Ration Not Available":

   * Customer panel should immediately show "Ration Not Available".

3. If status is "Ration Available":

   * Show Continue button.
   * Allow customer to proceed to Slot Booking.

4. If status is "Ration Not Available":

   * Hide or disable Continue button.
   * Show message:
     "Ration Not Available. Please try after some time."
   * Stop customer from proceeding further.

5. Check and fix:

   * Admin save/update functionality
   * Data storage logic
   * Customer status fetching logic
   * Event listeners
   * Button click handlers

6. If using localStorage:

   * Ensure admin saves status correctly.
   * Ensure customer reads the same value correctly.

7. If using Firebase:

   * Ensure admin writes to Firebase.
   * Ensure customer reads the same document in real time.

8. Add proper console error handling and comments.

9. Keep all other pages and functionality unchanged.

Generate corrected HTML, CSS, and JavaScript code with fully working ration availability synchronization between Admin and Customer panels.
