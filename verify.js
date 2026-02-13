import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getAuth, 
  signInWithEmailAndPassword 
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

function showLoader() {
  document.getElementById('loader').style.display = 'flex';
}

function hideLoader() {
  document.getElementById('loader').style.display = 'none';
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  document.getElementById('successMessage').style.display = 'none';
}

function showSuccess(message) {
  const successDiv = document.getElementById('successMessage');
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  document.getElementById('errorMessage').style.display = 'none';
}

// Pre-fill email from URL parameter if available
const urlParams = new URLSearchParams(window.location.search);
const emailParam = urlParams.get('email');
if (emailParam) {
  document.getElementById('email').value = decodeURIComponent(emailParam);
}

document.getElementById('verifyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const code = document.getElementById('code').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !code || !password) {
    showError('Please fill in all fields.');
    return;
  }

  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    showError('Verification code must be exactly 6 digits.');
    return;
  }

  showLoader();

  try {
    console.log('Searching for user with email:', email);
    
    // Find user by email
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    
    let querySnapshot;
    try {
      querySnapshot = await getDocs(q);
    } catch (permissionError) {
      console.error('Firestore permission error:', permissionError);
      hideLoader();
      showError('⚠️ Database permission error. Please contact support.');
      return;
    }

    if (querySnapshot.empty) {
      hideLoader();
      showError('No account found with this email address.');
      return;
    }

    let userDoc = null;
    let userId = null;

    querySnapshot.forEach((doc) => {
      userDoc = doc.data();
      userId = doc.id;
    });

    console.log('User found:', userId);

    // Check if code matches
    if (userDoc.verificationCode !== code) {
      hideLoader();
      showError('❌ Invalid verification code. Please check and try again.');
      return;
    }

    // Check if code expired
    if (userDoc.codeExpiresAt) {
      const expiresAt = new Date(userDoc.codeExpiresAt);
      if (expiresAt < new Date()) {
        hideLoader();
        showError('⏰ Verification code has expired. Please contact support.');
        return;
      }
    }

    console.log('Code matched! Attempting to sign in...');

    // ✅ STEP 1: Sign in with Firebase Auth using the password
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('User signed in successfully!');
    } catch (authError) {
      console.error('Sign in error:', authError);
      hideLoader();
      if (authError.code === 'auth/wrong-password') {
        showError('❌ Incorrect password. Please try again.');
      } else if (authError.code === 'auth/user-not-found') {
        showError('❌ Account not found. Please sign up first.');
      } else if (authError.code === 'auth/too-many-requests') {
        showError('⚠️ Too many failed attempts. Please try again later.');
      } else {
        showError('❌ Sign in failed: ' + authError.message);
      }
      return;
    }

    // ✅ STEP 2: Update verification status in Firestore
    const userDocRef = doc(db, "users", userId);
    
    try {
      await updateDoc(userDocRef, {
        emailVerified: true,
        codeVerified: true,
        verifiedAt: new Date().toISOString()
      });
      console.log('Verification status updated in Firestore!');
    } catch (updateError) {
      console.error('Update error:', updateError);
      // Don't fail here - user is already signed in
      console.warn('Warning: Could not update Firestore, but user is authenticated');
    }

    hideLoader();
    showSuccess('🎉 Account verified successfully! Redirecting to dashboard...');

    // ✅ STEP 3: Redirect to dashboard (user is now logged in)
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);

  } catch (error) {
    console.error('Verification error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    hideLoader();
    showError('❌ Verification failed: ' + error.message);
  }
});

// Auto-format code input (only allow numbers)
document.getElementById('code').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, '');
});