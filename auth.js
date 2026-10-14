// Sports Desire - Authentication & Dual-Persona Engine (Players/Parents vs Organisers)
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

let auth = null;
let googleProvider = null;
let confirmationResult = null;
let recaptchaVerifier = null;
let isRegisterMode = false;
let currentRole = 'player'; // 'player' or 'organizer'
let currentUser = null;

// Expose Core Modal Handlers to Window Immediately (Zero Delay)
window.closeModal = function(modalId) {
  if (modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
  } else {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
};

window.openAuthModal = function(preferredRole) {
  if (preferredRole) {
    window.setAuthRole(preferredRole);
  }
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.add('active');
    clearAuthMessage();
    const notice = document.getElementById('auth-notice-banner');
    if (notice) notice.style.display = 'none';
    const step1 = document.getElementById('auth-phone-step1');
    const step2 = document.getElementById('auth-phone-step2');
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
  }
};

window.setAuthRole = function(role) {
  currentRole = role;
  const playerPill = document.getElementById('role-pill-player');
  const organizerPill = document.getElementById('role-pill-organizer');
  const helpText = document.getElementById('role-help-text');

  if (role === 'player') {
    if (playerPill) playerPill.classList.add('active');
    if (organizerPill) organizerPill.classList.remove('active');
    if (helpText) helpText.textContent = "Free player account: Search calendars, save bookmarks & track registrations.";
  } else {
    if (organizerPill) organizerPill.classList.add('active');
    if (playerPill) playerPill.classList.remove('active');
    if (helpText) helpText.textContent = "Organiser portal: List official tournaments & manage events.";
  }
};

window.setAuthTab = function(tab) {
  const tabEmail = document.getElementById('auth-tab-email');
  const tabPhone = document.getElementById('auth-tab-phone');
  const formEmail = document.getElementById('auth-email-form');
  const formPhone = document.getElementById('auth-phone-form');

  if (tab === 'email') {
    if (tabEmail) tabEmail.classList.add('active');
    if (tabPhone) tabPhone.classList.remove('active');
    if (formEmail) formEmail.style.display = 'block';
    if (formPhone) formPhone.style.display = 'none';
  } else {
    if (tabPhone) tabPhone.classList.add('active');
    if (tabEmail) tabEmail.classList.remove('active');
    if (formEmail) formEmail.style.display = 'none';
    if (formPhone) formPhone.style.display = 'block';
    initRecaptcha();
  }
  clearAuthMessage();
};

window.toggleAuthMode = function() {
  isRegisterMode = !isRegisterMode;
  const submitBtn = document.getElementById('auth-email-submit');
  const title = document.getElementById('auth-email-mode-title');
  const nameGroup = document.getElementById('auth-name-group');
  const toggleBtn = document.getElementById('auth-toggle-mode');

  if (isRegisterMode) {
    if (title) title.textContent = "Create an Account";
    if (submitBtn) submitBtn.textContent = "Create Account";
    if (toggleBtn) toggleBtn.innerHTML = 'Already have an account? <span style="color: var(--primary-emerald); text-decoration: underline;">Sign In</span>';
    if (nameGroup) nameGroup.style.display = 'block';
  } else {
    if (title) title.textContent = "Sign In with Email";
    if (submitBtn) submitBtn.textContent = "Sign In";
    if (toggleBtn) toggleBtn.innerHTML = 'Don\'t have an account? <span style="color: var(--primary-emerald); text-decoration: underline;">Register</span>';
    if (nameGroup) nameGroup.style.display = 'none';
  }
  clearAuthMessage();
};

// Global Escape Key to Close Modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.closeModal();
  }
});

