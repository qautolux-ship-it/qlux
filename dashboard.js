import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, getDoc, setDoc, deleteDoc, collection, query, where, onSnapshot, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged, signOut, sendPasswordResetEmail, sendEmailVerification, deleteUser 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDp1xll_VkiCQcJhxkMa7ggYpfgAbZFXds",
  authDomain: "q-autolux.firebaseapp.com",
  projectId: "q-autolux",
  storageBucket: "q-autolux.firebasestorage.app",
  messagingSenderId: "958237455585",
  appId: "1:958237455585:web:7f8eb1848dd7de8fe0b3a0",
  measurementId: "G-WTET9LS8G6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let exchangeRates = { USD: 1 };

const CURRENCY_MAP = {
  GB: "GBP", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", 
  NL: "EUR", BE: "EUR", AT: "EUR", PT: "EUR", IE: "EUR",
  CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
  US: "USD", CA: "CAD", BR: "BRL", MX: "MXN", AR: "ARS",
  CL: "CLP", CO: "COP", PE: "PEN",
  JP: "JPY", CN: "CNY", IN: "INR", AU: "AUD", NZ: "NZD", 
  KR: "KRW", SG: "SGD", HK: "HKD", TH: "THB",
  NG: "NGN", ZA: "ZAR", KE: "KES", GH: "GHS", EG: "EGP",
  AE: "AED", SA: "SAR", IL: "ILS", TR: "TRY",
  en: "USD", de: "EUR", fr: "EUR", es: "EUR", 
  pt: "BRL", ru: "RUB", zh: "CNY", ja: "JPY",
  ar: "AED", ko: "KRW"
};

async function fetchExchangeRates() {
  try {
    const rateDoc = await getDoc(doc(db, "settings", "exchangeRates"));
    if (rateDoc.exists()) {
      const rawData = rateDoc.data();
      exchangeRates = {};
      Object.keys(rawData).forEach(key => {
        const cleanKey = key.trim().toUpperCase();
        exchangeRates[cleanKey] = Number(rawData[key]);
      });
      return true;
    }
    return false;
  } catch (err) {
    showError("Failed to load currency rates");
    return false;
  }
}

setInterval(async () => {
  await fetchExchangeRates();
}, 30 * 60 * 1000);

function showLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'flex';
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
}

function showSuccess(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification toast-success';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #27ae60;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
    font-weight: 500;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showError(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification toast-error';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4d4d;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
    font-weight: 500;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

async function loadDropdownOptions() {
  try {
    const countriesDoc = await getDoc(doc(db, "settings", "countries"));
    const currenciesDoc = await getDoc(doc(db, "settings", "currencies"));
    
    if (countriesDoc.exists()) {
      const countries = countriesDoc.data().list || [];
      populateLocationDropdown(countries);
    }
    
    if (currenciesDoc.exists()) {
      const currencies = currenciesDoc.data().list || [];
      populateCurrencyDropdown(currencies);
    }
  } catch (err) {
    showError("Failed to load country/currency options");
  }
}

function populateLocationDropdown(countries) {
  const locationSelect = document.getElementById('editLocation');
  if (!locationSelect) return;
  
  locationSelect.innerHTML = '<option value="">Select a country...</option>';
  
  countries.forEach(country => {
    const option = document.createElement('option');
    option.value = country;
    option.textContent = country;
    locationSelect.appendChild(option);
  });
}

function populateCurrencyDropdown(currencies) {
  const currencySelect = document.getElementById('editCurrency');
  if (!currencySelect) return;
  
  currencySelect.innerHTML = '<option value="">Select a currency...</option>';
  
  currencies.forEach(currency => {
    const option = document.createElement('option');
    if (typeof currency === 'object') {
      option.value = currency.code;
      option.textContent = `${currency.code} - ${currency.name}`;
    } else {
      option.value = currency;
      option.textContent = currency;
    }
    currencySelect.appendChild(option);
  });
}

function getLikelyCurrencyFromLocale() {
  const locale = new Intl.NumberFormat().resolvedOptions().locale || navigator.language || "en-US";
  const lang = locale.split("-")[0].toLowerCase();
  const region = (locale.split("-")[1] || "").toUpperCase();

  return region && CURRENCY_MAP[region] ? CURRENCY_MAP[region] :
         CURRENCY_MAP[lang] ? CURRENCY_MAP[lang] : "USD";
}

async function getDisplayCurrency() {
  const user = auth.currentUser;
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        return userDoc.data().preferredCurrency || "USD";
      }
    } catch (err) {}
  }
  return getLikelyCurrencyFromLocale();
}

