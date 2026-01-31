import { app, db, auth } from "./firebase.js";

import { 
    getFirestore, doc, getDoc, setDoc, deleteDoc, collection, query, where, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth, onAuthStateChanged, signOut, sendPasswordResetEmail, sendEmailVerification, deleteUser 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const defaults = {
  pageTitle: "Dashboard",
  heroSubtitle: "Your Premium Experience",
  lblStatSaved: "Saved Vehicles",
  lblStatApp: "Applications",
  lblStatMember: "Membership Level",
  lblLoc: "Location",
  lblCur: "Preferred Currency",
  lblPh: "Phone",
  lblJoin: "Member Since",
  navHome: "Home",
  navSaved: "Saved",
  navFinance: "Finance",
  navProfile: "Profile",
  secLblAcc: "Account",
  secTitAcc: "Profile",
  secLblVeh: "Vehicles",
  secTitVeh: "Saved Vehicles",
  secLblFin: "Finance",
  secTitFin: "Applications",
  editBtnTxt: "Edit Profile",
  viewBtnTxt: "View",
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

document.addEventListener('DOMContentLoaded', () => {
    const editModal = document.getElementById('editModal');
    const editForm = document.getElementById('editForm');
    const cancelEdit = document.getElementById('cancelEdit');

    if (cancelEdit) cancelEdit.addEventListener('click', () => editModal.style.display = 'none');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await populateDashboard(user);
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

            document.getElementById('labelLoc').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${data.lblLoc}`;
            document.getElementById('labelCur').innerHTML = `<i class="fas fa-coins"></i> ${data.lblCur}`;
            document.getElementById('labelPh').innerHTML = `<i class="fas fa-phone"></i> ${data.lblPh}`;
            document.getElementById('labelJoin').innerHTML = `<i class="fas fa-calendar-alt"></i> ${data.lblJoin}`;

            document.getElementById('navHome').textContent = data.navHome;
            document.getElementById('navSaved').textContent = data.navSaved;
            document.getElementById('navFinance').textContent = data.navFinance;
            document.getElementById('navProfile').textContent = data.navProfile;

            document.getElementById('sectionLabelAccount').textContent = data.secLblAcc;
            document.getElementById('sectionTitleAccount').textContent = data.secTitAcc;
            document.getElementById('sectionLabelVehicles').textContent = data.secLblVeh;
            document.getElementById('sectionTitleVehicles').textContent = data.secTitVeh;
            document.getElementById('sectionLabelFinance').textContent = data.secLblFin;
            document.getElementById('sectionTitleFinance').textContent = data.secTitFin;

            document.getElementById('editProfileBtn').textContent = data.editBtnTxt;
            document.getElementById('profileEmail').textContent = user.email || "";
            document.getElementById('profileLocation').textContent = userData.location || "";
            document.getElementById('profileCurrency').textContent = userData.preferredCurrency || "USD";
            document.getElementById('profilePhone').textContent = userData.phone || "";
            document.getElementById('statMemberLevel').textContent = userData.membership || data.membershipDefault;

            const statusEl = document.getElementById('accountStatus');
            if (statusEl) {
                statusEl.textContent = userData.status || data.statusDefault;
                statusEl.style.color = userData.statusColor || data.statusColorDefault;
            }

            if (user.metadata?.creationTime) {
                document.getElementById('profileDate').textContent = 
                    new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            }

            const avatarContainer = document.getElementById('avatarContainer');
            const avatarUrl = userData.profilePic || user.photoURL;
            avatarContainer.innerHTML = avatarUrl 
                ? `<img src="${avatarUrl}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                : `<i class="fas fa-user-circle" style="font-size:4rem;color:#ccc;"></i>`;

            loadSavedVehiclesRealtime(user.uid, data);
            loadFinanceApplicationsRealtime(user.uid, data);

        } catch (err) {
            console.error("Dashboard error:", err);
        }
    }

    function setupSecurityFeatures(user) {
        if (user.metadata.lastSignInTime) {
            const lastLogin = new Date(user.metadata.lastSignInTime).toLocaleString();
            document.getElementById('lastLoginInfo').textContent = lastLogin;
        }

        const statusEl = document.getElementById('emailVerificationStatus');
        const verifyBtn = document.getElementById('verifyEmailBtn');
        
        if (user.emailVerified) {
            statusEl.textContent = "Verified";
            statusEl.style.color = "var(--gold)";
            if (verifyBtn) verifyBtn.style.display = 'none';
        } else {
            statusEl.textContent = "Not Verified";
            statusEl.style.color = "#ff4444";
        }

        verifyBtn?.addEventListener('click', async () => {
            try {
                await sendEmailVerification(user);
                alert("Verification email sent! Please check your inbox.");
            } catch (err) {
                alert("Error sending email: " + err.message);
            }
        });

        document.getElementById('changePasswordBtn')?.addEventListener('click', async () => {
            try {
                await sendPasswordResetEmail(auth, user.email);
                alert("Password reset link sent to your email.");
            } catch (err) {
                alert("Error: " + err.message);
            }
        });

        document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
            const confirmDelete = confirm("WARNING: This is permanent. Are you absolutely sure you want to delete your account?");
            if (confirmDelete) {
                try {
                    await deleteDoc(doc(db, "users", user.uid));
                    await deleteUser(user);
                    alert("Account deleted successfully.");
                    window.location.href = "index.html";
                } catch (err) {
                    console.error(err);
                    alert("For security, you must have logged in recently to delete your account. Please log out and log back in, then try again.");
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
                container.innerHTML = `<div class="empty-state"><p>No saved vehicles yet</p></div>`;
                return;
            }

            snap.forEach(docSnap => {
                const car = docSnap.data();
                const card = document.createElement('div');
                card.className = 'car-card';
                card.innerHTML = `
                    <img src="${(car.images && car.images[0]) || car.image || ''}" alt="${car.make || ''}">
                    <div class="car-content">
                        <span class="gold-text">${car.condition || ''}</span>
                        <h3>${car.year || ''} ${car.make || ''} ${car.model || ''}</h3>
                        <div class="car-price">${formatPrice(car.price, currency)}</div>
                        <div style="display:flex; gap:0.8rem; margin-top:1rem;">
                            <a href="car-detail.html?id=${car.carId || ''}" class="btn-view">${data.viewBtnTxt}</a>
                            <button class="btn-remove" data-id="${docSnap.id}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>`;
                container.appendChild(card);
            });

            container.querySelectorAll('.btn-remove').forEach(btn => {
                btn.onclick = async () => {
                    if (confirm("Remove?")) await deleteDoc(doc(db, "wishlist", btn.dataset.id));
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
                container.innerHTML = `<div class="empty-state"><p>No applications yet</p></div>`;
                return;
            }

            snap.forEach(docSnap => {
                const app = docSnap.data();
                const item = document.createElement('div');
                item.className = 'finance-item';
                item.style.cursor = 'pointer';
                item.innerHTML = `
                    <div>
                        <strong style="display:block;">${app.vehicleName || ''}</strong>
                        <small>Ref: ${docSnap.id.toUpperCase()}</small>
                    </div>
                    <div style="text-align:right;">
                        <span style="color:${app.statusColor || data.statusColorDefault}; font-weight:600;">${app.status || data.statusDefault}</span>
                        <small style="display:block;">${app.date || ''}</small>
                    </div>`;
                item.onclick = () => window.location.href = `application-detail.html?id=${docSnap.id}`;
                container.appendChild(item);
            });
        });
    }

    // UPDATED: Pre-fill modal fields when clicking Edit Profile
    document.getElementById('editProfileBtn')?.addEventListener('click', () => {
        document.getElementById('editLocation').value = document.getElementById('profileLocation').textContent;
        document.getElementById('editPhone').value = document.getElementById('profilePhone').textContent;
        document.getElementById('editCurrency').value = document.getElementById('profileCurrency').textContent;
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
            const updates = {
                location: document.getElementById('editLocation').value.trim(),
                phone: document.getElementById('editPhone').value.trim(),
                preferredCurrency: document.getElementById('editCurrency').value.trim().toUpperCase()
            };
            await setDoc(doc(db, "users", user.uid), updates, { merge: true });
            editModal.style.display = 'none';
            // Smooth refresh to show new data
            populateDashboard(user); 
        } catch (err) {
            console.error("Update failed:", err);
            alert("Failed to save changes.");
        } finally {
            saveBtn.textContent = "Save Changes";
            saveBtn.disabled = false;
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = "index.html";
    });
});