// Load Current User from Storage Immediately
function loadLocalSession() {
  const savedUser = localStorage.getItem('sports_desire_auth_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
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
loadLocalSession();

// Asynchronous Firebase Background Initializer
async function initFirebaseAsync() {
  if (!isFirebaseConfigured()) return;
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
    const { 
      getAuth, 
      onAuthStateChanged, 
      GoogleAuthProvider 
    } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');

    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();

    onAuthStateChanged(auth, (user) => {
      if (user) {
        const savedRole = localStorage.getItem(`sports_desire_role_${user.uid}`) || currentRole;
        user.role = savedRole;
        currentUser = user;
        localStorage.setItem('sports_desire_auth_user', JSON.stringify({
          uid: user.uid,
          displayName: user.displayName || (user.role === 'player' ? 'Arun Sharma' : 'Assam Tennis Organiser'),
          email: user.email,
          phoneNumber: user.phoneNumber,
          photoURL: user.photoURL,
          role: user.role
        }));
      } else {
        // If not using simulated session, clear
        if (!localStorage.getItem('sports_desire_auth_user')) {
          currentUser = null;
        }
      }
      updateAuthUI(currentUser);
    });

  } catch (err) {
    console.warn("Firebase Auth async notice:", err);
  }
}
initFirebaseAsync();

// Google Sign-In Handler
window.handleGoogleSignIn = async function() {
  clearAuthMessage();
  if (!isFirebaseConfigured() || !auth) {
    // Instant demo login fallback
    showSimulatedSuccess({
      uid: `demo-${Date.now()}`,
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
    window.closeModal('auth-modal');
  } catch (error) {
    console.error("Google Auth error:", error);
    showAuthMessage(getFriendlyErrorMessage(error.code, error.message), "error");
  }
};

// Email Form Handler
window.handleEmailAuth = async function() {
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
      uid: `demo-${Date.now()}`,
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
    window.closeModal('auth-modal');
  } catch (error) {
    console.error("Email Auth error:", error);
    showAuthMessage(getFriendlyErrorMessage(error.code, error.message), "error");
  }
};

// Phone reCAPTCHA Init
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

// Send Phone OTP
window.handleSendPhoneOtp = async function() {
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
    console.error("Phone OTP error:", error);
    showAuthMessage(getFriendlyErrorMessage(error.code, error.message), "error");
  }
};

// Verify Phone OTP
window.handleVerifyPhoneOtp = async function() {
  clearAuthMessage();
  const otp = document.getElementById('auth-otp-input').value.trim();
  if (!otp || otp.length < 6) {
    showAuthMessage("Please enter the 6-digit verification code.", "error");
    return;
  }

  if (!isFirebaseConfigured() || !auth) {
    const rawPhone = document.getElementById('auth-phone-input').value.trim();
    showSimulatedSuccess({
      uid: `demo-${Date.now()}`,
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
    window.closeModal('auth-modal');
  } catch (error) {
    console.error("Phone OTP verify error:", error);
    showAuthMessage(getFriendlyErrorMessage(error.code, error.message), "error");
  }
};

// Sign Out
window.handleSignOut = async function() {
  if (isFirebaseConfigured() && auth) {
    try {
      const { signOut } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error:", e);
    }
  }
  localStorage.removeItem('sports_desire_auth_user');
  currentUser = null;
  updateAuthUI(null);
  window.closeModal();
};

function showSimulatedSuccess(userObj) {
  localStorage.setItem('sports_desire_auth_user', JSON.stringify(userObj));
  currentUser = userObj;
  updateAuthUI(userObj);
  window.closeModal('auth-modal');
  const roleName = userObj.role === 'player' ? 'Player / Parent' : 'Tournament Organiser';
  alert(`✅ Signed in as ${userObj.displayName || userObj.email || userObj.phoneNumber} (${roleName})!`);
}

// Update UI Across Navbar, Hero, and Bottom Nav based on Role
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
        userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || 'User')}&background=${bg}&color=000&bold=true`;
      }
    }
    if (mobileProfileLabel) mobileProfileLabel.textContent = "Dashboard";

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

  if (window.lucide) lucide.createIcons();
}

// User Dashboard Router (Separated Dashboards)
window.openUserDashboard = function() {
  if (!currentUser) {
    window.openAuthModal('player');
    return;
  }

  if (currentUser.role === 'player') {
    openPlayerDashboard();
  } else {
    openOrganizerDashboard();
  }
};

// 1. Player Dashboard Modal
function openPlayerDashboard() {
  const modal = document.getElementById('player-dashboard-modal');
  const nameEl = document.getElementById('player-dash-name');
  const avatarEl = document.getElementById('player-dash-avatar');
  const rankBadge = document.getElementById('player-dash-rank-badge');

  // Load saved profile data
  const profile = JSON.parse(localStorage.getItem('sports_desire_player_profile') || '{}');
  const displayName = profile.name || currentUser.displayName || currentUser.email?.split('@')[0] || "Player";
  const displayRank = profile.ranking ? `Rank: ${profile.ranking}` : "Rank: Unranked";

  if (nameEl) nameEl.textContent = displayName;
  if (rankBadge) rankBadge.textContent = displayRank;
  if (avatarEl) {
    avatarEl.src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00E676&color=000&bold=true`;
  }

  // Populate form fields with existing profile
  if (document.getElementById('prof-name')) document.getElementById('prof-name').value = profile.name || displayName;
  if (document.getElementById('prof-sport')) document.getElementById('prof-sport').value = profile.sport || "Tennis";
  if (document.getElementById('prof-category')) document.getElementById('prof-category').value = profile.category || "U-14";
  if (document.getElementById('prof-ranking')) document.getElementById('prof-ranking').value = profile.ranking || "";
  if (document.getElementById('prof-federation-id')) document.getElementById('prof-federation-id').value = profile.federationId || "";
  if (document.getElementById('prof-city')) document.getElementById('prof-city').value = profile.city || "";
  if (document.getElementById('prof-academy')) document.getElementById('prof-academy').value = profile.academy || "";
  if (document.getElementById('prof-parent-phone')) document.getElementById('prof-parent-phone').value = profile.parentPhone || "";

  // Render registrations history
  renderPlayerRegistrations();

  // Reset to entries tab
  window.switchPlayerDashTab('entries');

  if (modal) modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

