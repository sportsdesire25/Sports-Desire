// Sports Desire - Authentication & Dual-Persona Engine (Players/Parents vs Organisers)
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

let auth = null;
let googleProvider = null;
let confirmationResult = null;
let recaptchaVerifier = null;
let isRegisterMode = false;
let currentRole = 'player'; // 'player' or 'organizer'
let currentUser = null;

// Initialize Firebase if credentials provided
if (isFirebaseConfigured()) {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
    const { 
      getAuth, 
      onAuthStateChanged, 
      GoogleAuthProvider,
      RecaptchaVerifier
    } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');

    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();

    onAuthStateChanged(auth, (user) => {
      if (user) {
        // Read role from local storage or default to current
        const savedRole = localStorage.getItem(`sports_desire_role_${user.uid}`) || currentRole;
        user.role = savedRole;
        currentUser = user;
      } else {
        currentUser = null;
      }
      updateAuthUI(currentUser);
    });

  } catch (error) {
    console.error("Error initializing Firebase Auth:", error);
  }
} else {
  // Simulated fallback user
  const savedSimulatedUser = localStorage.getItem('sports_desire_auth_user');
  if (savedSimulatedUser) {
    try {
      currentUser = JSON.parse(savedSimulatedUser);
      updateAuthUI(currentUser);
    } catch (e) {
      currentUser = null;
      updateAuthUI(null);
    }
  } else {
    currentUser = null;
    updateAuthUI(null);
  }
}

// DOM Setup
document.addEventListener('DOMContentLoaded', () => {
  setupAuthEventListeners();
  setupRoleSelector();
  lucide.createIcons();
});

// Role Selector Logic
function setupRoleSelector() {
  const playerPill = document.getElementById('role-pill-player');
  const organizerPill = document.getElementById('role-pill-organizer');
  const helpText = document.getElementById('role-help-text');

  if (playerPill && organizerPill) {
    playerPill.addEventListener('click', () => {
      currentRole = 'player';
      playerPill.classList.add('active');
      organizerPill.classList.remove('active');
      if (helpText) {
        helpText.textContent = "Free player account: Search calendars, save bookmarks & track registrations.";
      }
    });

    organizerPill.addEventListener('click', () => {
      currentRole = 'organizer';
      organizerPill.classList.add('active');
      playerPill.classList.remove('active');
      if (helpText) {
        helpText.textContent = "Organiser portal: List official tournaments & manage events.";
      }
    });
  }
}

