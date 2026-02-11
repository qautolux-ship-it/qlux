import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendEmailVerification
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

// ========================================
// STANDARDIZED CURRENCY MAPPING
// ========================================
const CURRENCY_MAP = {
    // Europe
    GB: "GBP", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", 
    NL: "EUR", BE: "EUR", AT: "EUR", PT: "EUR", IE: "EUR",
    CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
    
    // Americas
    US: "USD", CA: "CAD", BR: "BRL", MX: "MXN", AR: "ARS",
    CL: "CLP", CO: "COP", PE: "PEN",
    
    // Asia Pacific
    JP: "JPY", CN: "CNY", IN: "INR", AU: "AUD", NZ: "NZD", 
    KR: "KRW", SG: "SGD", HK: "HKD", TH: "THB",
    
    // Africa
    NG: "NGN", ZA: "ZAR", KE: "KES", GH: "GHS", EG: "EGP",
    
    // Middle East
    AE: "AED", SA: "SAR", IL: "ILS", TR: "TRY",
    
    // Language fallbacks
    en: "USD", de: "EUR", fr: "EUR", es: "EUR", 
    pt: "BRL", ru: "RUB", zh: "CNY", ja: "JPY",
    ar: "AED", ko: "KRW"
};

// ========================================
// EXCHANGE RATE FUNCTIONS
// ========================================
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
            
            console.log("✅ Exchange rates loaded:", exchangeRates);
            return true;
        } else {
            console.warn("⚠️ Exchange rates not found");
            return false;
        }
    } catch (err) {
        console.error("❌ Error fetching exchange rates:", err);
        showError("Failed to load currency rates");
        return false;
    }
}

// Auto-refresh rates every 30 minutes
setInterval(async () => {
    console.log("🔄 Refreshing exchange rates...");
    await fetchExchangeRates();
}, 30 * 60 * 1000);

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
                const data = userDoc.data();
                return data.preferredCurrency || "USD";
            }
        } catch (err) {
            console.error("Failed to read user currency:", err);
        }
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

// ========================================
// UI HELPER FUNCTIONS
// ========================================
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
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
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
        background: #ff4444;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// ========================================
// ✅ BONUS DISPLAY FUNCTION
// ========================================
async function updateDetailBonus(user) {
    const bonusContainer = document.getElementById("detailBonus");
    const bonusText = document.getElementById("detailBonusText");
    const bonusAction = document.getElementById("detailBonusAction");
    
    if (!bonusContainer || !bonusText || !bonusAction) {
        console.log("⚠️ Bonus elements not found on details page");
        return;
    }

    // Guest user
    if (!user) {
        bonusText.textContent = "Invite friends and earn $250 when they purchase a vehicle";
        bonusAction.textContent = "Sign Up & Start Earning";
        bonusAction.href = "#";
        bonusAction.onclick = (e) => {
            e.preventDefault();
            const signupTrigger = document.querySelector(".signup-trigger");
            if (signupTrigger) signupTrigger.click();
        };
        bonusContainer.style.display = "flex";
        console.log("✅ Detail bonus: Guest state");
        return;
    }

    // Logged in user - fetch bonus data
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            bonusContainer.style.display = "none";
            return;
        }

        const userData = userDoc.data();
        const bonusAvailable = Number(userData.bonusAvailable || 0);
        const bonusPending = Number(userData.bonusPending || 0);
        const currency = await getDisplayCurrency();

        // Has available bonus
        if (bonusAvailable > 0) {
            const formattedBonus = formatPrice(bonusAvailable, currency);
            bonusText.textContent = `You have ${formattedBonus} available bonus credit — Apply at checkout`;
            bonusAction.textContent = "View Dashboard";
            bonusAction.href = "dashboard.html";
            bonusAction.onclick = null;
            bonusContainer.style.display = "flex";
            console.log(`✅ Detail bonus: Available $${bonusAvailable}`);
            return;
        }

        // Has pending bonus
        if (bonusPending > 0) {
            const formattedPending = formatPrice(bonusPending, currency);
            bonusText.textContent = `${formattedPending} in referral bonuses pending — Share your link to earn more`;
            bonusAction.textContent = "View Dashboard";
            bonusAction.href = "dashboard.html";
            bonusAction.onclick = null;
            bonusContainer.style.display = "flex";
            console.log(`✅ Detail bonus: Pending $${bonusPending}`);
            return;
        }

        // No bonus - show invitation
        bonusText.textContent = "Invite friends and earn $250 when they purchase a vehicle";
        bonusAction.textContent = "Get Your Referral Link";
        bonusAction.href = "dashboard.html";
        bonusAction.onclick = null;
        bonusContainer.style.display = "flex";
        console.log("✅ Detail bonus: No bonus, show referral");

    } catch (error) {
        console.error("❌ Error loading bonus data:", error);
        bonusContainer.style.display = "none";
    }
}

