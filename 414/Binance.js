(function () {
  'use strict';

  // Format number with commas
  function formatNumber(number) {
    const options = {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    };
    return Number(number).toLocaleString("en-US", options);
  }

  // Get balance from localStorage
  function getBalance() {
    const balance = localStorage.getItem("binanceBalance");
    return balance ? parseFloat(balance) : 0;
  }

  // Update balance in localStorage
  function updateBalance(newBalance) {
    localStorage.setItem("binanceBalance", newBalance.toString());
  }

  // Add amount to balance
  function addToBalance(amount) {
    if (amount <= 0) {
      return alert("Amount must be > 0");
    }
    
    const currentBalance = getBalance();
    const newBalance = currentBalance + amount;
    updateBalance(newBalance);
    
    showNotification("Added " + formatNumber(amount) + " USDT to balance");
    updateUI();
  }

  // Update UI with current balance
  function updateUI() {
    const balance = getBalance();
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
    
    // Update detail view
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

  // Show notification
  function showNotification(message) {
    const notification = document.createElement("div");
    notification.style.position = "fixed";
    notification.style.right = "16px";
    notification.style.bottom = "330px";
    notification.style.background = "#1e2329";
    notification.style.color = "#eaecef";
    notification.style.padding = "10px 14px";
    notification.style.borderRadius = "10px";
    notification.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
    notification.style.zIndex = "999999";
    notification.textContent = message;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  }

  // Show add balance modal
  function showAddBalanceModal() {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display:flex; align-items:center; justify-content:center;
      z-index: 999999;
    `;
    
    const modal = document.createElement("div");
    modal.style.cssText = `
      background: #1e2329; color: #eaecef; padding: 20px;
      border-radius: 12px; width: 350px; max-width: 90%;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5); font-family: Arial, sans-serif;
    `;
    
    modal.innerHTML = `
      <h3 style="margin:0 0 15px 0; font-size:18px; color:#f0b90b;">Add USDT Balance</h3>
      <label style="display:block; margin-bottom:10px; font-size:14px;">
        Amount (USDT):<br>
        <input id="addAmount" type="number" step="0.01" placeholder="Enter amount" style="width:100%; padding:8px; margin-top:4px; background:#2b3139; border:1px solid #444; border-radius:6px; color:#fff;">
      </label>
      <div style="font-size:12px; margin:10px 0; text-align:center;">
        <a href="https://t.me/onlysell919" target="_blank" style="color:#f0b90b; text-decoration:none;">@onlysell919</a>
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:15px;">
        <button id="addConfirm" style="flex:1; margin-right:10px; padding:10px; background:#f0b90b; border:none; border-radius:6px; color:#000; font-weight:bold;">Add Balance</button>
        <button id="addCancel" style="flex:1; padding:10px; background:#2b3139; border:none; border-radius:6px; color:#fff;">Cancel</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Focus on input
    setTimeout(() => {
      const input = modal.querySelector("#addAmount");
      if (input) input.focus();
    }, 100);
    
    // Cancel button
    modal.querySelector("#addCancel").onclick = () => overlay.remove();
    
    // Confirm button
    modal.querySelector("#addConfirm").onclick = () => {
      let amount = parseFloat(modal.querySelector("#addAmount").value.trim());
      
      if (isNaN(amount) || amount <= 0) {
        return alert("Please enter valid amount > 0");
      }
      
      overlay.remove();
      addToBalance(amount);
    };
    
    // Enter key support
    modal.querySelector("#addAmount").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        modal.querySelector("#addConfirm").click();
      }
    });
  }

  // Modify withdraw button to add balance
  function modifyWithdrawButton() {
    const withdrawButton = document.querySelector("#wallet-nav-withdraw");
    if (!withdrawButton) {
      return;
    }
    
    const newButton = withdrawButton.cloneNode(true);
    withdrawButton.parentNode.replaceChild(newButton, withdrawButton);
    
    // Change button text if possible
    const buttonText = newButton.querySelector(".button-text");
    if (buttonText) {
      buttonText.textContent = "Add Balance";
    }
    
    newButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showAddBalanceModal();
    }, true);
  }

  // Initialize app
  function initializeApp() {
    // Initialize balance if not exists
    if (localStorage.getItem("binanceBalance") === null) {
      updateBalance(0);
    }
    
    // Update UI and set up intervals
    setTimeout(() => {
      updateUI();
      modifyWithdrawButton();
    }, 1500);
    
    setInterval(updateUI, 2000);
  }

  // Start app when page loads
  window.addEventListener("load", () => {
    setTimeout(initializeApp, 1000);
  });
})();
