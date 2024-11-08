const adminPassword = "081024"; // Replace with actual code
let isLocked = false;
let remainingTime = 0; // Track remaining time in seconds

document.addEventListener("DOMContentLoaded", () => {
  const toggleLockButton = document.getElementById("toggleLock");
  const statusDiv = document.getElementById("status");
  const lockDurationInput = document.getElementById("lockDuration");
  const adminCodeInput = document.getElementById("adminCode");

  // Request initial lock status from background
  chrome.runtime.sendMessage({ requestStatus: true }, (response) => {
    if (response) {
      isLocked = response.isLocked;
      remainingTime = response.remainingTime || 0;
      updateStatus();
      startTimer(); // Start the timer if locked
    }
  });

  // Toggle lock on button click
  toggleLockButton.addEventListener("click", () => {
    const enteredCode = adminCodeInput.value;
    const duration = parseInt(lockDurationInput.value);

    if (enteredCode === adminPassword) {
      isLocked = !isLocked;

      // Send duration and toggle lock status to background
      chrome.runtime.sendMessage({ toggleLock: isLocked, duration: isLocked ? duration : null });

      updateStatus();
      adminCodeInput.value = '';
      lockDurationInput.value = '';
    } else {
      alert("Invalid Admin Code");
      adminCodeInput.value = '';
      lockDurationInput.value = '';
    }
  });

  // Listen for status updates from background.js to auto-update UI when lock expires
  chrome.runtime.onMessage.addListener((message) => {
    if (message.statusUpdated) {
      isLocked = false; // Update state from background
      remainingTime = 0; // Reset the time when unlocked
      updateStatus();
      clearInterval(timerInterval); // Clear any existing timer
    } else if (message.timeUpdated) {
      remainingTime = message.remainingTime;
    }
  });

  let timerInterval;
  
  function startTimer() {
    if (remainingTime > 0) {
      timerInterval = setInterval(() => {
        if (remainingTime > 0) {
          remainingTime--;
          chrome.runtime.sendMessage({ updateTime: remainingTime }); // Update time in background
        } else {
          clearInterval(timerInterval);
        }
      }, 1000);
    }
  }

  function updateStatus() {
    if (isLocked) {
      statusDiv.textContent = "Status: Locked";
      statusDiv.className = "locked";
      toggleLockButton.textContent = "Disable Lockdown";
      lockDurationInput.disabled = true; // Disable duration input when locked
      startTimer(); // Start the timer when locked
    } else {
      statusDiv.textContent = "Status: Unlocked";
      statusDiv.className = "unlocked";
      toggleLockButton.textContent = "Enable Lockdown";
      lockDurationInput.disabled = false; // Enable duration input when unlocked
    }
  }
});