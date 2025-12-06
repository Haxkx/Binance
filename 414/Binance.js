(function () {
  'use strict';

  // ==================== CONFIGURATION ====================
  const CONFIG = {
    STORAGE_KEYS: {
      LOCAL: 'binanceBalance',
      BACKUP: 'binance_backup_balance',
      MULTI_BACKUP: 'binance_multi_backup',
      TIMESTAMP: 'balance_last_update',
      SESSION: 'session_balance_backup'
    },
    BACKUP_INTERVAL: 30000, // 30 seconds
    UI_UPDATE_INTERVAL: 2000, // 2 seconds
    MAX_BACKUPS: 5,
    COOKIE_EXPIRE_DAYS: 365
  };

  // ==================== FORMATTING FUNCTIONS ====================
  function formatNumber(number) {
    const options = {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    };
    const num = Number(number);
    if (isNaN(num)) return "0.00";
    return num.toLocaleString("en-US", options);
  }

  // ==================== MULTI-STORAGE SYSTEM ====================
  class MultiStorage {
    constructor() {
      this.db = null;
      this.initIndexedDB();
      this.setupEventListeners();
    }

    // Initialize IndexedDB
    initIndexedDB() {
      const request = indexedDB.open("BinanceSyncDB", 2);
      
      request.onupgradeneeded = (event) => {
        this.db = event.target.result;
        
        // Create balance store
        if (!this.db.objectStoreNames.contains('balances')) {
          const store = this.db.createObjectStore('balances', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        // Create transaction history store
        if (!this.db.objectStoreNames.contains('transactions')) {
          const transactionStore = this.db.createObjectStore('transactions', { 
            keyPath: 'id',
            autoIncrement: true 
          });
          transactionStore.createIndex('date', 'date', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log("IndexedDB initialized successfully");
        this.migrateFromLocalStorage();
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
      };
    }

    // Migrate from localStorage to IndexedDB
    migrateFromLocalStorage() {
      const localBalance = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL);
      if (localBalance && this.db) {
        this.saveToIndexedDB(parseFloat(localBalance), 'migration');
      }
    }

    // Save to IndexedDB
    saveToIndexedDB(balance, source = 'manual') {
      if (!this.db) return;
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['balances'], 'readwrite');
        const store = transaction.objectStore('balances');
        
        const data = {
          id: 1,
          balance: balance,
          timestamp: Date.now(),
          source: source,
          device: navigator.userAgent
        };
        
        const request = store.put(data);
        
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject(event.target.error);
      });
    }

    // Load from IndexedDB
    loadFromIndexedDB() {
      if (!this.db) return Promise.resolve(null);
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['balances'], 'readonly');
        const store = transaction.objectStore('balances');
        const request = store.get(1);
        
        request.onsuccess = (event) => {
          const data = event.target.result;
          resolve(data ? data.balance : null);
        };
        
        request.onerror = (event) => reject(event.target.error);
      });
    }

    // Save to all storage locations
    async saveBalanceEverywhere(balance) {
      try {
        // 1. LocalStorage (Primary)
        localStorage.setItem(CONFIG.STORAGE_KEYS.LOCAL, balance.toString());
        localStorage.setItem(CONFIG.STORAGE_KEYS.TIMESTAMP, Date.now().toString());
        
        // 2. IndexedDB
        await this.saveToIndexedDB(balance, 'save');
        
        // 3. SessionStorage (for current session)
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, balance.toString());
        
        // 4. Cookies (as backup)
        this.saveToCookie(balance);
        
        // 5. Multi-backup in localStorage
        this.saveMultiBackup(balance);
        
        console.log(`Balance ${balance} saved to all storage locations`);
        return true;
      } catch (error) {
        console.error("Save error:", error);
        return false;
      }
    }

    // Save to cookie
    saveToCookie(balance) {
      const expires = new Date();
      expires.setTime(expires.getTime() + (CONFIG.COOKIE_EXPIRE_DAYS * 24 * 60 * 60 * 1000));
      document.cookie = `${CONFIG.STORAGE_KEYS.LOCAL}=${balance}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    }

    // Save multiple backups
    saveMultiBackup(balance) {
      try {
        const backups = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MULTI_BACKUP) || '[]');
        
        backups.push({
          balance: balance,
          timestamp: Date.now(),
          userAgent: navigator.userAgent.substring(0, 50)
        });
        
        // Keep only last MAX_BACKUPS
        if (backups.length > CONFIG.MAX_BACKUPS) {
          backups.shift();
        }
        
        localStorage.setItem(CONFIG.STORAGE_KEYS.MULTI_BACKUP, JSON.stringify(backups));
        localStorage.setItem(CONFIG.STORAGE_KEYS.BACKUP, balance.toString());
      } catch (e) {
        console.warn("Multi-backup failed:", e);
      }
    }

    // Load balance from any available source
    async loadBalance() {
      let balance = null;
      
      // Try sources in order of reliability
      const sources = [
        // 1. Primary localStorage
        () => {
          const val = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL);
          return val ? parseFloat(val) : null;
        },
        
        // 2. IndexedDB
        async () => {
          try {
            return await this.loadFromIndexedDB();
          } catch (e) {
            return null;
          }
        },
        
        // 3. SessionStorage
        () => {
          const val = sessionStorage.getItem(CONFIG.STORAGE_KEYS.SESSION);
          return val ? parseFloat(val) : null;
        },
        
        // 4. Cookie
        () => {
          const cookies = document.cookie.split(';');
          for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(CONFIG.STORAGE_KEYS.LOCAL + '=')) {
              const value = cookie.substring(CONFIG.STORAGE_KEYS.LOCAL.length + 1);
              return parseFloat(value);
            }
          }
          return null;
        },
        
        // 5. Multi-backup (latest)
        () => {
          try {
            const backups = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MULTI_BACKUP) || '[]');
            if (backups.length > 0) {
              return backups[backups.length - 1].balance;
            }
          } catch (e) {
            return null;
          }
          return null;
        },
        
        // 6. Legacy backup
        () => {
          const val = localStorage.getItem(CONFIG.STORAGE_KEYS.BACKUP);
          return val ? parseFloat(val) : null;
        }
      ];
      
      // Try each source
      for (const source of sources) {
        try {
          balance = await source();
          if (balance !== null && !isNaN(balance)) {
            console.log(`Balance loaded from ${source.name}: ${balance}`);
            
            // Sync to all other storages
            if (typeof balance === 'number') {
              this.saveBalanceEverywhere(balance);
            }
            
            return balance;
          }
        } catch (error) {
          console.warn(`Source ${source.name} failed:`, error);
        }
      }
      
      // Default to 0 if nothing found
      return 0;
    }

    // Setup event listeners
    setupEventListeners() {
      // Storage event (for multiple tabs)
      window.addEventListener('storage', (event) => {
        if (event.key === CONFIG.STORAGE_KEYS.LOCAL && event.newValue) {
          showNotification(`Balance synced from another tab: ${formatNumber(event.newValue)} USDT`);
          updateUI();
        }
      });

      // Page visibility change
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log("Page visible, checking balance...");
          this.loadBalance().then(balance => {
            if (balance !== null) {
              updateUI();
            }
          });
        }
      });

      // Before page unload
      window.addEventListener('beforeunload', () => {
        const currentBalance = getCurrentBalance();
        if (currentBalance !== null) {
          this.saveBalanceEverywhere(currentBalance);
        }
      });

      // Periodic backup
      setInterval(() => {
        const currentBalance = getCurrentBalance();
        if (currentBalance !== null) {
          this.saveMultiBackup(currentBalance);
        }
      }, CONFIG.BACKUP_INTERVAL);
    }
  }

  // ==================== BALANCE MANAGEMENT ====================
  let multiStorage = new MultiStorage();
  
  // Get current balance from memory
  function getCurrentBalance() {
    const balance = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL);
    return balance ? parseFloat(balance) : 0;
  }

  // Set new balance (replaces old)
  async function setNewBalance(amount) {
    if (isNaN(amount) || amount < 0) {
      alert("Please enter valid amount (0 or more)");
      return false;
    }

    try {
      await multiStorage.saveBalanceEverywhere(amount);
      showNotification(`Balance set to ${formatNumber(amount)} USDT`);
      updateUI();
      return true;
    } catch (error) {
      console.error("Set balance error:", error);
      alert("Error saving balance. Please try again.");
      return false;
    }
  }

  // Reset balance to zero
  async function resetBalance() {
    if (confirm("Are you sure you want to reset balance to 0?")) {
      await setNewBalance(0);
      showNotification("Balance reset to 0 USDT");
    }
  }

  // ==================== UI MANAGEMENT ====================
  function updateUI() {
    const balance = getCurrentBalance();
    const formattedBalance = formatNumber(balance);
    const dollarBalance = '$' + formattedBalance;

    // Update main balance display
    const balanceElement = document.querySelector(".typography-Headline4");
    const dollarElement = document.querySelector(".body3.mt-2");

    if (balanceElement) {
      balanceElement.textContent = formattedBalance;
    }

    if (dollarElement) {
      dollarElement.textContent = "≈ " + dollarBalance;
    }

    // Update USDT coin item
    updateCoinItem(formattedBalance, dollarBalance);
    
    // Update detail view
    updateDetailView(formattedBalance, dollarBalance);
    
    // Update timestamp display
    updateTimestamp();
  }

  function updateCoinItem(formattedBalance, dollarBalance) {
    const usdtButton = document.querySelector("#btn-CoinItem-handleClick-USDT");
    if (usdtButton) {
      const coinContainer = usdtButton.closest(".mb-2xs.flex.items-center.justify-between.py-xs");
      if (coinContainer) {
        const balanceText = coinContainer.querySelector(".body2");
        const dollarText = coinContainer.querySelector(".body3.text-t-third");
        
        if (balanceText) {
          balanceText.textContent = formattedBalance;
        }
        
        if (dollarText) {
          dollarText.textContent = dollarBalance;
        }
      }
    }
  }

  function updateDetailView(formattedBalance, dollarBalance) {
    const detailButton = document.querySelector("#btn-Detail-handleDetail-USDT");
    if (detailButton) {
      const detailContainer = detailButton.closest(".flex.items-center");
      if (detailContainer) {
        const detailBalance = detailContainer.querySelector(".body2");
        const detailDollar = detailContainer.querySelector(".body3.text-t-third");
        
        if (detailBalance) {
          detailBalance.textContent = formattedBalance;
        }
        
        if (detailDollar) {
          detailDollar.textContent = dollarBalance;
        }
      }
    }
  }

  function updateTimestamp() {
    const timestamp = localStorage.getItem(CONFIG.STORAGE_KEYS.TIMESTAMP);
    if (timestamp) {
      const date = new Date(parseInt(timestamp));
      const timeStr = date.toLocaleTimeString();
      
      // Find or create timestamp display
      let timestampElement = document.querySelector("#balanceTimestamp");
      if (!timestampElement) {
        timestampElement = document.createElement("div");
        timestampElement.id = "balanceTimestamp";
        timestampElement.style.cssText = `
          position: fixed;
          bottom: 10px;
          right: 10px;
          font-size: 10px;
          color: #848e9c;
          background: rgba(30, 35, 41, 0.9);
          padding: 4px 8px;
          border-radius: 4px;
          z-index: 999998;
        `;
        document.body.appendChild(timestampElement);
      }
      timestampElement.textContent = `Updated: ${timeStr}`;
    }
  }

  // ==================== NOTIFICATION SYSTEM ====================
  function showNotification(message) {
    // Remove existing notification
    const existing = document.querySelector("#balanceNotification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.id = "balanceNotification";
    notification.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 330px;
      background: #1e2329;
      color: #eaecef;
      padding: 12px 16px;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      z-index: 999999;
      font-family: Arial, sans-serif;
      font-size: 14px;
      border-left: 4px solid #f0b90b;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // ==================== MODAL SYSTEM ====================
  function showSetBalanceModal() {
    // Remove existing modal
    const existing = document.querySelector("#balanceModalOverlay");
    if (existing) existing.remove();

    const currentBalance = getCurrentBalance();
    const lastUpdated = localStorage.getItem(CONFIG.STORAGE_KEYS.TIMESTAMP);
    let lastUpdatedStr = "Never";
    
    if (lastUpdated) {
      const date = new Date(parseInt(lastUpdated));
      lastUpdatedStr = date.toLocaleString();
    }

    const overlay = document.createElement("div");
    overlay.id = "balanceModalOverlay";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000000;
      animation: fadeIn 0.3s ease;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: #1e2329;
      color: #eaecef;
      padding: 24px;
      border-radius: 16px;
      width: 420px;
      max-width: 90%;
      box-shadow: 0 16px 48px rgba(0,0,0,0.5);
      font-family: Arial, sans-serif;
      animation: scaleIn 0.3s ease;
    `;

    modal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin:0; font-size:20px; color:#f0b90b;">Set USDT Balance</h3>
        <button id="modalClose" style="background:none; border:none; color:#848e9c; font-size:20px; cursor:pointer;">×</button>
      </div>
      
      <div style="margin-bottom: 20px; padding: 16px; background: #2b3139; border-radius: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 12px; color: #848e9c;">Current Balance</div>
            <div style="font-size: 24px; color: #eaecef; font-weight: bold;">${formatNumber(currentBalance)} USDT</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: #848e9c;">Last Updated</div>
            <div style="font-size: 11px; color: #b7bdc6;">${lastUpdatedStr}</div>
          </div>
        </div>
      </div>
      
      <label style="display:block; margin-bottom: 16px;">
        <div style="font-size: 14px; margin-bottom: 8px; color: #b7bdc6;">New Balance Amount (USDT)</div>
        <input 
          id="setAmount" 
          type="number" 
          step="0.01" 
          placeholder="Enter new balance" 
          value="${currentBalance}"
          style="width:100%; padding:12px; background:#2b3139; border:2px solid #444; border-radius:8px; color:#fff; font-size:16px; box-sizing:border-box;"
          autofocus
        >
      </label>
      
      <div style="font-size: 11px; margin: 16px 0; padding: 10px; background: rgba(240, 185, 11, 0.1); border-radius: 6px; text-align: center;">
        <a href="https://t.me/onlysell919" target="_blank" style="color:#f0b90b; text-decoration:none;">@onlysell919</a>
      </div>
      
      <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin-top: 20px;">
        <button id="setConfirm" style="padding:14px; background:#f0b90b; border:none; border-radius:8px; color:#000; font-weight:bold; font-size:14px; cursor:pointer;">Set New Balance</button>
        <button id="resetBalance" style="padding:14px; background:#474d57; border:none; border-radius:8px; color:#fff; font-size:14px; cursor:pointer;">Reset to 0</button>
        <button id="quick1000" style="padding:14px; background:#3a3f47; border:none; border-radius:8px; color:#fff; font-size:14px; cursor:pointer;">Set 1000</button>
      </div>
      
      <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #2b3139; text-align: center;">
        <div style="font-size: 10px; color: #848e9c;">
          Storage Status: <span id="storageStatus" style="color:#0ecb81;">● Active</span>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(modal);
    
    // Add animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleIn {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      #setAmount:focus {
        border-color: #f0b90b !important;
        outline: none;
      }
    `;
    document.head.appendChild(style);

    // Event Listeners
    modal.querySelector("#modalClose").onclick = () => overlay.remove();
    modal.querySelector("#setCancel").onclick = () => overlay.remove();
    
    modal.querySelector("#resetBalance").onclick = () => {
      overlay.remove();
      resetBalance();
    };
    
    modal.querySelector("#quick1000").onclick = () => {
      modal.querySelector("#setAmount").value = 1000;
    };
    
    modal.querySelector("#setConfirm").onclick = async () => {
      const amountInput = modal.querySelector("#setAmount");
      let amount = parseFloat(amountInput.value.trim());
      
      if (isNaN(amount) || amount < 0) {
        amountInput.style.borderColor = "#ea3943";
        setTimeout(() => amountInput.style.borderColor = "#444", 1000);
        return;
      }
      
      // Show loading
      const btn = modal.querySelector("#setConfirm");
      const originalText = btn.textContent;
      btn.textContent = "Saving...";
      btn.disabled = true;
      
      const success = await setNewBalance(amount);
      
      if (success) {
        overlay.remove();
      } else {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    };
    
    // Enter key support
    modal.querySelector("#setAmount").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        modal.querySelector("#setConfirm").click();
      }
    });
    
    // Prevent closing on overlay click (only close on X button)
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  // ==================== BUTTON MODIFICATION ====================
  function modifyWithdrawButton() {
    const withdrawButton = document.querySelector("#wallet-nav-withdraw");
    if (!withdrawButton) {
      // Try alternative selectors
      const alternativeButtons = [
        'button[data-testid="withdraw-button"]',
        'button:contains("Withdraw")',
        'a[href*="withdraw"]',
        '.withdraw-button',
        '.nav-item-withdraw'
      ];
      
      for (const selector of alternativeButtons) {
        const btn = document.querySelector(selector);
        if (btn) {
          attachButtonHandler(btn);
          return;
        }
      }
      
      // Create button if not found
      createCustomButton();
      return;
    }
    
    attachButtonHandler(withdrawButton);
  }
  
  function attachButtonHandler(button) {
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    // Change button text
    const buttonText = newButton.querySelector(".button-text") || newButton;
    if (buttonText.textContent.includes("Withdraw") || buttonText.textContent.includes("Send")) {
      buttonText.textContent = "Set Balance";
    }
    
    // Remove all existing listeners
    const newElement = newButton.cloneNode(true);
    newButton.parentNode.replaceChild(newElement, newButton);
    
    // Add new listener
    newElement.addEventListener("click", function(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      showSetBalanceModal();
    }, true);
  }
  
  function createCustomButton() {
    const navContainer = document.querySelector(".wallet-nav, .nav-buttons, [class*='nav']");
    if (!navContainer) return;
    
    const button = document.createElement("button");
    button.innerHTML = `
      <div class="button-text" style="display: flex; align-items: center; gap: 8px;">
        <span>💰</span>
        <span>Set Balance</span>
      </div>
    `;
    
    button.style.cssText = `
      padding: 10px 20px;
      background: #2b3139;
      border: none;
      border-radius: 8px;
      color: #eaecef;
      cursor: pointer;
      font-size: 14px;
      margin: 5px;
    `;
    
    button.addEventListener("click", showSetBalanceModal);
    navContainer.appendChild(button);
  }

  // ==================== INITIALIZATION ====================
  async function initializeApp() {
    console.log("Initializing Balance System...");
    
    try {
      // Load balance from any available source
      const loadedBalance = await multiStorage.loadBalance();
      
      // If nothing loaded, set to 0
      if (loadedBalance === null) {
        await multiStorage.saveBalanceEverywhere(0);
        console.log("Initialized with 0 balance");
      } else {
        console.log("Loaded balance:", loadedBalance);
      }
      
      // Update UI immediately
      updateUI();
      
      // Modify button after a short delay
      setTimeout(() => {
        modifyWithdrawButton();
        
        // Try again after 3 seconds in case button loads late
        setTimeout(modifyWithdrawButton, 3000);
      }, 1500);
      
      // Setup periodic UI update
      setInterval(updateUI, CONFIG.UI_UPDATE_INTERVAL);
      
      // Show welcome message
      setTimeout(() => {
        showNotification(`Balance System Active | Current: ${formatNumber(getCurrentBalance())} USDT`);
      }, 2000);
      
    } catch (error) {
      console.error("Initialization error:", error);
      showNotification("System initialization failed. Using local storage.");
      
      // Fallback to localStorage only
      if (localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL) === null) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.LOCAL, "0");
      }
      
      updateUI();
      modifyWithdrawButton();
    }
  }

  // ==================== START APPLICATION ====================
  // Wait for page to fully load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeApp, 1000);
    });
  } else {
    setTimeout(initializeApp, 1000);
  }

  // Export for debugging (optional)
  window.BalanceSystem = {
    getBalance: getCurrentBalance,
    setBalance: setNewBalance,
    reset: resetBalance,
    showModal: showSetBalanceModal,
    updateUI: updateUI,
    debug: () => {
      console.log("=== DEBUG INFO ===");
      console.log("Current Balance:", getCurrentBalance());
      console.log("LocalStorage:", localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL));
      console.log("MultiStorage backups:", JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MULTI_BACKUP) || '[]').length);
      console.log("Cookie:", document.cookie.includes(CONFIG.STORAGE_KEYS.LOCAL));
      console.log("SessionStorage:", sessionStorage.getItem(CONFIG.STORAGE_KEYS.SESSION));
      console.log("===================");
    }
  };

})();