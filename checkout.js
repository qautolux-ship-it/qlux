import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, getDoc, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged 
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
let currentVehicleId = '';
let currentVehicleData = null;
let bankDetails = null;
let checkoutFees = null;
let userBonusAvailable = 0;
let appliedBonusUSD = 0;
let currentUser = null;

function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'flex';
    }
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    }
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
    `;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
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
            console.log("Exchange rates loaded:", exchangeRates);
        }
    } catch (err) {
        console.error("Error fetching exchange rates:", err);
        showError("Failed to load exchange rates. Please refresh the page.");
    }
}

async function fetchBankDetails() {
    try {
        const bankDoc = await getDoc(doc(db, "settings", "bankDetails"));
        if (bankDoc.exists()) {
            bankDetails = bankDoc.data();
            displayBankDetails();
        }
    } catch (err) {
        console.error("Error fetching bank details:", err);
        showError("Failed to load bank details. Please refresh the page.");
    }
}

async function fetchCheckoutFees() {
    try {
        const feesDoc = await getDoc(doc(db, "settings", "checkoutFees"));
        if (feesDoc.exists()) {
            checkoutFees = feesDoc.data();
        }
    } catch (err) {
        console.error("Error fetching checkout fees:", err);
    }
}

async function fetchUserBonus(user) {
    try {
        console.log("=== FETCHING BONUS FOR USER ===");
        console.log("User ID:", user.uid);
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            userBonusAvailable = Number(userData.bonusAvailable || 0);
            
            console.log("User data:", userData);
            console.log("Bonus Available (raw):", userData.bonusAvailable);
            console.log("Bonus Available (parsed):", userBonusAvailable);
            
            if (userBonusAvailable > 0) {
                console.log("User has bonus! Displaying section...");
                
                const bonusSection = document.getElementById('bonusSection');
                const availableBonusAmount = document.getElementById('availableBonusAmount');
                const bonusInput = document.getElementById('bonusInput');
                
                console.log("Bonus section exists?", !!bonusSection);
                console.log("Available bonus amount exists?", !!availableBonusAmount);
                console.log("Bonus input exists?", !!bonusInput);
                
                if (bonusSection && availableBonusAmount && bonusInput) {
                    const currency = await getDisplayCurrency();
                    console.log("Display currency:", currency);
                    
                    const formattedBonus = formatPrice(userBonusAvailable, currency);
                    console.log("Formatted bonus:", formattedBonus);
                    
                    availableBonusAmount.textContent = formattedBonus;
                    bonusInput.max = userBonusAvailable;
                    bonusSection.style.display = 'block';
                    
                    console.log("✅ BONUS SECTION DISPLAYED!");
                } else {
                    console.error("❌ Bonus section elements missing from DOM");
                }
            } else {
                console.log("No bonus available (value is 0 or missing)");
            }
        } else {
            console.error("❌ User document does not exist in Firebase");
        }
    } catch (err) {
        console.error("❌ Error fetching user bonus:", err);
    }
}

function displayBankDetails() {
    if (!bankDetails) return;

    const bankNameEl = document.getElementById('bankName');
    const accountNumberEl = document.getElementById('accountNumber');
    const accountNameEl = document.getElementById('accountName');

    if (bankNameEl) bankNameEl.textContent = bankDetails.bankName || '';
    if (accountNumberEl) accountNumberEl.textContent = bankDetails.accountNumber || '';
    if (accountNameEl) accountNameEl.textContent = bankDetails.accountName || '';

    if (bankDetails.ussdCodes && Object.keys(bankDetails.ussdCodes).length > 0) {
        const ussdContainer = document.getElementById('ussdCodesContainer');
        const ussdList = document.getElementById('ussdCodesList');
        
        if (ussdContainer && ussdList) {
            ussdList.innerHTML = '';
            Object.entries(bankDetails.ussdCodes).forEach(([bank, code]) => {
                const ussdCode = code.replace('{accountNumber}', bankDetails.accountNumber);
                const codeDiv = document.createElement('div');
                codeDiv.className = 'ussd-code';
                codeDiv.innerHTML = `<span>${ussdCode}</span>`;
                ussdList.appendChild(codeDiv);
            });
            ussdContainer.style.display = 'block';
        }
    }
}

function calculateTotalWithFees(basePrice, currency) {
    let totalUSD = Number(basePrice);
    const feesContainer = document.getElementById('additionalFeesContainer');
    feesContainer.innerHTML = '';

    if (!checkoutFees) {
        return totalUSD;
    }

    const fees = checkoutFees.fees || [];
    
    fees.forEach(fee => {
        let feeAmount = 0;

        if (fee.type === 'percentage') {
            feeAmount = (totalUSD * fee.value) / 100;
        } else if (fee.type === 'fixed') {
            feeAmount = Number(fee.value);
        }

        if (feeAmount > 0) {
            totalUSD += feeAmount;

            const feeRow = document.createElement('div');
            feeRow.className = 'total-row';
            feeRow.innerHTML = `
                <span>${fee.name}</span>
                <span class="price-amount">${formatPrice(feeAmount, currency)}</span>
            `;
            feesContainer.appendChild(feeRow);
        } else if (fee.type === 'included') {
            const feeRow = document.createElement('div');
            feeRow.className = 'total-row';
            feeRow.innerHTML = `
                <span>${fee.name}</span>
                <span class="price-included">Included</span>
            `;
            feesContainer.appendChild(feeRow);
        }
    });

    return totalUSD;
}

async function updateTotalWithBonus() {
    if (!currentVehicleData) return;
    
    const currency = await getDisplayCurrency();
    const basePrice = currentVehicleData.price;
    let totalPriceUSD = calculateTotalWithFees(basePrice, currency);
    
    totalPriceUSD = Math.max(0, totalPriceUSD - appliedBonusUSD);
    
    const totalPriceDisplay = formatPrice(totalPriceUSD, currency);
    const numericAmount = getNumericAmount(totalPriceUSD, currency);
    
    document.getElementById('totalDue').textContent = totalPriceDisplay;
    document.getElementById('totalDue').dataset.amountKobo = Math.round(numericAmount * 100);
    
    const transferAmountElement = document.getElementById('transferAmount');
    if (transferAmountElement) {
        transferAmountElement.textContent = totalPriceDisplay;
    }
    
    document.getElementById('successPrice').textContent = `Total: ${totalPriceDisplay}`;
}

function setupBonusApplication() {
    const applyBonusBtn = document.getElementById('applyBonusBtn');
    const bonusInput = document.getElementById('bonusInput');
    
    if (applyBonusBtn && bonusInput) {
        applyBonusBtn.addEventListener('click', async () => {
            const inputValue = parseFloat(bonusInput.value || 0);
            
            if (inputValue <= 0) {
                showError('Please enter a valid bonus amount');
                return;
            }
            
            if (inputValue > userBonusAvailable) {
                showError(`Maximum bonus available is ${formatPrice(userBonusAvailable, await getDisplayCurrency())}`);
                return;
            }
            
            appliedBonusUSD = inputValue;
            
            const bonusAppliedRow = document.getElementById('bonusAppliedRow');
            const bonusAppliedAmount = document.getElementById('bonusAppliedAmount');
            
            if (bonusAppliedRow && bonusAppliedAmount) {
                const currency = await getDisplayCurrency();
                bonusAppliedAmount.textContent = `-${formatPrice(appliedBonusUSD, currency)}`;
                bonusAppliedRow.style.display = 'flex';
            }
            
            await updateTotalWithBonus();
            showSuccess(`Bonus of ${formatPrice(appliedBonusUSD, await getDisplayCurrency())} applied successfully!`);
            
            bonusInput.disabled = true;
            applyBonusBtn.disabled = true;
            applyBonusBtn.textContent = 'Applied';
        });
    }
}

async function deductBonusFromUser(userId, bonusAmount) {
    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const currentBonus = Number(userSnap.data().bonusAvailable || 0);
            const newBonus = Math.max(0, currentBonus - bonusAmount);
            
            await updateDoc(userRef, {
                bonusAvailable: newBonus
            });
            
            console.log(`Bonus deducted: ${bonusAmount}, New balance: ${newBonus}`);
            return true;
        }
        return false;
    } catch (err) {
        console.error("Error deducting bonus:", err);
        return false;
    }
}

function getLikelyCurrencyFromLocale() {
    const locale = new Intl.NumberFormat().resolvedOptions().locale || navigator.language || "en-US";
    const lang = locale.split("-")[0].toLowerCase();
    const region = (locale.split("-")[1] || "").toUpperCase();

    const currencyMap = {
        NG: "NGN", ZA: "ZAR", KE: "KES", GH: "GHS", EG: "EGP",
        DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", GB: "GBP", IE: "EUR",
        US: "USD", CA: "CAD", BR: "BRL", MX: "MXN", AR: "ARS",
        CL: "CLP", CO: "COP", PE: "PEN",
        JP: "JPY", CN: "CNY", IN: "INR", AU: "AUD", NZ: "NZD",
        KR: "KRW", SG: "SGD", HK: "HKD", TH: "THB",
        AE: "AED", SA: "SAR", IL: "ILS", TR: "TRY",
        en: "USD", de: "EUR", fr: "EUR", es: "EUR",
        pt: "BRL", ru: "RUB", zh: "CNY", ja: "JPY",
        ar: "AED", ko: "KRW"
    };

    return region && currencyMap[region] ? currencyMap[region] :
           currencyMap[lang] ? currencyMap[lang] : "USD";
}

async function getDisplayCurrency() {
    const user = auth.currentUser;
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                return userDoc.data().preferredCurrency || "USD";
            }
        } catch (err) {
            console.error("Error getting currency:", err);
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

function getNumericAmount(amountUSD, currency = "USD") {
    const cleanCurrency = currency.trim().toUpperCase();
    const rate = exchangeRates[cleanCurrency] || 1;
    return Number(amountUSD || 0) * rate;
}

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetPanel = document.getElementById(`${targetTab}-panel`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });
}

function initializeCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            let textToCopy = '';
            
            if (btn.hasAttribute('data-copy-bank')) {
                textToCopy = document.getElementById('bankName')?.textContent || '';
            } else if (btn.hasAttribute('data-copy-account')) {
                textToCopy = document.getElementById('accountNumber')?.textContent || '';
            } else if (btn.hasAttribute('data-copy-name')) {
                textToCopy = document.getElementById('accountName')?.textContent || '';
            } else if (btn.hasAttribute('data-copy-amount')) {
                textToCopy = document.getElementById('transferAmount')?.textContent || '';
            } else if (btn.hasAttribute('data-copy-reference')) {
                textToCopy = document.getElementById('paymentReference')?.textContent || '';
            }

            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const icon = btn.querySelector('i');
                    if (icon) {
                        icon.className = 'fas fa-check';
                        setTimeout(() => {
                            icon.className = 'fas fa-copy';
                        }, 2000);
                    }
                    showSuccess('Copied to clipboard!');
                }).catch(() => {
                    showError('Failed to copy');
                });
            }
        });
    });
}

function initializeCardFormatting() {
    const cardNumberInput = document.getElementById('cardNumber');
    const expiryInput = document.getElementById('expiry');
    const cvvInput = document.getElementById('cvv');

    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '');
            value = value.replace(/\D/g, '');
            value = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = value;
        });
    }

    if (expiryInput) {
        expiryInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '');
            value = value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + ' / ' + value.slice(2, 4);
            }
            e.target.value = value;
        });
    }

    if (cvvInput) {
        cvvInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        });
    }
}

async function payWithPaystack() {
    const totalDueEl = document.getElementById('totalDue');
    const amountKobo = totalDueEl?.dataset.amountKobo;
    const email = document.getElementById('billingEmail')?.value;
    
    if (!amountKobo || !email) {
        showError('Missing payment information');
        return;
    }

    const handler = PaystackPop.setup({
        key: 'pk_test_a8e036e67b8d31a8af0ab73b9b8ca86e29e6fb16',
        email: email,
        amount: amountKobo,
        currency: 'NGN',
        ref: generatePaymentReference(),
        callback: async function(response) {
            showLoader();
            
            if (appliedBonusUSD > 0 && currentUser) {
                await deductBonusFromUser(currentUser.uid, appliedBonusUSD);
            }
            
            hideLoader();
            showSuccessOverlay('card', response.reference);
        },
        onClose: function() {
            showError('Payment cancelled');
        }
    });
    
    handler.openIframe();
}

function showSuccessOverlay(paymentMethod, reference) {
    const overlay = document.getElementById('successOverlay');
    const title = document.getElementById('successTitle');
    const message = document.getElementById('successMessage');
    const vehicleEl = document.getElementById('successVehicle');
    const priceEl = document.getElementById('successPrice');
    const refElement = document.getElementById('successReference');

    if (currentVehicleData) {
        const vehicleTitle = `${currentVehicleData.year || ''} ${currentVehicleData.make || ''} ${currentVehicleData.model || ''}`.trim();
        vehicleEl.textContent = vehicleTitle;
        priceEl.textContent = document.getElementById('totalDue').textContent;
    }
    
    if (paymentMethod === 'bank') {
        title.textContent = 'Transfer Instructions Sent!';
        message.textContent = 'Please complete your bank transfer using the details provided.';
        refElement.textContent = `Reference: ${reference}`;
        showSuccess('Transfer details confirmed!');
    } else {
        title.textContent = 'Payment Successful!';
        message.textContent = 'Your premium vehicle acquisition has been confirmed.';
        refElement.textContent = reference ? `Transaction Ref: ${reference}` : '';
        showSuccess('Payment processed successfully!');
    }
    
    overlay.style.display = 'flex';
    setTimeout(() => {
        overlay.classList.add('visible');
    }, 100);
}

function generatePaymentReference() {
    const prefix = 'QAUTOLUX';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `${prefix}-${timestamp}-${random}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("=== PAGE LOADED ===");
    showLoader();
    
    try {
        await fetchExchangeRates();
        await fetchBankDetails();
        await fetchCheckoutFees();

        const params = new URLSearchParams(window.location.search);
        const vehicleId = params.get('id');

        if (!vehicleId) {
            hideLoader();
            showError('No vehicle selected. Redirecting...');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }

        currentVehicleId = vehicleId;

        initializeTabs();
        initializeCopyButtons();
        initializeCardFormatting();
        setupBonusApplication();

        const paymentRef = generatePaymentReference();
        const refElement = document.getElementById('paymentReference');
        if (refElement) {
            refElement.textContent = paymentRef;
        }

        onAuthStateChanged(auth, async (user) => {
            console.log("=== AUTH STATE CHANGED ===");
            console.log("User:", user);
            
            if (!user) {
                hideLoader();
                showError('Please log in to complete your purchase.');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                return;
            }

            currentUser = user;

            try {
                const inventoryRef = doc(db, "inventory", vehicleId);
                const carRef = doc(db, "car", vehicleId);

                const [inventorySnap, carSnap] = await Promise.all([
                    getDoc(inventoryRef),
                    getDoc(carRef)
                ]);

                if (!inventorySnap.exists() && !carSnap.exists()) {
                    hideLoader();
                    showError("Vehicle not found. Redirecting...");
                    setTimeout(() => {
                        window.location.href = 'inventory.html';
                    }, 2000);
                    return;
                }

                const inventoryData = inventorySnap.exists() ? inventorySnap.data() : {};
                const techData = carSnap.exists() ? carSnap.data() : {};
                const car = { ...inventoryData, ...techData };
                
                currentVehicleData = car;

                const currency = await getDisplayCurrency();

                const vehicleImg = document.getElementById('vehiclePreviewImg');
                if (vehicleImg && (car.images?.[0] || car.image)) {
                    vehicleImg.src = car.images?.[0] || car.image;
                    vehicleImg.alt = `${car.make || ''} ${car.model || ''}`;
                    vehicleImg.style.display = 'block';
                }

                const vehicleTitle = `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();
                document.getElementById('vehicleTitle').textContent = vehicleTitle;
                
                document.getElementById('vehicleCondition').textContent = car.condition || 'Premium';
                
                document.getElementById('vehicleRef').textContent = `Reference: ${vehicleId.toUpperCase()}`;

                const basePriceDisplay = formatPrice(car.price, currency);
                document.getElementById('vehiclePrice').textContent = basePriceDisplay;

                const totalPriceUSD = calculateTotalWithFees(car.price, currency);
                const totalPriceDisplay = formatPrice(totalPriceUSD, currency);
                const numericAmount = getNumericAmount(totalPriceUSD, currency);
                
                document.getElementById('totalDue').textContent = totalPriceDisplay;
                document.getElementById('totalDue').dataset.amountKobo = Math.round(numericAmount * 100);
                
                const transferAmountElement = document.getElementById('transferAmount');
                if (transferAmountElement) {
                    transferAmountElement.textContent = totalPriceDisplay;
                }

                document.getElementById('successVehicle').textContent = vehicleTitle;
                document.getElementById('successPrice').textContent = `Total: ${totalPriceDisplay}`;

                console.log("=== NOW FETCHING USER BONUS ===");
                await fetchUserBonus(user);

                hideLoader();
                showSuccess('Vehicle details loaded successfully!');

            } catch (err) {
                hideLoader();
                console.error("Error loading vehicle:", err);
                showError("Could not load vehicle details. Please try again.");
            }
        });

        const paymentForm = document.getElementById('paymentForm');
        if (paymentForm) {
            paymentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
                const expiry = document.getElementById('expiry').value;
                const cvv = document.getElementById('cvv').value;
                const cardName = document.getElementById('cardName').value;
                const email = document.getElementById('billingEmail').value;
                
                if (cardNumber.length < 13 || cardNumber.length > 19) {
                    showError('Please enter a valid card number');
                    return;
                }
                
                if (!expiry.includes('/') || expiry.length < 7) {
                    showError('Please enter a valid expiry date (MM / YY)');
                    return;
                }
                
                if (cvv.length < 3 || cvv.length > 4) {
                    showError('Please enter a valid CVV');
                    return;
                }
                
                if (!cardName.trim()) {
                    showError('Please enter the cardholder name');
                    return;
                }
                
                if (!email.includes('@')) {
                    showError('Please enter a valid email address');
                    return;
                }
                
                payWithPaystack();
            });
        }

        const bankTransferForm = document.getElementById('bankTransferForm');
        if (bankTransferForm) {
            bankTransferForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const senderName = document.getElementById('senderName').value;
                const senderEmail = document.getElementById('senderEmail').value;
                const senderPhone = document.getElementById('senderPhone').value;
                
                if (!senderName.trim() || !senderEmail.includes('@') || !senderPhone.trim()) {
                    showError('Please fill in all required fields');
                    return;
                }
                
                if (appliedBonusUSD > 0 && currentUser) {
                    showLoader();
                    await deductBonusFromUser(currentUser.uid, appliedBonusUSD);
                    hideLoader();
                }
                
                const reference = document.getElementById('paymentReference').textContent;
                
                showSuccessOverlay('bank', reference);
            });
        }
        
        hideLoader();
        
    } catch (error) {
        hideLoader();
        console.error("Initialization error:", error);
        showError("Failed to initialize payment page. Please refresh.");
    }
});