function setupAuthEventListeners() {
  // Modal open / close
  const openBtn = document.getElementById('nav-auth-btn');
  const closeBtn = document.getElementById('auth-modal-close');
  const overlay = document.getElementById('auth-modal');

  if (openBtn) openBtn.addEventListener('click', () => openAuthModal());
  if (closeBtn) closeBtn.addEventListener('click', () => closeAuthModal());
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAuthModal();
    });
  }

  // Switch between Email & Phone tabs
  const tabEmail = document.getElementById('auth-tab-email');
  const tabPhone = document.getElementById('auth-tab-phone');
  const formEmail = document.getElementById('auth-email-form');
  const formPhone = document.getElementById('auth-phone-form');

  if (tabEmail && tabPhone) {
    tabEmail.addEventListener('click', () => {
      tabEmail.classList.add('active');
      tabPhone.classList.remove('active');
      formEmail.style.display = 'block';
      formPhone.style.display = 'none';
      clearAuthMessage();
    });

    tabPhone.addEventListener('click', () => {
      tabPhone.classList.add('active');
      tabEmail.classList.remove('active');
      formEmail.style.display = 'none';
      formPhone.style.display = 'block';
      clearAuthMessage();
      initRecaptcha();
    });
  }

  // Toggle Login vs Register in Email Form
  const toggleModeBtn = document.getElementById('auth-toggle-mode');
  if (toggleModeBtn) {
    toggleModeBtn.addEventListener('click', () => {
      isRegisterMode = !isRegisterMode;
      const submitBtn = document.getElementById('auth-email-submit');
      const title = document.getElementById('auth-email-mode-title');
      const nameGroup = document.getElementById('auth-name-group');

      if (isRegisterMode) {
        if (title) title.textContent = "Create an Account";
        if (submitBtn) submitBtn.textContent = "Create Account";
        toggleModeBtn.innerHTML = 'Already have an account? <span style="color: var(--primary-emerald); text-decoration: underline;">Sign In</span>';
        if (nameGroup) nameGroup.style.display = 'block';
      } else {
        if (title) title.textContent = "Sign In with Email";
        if (submitBtn) submitBtn.textContent = "Sign In";
        toggleModeBtn.innerHTML = 'Don\'t have an account? <span style="color: var(--primary-emerald); text-decoration: underline;">Register</span>';
        if (nameGroup) nameGroup.style.display = 'none';
      }
      clearAuthMessage();
    });
  }

  // Google Sign In
  const googleBtn = document.getElementById('auth-google-btn');
  if (googleBtn) googleBtn.addEventListener('click', handleGoogleSignIn);

  // Email Form Submit
  if (formEmail) {
    formEmail.addEventListener('submit', (e) => {
      e.preventDefault();
      handleEmailAuth();
    });
  }

  // Phone Send & Verify OTP
  const sendOtpBtn = document.getElementById('auth-send-otp-btn');
  if (sendOtpBtn) sendOtpBtn.addEventListener('click', handleSendPhoneOtp);

  const verifyOtpBtn = document.getElementById('auth-verify-otp-btn');
  if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', handleVerifyPhoneOtp);

  // Navbar User Profile click -> Opens Dashboard
  const userProfilePill = document.getElementById('nav-user-profile');
  if (userProfilePill) {
    userProfilePill.addEventListener('click', (e) => {
      // If clicked logout specifically
      if (e.target.closest('#nav-user-logout')) {
        handleSignOut();
        return;
      }
      openUserDashboard();
    });
  }
}

// Google Sign-In
async function handleGoogleSignIn() {
  clearAuthMessage();
  if (!isFirebaseConfigured() || !auth) {
    showSimulatedSuccess({
      displayName: currentRole === 'player' ? "Arun Sharma (Player)" : "Assam Tennis Desk (Organiser)",
      email: currentRole === 'player' ? "arun.sharma@example.com" : "organizer@assamtennis.org",
      photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
      role: currentRole,
      provider: "Google"
    });
    return;
  }

  try {
    const { signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      localStorage.setItem(`sports_desire_role_${result.user.uid}`, currentRole);
      result.user.role = currentRole;
    }
    closeAuthModal();
  } catch (error) {
    console.error("Google Auth error:", error);
    showAuthMessage(getFriendlyErrorMessage(error.code, error.message), "error");
  }
}

// Email Auth
async function handleEmailAuth() {
  clearAuthMessage();
  const email = document.getElementById('auth-email-input').value.trim();
  const password = document.getElementById('auth-password-input').value;
  const name = document.getElementById('auth-name-input')?.value.trim() || (currentRole === 'player' ? "Player" : "Organiser");

  if (!email || !password) {
    showAuthMessage("Please fill in both email and password.", "error");
    return;
  }

  if (!isFirebaseConfigured() || !auth) {
    showSimulatedSuccess({
      displayName: name || email.split('@')[0],
      email: email,
      photoURL: null,
      role: currentRole,
      provider: "Email"
    });
    return;
  }

  try {
    const { 
      signInWithEmailAndPassword, 
      createUserWithEmailAndPassword, 
      updateProfile 
    } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');

    if (isRegisterMode) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (name) {
        await updateProfile(userCredential.user, { displayName: name });
      }
      localStorage.setItem(`sports_desire_role_${userCredential.user.uid}`, currentRole);
      userCredential.user.role = currentRole;
    } else {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const savedRole = localStorage.getItem(`sports_desire_role_${userCredential.user.uid}`) || currentRole;
      userCredential.user.role = savedRole;
    }
    closeAuthModal();
  } catch (error) {
    console.error("Email Auth error:", error);
    showAuthMessage(getFriendlyErrorMessage(error.code, error.message), "error");
  }
}

