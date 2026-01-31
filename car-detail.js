import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged, signOut 
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

async function getDisplayCurrency() {
    const user = auth.currentUser;
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) return userDoc.data().preferredCurrency || "USD";
        } catch (err) { console.error("Currency fetch error:", err); }
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

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const carId = params.get('id');

    if (!carId) {
        window.location.href = 'index.html';
        return;
    }

    setupNavigationUI();

    onAuthStateChanged(auth, async (user) => {
        updateNavbar(user);
        await loadCarDetails(carId);
    });

    async function loadCarDetails(id) {
        try {
            const inventoryRef = doc(db, "inventory", id);
            const carRef = doc(db, "car", id);

            const [inventorySnap, carSnap] = await Promise.all([
                getDoc(inventoryRef),
                getDoc(carRef)
            ]);
            
            if (!inventorySnap.exists() && !carSnap.exists()) {
                document.getElementById('detail-main').innerHTML = `<h2 style="text-align:center; padding: 50px; color:white;">Vehicle Not Found</h2>`;
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
                    document.getElementById('authModalOverlay').classList.add('active');
                } else {
                    window.location.href = `checkout.html?id=${id}&amount=${car.price}`;
                }
            };

            document.getElementById('loader').style.display = 'none';
            document.getElementById('content-wrapper').style.display = 'block';

            setupSaveAction(id, car);

        } catch (err) {
            console.error("Error loading merged car data:", err);
            document.getElementById('loader').innerHTML = "Error loading collection details.";
        }
    }

    function setupSaveAction(carId, carData) {
        const saveBtn = document.getElementById('saveToWishlistBtn');
        saveBtn.onclick = async () => {
            const user = auth.currentUser;
            if (!user) {
                document.getElementById('authModalOverlay').classList.add('active');
                return;
            }
            saveBtn.disabled = true;
            try {
                const q = query(collection(db, "wishlist"), where("userId", "==", user.uid), where("carId", "==", carId));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    alert("Already in your collection.");
                } else {
                    await addDoc(collection(db, "wishlist"), {
                        userId: user.uid,
                        carId: carId,
                        make: carData.make || '',
                        model: carData.model || '',
                        savedAt: new Date().toISOString()
                    });
                    alert("Vehicle saved!");
                    saveBtn.innerHTML = `<i class="fas fa-heart"></i> Saved`;
                }
            } catch (err) { console.error(err); }
            finally { saveBtn.disabled = false; }
        };
    }

    document.getElementById('shareAssetBtn').onclick = () => {
        if (navigator.share) {
            navigator.share({
                title: document.title,
                url: window.location.href
            }).catch(console.error);
        } else {
            alert("Link copied to clipboard: " + window.location.href);
            navigator.clipboard.writeText(window.location.href);
        }
    };

    function setupNavigationUI() {
        const hamburger = document.getElementById("hamburger");
        const mobileOverlay = document.getElementById("mobile-overlay");
        const authOverlay = document.getElementById("authModalOverlay");
        const modalClose = document.getElementById("modalClose");

        hamburger?.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            mobileOverlay.classList.toggle("active");
        });

        document.addEventListener("click", (e) => {
            if (e.target.closest(".login-trigger") || e.target.closest(".signup-trigger")) {
                e.preventDefault();
                authOverlay.classList.add("active");
            }
        });

        modalClose?.addEventListener("click", () => authOverlay.classList.remove("active"));
    }

    function updateNavbar(user) {
        const guestItems = document.querySelectorAll(".auth-guest");
        const desktopNav = document.getElementById("desktop-nav");
        const mobileNavList = document.getElementById("mobile-nav-links");

        guestItems.forEach(item => item.style.display = user ? "none" : "block");
        document.querySelectorAll(".dynamic-auth-item").forEach(el => el.remove());

        if (user) {
            const items = `<li class="dynamic-auth-item"><a href="dashboard.html">Dashboard</a></li>
                           <li class="dynamic-auth-item"><a href="#" id="logoutBtn" style="color:#ff4444;">Logout</a></li>`;
            desktopNav.insertAdjacentHTML('beforeend', items);
            mobileNavList.insertAdjacentHTML('beforeend', items);

            document.getElementById("logoutBtn").onclick = async () => {
                await signOut(auth);
                window.location.reload();
            };
        }
    }
});