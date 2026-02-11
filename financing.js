import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
    getFirestore,
    collection,
    getDocs,
    addDoc,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// GLOBAL STATE
let exchangeRates = { USD: 1 };
let userCurrency = "USD";
const vehicleBasePricesUSD = {};

// ────────────────────────────────────────────────
// CURRENCY HELPER
// ────────────────────────────────────────────────

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

function detectLikelyCurrency() {
  const locale = new Intl.NumberFormat().resolvedOptions().locale || navigator.language || "en-US";
  const lang = locale.split("-")[0].toLowerCase();
  const region = (locale.split("-")[1] || "").toUpperCase();
  if (region && CURRENCY_MAP[region]) return CURRENCY_MAP[region];
  if (CURRENCY_MAP[lang]) return CURRENCY_MAP[lang];
  return "USD";
}

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
    } else {
      return false;
    }
  } catch (err) {
    showError("Failed to load currency rates. Displaying in USD.");
    return false;
  }
}

function formatMoney(amount, currency = "USD") {
  const cleanCurrency = currency.trim().toUpperCase();
  const rate = exchangeRates[cleanCurrency] || 1;
  const converted = Number(amount || 0) * rate;
  return new Intl.NumberFormat(navigator.language || "en-US", {
    style: "currency",
    currency: cleanCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(converted);
}

// ────────────────────────────────────────────────
// UI HELPER FUNCTIONS (Loader & Toast)
// ────────────────────────────────────────────────

function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

function showError(message) {
    console.error("Error:", message);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-toast';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
        font-weight: 500;
    `;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
}

// ────────────────────────────────────────────────
// PASSWORD VALIDATION & STRENGTH
// ────────────────────────────────────────────────

// Top 30 countries phone validation patterns
const PHONE_PATTERNS = {
    US: /^(\+?1)?[\s.-]?\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}$/, // USA/Canada +1
    GB: /^(\+?44)?[\s.-]?[0-9]{10,11}$/, // UK +44
    CN: /^(\+?86)?[\s.-]?1[0-9]{10}$/, // China +86
    IN: /^(\+?91)?[\s.-]?[0-9]{10}$/, // India +91
    NG: /^(\+?234)?[\s.-]?[0-9]{10}$/, // Nigeria +234
    BR: /^(\+?55)?[\s.-]?[0-9]{10,11}$/, // Brazil +55
    MX: /^(\+?52)?[\s.-]?[0-9]{10}$/, // Mexico +52
    DE: /^(\+?49)?[\s.-]?[0-9]{10,11}$/, // Germany +49
    FR: /^(\+?33)?[\s.-]?[0-9]{9}$/, // France +33
    IT: /^(\+?39)?[\s.-]?[0-9]{9,10}$/, // Italy +39
    ES: /^(\+?34)?[\s.-]?[0-9]{9}$/, // Spain +34
    PL: /^(\+?48)?[\s.-]?[0-9]{9}$/, // Poland +48
    TR: /^(\+?90)?[\s.-]?[0-9]{10}$/, // Turkey +90
    RU: /^(\+?7)?[\s.-]?[0-9]{10}$/, // Russia +7
    ZA: /^(\+?27)?[\s.-]?[0-9]{9}$/, // South Africa +27
    AE: /^(\+?971)?[\s.-]?[0-9]{9}$/, // UAE +971
    SA: /^(\+?966)?[\s.-]?[0-9]{9}$/, // Saudi Arabia +966
    AU: /^(\+?61)?[\s.-]?[0-9]{9}$/, // Australia +61
    JP: /^(\+?81)?[\s.-]?[0-9]{10}$/, // Japan +81
    KR: /^(\+?82)?[\s.-]?[0-9]{9,10}$/, // South Korea +82
    ID: /^(\+?62)?[\s.-]?[0-9]{9,12}$/, // Indonesia +62
    PH: /^(\+?63)?[\s.-]?[0-9]{10}$/, // Philippines +63
    TH: /^(\+?66)?[\s.-]?[0-9]{9}$/, // Thailand +66
    VN: /^(\+?84)?[\s.-]?[0-9]{9,10}$/, // Vietnam +84
    EG: /^(\+?20)?[\s.-]?[0-9]{10}$/, // Egypt +20
    KE: /^(\+?254)?[\s.-]?[0-9]{9}$/, // Kenya +254
    GH: /^(\+?233)?[\s.-]?[0-9]{9}$/, // Ghana +233
    CA: /^(\+?1)?[\s.-]?\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}$/, // Canada +1
    AR: /^(\+?54)?[\s.-]?[0-9]{10}$/, // Argentina +54
    CO: /^(\+?57)?[\s.-]?[0-9]{10}$/ // Colombia +57
};

function validateInternationalPhone(phone) {
    // Remove all whitespace and special characters for basic validation
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
    
    // Must start with + or digit, and be between 8-15 digits (international standard)
    if (!/^[\+]?[0-9]{8,15}$/.test(cleaned)) {
        return false;
    }
    
    // Try to match against known country patterns
    for (const pattern of Object.values(PHONE_PATTERNS)) {
        if (pattern.test(phone)) {
            return true;
        }
    }
    
    // If it doesn't match specific patterns but has valid format, accept it
    // This allows for other countries not in top 30
    return /^[\+]?[0-9]{8,15}$/.test(cleaned);
}

function isPasswordStrong(password) {
    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[@$!%*?&#]/.test(password);
    return hasLength && hasUpper && hasLower && hasNumber && hasSpecial;
}

function checkPasswordRequirements(password) {
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[@$!%*?&#]/.test(password)
    };

    const reqElements = {
        'req-length': requirements.length,
        'req-uppercase': requirements.uppercase,
        'req-lowercase': requirements.lowercase,
        'req-number': requirements.number,
        'req-special': requirements.special
    };

    Object.entries(reqElements).forEach(([id, met]) => {
        const el = document.getElementById(id);
        if (el) {
            if (met) {
                el.classList.add('met');
                el.querySelector('i').className = 'fas fa-check-circle';
            } else {
                el.classList.remove('met');
                el.querySelector('i').className = 'fas fa-circle';
            }
        }
    });

    return requirements;
}

function calculatePasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[@$!%*?&#]/.test(password)) strength++;
    return Math.min(strength, 4);
}

function updatePasswordStrength(password) {
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    if (!strengthFill || !strengthText) return;

    const strength = calculatePasswordStrength(password);
    const percentage = (strength / 4) * 100;
    
    strengthFill.style.width = percentage + '%';
    
    const colors = ['#ff4d4d', '#ff9d00', '#ffd000', '#8bc34a', '#4caf50'];
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    
    strengthFill.style.backgroundColor = colors[strength];
    strengthText.textContent = labels[strength];
}

// ────────────────────────────────────────────────
// HAMBURGER MENU
// ────────────────────────────────────────────────

function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const overlay = document.getElementById('mobile-overlay');
    const navLinks = document.querySelectorAll('#mobile-nav-links a');

    if (!hamburger || !overlay) return;

    const toggleMenu = () => {
        hamburger.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = hamburger.classList.contains('active') ? 'hidden' : '';
    };

    const closeMenu = () => {
        hamburger.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    hamburger.addEventListener('click', toggleMenu);
    navLinks.forEach(link => link.addEventListener('click', closeMenu));

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeMenu();
        }
    });
}

// ────────────────────────────────────────────────
// MODAL & TABS
// ────────────────────────────────────────────────

function initAuthModal() {
    const overlay = document.getElementById('authModalOverlay');
    if (!overlay) return null;

    const title = document.getElementById('modalTitle');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const tabs = document.querySelectorAll('.tab-btn');

    function openModal(defaultTab = 'login') {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        switchTab(defaultTab);
    }

    function closeModal() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function switchTab(tab) {
        tabs.forEach(t => t.classList.remove('active'));
        const targetTab = document.querySelector(`[data-tab="${tab}"]`);
        if (targetTab) targetTab.classList.add('active');

        if (tab === 'login') {
            title.textContent = 'Welcome Back';
            loginForm.classList.add('active');
            signupForm.classList.remove('active');
        } else {
            title.textContent = 'Join Q AutoLux';
            signupForm.classList.add('active');
            loginForm.classList.remove('active');
        }
    }

    document.querySelectorAll('.login-trigger').forEach(el =>
        el.addEventListener('click', e => { e.preventDefault(); openModal('login'); }));

    document.querySelectorAll('.signup-trigger').forEach(el =>
        el.addEventListener('click', e => { e.preventDefault(); openModal('signup'); }));

    document.getElementById('modalClose')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

    return { openModal, closeModal };
}

// ────────────────────────────────────────────────
// PASSWORD TOGGLE
// ────────────────────────────────────────────────

function initPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            if (!input) return;
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

// ────────────────────────────────────────────────
// PASSWORD REQUIREMENTS
// ────────────────────────────────────────────────

function initPasswordRequirements() {
    const signupPassword = document.getElementById('signupPassword');
    const passwordRequirements = document.getElementById('passwordRequirements');
    const passwordStrength = document.getElementById('passwordStrength');

    if (signupPassword) {
        signupPassword.addEventListener('focus', () => {
            if (passwordRequirements) passwordRequirements.style.display = 'block';
            if (passwordStrength) passwordStrength.style.display = 'block';
        });

        signupPassword.addEventListener('input', (e) => {
            const password = e.target.value;
            checkPasswordRequirements(password);
            updatePasswordStrength(password);
        });
    }
}

// ────────────────────────────────────────────────
// CALCULATOR
// ────────────────────────────────────────────────

async function loadDefaultPrice() {
    try {
        const presetsSnap = await getDocs(collection(db, "vehicle_presets"));
        if (!presetsSnap.empty) {
            // Get the first preset as default
            const preset = presetsSnap.docs[0].data();
            
            // Set vehicle price
            const vehiclePriceInput = document.getElementById('vehiclePrice');
            if (vehiclePriceInput && preset.price) {
                vehiclePriceInput.value = preset.price;
            }
            
            // Set trade-in (default to 0 if not in database)
            const tradeInInput = document.getElementById('tradeIn');
            if (tradeInInput) {
                tradeInInput.value = preset.tradeIn || 0;
            }
            
            // Set down payment
            const downPaymentInput = document.getElementById('downPayment');
            if (downPaymentInput && preset.downPayment) {
                downPaymentInput.value = preset.downPayment;
            }
            
            // Set sales tax
            const salesTaxInput = document.getElementById('salesTax');
            if (salesTaxInput && preset.salesTax) {
                salesTaxInput.value = preset.salesTax;
            }
            
            // Set dealer fees
            const dealerFeesInput = document.getElementById('dealerFees');
            if (dealerFeesInput && preset.dealerFees) {
                dealerFeesInput.value = preset.dealerFees;
            }
            
            // Set loan term
            const loanTermSelect = document.getElementById('loanTerm');
            if (loanTermSelect && preset.loanTerm) {
                loanTermSelect.value = preset.loanTerm;
            }
            
            // Set interest rate
            const interestRateInput = document.getElementById('interestRate');
            if (interestRateInput && preset.interestRate) {
                interestRateInput.value = preset.interestRate;
            }
            
            return preset.price;
        }
    } catch (err) {
        console.error("Failed to load defaults from vehicle_presets:", err);
        showError("Failed to load calculator defaults from database");
    }
    return null;
}

async function initCalculator() {
    const vehicleSelect = document.getElementById('vehicleSelect');
    const vehiclePriceInput = document.getElementById('vehiclePrice');

    if (!vehicleSelect || !vehiclePriceInput) return;

    // Load default price from vehicle_presets
    await loadDefaultPrice();

    // Fetch inventory from Firestore vehicle_presets collection
    try {
        const snap = await getDocs(collection(db, "vehicle_presets"));
        snap.forEach(doc => {
            const car = doc.data();
            vehicleBasePricesUSD[car.model] = car.price || 0;
            const opt = document.createElement('option');
            opt.value = car.model;
            opt.textContent = `${car.model} — ${formatMoney(car.price, userCurrency)}`;
            vehicleSelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load vehicles:", err);
        showError("Failed to load vehicle data");
    }

    vehicleSelect.addEventListener('change', () => {
        const selected = vehicleSelect.value;
        if (selected !== "custom" && vehicleBasePricesUSD[selected]) {
            vehiclePriceInput.value = vehicleBasePricesUSD[selected];
            recalculate();
        }
    });

    function recalculate() {
        const vehiclePrice = parseFloat(document.getElementById('vehiclePrice')?.value || 0);
        const tradeIn = parseFloat(document.getElementById('tradeIn')?.value || 0);
        const downPayment = parseFloat(document.getElementById('downPayment')?.value || 0);
        const salesTax = parseFloat(document.getElementById('salesTax')?.value || 0) / 100;
        const dealerFees = parseFloat(document.getElementById('dealerFees')?.value || 0);
        const loanTerm = parseInt(document.getElementById('loanTerm')?.value || 60);
        const apr = parseFloat(document.getElementById('interestRate')?.value || 0) / 100;

        const taxAmount = vehiclePrice * salesTax;
        const netFinanced = vehiclePrice + dealerFees + taxAmount - tradeIn - downPayment;
        const monthlyRate = apr / 12;
        const monthlyPayment = netFinanced > 0 && monthlyRate > 0
            ? (netFinanced * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -loanTerm))
            : netFinanced / loanTerm;

        const totalInterest = (monthlyPayment * loanTerm) - netFinanced;
        const totalCost = monthlyPayment * loanTerm + tradeIn + downPayment;

        document.getElementById('resTax').textContent = formatMoney(taxAmount, userCurrency);
        document.getElementById('totalPrincipal').textContent = formatMoney(netFinanced, userCurrency);
        document.getElementById('totalInterest').textContent = formatMoney(totalInterest, userCurrency);
        document.getElementById('totalCost').textContent = formatMoney(totalCost, userCurrency);
        document.getElementById('monthlyResult').textContent = formatMoney(monthlyPayment, userCurrency);
    }

    ['vehiclePrice','tradeIn','downPayment','salesTax','dealerFees','loanTerm','interestRate']
        .forEach(id => {
            document.getElementById(id)?.addEventListener('input', recalculate);
        });

    recalculate();
}

// ────────────────────────────────────────────────
// APPLICATION FORM
// ────────────────────────────────────────────────

function loadCalculatorData() {
    const searchParams = new URLSearchParams(window.location.search);
    ['vehiclePrice', 'loanTerm', 'downPayment'].forEach(key => {
        if (searchParams.has(key)) {
            const el = document.getElementById(key);
            if (el) el.value = searchParams.get(key);
        }
    });
}

async function initApplicationForm(openModal) {
    const form = document.getElementById('financeForm');
    if (!form) return;

    // Prefill form from calculator data
    loadCalculatorData();

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            showError("Please sign in first.");
            openModal('login');
            return;
        }

        if (!user.emailVerified) {
            showError("Please verify your email before submitting an application.");
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = "Submitting...";
        
        showLoader();

        try {
            const idProofFile = document.getElementById('idProof')?.files[0];
            const incomeProofFile = document.getElementById('incomeProof')?.files[0];
            
            let idURL = "";
            let incomeURL = "";

            if (idProofFile) {
                const idRef = ref(storage, `applications/${user.uid}/${Date.now()}_id_${idProofFile.name}`);
                await uploadBytes(idRef, idProofFile);
                idURL = await getDownloadURL(idRef);
            }

            if (incomeProofFile) {
                const incomeRef = ref(storage, `applications/${user.uid}/${Date.now()}_income_${incomeProofFile.name}`);
                await uploadBytes(incomeRef, incomeProofFile);
                incomeURL = await getDownloadURL(incomeRef);
            }

            const data = {
                userId: user.uid,
                email: user.email,
                fullName: document.getElementById('fullName')?.value,
                phone: document.getElementById('phone')?.value,
                dob: document.getElementById('dob')?.value,
                nationality: document.getElementById('nationality')?.value,
                address1: document.getElementById('address1')?.value,
                address2: document.getElementById('address2')?.value,
                city: document.getElementById('city')?.value,
                state: document.getElementById('state')?.value,
                zip: document.getElementById('zip')?.value,
                country: document.getElementById('country')?.value,
                netWorth: document.getElementById('netWorth')?.value,
                income: document.getElementById('income')?.value,
                liquidAssets: document.getElementById('liquidAssets')?.value,
                wealthSource: document.getElementById('wealthSource')?.value,
                monthlyDebt: document.getElementById('monthlyDebt')?.value,
                creditProfile: document.getElementById('creditProfile')?.value,
                employer: document.getElementById('employer')?.value,
                occupation: document.getElementById('occupation')?.value,
                yearsEmployed: document.getElementById('yearsEmployed')?.value,
                vehicle: document.getElementById('vehicle')?.value,
                vehicleYear: document.getElementById('vehicleYear')?.value,
                vehiclePrice: document.getElementById('vehiclePrice')?.value,
                vehicleCountry: document.getElementById('vehicleCountry')?.value,
                downPayment: document.getElementById('downPayment')?.value,
                loanTerm: document.getElementById('loanTerm')?.value,
                preferredContactTime: document.getElementById('preferredContactTime')?.value,
                notes: document.getElementById('notes')?.value,
                idProofURL: idURL,
                incomeProofURL: incomeURL,
                submittedAt: new Date().toISOString()
            };

            await addDoc(collection(db, "applications"), data);
            hideLoader();
            showSuccess("Application submitted successfully!");
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1500);
        } catch (err) {
            console.error(err);
            hideLoader();
            showError("Submission failed. Please try again.");
        } finally {
            btn.disabled = false;
            btn.textContent = "Submit Secure Application";
        }
    });
}

// ────────────────────────────────────────────────
// AUTH FORMS WITH EMAIL VERIFICATION
// ────────────────────────────────────────────────

function initAuthForms(openModal, closeModal) {
    const signupForm = document.getElementById('signupForm');
    const loginForm  = document.getElementById('loginForm');

    if (signupForm) {
        signupForm.addEventListener('submit', async e => {
            e.preventDefault();
            const fullName = document.getElementById('signupFullName')?.value.trim();
            const email = document.getElementById('signupEmail')?.value.trim();
            const phone = document.getElementById('signupPhone')?.value.trim();
            const password = document.getElementById('signupPassword')?.value;
            const confirmPassword = document.getElementById('signupConfirmPassword')?.value;

            if (!fullName || fullName.length < 2) {
                showError("Please enter your full name (minimum 2 characters)");
                return;
            }

            if (!validateInternationalPhone(phone)) {
                showError("Please enter a valid phone number with country code (e.g., +1 555-123-4567)");
                return;
            }

            if (password !== confirmPassword) {
                showError("Passwords don't match!");
                return;
            }

            if (!isPasswordStrong(password)) {
                showError("Password must meet all requirements: 8+ characters, uppercase, lowercase, number, and special character (@$!%*?&#)");
                return;
            }

            showLoader();
            
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                await sendEmailVerification(user);

                const autoCurrency = detectLikelyCurrency();

                const urlParams = new URLSearchParams(window.location.search);
                const referralCode = urlParams.get("ref");

                const userData = {
                    fullName: fullName,
                    phone: phone,
                    email: user.email,
                    preferredCurrency: autoCurrency,
                    bonusAvailable: 0,
                    bonusPending: 0,
                    createdAt: new Date().toISOString(),
                    emailVerified: false
                };

                if (referralCode) {
                    userData.referredBy = referralCode;
                }

                await setDoc(doc(db, "users", user.uid), userData);

                hideLoader();
                closeModal();

                const verificationModal = document.getElementById('verificationModal');
                const verificationEmailEl = document.getElementById('verificationEmail');
                if (verificationEmailEl) verificationEmailEl.textContent = email;
                if (verificationModal) verificationModal.classList.add('active');

                await signOut(auth);

            } catch (error) {
                let errorMessage = "Signup failed. Please try again.";
                
                if (error.code === "auth/email-already-in-use") {
                    errorMessage = "This email is already registered. Please login instead.";
                } else if (error.code === "auth/weak-password") {
                    errorMessage = "Password is too weak. Please use a stronger password.";
                } else if (error.code === "auth/invalid-email") {
                    errorMessage = "Invalid email address format.";
                }
                
                showError(errorMessage);
            } finally {
                hideLoader();
            }
        });
    }

    document.getElementById('closeVerificationModal')?.addEventListener('click', () => {
        const verificationModal = document.getElementById('verificationModal');
        if (verificationModal) verificationModal.classList.remove('active');
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            const email = document.getElementById('loginEmail')?.value.trim();
            const password = document.getElementById('loginPassword')?.value;
            
            showLoader();
            
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                if (!user.emailVerified) {
                    await signOut(auth);
                    hideLoader();
                    
                    const verificationModal = document.getElementById('verificationModal');
                    const verificationEmailEl = document.getElementById('verificationEmail');
                    if (verificationEmailEl) verificationEmailEl.textContent = email;
                    if (verificationModal) verificationModal.classList.add('active');
                    
                    showError("Email not verified. Please check your inbox and click the verification link.");
                    return;
                }

                const userDocRef = doc(db, "users", user.uid);
                await setDoc(userDocRef, { emailVerified: true }, { merge: true });

                hideLoader();
                showSuccess("Welcome back!");
                closeModal();
                
                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 1000);
            } catch (error) {
                let errorMessage = "Login failed. Please check your email and password.";
                
                if (error.code === "auth/user-not-found") {
                    errorMessage = "No account found with this email address.";
                } else if (error.code === "auth/wrong-password") {
                    errorMessage = "Incorrect password. Please try again.";
                } else if (error.code === "auth/invalid-email") {
                    errorMessage = "Invalid email address format.";
                } else if (error.code === "auth/invalid-credential") {
                    errorMessage = "Invalid email or password. Please check your credentials.";
                } else if (error.code === "auth/too-many-requests") {
                    errorMessage = "Too many failed login attempts. Please try again later or reset your password.";
                }
                
                showError(errorMessage);
            } finally {
                hideLoader();
            }
        });
    }

    document.querySelectorAll('.social-btn.google').forEach(btn => {
        btn.addEventListener('click', async () => {
            showLoader();
            
            try {
                const result = await signInWithPopup(auth, googleProvider);
                const user = result.user;
                const userRef = doc(db, "users", user.uid);
                const snap = await getDoc(userRef);
                
                if (!snap.exists()) {
                    const autoCurrency = detectLikelyCurrency();

                    await setDoc(userRef, {
                        fullName: user.displayName || user.email.split("@")[0],
                        email: user.email,
                        phone: "",
                        photoURL: user.photoURL || "",
                        preferredCurrency: autoCurrency,
                        bonusAvailable: 0,
                        bonusPending: 0,
                        createdAt: new Date().toISOString(),
                        emailVerified: true
                    });
                } else {
                    await setDoc(userRef, { emailVerified: true }, { merge: true });
                }
                
                hideLoader();
                showSuccess("Signed in with Google!");
                closeModal();
                
                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 1000);
            } catch (error) {
                if (error.code !== "auth/popup-closed-by-user") {
                    showError("Google sign-in failed. Please try again.");
                }
            } finally {
                hideLoader();
            }
        });
    });
}

// ────────────────────────────────────────────────
// NAVBAR UPDATE
// ────────────────────────────────────────────────

function updateNavbar(user) {
    const desktop = document.getElementById('desktop-nav');
    const mobile  = document.getElementById('mobile-nav-links');
    document.querySelectorAll('.auth-guest').forEach(el => el.style.display = user ? 'none' : 'block');
    document.querySelectorAll('.dynamic-auth').forEach(el => el.remove());

    if (user) {
        const html = `
            <li class="dynamic-auth"><a href="dashboard.html">Dashboard</a></li>
            <li class="dynamic-auth"><a href="#" class="logout-trigger" style="color:#ff4444 !important;">Logout</a></li>
        `;
        if (desktop) desktop.insertAdjacentHTML('beforeend', html);
        if (mobile) mobile.insertAdjacentHTML('beforeend', html);

        document.querySelectorAll('.logout-trigger').forEach(btn => {
            btn.onclick = async e => {
                e.preventDefault();
                if (confirm("Sign out of Q AutoLux?")) {
                    try {
                        await signOut(auth);
                        showSuccess("Signed out successfully");
                        setTimeout(() => {
                            window.location.href = "index.html";
                        }, 1000);
                    } catch (err) {
                        showError("Failed to sign out. Please try again.");
                    }
                }
            };
        });
    }
}

// ────────────────────────────────────────────────
// PAGE LOAD & INITIALIZATION
// ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    showLoader();
    
    try {
        await fetchExchangeRates();
        const user = auth.currentUser;
        
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                userCurrency = userDoc.data().preferredCurrency || detectLikelyCurrency();
            } else {
                userCurrency = detectLikelyCurrency();
            }
        } else {
            userCurrency = detectLikelyCurrency();
        }
    } catch (err) {
        console.error("Initialization error:", err);
        userCurrency = detectLikelyCurrency();
    }
    
    initMobileMenu();
    const modal = initAuthModal();
    initPasswordToggles();
    initPasswordRequirements();
    
    if (modal) {
        initAuthForms(modal.openModal, modal.closeModal);
    }
    
    await initCalculator();
    
    if (modal) {
        await initApplicationForm(modal.openModal);
    }
    
    onAuthStateChanged(auth, user => {
        updateNavbar(user);
    });
    
    hideLoader();
});
