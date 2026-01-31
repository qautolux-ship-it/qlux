import { app, db, auth, storage, googleProvider } from "./firebase.js";

import { collection, getDocs, addDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {

  const overlay = document.getElementById('authModalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const tabs = document.querySelectorAll('.tab-btn');

  function openModal(defaultTab = 'login') {
    if (!overlay) return;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    switchTab(defaultTab);
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function switchTab(tab) {
    tabs.forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`[data-tab="${tab}"]`);
    if (activeTab) activeTab.classList.add('active');

    if (tab === 'login') {
      if (titleEl) titleEl.textContent = 'Welcome Back';
      loginForm?.classList.add('active');
      signupForm?.classList.remove('active');
    } else {
      if (titleEl) titleEl.textContent = 'Join Q AutoLux';
      signupForm?.classList.add('active');
      loginForm?.classList.remove('active');
    }
  }

  const hamburger = document.getElementById('hamburger');
  const mobileOverlay = document.getElementById('mobile-overlay');

  if (hamburger && mobileOverlay) {
    const openMenu = () => {
      mobileOverlay.classList.add('active');
      hamburger.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    const closeMenu = () => {
      mobileOverlay.classList.remove('active');
      hamburger.classList.remove('active');
      document.body.style.overflow = 'auto';
    };

    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileOverlay.classList.contains('active') ? closeMenu() : openMenu();
    });

    mobileOverlay.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    mobileOverlay.addEventListener('click', (e) => {
      if (e.target === mobileOverlay) closeMenu();
    });
  }

  const vehicleSelect = document.getElementById('vehicleSelect');
  const carPriceInput = document.getElementById('carPrice');

  if (vehicleSelect && carPriceInput) {
    let vehiclePrices = { "custom": 125000 };

    async function loadVehiclePresets() {
      try {
        const snapshot = await getDocs(collection(db, "vehicle_presets"));
        const loadingOption = vehicleSelect.querySelector('option[value="loading"]');
        if (loadingOption) loadingOption.remove();

        const categories = {};
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.model && data.price && data.category) {
            vehiclePrices[data.model] = data.price;
            if (!categories[data.category]) categories[data.category] = [];
            categories[data.category].push(data.model);
          }
        });

        Object.keys(categories).sort().forEach(cat => {
          const optgroup = document.createElement('optgroup');
          optgroup.label = cat;
          categories[cat].sort().forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            optgroup.appendChild(option);
          });
          vehicleSelect.appendChild(optgroup);
        });

        if (snapshot.empty) {
          vehicleSelect.innerHTML += '<option value="">No presets found in database</option>';
        }
      } catch (err) {
        console.error("Failed to load presets:", err);
      }
    }

    await loadVehiclePresets();

    function calculateLoan() {
      const price = parseFloat(carPriceInput.value) || 0;
      const tradeIn = parseFloat(document.getElementById('tradeIn')?.value) || 0;
      const down = parseFloat(document.getElementById('downPayment')?.value) || 0;
      const fees = parseFloat(document.getElementById('dealerFees')?.value) || 0;
      const taxRate = (parseFloat(document.getElementById('salesTax')?.value) || 0) / 100;
      const annualRate = parseFloat(document.getElementById('interestRate')?.value) || 0;
      const term = parseFloat(document.getElementById('loanTerm')?.value) || 60;

      const monthlyRate = annualRate / 1200;
      const taxable = Math.max(0, price - tradeIn);
      const taxTotal = taxable * taxRate;
      const principal = price + taxTotal + fees - down - tradeIn;

      const results = {
        monthly: document.getElementById('monthlyResult'),
        tax: document.getElementById('resTax'),
        principal: document.getElementById('totalPrincipal'),
        interest: document.getElementById('totalInterest'),
        cost: document.getElementById('totalCost')
      };

      if (principal <= 0 || monthlyRate < 0 || term <= 0) {
        Object.values(results).forEach(el => { if (el) el.textContent = '$0'; });
        return;
      }

      const pow = Math.pow(1 + monthlyRate, term);
      const monthly = (principal * monthlyRate * pow) / (pow - 1);
      const totalInterest = (monthly * term) - principal;
      const totalOutlay = (monthly * term) + down + tradeIn;

      if (results.monthly) results.monthly.textContent = '$' + Math.round(monthly).toLocaleString();
      if (results.tax) results.tax.textContent = '$' + Math.round(taxTotal).toLocaleString();
      if (results.principal) results.principal.textContent = '$' + Math.round(principal).toLocaleString();
      if (results.interest) results.interest.textContent = '$' + Math.round(totalInterest).toLocaleString();
      if (results.cost) results.cost.textContent = '$' + Math.round(totalOutlay).toLocaleString();
    }

    vehicleSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (vehiclePrices[val] !== undefined) {
        carPriceInput.value = vehiclePrices[val];
      } else if (val === 'custom') {
        carPriceInput.value = 125000;
      }
      calculateLoan();
    });

    const calcInputs = ['carPrice', 'tradeIn', 'downPayment', 'salesTax', 'dealerFees', 'interestRate', 'loanTerm'];
    calcInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', calculateLoan);
        el.addEventListener('change', calculateLoan);
      }
    });

    calculateLoan();
  }

  const financeForm = document.getElementById('financeForm');

  if (financeForm) {
    financeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = financeForm.querySelector('button[type="submit"]');

      const user = auth.currentUser;
      if (!user) {
        alert("Verification Required: Please sign in to submit your application.");
        openModal('login');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Uploading Secure Documents...";

      try {
        const idFile = document.getElementById('idUpload')?.files[0];
        const incomeFile = document.getElementById('incomeUpload')?.files[0];
        let idUrl = null;
        let incomeUrl = null;

        if (idFile) {
          const idRef = ref(storage, `docs/${user.uid}/id_${Date.now()}`);
          await uploadBytes(idRef, idFile);
          idUrl = await getDownloadURL(idRef);
        }

        if (incomeFile) {
          const incRef = ref(storage, `docs/${user.uid}/income_${Date.now()}`);
          await uploadBytes(incRef, incomeFile);
          incomeUrl = await getDownloadURL(incRef);
        }

        const application = {
          userId: user.uid,
          fullName: document.getElementById('fullName')?.value.trim(),
          email: document.getElementById('email')?.value.trim(),
          phone: document.getElementById('phone')?.value.trim(),
          dob: document.getElementById('dob')?.value,
          nationality: document.getElementById('nationality')?.value.trim(),
          address1: document.getElementById('address1')?.value.trim(),
          address2: document.getElementById('address2')?.value.trim(),
          city: document.getElementById('city')?.value.trim(),
          state: document.getElementById('state')?.value.trim(),
          zip: document.getElementById('zip')?.value.trim(),
          country: document.getElementById('country')?.value,
          netWorth: Number(document.getElementById('netWorth')?.value) || 0,
          income: Number(document.getElementById('income')?.value) || 0,
          liquidAssets: Number(document.getElementById('liquidAssets')?.value) || 0,
          wealthSource: document.getElementById('wealthSource')?.value,
          monthlyDebt: Number(document.getElementById('monthlyDebt')?.value) || 0,
          creditProfile: document.getElementById('creditProfile')?.value,
          employer: document.getElementById('employer')?.value.trim(),
          occupation: document.getElementById('occupation')?.value.trim(),
          yearsEmployed: Number(document.getElementById('yearsEmployed')?.value) || 0,
          vehicleName: document.getElementById('vehicle')?.value.trim(),
          vehicleYear: Number(document.getElementById('vehicleYear')?.value) || 0,
          vehiclePrice: Number(document.getElementById('vehiclePrice')?.value) || 0,
          vehicleCountry: document.getElementById('vehicleCountry')?.value,
          downPayment: document.getElementById('downPayment')?.value.trim(),
          loanTerm: document.getElementById('loanTerm')?.value,
          status: 'Pending Review',
          statusColor: '#d4af37',
          idProof: idUrl,
          incomeProof: incomeUrl,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          submittedAt: new Date().toISOString()
        };

        await addDoc(collection(db, "applications"), application);
        alert("Application Success: Your file is now with our underwriting team.");
        window.location.href = "dashboard.html";
      } catch (error) {
        console.error("Submission error:", error);
        alert("System Error: Unable to process application.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Secure Application";
      }
    });
  }
  document.querySelectorAll('.login-trigger').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); openModal('login'); });
  });

  document.querySelectorAll('.signup-trigger').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); openModal('signup'); });
  });

  document.getElementById('modalClose')?.addEventListener('click', closeModal);

  if (overlay) {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signupEmail')?.value.trim();
      const password = document.getElementById('signupPassword')?.value;
      const confirm = document.getElementById('signupConfirmPassword')?.value;
      const fullName = document.getElementById('signupFullName')?.value.trim();

      if (password !== confirm) { alert("Error: Passwords do not match."); return; }

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
      
        await setDoc(doc(db, "users", cred.user.uid), {
          fullName: fullName,
          email: email,
          membership: "Premium",
          status: "Active",
          joinedAt: new Date().toISOString()
        });
        alert("Account Created: Welcome to the collection.");
        closeModal();
      } catch (error) { alert(error.message); }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;

      try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal();
      } catch (error) { alert("Invalid credentials."); }
    });
  }

  document.querySelectorAll('.social-btn.google').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        closeModal();
      } catch (error) { console.error("Google Auth Error:", error); }
    });
  });

  function updateNavbar(user) {
    const desktopNav = document.getElementById('desktop-nav');
    const mobileNav = document.getElementById('mobile-nav-links');
    const guests = document.querySelectorAll('.auth-guest');

    guests.forEach(el => el.style.display = user ? 'none' : 'block');
    document.querySelectorAll('.dynamic-auth').forEach(el => el.remove());

    if (user) {
      const links = `
        <li class="dynamic-auth"><a href="dashboard.html">Dashboard</a></li>
        <li class="dynamic-auth"><a href="#" id="logoutBtn" style="color: #ff4d4d !important;">Logout</a></li>
      `;
      desktopNav?.insertAdjacentHTML('beforeend', links);
      mobileNav?.insertAdjacentHTML('beforeend', links);

      document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).then(() => window.location.reload());
      });
    }
  }

  onAuthStateChanged(auth, (user) => {
    updateNavbar(user);
    if (user) {
      const nameInp = document.getElementById('fullName');
      const emailInp = document.getElementById('email');
      if (nameInp && !nameInp.value) nameInp.value = user.displayName || "";
      if (emailInp && !emailInp.value) emailInp.value = user.email || "";
    }
  });
});