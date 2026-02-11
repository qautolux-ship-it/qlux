import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut,
    sendEmailVerification
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
let masterInventory = [];

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
        showError("Failed to load currency rates.");
        return false;
    }
}

setInterval(async () => {
    await fetchExchangeRates();
}, 30 * 60 * 1000);

function getLikelyCurrencyFromLocale() {
    const locale = new Intl.NumberFormat().resolvedOptions().locale || navigator.language || "en-US";
    const lang = locale.split("-")[0].toLowerCase();
    const region = (locale.split("-")[1] || "").toUpperCase();

    if (region && CURRENCY_MAP[region]) {
        return CURRENCY_MAP[region];
    }

    if (CURRENCY_MAP[lang]) {
        return CURRENCY_MAP[lang];
    }

    return "USD";
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

async function updateBudgetPlaceholder() {
    try {
        const currency = await getDisplayCurrency();
        const budgetInput = document.getElementById('filterBudget');
        if (budgetInput) {
            budgetInput.placeholder = `e.g. ${formatPrice(100000, currency)}`;
        }
    } catch (error) {
        const budgetInput = document.getElementById('filterBudget');
        if (budgetInput) {
            budgetInput.placeholder = 'e.g. $100,000';
        }
    }
}

async function updateInventoryBonus(user) {
    const bonusContainer = document.getElementById("inventoryBonus");
    const bonusText = document.getElementById("inventoryBonusText");
    const bonusAction = document.getElementById("inventoryBonusAction");

    if (!bonusContainer || !bonusText || !bonusAction) return;

    if (!user) {
        bonusText.textContent = "Sign up today and get $250 bonus when you refer a friend who makes their first purchase";
        bonusAction.textContent = "Create Account";
        bonusAction.href = "#";
        bonusAction.onclick = (e) => {
            e.preventDefault();
            openModal("signup");
        };
        bonusContainer.style.display = "block";
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            bonusContainer.style.display = "none";
            return;
        }

        const userData = userDoc.data();
        const bonusPending = Number(userData.bonusPending || 0);
        const bonusAvailable = Number(userData.bonusAvailable || 0);
        const currency = await getDisplayCurrency();

        if (bonusAvailable > 0) {
            bonusText.textContent = `You have ${formatPrice(bonusAvailable, currency)} in referral bonuses ready to use!`;
            bonusAction.textContent = "View My Bonus";
            bonusAction.href = "dashboard.html";
            bonusAction.onclick = null;
            bonusContainer.style.display = "block";
            return;
        }

        if (bonusPending > 0) {
            bonusText.textContent = `You have ${formatPrice(bonusPending, currency)} pending in referral bonuses`;
            bonusAction.textContent = "Invite More Friends";
            bonusAction.href = "dashboard.html";
            bonusAction.onclick = null;
            bonusContainer.style.display = "block";
            return;
        }

        bonusText.textContent = "Invite friends — earn $250 bonus per approved referral";
        bonusAction.textContent = "Get Your Referral Link";
        bonusAction.href = "dashboard.html";
        bonusAction.onclick = null;
        bonusContainer.style.display = "block";

    } catch (error) {
        bonusContainer.style.display = "none";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    showLoader();
    
    try {
        await fetchExchangeRates();
        await updateBudgetPlaceholder();
    } catch (error) {
        showError("Failed to initialize. Please refresh the page.");
    } finally {
        hideLoader();
    }

    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(btn => {
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

    const hamburger = document.getElementById("hamburger");
    const mobileOverlay = document.getElementById("mobile-overlay");

    if (hamburger && mobileOverlay) {
        const toggleMenu = () => {
            const isOpening = !mobileOverlay.classList.contains("active");
            mobileOverlay.classList.toggle("active");
            hamburger.classList.toggle("active");
            document.body.style.overflow = isOpening ? "hidden" : "auto";
        };

        const closeMenu = () => {
            mobileOverlay.classList.remove("active");
            hamburger.classList.remove("active");
            document.body.style.overflow = "auto";
        };

        hamburger.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleMenu();
        });

        mobileOverlay.addEventListener("click", (e) => {
            if (e.target.tagName === "A" || e.target === mobileOverlay) {
                closeMenu();
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && mobileOverlay.classList.contains("active")) {
                closeMenu();
            }
        });
    }

    async function fetchInventory() {
        const carGrid = document.getElementById("carGrid");
        if (!carGrid) return;

        showLoader();

        try {
            const querySnapshot = await getDocs(collection(db, "car"));
            masterInventory = [];

            querySnapshot.forEach(doc => {
                const data = doc.data();
                masterInventory.push({ id: doc.id, ...data });
            });

            if (masterInventory.length === 0) {
                showError("No vehicles found in inventory.");
            }

            await renderCars(masterInventory);
        } catch (error) {
            showError("Unable to load inventory. Please try again later.");
            carGrid.innerHTML = '<p style="text-align:center; color: #666; padding: 60px;">Unable to load inventory. Please try again later.</p>';
        } finally {
            hideLoader();
        }
    }

    async function renderCars(carsToDisplay) {
        const carGrid = document.getElementById("carGrid");
        if (!carGrid) return;

        carGrid.innerHTML = "";

        if (!carsToDisplay || carsToDisplay.length === 0) {
            carGrid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color: #999; padding: 60px 20px;">No vehicles found matching your criteria.</p>';
            return;
        }

        const currency = await getDisplayCurrency();

        carsToDisplay.forEach(car => {
            const cardHTML = `
                <div class="car-card">
                    <img src="${car.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image'}" 
                         alt="${car.year || ''} ${car.make || ''} ${car.model || ''}" 
                         loading="lazy">
                    <div class="car-content">
                        <span class="gold-text">${car.condition || 'Available'}</span>
                        <h3>${car.year || '—'} ${car.make || ''} ${car.model || ''}</h3>
                        
                        <div class="price-container" style="margin: 15px 0; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px;">
                            <div class="car-price" style="font-size: 1.4rem; margin-bottom: 2px;">
                                ${formatPrice(car.price, currency)}
                            </div>
                            ${car.monthly ? `
                            <div class="finance-preview" style="font-size: 0.85rem; color: #d4af37; font-weight: 600;">
                                Est. ${formatPrice(car.monthly, currency)}/mo
                            </div>` : ''}
                        </div>

                        <div class="car-footer">
                            <span><i class="fa fa-gauge-high"></i> ${Number(car.mileage || 0).toLocaleString()} mi</span>
                            <span><i class="fa fa-gas-pump"></i> ${car.fuelType || '—'}</span>
                        </div>
                        <a href="car-detail.html?id=${car.id}" class="car-view-btn">View Details</a>
                    </div>
                </div>`;
            carGrid.insertAdjacentHTML("beforeend", cardHTML);
        });
    }

    const searchBtn = document.getElementById("searchBtn");
    if (searchBtn) {
        searchBtn.addEventListener("click", async () => {
            const makeVal = (document.getElementById("filterMake")?.value || "").trim().toLowerCase();
            const modelVal = (document.getElementById("filterModel")?.value || "").trim().toLowerCase();
            const budgetVal = parseFloat(document.getElementById("filterBudget")?.value) || 0;
            
            try {
                const currency = await getDisplayCurrency();
                const cleanCurrency = currency.trim().toUpperCase();
                const rate = exchangeRates[cleanCurrency] || 1;
                
                const budgetInUSD = budgetVal / rate;

                const filtered = masterInventory.filter(car => {
                    const matchesMake = !makeVal || (car.make || "").toLowerCase().includes(makeVal);
                    const matchesModel = !modelVal || (car.model || "").toLowerCase().includes(modelVal);
                    const matchesBudget = budgetVal <= 0 || Number(car.price || 0) <= budgetInUSD;

                    return matchesMake && matchesModel && matchesBudget;
                });

                await renderCars(filtered);

                const inventorySection = document.getElementById("inventory");
                if (inventorySection) {
                    inventorySection.scrollIntoView({ behavior: "smooth" });
                }
            } catch (error) {
                showError("Error filtering vehicles. Please try again.");
            }
        });
    }

    fetchInventory();

    const overlay = document.getElementById("authModalOverlay");
    const titleEl = document.getElementById("modalTitle");
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const tabs = document.querySelectorAll(".tab-btn");

    function openModal(defaultTab = "login") {
        if (!overlay) return;
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";
        switchTab(defaultTab);
    }

    function closeModal() {
        if (!overlay) return;
        overlay.classList.remove("active");
        document.body.style.overflow = "";
    }

    function switchTab(tab) {
        tabs.forEach(t => t.classList.remove("active"));
        const activeTab = document.querySelector(`[data-tab="${tab}"]`);
        if (activeTab) activeTab.classList.add("active");

        if (tab === "login") {
            titleEl.textContent = "Welcome Back";
            loginForm?.classList.add("active");
            signupForm?.classList.remove("active");
        } else {
            titleEl.textContent = "Join Q AutoLux";
            signupForm?.classList.add("active");
            loginForm?.classList.remove("active");
        }
    }

    document.addEventListener("click", (e) => {
        if (e.target.closest(".login-trigger")) {
            e.preventDefault();
            openModal("login");
        }
        if (e.target.closest(".signup-trigger")) {
            e.preventDefault();
            openModal("signup");
        }
    });

    document.getElementById("modalClose")?.addEventListener("click", closeModal);

    if (overlay) {
        overlay.addEventListener("click", e => {
            if (e.target === overlay) closeModal();
        });
    }

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closeModal();
    });

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            switchTab(tab.dataset.tab);
        });
    });

    function updateNavbar(user) {
        const guestItems = document.querySelectorAll(".auth-guest");
        const desktopNav = document.getElementById("desktop-nav");
        const mobileNavList = document.getElementById("mobile-nav-links");

        guestItems.forEach(item => {
            item.style.display = user ? "none" : "block";
        });

        document.querySelectorAll(".dynamic-auth-item").forEach(el => el.remove());

        if (user) {
            const dashboardLink = `<li class="dynamic-auth-item"><a href="dashboard.html">Dashboard</a></li>`;
            const logoutLink = `<li class="dynamic-auth-item"><a href="#" class="logout-trigger" style="color:#ff4444 !important;">Logout</a></li>`;

            desktopNav.insertAdjacentHTML('beforeend', dashboardLink);
            desktopNav.insertAdjacentHTML('beforeend', logoutLink);

            mobileNavList.insertAdjacentHTML('beforeend', dashboardLink);
            mobileNavList.insertAdjacentHTML('beforeend', logoutLink);

            document.querySelectorAll(".logout-trigger").forEach(btn => {
                btn.onclick = async (e) => {
                    e.preventDefault();
                    if(confirm("Sign out of Q AutoLux?")) {
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

    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fullName = document.getElementById("signupFullName")?.value.trim();
            const email = document.getElementById("signupEmail")?.value.trim();
            const phone = document.getElementById("signupPhone")?.value.trim();
            const password = document.getElementById("signupPassword")?.value;
            const confirmPassword = document.getElementById("signupConfirmPassword")?.value;

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

                const autoCurrency = getLikelyCurrencyFromLocale();

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
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("loginEmail")?.value.trim();
            const password = document.getElementById("loginPassword")?.value;

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

    onAuthStateChanged(auth, async (user) => {
        updateNavbar(user);
        await updateInventoryBonus(user);
        if (user) {
            await updateBudgetPlaceholder();
        }
    });
});