// reCAPTCHA Init
async function initRecaptcha() {
  if (!isFirebaseConfigured() || !auth || recaptchaVerifier) return;
  try {
    const { RecaptchaVerifier } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
    recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible'
    });
  } catch (err) {
    console.warn("reCAPTCHA notice:", err);
  }
}

// Phone Send OTP
async function handleSendPhoneOtp() {
  clearAuthMessage();
  const rawPhone = document.getElementById('auth-phone-input').value.trim();
  if (!rawPhone || rawPhone.length < 10) {
    showAuthMessage("Please enter a valid 10-digit mobile number.", "error");
    return;
  }

  const fullPhone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone.replace(/\D/g, '')}`;

  if (!isFirebaseConfigured() || !auth) {
    document.getElementById('auth-phone-step1').style.display = 'none';
    document.getElementById('auth-phone-step2').style.display = 'block';
    showAuthMessage("Demo Mode: OTP sent! (Use code: 123456)", "success");
    return;
  }

  try {
    await initRecaptcha();
    const { signInWithPhoneNumber } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
    confirmationResult = await signInWithPhoneNumber(auth, fullPhone, recaptchaVerifier);
    document.getElementById('auth-phone-step1').style.display = 'none';
    document.getElementById('auth-phone-step2').style.display = 'block';
    showAuthMessage(`OTP sent to ${fullPhone}! Enter the 6-digit code below.`, "success");
  } catch (error) {
    console.error("Phone OTP send error:", error);
    showAuthMessage(getFriendlyErrorMessage(error.code, error.message), "error");
  }
}

// Phone Verify OTP
async function handleVerifyPhoneOtp() {
  clearAuthMessage();
  const otp = document.getElementById('auth-otp-input').value.trim();
  if (!otp || otp.length < 6) {
    showAuthMessage("Please enter the 6-digit verification code.", "error");
    return;
  }

  if (!isFirebaseConfigured() || !auth) {
    const rawPhone = document.getElementById('auth-phone-input').value.trim();
    showSimulatedSuccess({
      displayName: `${currentRole === 'player' ? 'Player' : 'Organiser'} (${rawPhone.slice(-4)})`,
      email: null,
      phoneNumber: rawPhone,
      photoURL: null,
      role: currentRole,
      provider: "Phone"
    });
    return;
  }

  try {
    if (!confirmationResult) {
      showAuthMessage("Session expired. Please request a new OTP.", "error");
      return;
    }
    const userCredential = await confirmationResult.confirm(otp);
    if (userCredential.user) {
      localStorage.setItem(`sports_desire_role_${userCredential.user.uid}`, currentRole);
      userCredential.user.role = currentRole;
    }
    closeAuthModal();
  } catch (error) {
    console.error("Phone OTP verify error:", error);
    showAuthMessage(getFriendlyErrorMessage(error.code, error.message), "error");
  }
}

// Sign Out
export async function handleSignOut() {
  if (isFirebaseConfigured() && auth) {
    try {
      const { signOut } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error:", e);
    }
  } else {
    localStorage.removeItem('sports_desire_auth_user');
    currentUser = null;
    updateAuthUI(null);
  }
}

// Simulated Demo
function showSimulatedSuccess(userObj) {
  localStorage.setItem('sports_desire_auth_user', JSON.stringify(userObj));
  currentUser = userObj;
  updateAuthUI(userObj);
  closeAuthModal();
  const roleName = userObj.role === 'player' ? 'Player / Parent' : 'Tournament Organiser';
  alert(`✅ Signed in as ${userObj.displayName || userObj.email || userObj.phoneNumber} (${roleName})!\n\nTo connect live Google & SMS Phone OTP, add your Firebase keys in firebaseConfig.js.`);
}

// Update UI (Navbar, Hero, Mobile Bottom Nav based on Role)
function updateAuthUI(user) {
  const authBtn = document.getElementById('nav-auth-btn');
  const userProfile = document.getElementById('nav-user-profile');
  const userName = document.getElementById('nav-user-name');
  const userAvatar = document.getElementById('nav-user-avatar');
  const heroOrganizerBox = document.getElementById('hero-organizer-box');
  const heroPlayerBox = document.getElementById('hero-player-box');
  const mobileProfileLabel = document.getElementById('mobile-profile-label');
  const mobileEntriesLabel = document.getElementById('mobile-entries-label');

  if (user) {
    if (authBtn) authBtn.style.display = 'none';
    if (userProfile) userProfile.style.display = 'flex';
    if (userName) userName.textContent = user.displayName || user.email?.split('@')[0] || user.phoneNumber || "My Account";
    if (userAvatar) {
      if (user.photoURL) {
        userAvatar.src = user.photoURL;
      } else {
        const bg = user.role === 'organizer' ? 'FFB300' : '00E676';
        userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || 'Player')}&background=${bg}&color=000&bold=true`;
      }
    }
    if (mobileProfileLabel) mobileProfileLabel.textContent = "Account";

    // Persona-specific Visibility (Fee Privacy)
    if (user.role === 'player') {
      if (heroOrganizerBox) heroOrganizerBox.style.display = 'none';
      if (heroPlayerBox) heroPlayerBox.style.display = 'block';
      if (mobileEntriesLabel) mobileEntriesLabel.textContent = "My Entries";
    } else {
      // Organiser
      if (heroOrganizerBox) heroOrganizerBox.style.display = 'block';
      if (heroPlayerBox) heroPlayerBox.style.display = 'none';
      if (mobileEntriesLabel) mobileEntriesLabel.textContent = "My Events";
    }
  } else {
    if (authBtn) authBtn.style.display = 'inline-flex';
    if (userProfile) userProfile.style.display = 'none';
    if (heroOrganizerBox) heroOrganizerBox.style.display = 'block';
    if (heroPlayerBox) heroPlayerBox.style.display = 'none';
    if (mobileProfileLabel) mobileProfileLabel.textContent = "Sign In";
    if (mobileEntriesLabel) mobileEntriesLabel.textContent = "My Entries";
  }
}

