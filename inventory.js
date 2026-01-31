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
    signOut 
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
const googleProvider = new GoogleAuthProvider();

let masterInventory = [];

async function getDisplayCurrency() {
    const user = auth.currentUser;
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                return userDoc.data().preferredCurrency || "USD";
            }
        } catch (err) {
            console.error("Currency fetch error:", err);
        }
    }
    return "USD";
}

function formatPrice(amount, currency = "USD") {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0
    }).format(Number(amount || 0));
}

document.addEventListener('DOMContentLoaded', () => {

    const hamburger = document.getElementById('hamburger');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const body = document.body;

    if (hamburger && mobileOverlay) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            mobileOverlay.classList.toggle('active');
            body.style.overflow = mobileOverlay.classList.contains('active') ? 'hidden' : '';
        });
    }

    async function fetchInventoryData() {
        const carGrid = document.getElementById('carGrid');
        try {
            const querySnapshot = await getDocs(collection(db, "inventory"));
            masterInventory = [];
            querySnapshot.forEach((doc) => {
                masterInventory.push({ id: doc.id, ...doc.data() });
            });
            renderInventory(masterInventory);
        } catch (error) {
            console.error("Database Error:", error);
            if (carGrid) {
                carGrid.innerHTML = `<div class="error-msg">Failed to load collection. Please refresh.</div>`;
            }
        }
    }

    async function renderInventory(cars) {
        const carGrid = document.getElementById('carGrid');
        if (!carGrid) return;

        if (cars.length === 0) {
            carGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 50px; color: #666;">
                No vehicles match your criteria.
            </p>`;
            return;
        }

        const currency = await getDisplayCurrency();

        carGrid.innerHTML = cars.map(car => `
            <div class="car-card">
                <img src="${car.images && car.images[0] ? car.images[0] : ''}" 
                     alt="${car.make} ${car.model}">
                <div class="car-content">
                    <span class="gold-text">${car.condition || 'Exotic'}</span>
                    <h3>${car.year || ''} ${car.make} ${car.model}</h3>
                    
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
                        <span><i class="fa fa-gas-pump"></i> ${car.fuelType || 'Petrol'}</span>
                    </div>
                    <a href="car-detail.html?id=${car.id}" class="car-view-btn">View Specification</a>
                </div>
            </div>
        `).join('');
    }

    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const makeInput = document.getElementById('filterMake').value.toLowerCase();
            const modelInput = document.getElementById('filterModel').value.toLowerCase();
            const budgetInput = parseFloat(document.getElementById('filterBudget').value) || Infinity;

            const filtered = masterInventory.filter(car => {
                const matchesMake = (car.make || "").toLowerCase().includes(makeInput);
                const matchesModel = (car.model || "").toLowerCase().includes(modelInput);
                const matchesBudget = Number(car.price || 0) <= budgetInput;
                return matchesMake && matchesModel && matchesBudget;
            });

            renderInventory(filtered);
            document.getElementById('inventory')?.scrollIntoView({ behavior: 'smooth' });
        });
    }

    const authOverlay = document.getElementById('authModalOverlay');
    const modalClose = document.getElementById('modalClose');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    function openAuthModal(tab = 'login') {

        if (hamburger) hamburger.classList.remove('active');
        if (mobileOverlay) mobileOverlay.classList.remove('active');
        body.style.overflow = '';

        authOverlay.classList.add('active');
        switchTab(tab);
    }

    function switchTab(tab) {
        tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
        loginForm.classList.toggle('active', tab === 'login');
        signupForm.classList.toggle('active', tab === 'signup');
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest(".login-trigger") || e.target.closest(".signup-trigger")) {
            e.preventDefault();
            const trigger = e.target.closest(".login-trigger, .signup-trigger");
            const startTab = trigger.classList.contains('signup-trigger') ? 'signup' : 'login';
            openAuthModal(startTab);
        }
    });

    if (modalClose) {
        modalClose.addEventListener('click', () => {
            authOverlay.classList.remove('active');
        });
    }

    tabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signupFullName').value;
            const email = document.getElementById('signupEmail').value;
            const pass = document.getElementById('signupPassword').value;
            const confirmPass = document.getElementById('signupConfirmPassword').value;

            if (pass !== confirmPass) {
                alert("Passwords do not match.");
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    fullName: name,
                    email: email,
                    createdAt: new Date().toISOString()
                });
                authOverlay.classList.remove('active');
            } catch (error) {
                alert(error.message);
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;

            try {
                await signInWithEmailAndPassword(auth, email, pass);
                authOverlay.classList.remove('active');
            } catch (error) {
                alert("Invalid credentials.");
            }
        });
    }

    document.querySelector('.social-btn.google')?.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            await setDoc(doc(db, "users", user.uid), {
                fullName: user.displayName,
                email: user.email,
                lastLogin: new Date().toISOString()
            }, { merge: true });
            authOverlay.classList.remove('active');
        } catch (error) {
            console.error(error);
        }
    });

    function updateNavbar(user) {
        const guestItems = document.querySelectorAll(".auth-guest");
        const desktopNav = document.getElementById("desktop-nav");
        const mobileNavList = document.getElementById("mobile-nav-links");

        guestItems.forEach(item => item.style.display = user ? "none" : "block");
        document.querySelectorAll(".dynamic-auth-item").forEach(el => el.remove());

        if (user) {
            const dashboardLink = `<li class="dynamic-auth-item"><a href="dashboard.html">Dashboard</a></li>`;
            const logoutLink = `<li class="dynamic-auth-item"><a href="#" id="logoutBtn" style="color:#ff4444 !important;">Logout</a></li>`;

            if (desktopNav) {
                desktopNav.insertAdjacentHTML('beforeend', dashboardLink);
                desktopNav.insertAdjacentHTML('beforeend', logoutLink);
            }
            if (mobileNavList) {
                mobileNavList.insertAdjacentHTML('beforeend', dashboardLink);
                mobileNavList.insertAdjacentHTML('beforeend', logoutLink);
            }

            const logoutBtn = document.getElementById("logoutBtn");
            if (logoutBtn) {
                logoutBtn.onclick = async (e) => {
                    e.preventDefault();
                    if (confirm("Sign out?")) {
                        await signOut(auth);
                        window.location.reload();
                    }
                };
            }
        }
    }

    onAuthStateChanged(auth, (user) => {
        updateNavbar(user);
        fetchInventoryData(); 
    });
});