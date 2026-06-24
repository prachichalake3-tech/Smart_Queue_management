// admin-login.js
// Simple local admin login using fixed credentials.

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('adminLoginForm');
  const errorMessage = document.getElementById('adminError');

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
  }

  function clearError() {
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearError();

    const username = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value;

    if (!username || !password) {
      showError('Please enter username and password');
      return;
    }

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      window.location.href = 'admin.html';
      return;
    }

    showError('Invalid Username or Password');
  });
});