// ========================================
// MAIN INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    showLoader();
    
    try {
        await fetchExchangeRates();
    } catch (error) {
        console.error("Initialization error:", error);
    }

    const params = new URLSearchParams(window.location.search);
    const carId = params.get('id');

    if (!carId) {
        showError("No vehicle ID provided");
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    const overlay = document.getElementById("authModalOverlay");
    const titleEl = document.getElementById("modalTitle");
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const tabs = document.querySelectorAll(".tab-btn");

    function closeMobileMenu() {
        document.getElementById("hamburger")?.classList.remove("active");
        document.getElementById("mobile-overlay")?.classList.remove("active");
    }

    function openModal(mode = "login") {
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";
        tabs.forEach(t => t.classList.remove("active"));
        if (mode === "signup") {
            tabs[1]?.classList.add("active");
            signupForm.classList.add("active");
            loginForm.classList.remove("active");
            titleEl.textContent = "Join Q AutoLux";
        } else {
            tabs[0]?.classList.add("active");
            loginForm.classList.add("active");
            signupForm.classList.remove("active");
            titleEl.textContent = "Welcome Back";
        }
    }

    function closeModal() {
        overlay.classList.remove("active");
        document.body.style.overflow = "";
    }

    document.querySelectorAll(".login-trigger").forEach(btn => {
        btn.addEventListener("click", e => {
            e.preventDefault();
            closeMobileMenu();
            openModal("login");
        });
    });

    document.querySelectorAll(".signup-trigger").forEach(btn => {
        btn.addEventListener("click", e => {
            e.preventDefault();
            closeMobileMenu();
            openModal("signup");
        });
    });

    document.getElementById("modalClose")?.addEventListener("click", closeModal);
    overlay.addEventListener("click", e => {
        if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closeModal();
    });

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetForm = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            if (targetForm === "login") {
                loginForm.classList.add("active");
                signupForm.classList.remove("active");
                titleEl.textContent = "Welcome Back";
            } else {
                signupForm.classList.add("active");
                loginForm.classList.remove("active");
                titleEl.textContent = "Join Q AutoLux";
            }
        });
    });

    document.querySelectorAll('.password-toggle').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            if (passwordInput && icon) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        });
    });

    const signupPassword = document.getElementById('signupPassword');
    const passwordRequirements = document.getElementById('passwordRequirements');
    const passwordStrength = document.getElementById('passwordStrength');

    if (signupPassword) {
        signupPassword.addEventListener('focus', function() {
            if (passwordRequirements) passwordRequirements.style.display = 'block';
            if (passwordStrength) passwordStrength.style.display = 'block';
        });

        signupPassword.addEventListener('input', function() {
            validatePasswordStrength(this.value);
        });
    }

    function validatePasswordStrength(password) {
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[@$!%*?&#]/.test(password)
        };

        const reqLength = document.getElementById('req-length');
        const reqUppercase = document.getElementById('req-uppercase');
        const reqLowercase = document.getElementById('req-lowercase');
        const reqNumber = document.getElementById('req-number');
        const reqSpecial = document.getElementById('req-special');

        if (reqLength) reqLength.classList.toggle('met', requirements.length);
        if (reqUppercase) reqUppercase.classList.toggle('met', requirements.uppercase);
        if (reqLowercase) reqLowercase.classList.toggle('met', requirements.lowercase);
        if (reqNumber) reqNumber.classList.toggle('met', requirements.number);
        if (reqSpecial) reqSpecial.classList.toggle('met', requirements.special);

        const metCount = Object.values(requirements).filter(Boolean).length;
        const strengthFill = document.getElementById('strengthFill');
        const strengthText = document.getElementById('strengthText');

        if (strengthFill && strengthText) {
            strengthFill.className = 'strength-fill';
            strengthText.className = 'strength-text';

            if (metCount <= 2) {
                strengthFill.classList.add('weak');
                strengthText.classList.add('weak');
                strengthText.textContent = 'Weak password';
            } else if (metCount <= 4) {
                strengthFill.classList.add('medium');
                strengthText.classList.add('medium');
                strengthText.textContent = 'Medium password';
            } else {
                strengthFill.classList.add('strong');
                strengthText.classList.add('strong');
                strengthText.textContent = 'Strong password';
            }
        }

        return requirements;
    }

    function isPasswordStrong(password) {
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[@$!%*?&#]/.test(password)
        };

        return Object.values(requirements).every(Boolean);
    }

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

    loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        
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

            showSuccess("Welcome back!");
            closeModal();
            hideLoader();
        } catch (error) {
            hideLoader();
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
        }
    });

    signupForm.addEventListener("submit", async e => {
        e.preventDefault();
        const fullName = document.getElementById("signupFullName").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        const phone = document.getElementById("signupPhone").value.trim();
        const password = document.getElementById("signupPassword").value;
        const confirmPassword = document.getElementById("signupConfirmPassword").value;

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

            await setDoc(doc(db, "users", user.uid), {
                fullName,
                email,
                phone,
                createdAt: new Date().toISOString(),
                preferredCurrency: getLikelyCurrencyFromLocale(),
                bonusAvailable: 0,
                bonusPending: 0,
                emailVerified: false
            });

            hideLoader();
            closeModal();

            const verificationModal = document.getElementById('verificationModal');
            const verificationEmailEl = document.getElementById('verificationEmail');
            if (verificationEmailEl) verificationEmailEl.textContent = email;
            if (verificationModal) verificationModal.classList.add('active');

            await signOut(auth);

        } catch (error) {
            hideLoader();
            let errorMessage = "Signup failed. Please try again.";
            
            if (error.code === "auth/email-already-in-use") {
                errorMessage = "This email is already registered. Please login instead.";
            } else if (error.code === "auth/weak-password") {
                errorMessage = "Password is too weak. Please use a stronger password.";
            } else if (error.code === "auth/invalid-email") {
                errorMessage = "Invalid email address format.";
            }
            
            showError(errorMessage);
        }
    });

    document.getElementById('closeVerificationModal')?.addEventListener('click', () => {
        const verificationModal = document.getElementById('verificationModal');
        if (verificationModal) verificationModal.classList.remove('active');
    });

    const googleBtns = document.querySelectorAll(".social-btn.google");
    googleBtns.forEach(btn => {
        btn.addEventListener("click", async () => {
            const provider = new GoogleAuthProvider();
            showLoader();
            
            try {
                const result = await signInWithPopup(auth, provider);
                const user = result.user;
                const userRef = doc(db, "users", user.uid);
                const snap = await getDoc(userRef);
                
                if (!snap.exists()) {
                    const autoCurrency = getLikelyCurrencyFromLocale();

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
                
                showSuccess("Signed in with Google!");
                closeModal();
                hideLoader();
            } catch (error) {
                hideLoader();
                if (error.code !== "auth/popup-closed-by-user") {
                    showError("Google sign-in failed. Please try again.");
                }
            }
        });
    });

    setupNavigationUI();

    // ✅ AUTH STATE LISTENER - Update bonus on auth change
    onAuthStateChanged(auth, user => {
        updateNavbar(user);
        updateDetailBonus(user);  // ✅ Update bonus display
    });

    await loadCarDetails(carId);

    async function loadCarDetails(id) {
        const loaderEl = document.getElementById('loader-inline');
        const contentEl = document.getElementById('content-wrapper');
        
        try {
            const inventoryRef = doc(db, "inventory", id);
            const carRef = doc(db, "car", id);

            const [inventorySnap, carSnap] = await Promise.all([
                getDoc(inventoryRef),
                getDoc(carRef)
            ]);
            
            if (!inventorySnap.exists() && !carSnap.exists()) {
                hideLoader();
                showError("Vehicle not found");
                document.getElementById('detail-main').innerHTML = 
                    `<h2 style="text-align:center; padding: 50px;">Vehicle Not Found</h2>
                     <p style="text-align:center;"><a href="inventory.html" class="btn-gold">Back to Inventory</a></p>`;
                return;
            }

            const inventoryData = inventorySnap.exists() ? inventorySnap.data() : {};
            const techData = carSnap.exists() ? carSnap.data() : {};
            const car = { ...inventoryData, ...techData };

            const currency = await getDisplayCurrency();

            document.title = `${car.year || ''} ${car.make || ''} ${car.model || ''} | Q AutoLux`;
            document.getElementById('carTitle').textContent = `${car.year || ''} ${car.make || ''} ${car.model || ''}`;
            document.getElementById('carCondition').textContent = car.condition || 'Premium';
            
            const priceArea = document.getElementById('carPrice');
            const financeBtn = document.getElementById('financeBtn');
            
            let priceHTML = `<div style="font-size: 2.2rem; font-weight: 700;">${formatPrice(car.price, currency)}</div>`;
            
            if (car.monthly) {
                priceHTML += `<div style="color: #d4af37; font-weight: 600; font-size: 1.1rem; margin-top: 5px;">
                                Est. ${formatPrice(car.monthly, currency)}/mo
                              </div>`;

                financeBtn.style.display = 'block';
                financeBtn.href = `financing.html?id=${id}`;
            } else {
                financeBtn.style.display = 'none';
            }
            priceArea.innerHTML = priceHTML;

            document.getElementById('carYear').textContent = car.year || '—';
            document.getElementById('carColor').textContent = car.exteriorColor || car.color || '—';
            document.getElementById('carEngine').textContent = car.engine || '—';
            document.getElementById('carTrans').textContent = car.transmission || '—';
            document.getElementById('carFuel').textContent = car.fuelType || '—';
            document.getElementById('carMileage').textContent = `${Number(car.mileage || 0).toLocaleString()} mi`;
            document.getElementById('carDescription').textContent = car.description || 'Consult with our concierge for full vehicle details.';

            const mainImg = document.getElementById('mainDisplayImage');
            const thumbRow = document.getElementById('thumbnailRow');
            const images = car.images || (car.image ? [car.image] : []);

            if (images.length > 0) {
                mainImg.src = images[0];
                thumbRow.innerHTML = '';
                images.forEach((imgUrl, index) => {
                    const img = document.createElement('img');
                    img.src = imgUrl;
                    img.className = index === 0 ? 'active' : '';
                    img.onclick = () => {
                        mainImg.src = imgUrl;
                        document.querySelectorAll('.thumbnail-row img').forEach(t => t.classList.remove('active'));
                        img.classList.add('active');
                    };
                    thumbRow.appendChild(img);
                });
            }

            document.getElementById('buyNowBtn').onclick = () => {
                if (!auth.currentUser) {
                    openModal("login");
                } else {
                    window.location.href = `checkout.html?id=${id}`;
                }
            };

            if (loaderEl) loaderEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
            hideLoader();

            setupSaveAction(id, car);

        } catch (err) {
            console.error("❌ Error loading car details:", err);
            hideLoader();
            showError("Failed to load vehicle details");
            
            if (loaderEl) loaderEl.innerHTML = `
                <div style="text-align:center; padding: 50px;">
                    <p style="color: #ff4444; margin-bottom: 20px;">Error loading vehicle details</p>
                    <a href="inventory.html" class="btn-gold">Back to Inventory</a>
                </div>
            `;
        }
    }

    function setupSaveAction(carId, carData) {
        const saveBtn = document.getElementById('saveToWishlistBtn');
        if (!saveBtn) return;

        saveBtn.onclick = async () => {
            const user = auth.currentUser;
            if (!user) {
                openModal("login");
                return;
            }

            const originalHTML = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            try {
                const q = query(
                    collection(db, "wishlist"),
                    where("userId", "==", user.uid),
                    where("carId", "==", carId)
                );
                const snap = await getDocs(q);

                if (!snap.empty) {
                    showSuccess("Already in your collection!");
                    saveBtn.innerHTML = '<i class="fas fa-heart"></i> Saved';
                    return;
                }

                await addDoc(collection(db, "wishlist"), {
                    userId:      user.uid,
                    carId:       carId,
                    make:        carData.make || '',
                    model:       carData.model || '',
                    year:        carData.year || '',
                    priceUSD:    Number(carData.price || 0),
                    condition:   carData.condition || 'Premium',
                    image:       (carData.images && carData.images[0]) || carData.image || '',
                    savedAt:     new Date().toISOString()
                });

                showSuccess("Vehicle added to your collection!");
                saveBtn.innerHTML = '<i class="fas fa-heart"></i> Saved';

            } catch (err) {
                console.error("❌ Failed to save to wishlist:", err);
                showError("Could not save vehicle. Please try again.");
                saveBtn.innerHTML = originalHTML;
            } finally {
                saveBtn.disabled = false;
            }
        };
    }

    document.getElementById('shareAssetBtn').onclick = () => {
        if (navigator.share) {
            navigator.share({
                title: document.title,
                url: window.location.href
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(window.location.href);
            showSuccess("Link copied to clipboard!");
        }
    };

    function setupNavigationUI() {
        const hamburger = document.getElementById("hamburger");
        const mobileOverlay = document.getElementById("mobile-overlay");

        hamburger?.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            mobileOverlay.classList.toggle("active");
        });
        
        mobileOverlay?.addEventListener("click", (e) => {
            if (e.target === mobileOverlay) closeMobileMenu();
        });
    }

    function updateNavbar(user) {
        const guestItems = document.querySelectorAll(".auth-guest");
        const desktopNav = document.getElementById("desktop-nav");
        const mobileNavList = document.getElementById("mobile-nav-links");

        guestItems.forEach(item => item.style.display = user ? "none" : "block");
        document.querySelectorAll(".dynamic-auth-item").forEach(el => el.remove());

        if (user) {
            const items = `<li class="dynamic-auth-item"><a href="dashboard.html">Dashboard</a></li>
                           <li class="dynamic-auth-item"><a href="#" class="logout-btn" style="color:#ff4444;">Logout</a></li>`;
            desktopNav.insertAdjacentHTML('beforeend', items);
            mobileNavList.insertAdjacentHTML('beforeend', items);

            // Attach logout handler to ALL logout buttons using querySelectorAll
            document.querySelectorAll(".logout-btn").forEach(logoutBtn => {
                logoutBtn.onclick = async (e) => {
                    e.preventDefault();
                    showLoader();
                    try {
                        await signOut(auth);
                        showSuccess("Signed out successfully");
                        setTimeout(() => window.location.reload(), 1000);
                    } catch (err) {
                        hideLoader();
                        showError("Failed to sign out");
                    }
                };
            });
        }
    }
});