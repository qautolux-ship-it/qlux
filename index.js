import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  collection, 
  getDocs, 
  getFirestore,
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
  return "USD";
}

function formatPrice(amount, currency = "USD") {
  return new Intl.NumberFormat(navigator.language || "en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number(amount || 0));
}

document.addEventListener("DOMContentLoaded", () => {
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
  }

  let allCars = [];

  async function fetchInventory() {
    const carGrid = document.getElementById("carGrid");
    if (!carGrid) return;

    try {
      const querySnapshot = await getDocs(collection(db, "car"));
      allCars = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();
        allCars.push({ id: doc.id, ...data });
      });

      renderCars(allCars);
    } catch (error) {
      console.error("Firebase Fetch Error:", error);
      carGrid.innerHTML = '<p style="text-align:center; color: #666; padding: 60px;">Unable to load inventory. Please try again later.</p>';
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
            <div class="car-price">${formatPrice(car.price, currency)}</div>
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
      const makeVal    = (document.getElementById("filterMake")?.value  || "").trim().toLowerCase();
      const modelVal   = (document.getElementById("filterModel")?.value || "").trim().toLowerCase();
      const budgetVal  = parseFloat(document.getElementById("filterBudget")?.value) || 0;

      const filtered = allCars.filter(car => {
        const matchesMake  = !makeVal  || (car.make || "").toLowerCase().includes(makeVal);
        const matchesModel = !modelVal || (car.model || "").toLowerCase().includes(modelVal);
        const matchesBudget = budgetVal <= 0 || Number(car.price || 0) <= budgetVal;

        return matchesMake && matchesModel && matchesBudget;
      });

      renderCars(filtered);

      const inventorySection = document.getElementById("inventory");
      if (inventorySection) {
        inventorySection.scrollIntoView({ behavior: "smooth" });
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
              window.location.href = "index.html";
            } catch (err) {
              console.error("Logout error:", err);
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

      if (password !== confirmPassword) {
        alert("Passwords don't match!");
        return;
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
          fullName: fullName || user.email.split("@")[0],
          phone: phone || "",
          email: user.email,
          createdAt: new Date().toISOString()
        });

        closeModal();
        window.location.href = "dashboard.html";
      } catch (error) {
        alert("Signup failed: " + error.message);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail")?.value.trim();
      const password = document.getElementById("loginPassword")?.value;

      try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal();
        window.location.href = "dashboard.html";
      } catch (error) {
        alert("Login failed. Check your credentials.");
      }
    });
  }

  const googleBtns = document.querySelectorAll(".social-btn.google");
  googleBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      const provider = new GoogleAuthProvider();
      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            fullName: user.displayName || user.email.split("@")[0],
            email: user.email,
            phone: "",
            photoURL: user.photoURL || "",
            createdAt: new Date().toISOString()
          });
        }
        closeModal();
        window.location.href = "dashboard.html";
      } catch (error) {
        if (error.code !== "auth/popup-closed-by-user") alert("Google sign-in failed.");
      }
    });
  });

  onAuthStateChanged(auth, (user) => {
    updateNavbar(user);
  });
});