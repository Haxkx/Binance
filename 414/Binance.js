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

  // Set balance in localStorage (replace, not add)
  function setBalance(newBalance) {
    localStorage.setItem("binanceBalance", newBalance.toString());
  }

  // Set new balance (completely replace old balance)
  function setNewBalance(amount) {
    if (amount < 0) {
      return alert("Amount cannot be negative");
    }

    setBalance(amount);
    showNotification("Balance set to " + formatNumber(amount) + " USDT");
    updateUI();
  }

  // Reset balance to zero
  function resetBalance() {
    if (confirm("Are you sure you want to reset balance to 0?")) {
      setBalance(0);
      showNotification("Balance reset to 0 USDT");
      updateUI();
    }
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

  // Show set balance modal
  function showSetBalanceModal() {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display:flex; align-items:center; justify-content:center;
      z-index: 999999;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: #1e2329; color: #eaecef; padding: 20px;
      border-radius: 12px; width: 400px; max-width: 90%;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5); font-family: Arial, sans-serif;
    `;

    const currentBalance = getBalance();
    
    modal.innerHTML = `
      <h3 style="margin:0 0 15px 0; font-size:18px; color:#f0b90b;">Set USDT Balance</h3>
      <div style="margin-bottom:15px; padding:10px; background:#2b3139; border-radius:6px;">
        <div style="font-size:12px; color:#848e9c;">Current Balance</div>
        <div style="font-size:18px; color:#eaecef; font-weight:bold;">${formatNumber(currentBalance)} USDT</div>
      </div>
      <label style="display:block; margin-bottom:10px; font-size:14px;">
        New Balance Amount (USDT):<br>
        <input id="setAmount" type="number" step="0.01" placeholder="Enter new balance" style="width:100%; padding:8px; margin-top:4px; background:#2b3139; border:1px solid #444; border-radius:6px; color:#fff;">
      </label>
      <div style="font-size:12px; margin:10px 0; text-align:center;">
        <a href="https://t.me/onlysell919" target="_blank" style="color:#f0b90b; text-decoration:none;">@onlysell919</a>
      </div>
      <div style="display:flex; gap:10px; margin-top:15px;">
        <button id="setConfirm" style="flex:2; padding:10px; background:#f0b90b; border:none; border-radius:6px; color:#000; font-weight:bold;">Set New Balance</button>
        <button id="resetBalance" style="flex:1; padding:10px; background:#474d57; border:none; border-radius:6px; color:#fff;">Reset to 0</button>
        <button id="setCancel" style="flex:1; padding:10px; background:#2b3139; border:none; border-radius:6px; color:#fff;">Cancel</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Focus on input
    setTimeout(() => {
      const input = modal.querySelector("#setAmount");
      if (input) input.focus();
    }, 100);

    // Cancel button
    modal.querySelector("#setCancel").onclick = () => overlay.remove();

    // Reset button
    modal.querySelector("#resetBalance").onclick = () => {
      overlay.remove();
      resetBalance();
    };

    // Confirm button
    modal.querySelector("#setConfirm").onclick = () => {
      let amount = parseFloat(modal.querySelector("#setAmount").value.trim());

      if (isNaN(amount) || amount < 0) {
        return alert("Please enter valid amount (0 or more)");
      }

      overlay.remove();
      setNewBalance(amount);
    };

    // Enter key support
    modal.querySelector("#setAmount").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        modal.querySelector("#setConfirm").click();
      }
    });
  }

  // Modify withdraw button to set balance
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
      buttonText.textContent = "Set Balance";
    }

    newButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showSetBalanceModal();
    }, true);
  }

  // Initialize app
  function initializeApp() {
    // Initialize balance if not exists
    if (localStorage.getItem("binanceBalance") === null) {
      setBalance(0);
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