// User Dashboard Modal (Displays Personal History)
export function openUserDashboard() {
  if (!currentUser) {
    openAuthModal();
    return;
  }

  const modal = document.getElementById('user-dashboard-modal');
  const nameEl = document.getElementById('dash-name');
  const avatarEl = document.getElementById('dash-avatar');
  const roleBadge = document.getElementById('dash-role-badge');
  const playerSection = document.getElementById('dash-player-section');
  const organizerSection = document.getElementById('dash-organizer-section');
  const playerList = document.getElementById('dash-player-history-list');
  const organizerList = document.getElementById('dash-organizer-history-list');

  if (nameEl) nameEl.textContent = currentUser.displayName || currentUser.email || currentUser.phoneNumber || "User";
  if (avatarEl) {
    avatarEl.src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || 'Player')}&background=00E676&color=000&bold=true`;
  }

  if (currentUser.role === 'player') {
    if (roleBadge) {
      roleBadge.textContent = "Player / Parent";
      roleBadge.className = "badge badge-player";
    }
    if (playerSection) playerSection.style.display = 'block';
    if (organizerSection) organizerSection.style.display = 'none';

    // Populate player entries from localStorage
    const savedEntries = JSON.parse(localStorage.getItem('sports_desire_player_entries') || '[]');
    if (playerList) {
      if (savedEntries.length === 0) {
        playerList.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
            <i data-lucide="calendar-x" style="width: 36px; height: 36px; margin-bottom: 0.5rem; stroke: var(--text-dim);"></i>
            <p style="font-size: 0.9rem;">You haven't entered any tournaments yet.</p>
            <p style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;">Click "WhatsApp Registration" on any tournament to register and track it here!</p>
          </div>
        `;
      } else {
        playerList.innerHTML = savedEntries.map(e => `
          <div class="dash-history-card">
            <div>
              <div class="dash-card-title">${e.title}</div>
              <div class="dash-card-meta">${e.sport} • ${e.city || 'Assam'} • Registered on ${e.dateRegistered || 'Recent'}</div>
            </div>
            <span class="status-badge status-approved">Registered</span>
          </div>
        `).join('');
      }
    }
  } else {
    // Organiser Dashboard
    if (roleBadge) {
      roleBadge.textContent = "Tournament Organiser";
      roleBadge.className = "badge badge-organizer";
    }
    if (playerSection) playerSection.style.display = 'none';
    if (organizerSection) organizerSection.style.display = 'block';

    // Populate hosted tournaments
    const allTournaments = JSON.parse(localStorage.getItem('sports_desire_tournaments') || '[]');
    const hostedList = allTournaments.filter(t => t.id && (t.id.startsWith('tourn-') || t.isVerified));
    if (organizerList) {
      if (hostedList.length === 0) {
        organizerList.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
            <p style="font-size: 0.9rem;">You haven't hosted any tournaments yet.</p>
          </div>
        `;
      } else {
        organizerList.innerHTML = hostedList.slice(0, 5).map(t => `
          <div class="dash-history-card">
            <div>
              <div class="dash-card-title">${t.title}</div>
              <div class="dash-card-meta">${t.sport} • ${t.city} • ${t.startDate}</div>
            </div>
            <span class="status-badge status-approved">Verified & Live</span>
          </div>
        `).join('');
      }
    }
  }

  if (modal) modal.classList.add('active');
  lucide.createIcons();
}

// Track Player Registration on WhatsApp Click
export function trackPlayerEntry(tournamentId) {
  const allTournaments = JSON.parse(localStorage.getItem('sports_desire_tournaments') || '[]');
  const tourn = allTournaments.find(t => t.id === tournamentId) || { id: tournamentId, title: "Tournament", sport: "Sports", city: "Assam" };
  
  let entries = JSON.parse(localStorage.getItem('sports_desire_player_entries') || '[]');
  if (!entries.some(e => e.id === tournamentId)) {
    entries.unshift({
      id: tournamentId,
      title: tourn.title,
      sport: tourn.sport,
      city: tourn.city,
      dateRegistered: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      timestamp: Date.now()
    });
    localStorage.setItem('sports_desire_player_entries', JSON.stringify(entries));
  }
}

// Handlers for Mobile & CTA clicks
export function handleHostClick() {
  if (currentUser && currentUser.role === 'player') {
    alert("ℹ️ You are signed in as a Player/Parent.\n\nHosting tournaments (₹499 listing fee) is for Tournament Organizers. To host an event, please sign in with an Organiser account.");
    return;
  }
  const hostModal = document.getElementById('host-modal');
  if (hostModal) hostModal.classList.add('active');
}

export function handleProfileClick() {
  if (currentUser) {
    openUserDashboard();
  } else {
    openAuthModal();
  }
}

// UI Helpers
export function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.add('active');
    clearAuthMessage();
    const step1 = document.getElementById('auth-phone-step1');
    const step2 = document.getElementById('auth-phone-step2');
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
  }
}

export function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('active');
}

function showAuthMessage(msg, type = "error") {
  const box = document.getElementById('auth-message-box');
  if (!box) return;
  box.textContent = msg;
  box.style.display = 'block';
  if (type === "error") {
    box.style.background = 'rgba(239, 68, 68, 0.15)';
    box.style.color = '#EF4444';
    box.style.border = '1px solid rgba(239, 68, 68, 0.3)';
  } else {
    box.style.background = 'rgba(0, 230, 118, 0.15)';
    box.style.color = 'var(--primary-emerald)';
    box.style.border = '1px solid rgba(0, 230, 118, 0.3)';
  }
}

function clearAuthMessage() {
  const box = document.getElementById('auth-message-box');
  if (box) {
    box.textContent = '';
    box.style.display = 'none';
  }
}

function getFriendlyErrorMessage(code, defaultMsg) {
  switch (code) {
    case 'auth/user-not-found':
      return 'No account found with this email. Please click "Register" to create one.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-phone-number':
      return 'Invalid mobile number. Please check the digits and try again.';
    default:
      return defaultMsg || 'Authentication error. Please check your credentials.';
  }
}

// Make accessible to global scope
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.openUserDashboard = openUserDashboard;
window.handleHostClick = handleHostClick;
window.handleProfileClick = handleProfileClick;
window.handleSignOut = handleSignOut;
window.trackPlayerEntry = trackPlayerEntry;
