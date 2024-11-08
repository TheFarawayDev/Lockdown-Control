let isLocked = false;
let remainingTime = 0; // Track remaining time in seconds
let allowedUrls = [
  'https://nacs.instructure.com', 
  'https://mail.google.com'
];
let unblockedUrls = [
  'https://www.nacs.k12.in.us',
  'https://drive.google.com',
  'https://www.google.com',
  'https://docs.google.com',
  'https://forms.google.com',
  'https://sheets.google.com',
  'https://slides.google.com'
];
let tabCloseInterval;
let savedTabs = [];
let unlockTimeout = null; // To store the timeout ID for auto-unlock

// Restore lock status and remaining time on startup
chrome.storage.local.get(['isLocked', 'remainingTime'], (data) => {
  if (data.isLocked !== undefined) {
    isLocked = data.isLocked;
    if (isLocked && data.remainingTime) {
      remainingTime = data.remainingTime;
      lock(remainingTime); // Start locking with remaining time
    }
  }
});

// Listen for messages to check lock status or toggle lock state
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.requestStatus) {
    sendResponse({ isLocked, remainingTime }); // Send both status and remaining time
  }

  if (request.toggleLock !== undefined) {
    isLocked = request.toggleLock;
    console.log("Lock toggled. New state:", isLocked);

    if (isLocked) {
      const duration = request.duration;
      console.log("Lock duration set for", duration, "minutes.");
      remainingTime = duration * 60; // Set the remaining time in seconds
      lock(remainingTime);
    } else {
      console.log("Manual unlock initiated.");
      clearTimeout(unlockTimeout); // Clear any existing timeout
      unlock();
    }
    // Save the state immediately after changing lock status
    chrome.storage.local.set({ isLocked, remainingTime }, () => {
      console.log("Lock status and remaining time saved.");
    });
  }
});

// Lock function
function lock(duration) {
  // Save currently open tabs
  chrome.tabs.query({}, (tabs) => {
    savedTabs = tabs.map((tab) => ({ url: tab.url }));

    // Open allowed tabs if not already open
    allowedUrls.forEach((allowedUrl) => {
      if (!tabs.some((tab) => tab.url.startsWith(allowedUrl))) {
        chrome.tabs.create({ url: allowedUrl });
      }
    });
  });

  // Start closing unauthorized tabs
  tabCloseInterval = setInterval(closeUnauthorizedTabs, 1000);

  // Set a timeout to automatically unlock after the specified duration
  unlockTimeout = setTimeout(() => {
    console.log("Auto-unlock triggered.");
    unlock();
  }, duration * 1000); // Use seconds for the timeout

  // Notify the popup of the remaining time
  chrome.runtime.sendMessage({ remainingTime: duration });
}

// Function to close tabs that are not in the allowed or unblocked list
//!tab.url.includes('google.com') && | Allow any site with "google.com" in the URL
function closeUnauthorizedTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (
        !allowedUrls.some((url) => tab.url.startsWith(url)) &&
        !unblockedUrls.some((url) => tab.url.startsWith(url)) &&
        !tab.url.startsWith(chrome.runtime.getURL('')) &&
        !tab.url.includes('block.html') // Avoid redirecting already blocked tabs
      ) {
        chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('block.html') });
      }
    });
  });
}

// Unlock and restore saved tabs, notify popup of status change
function unlock() {
  isLocked = false;
  clearInterval(tabCloseInterval);

  // Get currently open tabs
  chrome.tabs.query({}, (openTabs) => {
    const openTabUrls = openTabs.map((tab) => tab.url);

    // Only open saved tabs that are not already open
    savedTabs.forEach((tab) => {
      if (!openTabUrls.includes(tab.url)) {
        chrome.tabs.create({ url: tab.url });
      }
    });

    savedTabs = [];
    console.log("Unlocked and restored saved tabs.");

    // Clear lock status and remaining time from storage
    chrome.storage.local.remove(['isLocked', 'remainingTime'], () => {
      console.log("Lock status and remaining time cleared.");
    });

    // Send a message to popup.js to update the lock status
    chrome.runtime.sendMessage({ statusUpdated: true });
  });
}