window.switchPlayerDashTab = function(tab) {
  const btnEntries = document.getElementById('player-tab-btn-entries');
  const btnProfile = document.getElementById('player-tab-btn-profile');
  const viewEntries = document.getElementById('player-view-entries');
  const viewProfile = document.getElementById('player-view-profile');

  if (tab === 'entries') {
    if (btnEntries) btnEntries.classList.add('active');
    if (btnProfile) btnProfile.classList.remove('active');
    if (viewEntries) viewEntries.style.display = 'block';
    if (viewProfile) viewProfile.style.display = 'none';
  } else {
    if (btnProfile) btnProfile.classList.add('active');
    if (btnEntries) btnEntries.classList.remove('active');
    if (viewEntries) viewEntries.style.display = 'none';
    if (viewProfile) viewProfile.style.display = 'block';
  }
};

function renderPlayerRegistrations() {
  const listEl = document.getElementById('player-entries-list');
  if (!listEl) return;

  const entries = JSON.parse(localStorage.getItem('sports_desire_player_entries') || '[]');
  if (entries.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
        <i data-lucide="calendar-x" style="width: 36px; height: 36px; margin: 0 auto 0.5rem; color: var(--text-dim); display: block;"></i>
        <p style="font-size: 0.9rem; font-weight: 600;">No tournament registrations yet</p>
        <p style="font-size: 0.78rem; color: var(--text-dim); margin-top: 4px;">Click "WhatsApp Registration" on any tournament card to register directly with organizers!</p>
      </div>
    `;
  } else {
    listEl.innerHTML = entries.map(e => `
      <div class="dash-history-card">
        <div>
          <div class="dash-card-title">${e.title}</div>
          <div class="dash-card-meta">${e.sport} • ${e.city || 'Assam'} • Registered: ${e.dateRegistered || 'Recent'}</div>
        </div>
        <span class="status-badge status-approved">Registered</span>
      </div>
    `).join('');
  }
}

window.savePlayerProfile = function(event) {
  if (event) event.preventDefault();
  const profile = {
    name: document.getElementById('prof-name')?.value.trim() || "",
    sport: document.getElementById('prof-sport')?.value || "Tennis",
    category: document.getElementById('prof-category')?.value || "U-14",
    ranking: document.getElementById('prof-ranking')?.value.trim() || "",
    federationId: document.getElementById('prof-federation-id')?.value.trim() || "",
    city: document.getElementById('prof-city')?.value.trim() || "",
    academy: document.getElementById('prof-academy')?.value.trim() || "",
    parentPhone: document.getElementById('prof-parent-phone')?.value.trim() || ""
  };

  localStorage.setItem('sports_desire_player_profile', JSON.stringify(profile));
  if (currentUser) {
    currentUser.displayName = profile.name || currentUser.displayName;
    localStorage.setItem('sports_desire_auth_user', JSON.stringify(currentUser));
  }

  // Update header display
  const nameEl = document.getElementById('player-dash-name');
  const rankBadge = document.getElementById('player-dash-rank-badge');
  if (nameEl) nameEl.textContent = profile.name || "Player";
  if (rankBadge) rankBadge.textContent = profile.ranking ? `Rank: ${profile.ranking}` : "Rank: Unranked";

  updateAuthUI(currentUser);
  alert("✅ Player Profile Saved Successfully!");
  window.switchPlayerDashTab('entries');
};

// 2. Tournament Organiser Dashboard Modal
function openOrganizerDashboard() {
  const modal = document.getElementById('organizer-dashboard-modal');
  const nameEl = document.getElementById('org-dash-name');
  const avatarEl = document.getElementById('org-dash-avatar');
  const countEl = document.getElementById('org-dash-count');
  const listEl = document.getElementById('org-hosted-tournaments-list');

  const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || "Tournament Organiser";
  if (nameEl) nameEl.textContent = displayName;
  if (avatarEl) {
    avatarEl.src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=FFB300&color=000&bold=true`;
  }

  // Populate hosted tournaments
  const allTournaments = JSON.parse(localStorage.getItem('sports_desire_tournaments') || '[]');
  const hosted = allTournaments.filter(t => t.id && (t.id.startsWith('tourn-') || t.isVerified));

  if (countEl) countEl.textContent = hosted.length;

  if (listEl) {
    if (hosted.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
          <p style="font-size: 0.9rem;">You haven't listed any tournaments yet.</p>
        </div>
      `;
    } else {
      listEl.innerHTML = hosted.slice(0, 6).map(t => `
        <div class="dash-history-card">
          <div>
            <div class="dash-card-title">${t.title}</div>
            <div class="dash-card-meta">${t.sport} • ${t.city} • Starts: ${t.startDate}</div>
          </div>
          <span class="status-badge status-approved">Verified & Live</span>
        </div>
      `).join('');
    }
  }

  if (modal) modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

// Host Tournament Click Handler (Enforces Login First)
window.handleHostClick = function() {
  if (!currentUser) {
    // Open auth modal with organizer role preselected and notice banner
    window.openAuthModal('organizer');
    const notice = document.getElementById('auth-notice-banner');
    if (notice) {
      notice.innerHTML = '<i data-lucide="info" style="width: 16px; height: 16px;"></i> Please sign in or register as a <strong>Tournament Organiser</strong> to host a tournament.';
      notice.style.display = 'flex';
      if (window.lucide) lucide.createIcons();
    }
    return;
  }

  if (currentUser.role === 'player') {
    const changeRole = confirm(
      "ℹ️ You are currently signed in as a Player/Parent.\n\n" +
      "Tournament Hosting with verified listing (₹499) is reserved for Tournament Organizers.\n\n" +
      "Would you like to switch this account to a Tournament Organiser?"
    );
    if (changeRole) {
      currentUser.role = 'organizer';
      localStorage.setItem('sports_desire_auth_user', JSON.stringify(currentUser));
      if (currentUser.uid) {
        localStorage.setItem(`sports_desire_role_${currentUser.uid}`, 'organizer');
      }
      updateAuthUI(currentUser);
      window.openHostModalDirect();
    }
    return;
  }

  // User is logged in as organizer: open host modal directly
  window.openHostModalDirect();
};

window.openHostModalDirect = function() {
  const hostModal = document.getElementById('host-modal');
  if (hostModal) hostModal.classList.add('active');
  if (window.lucide) lucide.createIcons();
};

window.handleProfileClick = function() {
  if (currentUser) {
    window.openUserDashboard();
  } else {
    window.openAuthModal();
  }
};

window.trackPlayerEntry = function(tournamentId) {
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
};

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
      return 'No account found with this email. Click "Register" to create one.';
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