function formatPrice(amountUSD, currency = "USD") {
  const cleanCurrency = currency.trim().toUpperCase();
  const rate = exchangeRates[cleanCurrency] || 1;
  const convertedAmount = Number(amountUSD || 0) * rate;
  
  return new Intl.NumberFormat(navigator.language || "en-US", {
    style: "currency",
    currency: cleanCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(convertedAmount);
}

async function loadBonusData(user) {
  const availableEl = document.getElementById('bonusAvailable');
  const pendingEl = document.getElementById('bonusPending');
  
  if (!availableEl || !pendingEl) return;

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      availableEl.textContent = formatPrice(0, "USD");
      pendingEl.textContent = formatPrice(0, "USD");
      return;
    }

    const userData = userDoc.data();
    const bonusAvailable = Number(userData.bonusAvailable || 0);
    const bonusPending = Number(userData.bonusPending || 0);
    const currency = await getDisplayCurrency();

    availableEl.textContent = formatPrice(bonusAvailable, currency);
    pendingEl.textContent = formatPrice(bonusPending, currency);

  } catch (error) {
    availableEl.textContent = "Error";
    pendingEl.textContent = "Error";
  }
}

async function generateReferralLink(user) {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    let referralCode = "";

    if (userSnap.exists()) {
      const userData = userSnap.data();
      referralCode = userData.referralCode;

      if (!referralCode) {
        referralCode = generateUniqueCode();
        await setDoc(userRef, { referralCode }, { merge: true });
      }
    }

    const baseUrl = window.location.origin;
    const referralLink = `${baseUrl}/index.html?ref=${referralCode}`;
    
    const referralInput = document.getElementById('referralLink');
    if (referralInput) {
      referralInput.value = referralLink;
    }

  } catch (error) {}
}

function generateUniqueCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const defaults = {
  pageTitle: "Dashboard",
  heroSubtitle: "Your Premium Experience",
  lblStatSaved: "Saved Vehicles",
  lblStatApp: "Applications",
  lblStatMember: "Membership Level",
  lblStatPurchases: "Purchases",
  lblLoc: "Location",
  lblCur: "Preferred Currency",
  lblPh: "Phone",
  lblJoin: "Member Since",
  navHome: "Home",
  navSaved: "Saved",
  navFinance: "Finance",
  navProfile: "Profile",
  navInventory: "Inventory",
  secLblAcc: "Account",
  secTitAcc: "Profile",
  secLblVeh: "Vehicles",
  secTitVeh: "Saved Vehicles",
  secLblFin: "Finance",
  secTitFin: "Applications",
  secLblPurchases: "Orders",
  secTitPurchases: "Purchase History",
  editBtnTxt: "Edit Profile",
  viewBtnTxt: "View",
  buyNowBtnTxt: "Buy Now",
  membershipDefault: "Premium",
  statusDefault: "Active",
  statusColorDefault: "var(--gold)"
};

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 23) return "Good evening";
  return "Good night";
}

document.addEventListener('DOMContentLoaded', async () => {
  showLoader();
  
  try {
    await fetchExchangeRates();
    await loadDropdownOptions();
  } catch (error) {
    showError("Failed to initialize dashboard");
  } finally {
    hideLoader();
  }

  const editModal = document.getElementById('editModal');
  const editForm = document.getElementById('editForm');
  const cancelEdit = document.getElementById('cancelEdit');

  if (cancelEdit) cancelEdit.addEventListener('click', () => editModal.style.display = 'none');

  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const referralInput = document.getElementById('referralLink');
      if (referralInput && referralInput.value && referralInput.value !== "Generating...") {
        try {
          await navigator.clipboard.writeText(referralInput.value);
          copyBtn.innerHTML = '<i class="fas fa-check"></i>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
          }, 2000);
          showSuccess("Link copied!");
        } catch (err) {
          showError("Failed to copy link");
        }
      }
    });
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (!user.emailVerified) {
        hideLoader();
        showError("⚠️ Email Verification Required - Please check your inbox and verify your email address before accessing your dashboard.");
        setTimeout(() => {
          signOut(auth);
          window.location.href = "index.html";
        }, 4000);
        return;
      }
      
      await populateDashboard(user);
      await loadBonusData(user);
      await generateReferralLink(user);
      setupSecurityFeatures(user);
    } else {
      window.location.href = "index.html";
    }
  });

  async function populateDashboard(user) {
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      const data = { ...defaults, ...userData };

      const greeting = getTimeGreeting();
      const name = userData.fullName || user.displayName || "";
      document.getElementById('welcomeText').textContent = greeting + (name ? ", " : " ");
      document.querySelectorAll('#userName, #profileName').forEach(el => el.textContent = name);

      document.getElementById('pageTitle').textContent = data.pageTitle;
      document.getElementById('heroSubtitle').textContent = data.heroSubtitle;
      document.getElementById('labelStatSaved').textContent = data.lblStatSaved;
      document.getElementById('labelStatApp').textContent = data.lblStatApp;
      document.getElementById('labelStatMember').textContent = data.lblStatMember;
      
      const statPurchasesLabel = document.getElementById('labelStatPurchases');
      if (statPurchasesLabel) {
        statPurchasesLabel.textContent = data.lblStatPurchases;
      }

      document.getElementById('labelLoc').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${data.lblLoc}`;
      document.getElementById('labelCur').innerHTML = `<i class="fas fa-dollar-sign"></i> ${data.lblCur}`;
      document.getElementById('labelPh').innerHTML = `<i class="fas fa-phone"></i> ${data.lblPh}`;
      document.getElementById('labelJoin').innerHTML = `<i class="fas fa-calendar"></i> ${data.lblJoin}`;

      document.getElementById('navHome').textContent = data.navHome;
      document.getElementById('navSaved').textContent = data.navSaved;
      document.getElementById('navFinance').textContent = data.navFinance;
      document.getElementById('navProfile').textContent = data.navProfile;
      document.getElementById('navInventory').textContent = data.navInventory;

      document.getElementById('sectionLabelAccount').textContent = data.secLblAcc;
      document.getElementById('sectionTitleAccount').textContent = data.secTitAcc;
      document.getElementById('sectionLabelVehicles').textContent = data.secLblVeh;
      document.getElementById('sectionTitleVehicles').textContent = data.secTitVeh;
      document.getElementById('sectionLabelFinance').textContent = data.secLblFin;
      document.getElementById('sectionTitleFinance').textContent = data.secTitFin;

      document.getElementById('editProfileBtn').textContent = data.editBtnTxt;

      document.getElementById('profileEmail').textContent = userData.email || user.email || "";
      document.getElementById('profileLocation').textContent = userData.location || "Not specified";
      document.getElementById('profileCurrency').textContent = userData.preferredCurrency || "USD";
      document.getElementById('profilePhone').textContent = userData.phone || "Not specified";

      const joinDate = userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      }) : "";
      document.getElementById('profileDate').textContent = joinDate;

      document.getElementById('statMemberLevel').textContent = userData.membershipLevel || data.membershipDefault;
      const statusEl = document.getElementById('accountStatus');
      statusEl.textContent = userData.accountStatus || data.statusDefault;
      statusEl.style.color = userData.statusColor || data.statusColorDefault;

      const avatarContainer = document.getElementById('avatarContainer');
      if (user.photoURL) {
        avatarContainer.innerHTML = `<img src="${user.photoURL}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
      } else {
        avatarContainer.textContent = (name.charAt(0) || user.email?.charAt(0) || "U").toUpperCase();
      }

      loadSavedVehiclesRealtime(user.uid, data);
      loadFinanceApplicationsRealtime(user.uid, data);
      loadPurchaseHistoryRealtime(user.uid, data);

    } catch (error) {
      showError("Failed to load dashboard data");
    }
  }

  function setupSecurityFeatures(user) {
    document.getElementById('changePasswordBtn')?.addEventListener('click', async () => {
      const email = user.email;
      if (!email) {
        showError("No email associated with your account.");
        return;
      }

      showLoader();
      try {
        await sendPasswordResetEmail(auth, email);
        hideLoader();
        showSuccess("Password reset email sent! Check your inbox.");
      } catch (err) {
        hideLoader();
        showError("Failed to send password reset email.");
      }
    });

    document.getElementById('verifyEmailBtn')?.addEventListener('click', async () => {
      if (user.emailVerified) {
        showSuccess("Your email is already verified!");
        return;
      }

      showLoader();
      try {
        await sendEmailVerification(user);
        hideLoader();
        showSuccess("Verification email sent! Check your inbox.");
      } catch (err) {
        hideLoader();
        showError("Failed to send verification email.");
      }
    });

    const statusEl = document.getElementById('emailVerificationStatus');
    if (statusEl) {
      statusEl.textContent = user.emailVerified ? "✓ Verified" : "Not verified";
      statusEl.style.color = user.emailVerified ? "var(--success)" : "var(--warning)";
      statusEl.style.fontWeight = "600";
    }

    const lastLoginEl = document.getElementById('lastLoginInfo');
    if (lastLoginEl && user.metadata && user.metadata.lastSignInTime) {
      const lastLogin = new Date(user.metadata.lastSignInTime);
      const now = new Date();
      const diffMs = now - lastLogin;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      let timeAgo;
      if (diffMins < 1) {
        timeAgo = "Just now";
      } else if (diffMins < 60) {
        timeAgo = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffDays < 7) {
        timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else {
        timeAgo = lastLogin.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      lastLoginEl.textContent = timeAgo;
    }

    document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
      const confirm1 = confirm("⚠️ WARNING: This will permanently delete your account and all data. Are you absolutely sure?");
      if (!confirm1) return;

      const confirm2 = confirm("This action CANNOT be undone. Type 'DELETE' to confirm.");
      if (!confirm2) return;

      showLoader();
      try {
        await deleteUser(user);
        hideLoader();
        showSuccess("Account deleted successfully");
        setTimeout(() => {
          window.location.href = "index.html";
        }, 2000);
      } catch (err) {
        hideLoader();
        if (err.code === "auth/requires-recent-login") {
          showError("For security, please log out and log back in, then try again.");
        } else {
          showError("Failed to delete account. Please try again.");
        }
      }
    });
  }

  async function loadSavedVehiclesRealtime(uid, data) {
    const container = document.getElementById('savedVehicles');
    const countStat = document.getElementById('statSavedCount');
    const currency = await getDisplayCurrency();

    onSnapshot(query(collection(db, "wishlist"), where("userId", "==", uid)), (snap) => {
      container.innerHTML = '';
      countStat.textContent = snap.size;

      if (snap.empty) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-heart"></i>
            <p>No saved vehicles yet</p>
            <a href="inventory.html" class="btn-outline">Browse Inventory</a>
          </div>`;
        return;
      }

      snap.forEach(docSnap => {
        const car = docSnap.data();
        const card = document.createElement('div');
        card.className = 'car-card';
        card.innerHTML = `
          <img src="${(car.images && car.images[0]) || car.image || 'https://via.placeholder.com/400x300?text=Vehicle'}" alt="${car.make || ''}">
          <div class="car-content">
            <span class="gold-text condition-badge">${car.condition || 'Premium'}</span>
            <h3>${car.year || ''} ${car.make || ''} ${car.model || ''}</h3>
            <div class="car-price">
              ${formatPrice(car.priceUSD ?? car.price ?? 0, currency)}
            </div>
            <div class="card-actions">
              <a href="car-detail.html?id=${car.carId || ''}" class="btn-view">${data.viewBtnTxt}</a>
              <a href="checkout.html?id=${car.carId || ''}" class="btn-buy-now">${data.buyNowBtnTxt}</a>
              <button class="btn-remove" data-id="${docSnap.id}" title="Remove from saved">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>`;
        container.appendChild(card);
      });

      container.querySelectorAll('.btn-remove').forEach(btn => {
        btn.onclick = async () => {
          if (confirm("Remove this vehicle from your saved list?")) {
            showLoader();
            try {
              await deleteDoc(doc(db, "wishlist", btn.dataset.id));
              hideLoader();
              showSuccess("Vehicle removed successfully");
            } catch (err) {
              hideLoader();
              showError("Failed to remove vehicle");
            }
          }
        };
      });
    });
  }

  function loadFinanceApplicationsRealtime(uid, data) {
    const container = document.getElementById('financeList');
    const countStat = document.getElementById('statAppCount');

    onSnapshot(query(collection(db, "applications"), where("userId", "==", uid)), (snap) => {
      container.innerHTML = '';
      countStat.textContent = snap.size;

      if (snap.empty) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-file-invoice-dollar"></i>
            <p>No finance applications yet</p>
            <a href="financing.html" class="btn-outline">Apply for Financing</a>
          </div>`;
        return;
      }

      snap.forEach(docSnap => {
        const app = docSnap.data();
        const item = document.createElement('div');
        item.className = 'finance-item';
        item.style.cursor = 'pointer';
        item.innerHTML = `
          <div>
            <strong style="display:block;">${app.vehicleName || 'Vehicle Finance'}</strong>
            <small>Ref: ${docSnap.id.toUpperCase()}</small>
          </div>
          <div style="text-align:right;">
            <span class="status-badge" style="background:${app.statusColor || data.statusColorDefault}15; color:${app.statusColor || data.statusColorDefault};">
              ${app.status || data.statusDefault}
            </span>
            <small style="display:block; margin-top:5px;">${app.date || ''}</small>
          </div>`;
        item.onclick = () => window.location.href = `application-detail.html?id=${docSnap.id}`;
        container.appendChild(item);
      });
    });
  }

  async function loadPurchaseHistoryRealtime(uid, data) {
    const container = document.getElementById('purchaseHistory');
    const countStat = document.getElementById('statPurchasesCount');
    
    if (!container) return;
    
    const currency = await getDisplayCurrency();

    onSnapshot(
      query(
        collection(db, "purchases"), 
        where("userId", "==", uid),
        orderBy("purchaseDate", "desc")
      ), 
      (snap) => {
        container.innerHTML = '';
        if (countStat) countStat.textContent = snap.size;

        if (snap.empty) {
          container.innerHTML = `
            <div class="empty-state">
              <i class="fas fa-shopping-bag"></i>
              <p>No purchases yet</p>
              <a href="inventory.html" class="btn-outline">Start Shopping</a>
            </div>`;
          return;
        }

        snap.forEach(docSnap => {
          const purchase = docSnap.data();
          const purchaseDate = purchase.purchaseDate?.toDate?.() || new Date();
          
          const item = document.createElement('div');
          item.className = 'purchase-item';
          item.innerHTML = `
            <div class="purchase-image">
              <img src="${purchase.vehicleImage || 'https://via.placeholder.com/100x60?text=Vehicle'}" alt="Vehicle">
            </div>
            <div class="purchase-details">
              <h4>${purchase.vehicleName || 'Vehicle Purchase'}</h4>
              <p class="purchase-ref">Order #${docSnap.id.toUpperCase().slice(0, 8)}</p>
              <p class="purchase-date">${purchaseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <div class="purchase-amount">
              <span class="amount">${formatPrice(purchase.amount || 0, currency)}</span>
              <span class="payment-method">${purchase.paymentMethod || 'Card'}</span>
            </div>
            <div class="purchase-status">
              <span class="status-badge status-${(purchase.status || 'pending').toLowerCase()}">
                ${purchase.status || 'Pending'}
              </span>
            </div>
          `;
          container.appendChild(item);
        });
      },
      (error) => {
        showError("Unable to load purchase history");
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <p>Unable to load purchase history</p>
          </div>`;
      }
    );
  }

  document.getElementById('editProfileBtn')?.addEventListener('click', async () => {
    await loadDropdownOptions();
    
    const currentLocation = document.getElementById('profileLocation').textContent;
    const currentCurrency = document.getElementById('profileCurrency').textContent;
    const currentPhone = document.getElementById('profilePhone').textContent;
    
    document.getElementById('editLocation').value = currentLocation;
    document.getElementById('editPhone').value = currentPhone;
    document.getElementById('editCurrency').value = currentCurrency;
    
    editModal.style.display = 'flex';
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;

    try {
      const location = document.getElementById('editLocation').value;
      const currency = document.getElementById('editCurrency').value;
      const phone = document.getElementById('editPhone').value.trim();
      
      if (!location) throw new Error("Please select a location");
      if (!currency) throw new Error("Please select a currency");
      
      const updates = {
        location: location,
        phone: phone,
        preferredCurrency: currency
      };
      
      await setDoc(doc(db, "users", user.uid), updates, { merge: true });
      editModal.style.display = 'none';
      showSuccess("Profile updated successfully!");
      
      await loadBonusData(user);
      populateDashboard(user);
    } catch (err) {
      showError(err.message || "Failed to save changes");
    } finally {
      saveBtn.textContent = "Save Changes";
      saveBtn.disabled = false;
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    showLoader();
    try {
      await signOut(auth);
      showSuccess("Signed out successfully");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1000);
    } catch (err) {
      hideLoader();
      showError("Failed to sign out");
    }
  });
});