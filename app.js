// Sports Desire - Core Application Engine

// Global App State
let state = {
  activeTab: 'all', // 'all', 'aata', 'aita', 'local', 'stats'
  searchQuery: '',
  selectedRegion: 'All Regions',
  selectedSport: 'All Sports',
  selectedAge: 'All Ages',
  selectedLevel: 'All Levels',
  tournaments: [],

  pendingOrganizerData: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadTournamentsData();
  setupEventListeners();
  renderFilters();
  renderTournaments();
  lucide.createIcons();
});

// Load Tournaments from Scraper Database & Preserve User Submitted Cards
function loadTournamentsData() {
  let masterList = [...INITIAL_TOURNAMENTS];
  const saved = localStorage.getItem('sports_desire_tournaments');
  if (saved) {
    try {
      const savedList = JSON.parse(saved);
      // Preserve any custom tournaments submitted via Host Tournament form in localStorage
      savedList.forEach(savedItem => {
        if (!masterList.some(item => item.id === savedItem.id)) {
          masterList.unshift(savedItem); // Put organizer submitted events at the top of the feed
        }
      });
    } catch (e) {
      console.warn('Could not parse localStorage tournaments, using fresh database.', e);
    }
  }
  state.tournaments = masterList;
  saveTournamentsToStorage();
}

function saveTournamentsToStorage() {
  localStorage.setItem('sports_desire_tournaments', JSON.stringify(state.tournaments));
}

// Render Filter Dropdowns
function renderFilters() {
  const regionSelect = document.getElementById('filter-region');
  const sportSelect = document.getElementById('filter-sport');
  const ageSelect = document.getElementById('filter-age');
  const levelSelect = document.getElementById('filter-level');

  if (regionSelect) {
    regionSelect.innerHTML = NE_STATES.map(s => `<option value="${s}">${s}</option>`).join('');
  }
  if (sportSelect) {
    sportSelect.innerHTML = SPORTS_LIST.map(s => `<option value="${s}">${s}</option>`).join('');
  }
  if (ageSelect) {
    ageSelect.innerHTML = AGE_GROUPS.map(a => `<option value="${a}">${a}</option>`).join('');
  }
  if (levelSelect) {
    levelSelect.innerHTML = LEVEL_LIST.map(l => `<option value="${l}">${l}</option>`).join('');
  }
}

// Event Listeners
function setupEventListeners() {
  // Category Tab Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const targetBtn = e.currentTarget;
      targetBtn.classList.add('active');
      state.activeTab = targetBtn.dataset.tab;
      
      // Update section title
      const titleEl = document.getElementById('section-title-text');
      if (titleEl) {
        if (state.activeTab === 'national') titleEl.textContent = 'National Level Tournaments & Calendars';
        else if (state.activeTab === 'state') titleEl.textContent = 'State Level Tournaments';
        else if (state.activeTab === 'local') titleEl.textContent = 'Local Level Tournaments';
        else titleEl.textContent = 'All Upcoming Sports Tournaments';
      }

      renderTournaments();
    });
  });

  // Search Input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase();
      renderTournaments();
    });
  }

  // Filter Dropdowns
  const regionSelect = document.getElementById('filter-region');
  const sportSelect = document.getElementById('filter-sport');
  const ageSelect = document.getElementById('filter-age');
  const levelSelect = document.getElementById('filter-level');

  if (regionSelect) regionSelect.addEventListener('change', (e) => { state.selectedRegion = e.target.value; renderTournaments(); });
  if (sportSelect) sportSelect.addEventListener('change', (e) => { state.selectedSport = e.target.value; renderTournaments(); });
  if (ageSelect) ageSelect.addEventListener('change', (e) => { state.selectedAge = e.target.value; renderTournaments(); });
  if (levelSelect) levelSelect.addEventListener('change', (e) => { state.selectedLevel = e.target.value; renderTournaments(); });

  // Organizer Form Submission
  const hostForm = document.getElementById('organizer-host-form');
  if (hostForm) {
    hostForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleOrganizerFormSubmit();
    });
  }
}

// Filter and Render Tournaments Grid
function renderTournaments() {
  const container = document.getElementById('tournaments-grid');
  const countEl = document.getElementById('results-count');
  if (!container) return;

  let filtered = state.tournaments.filter(item => {
    // Tab Filter
    if (state.activeTab === 'national' && item.tier !== 'national') return false;
    if (state.activeTab === 'state' && item.tier !== 'state') return false;
    if (state.activeTab === 'local' && item.tier !== 'local') return false;

    // Search Query
    if (state.searchQuery) {
      const q = state.searchQuery;
      const matchName = item.title.toLowerCase().includes(q);
      const matchCity = item.city.toLowerCase().includes(q);
      const matchVenue = item.venue.toLowerCase().includes(q);
      const matchAssoc = item.associationFullName.toLowerCase().includes(q);
      if (!matchName && !matchCity && !matchVenue && !matchAssoc) return false;
    }

    // Region / State Filter
    if (state.selectedRegion !== 'All Regions') {
      if (item.state !== state.selectedRegion) return false;
    }

    // Sport Filter
    if (state.selectedSport !== 'All Sports') {
      if (item.sport !== state.selectedSport) return false;
    }

    // Age Group Filter
    if (state.selectedAge !== 'All Ages') {
      if (!item.ageGroups.includes(state.selectedAge)) return false;
    }

    // Level Filter
    if (state.selectedLevel !== 'All Levels') {
      if (!item.level.includes(state.selectedLevel.split(' ')[0])) return false;
    }

    return true;
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} Tournaments Found`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <i data-lucide="trophy" style="width: 48px; height: 48px; stroke: var(--text-dim); margin-bottom: 1rem;"></i>
        <h3 style="font-family: var(--font-heading); color: var(--text-main); font-size: 1.25rem;">No Tournaments Match Your Filters</h3>
        <p style="font-size: 0.9rem; margin-top: 0.25rem;">Try adjusting your search terms, sport type, or region filters.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(item => createTournamentCardHTML(item)).join('');
  lucide.createIcons();
}

// Create Tournament Card HTML Component
function createTournamentCardHTML(item) {
  const badgeClass = item.tier === 'state' ? 'badge-state' : (item.tier === 'national' ? 'badge-national' : 'badge-local');
  const formattedStartDate = formatDate(item.startDate);
  const formattedEndDate = formatDate(item.endDate);

  return `
    <div class="tournament-card" onclick="openDetailModal('${item.id}')">
      <div class="card-image-box">
        <img src="${item.posterUrl}" alt="${item.title}" class="card-image" onerror="this.src='https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80'">
        <div class="card-badges">
          <span class="badge ${badgeClass}">${item.association}</span>
          <span class="badge" style="background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); color: var(--text-main);">${item.state}</span>
        </div>
        ${item.isVerified ? `
          <div class="badge-verified" title="Verified Tournament Organizer">
            <i data-lucide="check-circle-2" style="width: 12px; height: 12px;"></i> Verified
          </div>
        ` : ''}
      </div>

      <div class="card-content">
        <div class="card-sport-tag">${item.sport} • ${item.level}</div>
        <h3 class="card-title">${item.title}</h3>

        <div class="card-meta-list">
          <div class="meta-item">
            <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
            <span>${formattedStartDate} - ${formattedEndDate}</span>
          </div>
          <div class="meta-item">
            <i data-lucide="map-pin" style="width: 14px; height: 14px;"></i>
            <span>${item.city}, ${item.state} (${item.venue.split(',')[0]})</span>
          </div>
          <div class="meta-item">
            <i data-lucide="user-check" style="width: 14px; height: 14px;"></i>
            <span>Entry Deadline: <strong style="color: var(--accent-crimson);">${formatDate(item.entryDeadline)}</strong></span>
          </div>
        </div>

        <div class="card-age-tags">
          ${item.ageGroups.map(ag => `<span class="age-tag">${ag}</span>`).join('')}
        </div>

        <div class="card-footer">
          <button class="btn btn-outline" style="padding: 0.4rem 0.85rem; font-size: 0.8rem; width: 100%;">
            View Details
          </button>
        </div>
      </div>
    </div>
  `;
}

// Open Detail Modal
function openDetailModal(id) {
  const item = state.tournaments.find(t => t.id === id);
  if (!item) return;

  const modalOverlay = document.getElementById('detail-modal');
  const modalBody = document.getElementById('detail-modal-body');

  modalBody.innerHTML = `
    <div style="position: relative;">
      <img src="${item.posterUrl}" style="width: 100%; height: 200px; object-fit: cover; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
      <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
        <span class="badge ${item.tier === 'state' ? 'badge-state' : (item.tier === 'national' ? 'badge-national' : 'badge-local')}">${item.association} Sanctioned</span>
        <span class="badge" style="background: rgba(0, 240, 255, 0.15); color: var(--neon-cyan); border: 1px solid var(--neon-cyan);">${item.sport}</span>
        ${item.isVerified ? `<span class="badge-verified" style="position: static;"><i data-lucide="check-circle-2" style="width: 12px; height: 12px;"></i> Verified Organizer</span>` : ''}
      </div>
      
      <h2 class="modal-title">${item.title}</h2>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">${item.description}</p>

      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase;">Dates & Timing</span>
          <p style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-top: 2px;">${formatDate(item.startDate)} - ${formatDate(item.endDate)}</p>
        </div>
        <div>
          <span style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase;">Last Date to Apply</span>
          <p style="font-size: 0.95rem; font-weight: 700; color: var(--accent-crimson); margin-top: 2px;">${formatDate(item.entryDeadline)}</p>
        </div>
        <div>
          <span style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase;">Venue & City</span>
          <p style="font-size: 0.9rem; font-weight: 600; color: var(--text-main); margin-top: 2px;">${item.venue}, ${item.city}, ${item.state}</p>
        </div>
        <div>
          <span style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase;">Entry Fee</span>
          <p style="font-size: 0.95rem; font-weight: 700; color: var(--primary-emerald); margin-top: 2px;">${item.entryFee}</p>
        </div>
      </div>

      <div style="margin-bottom: 1.25rem;">
        <h4 style="font-family: var(--font-heading); font-size: 0.95rem; margin-bottom: 0.5rem;">Categories & Age Groups</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${item.ageGroups.map(ag => `<span class="age-tag" style="padding: 4px 10px; font-size: 0.8rem; background: var(--bg-card);">${ag}</span>`).join('')}
        </div>
      </div>

      <div style="background: rgba(0, 230, 118, 0.05); border: 1px dashed var(--primary-emerald); border-radius: var(--radius-md); padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
        <div>
          <h4 style="font-family: var(--font-heading); font-size: 1rem; color: var(--primary-emerald);">Organizer Contact & Registration</h4>
          <p style="font-size: 0.85rem; color: var(--text-muted);">${item.organizerName} (${item.organizerPhone})</p>
        </div>
        <a href="https://wa.me/${item.organizerWhatsApp}?text=Hi%2C%20I%20saw%20your%20tournament%20'${encodeURIComponent(item.title)}'%20on%20Sports%20Desire.%20I%20want%20to%20register!" target="_blank" class="btn btn-primary" style="white-space: nowrap;">
          <i data-lucide="message-square" style="width: 16px; height: 16px;"></i> WhatsApp Registration
        </a>
      </div>
    </div>
  `;

  modalOverlay.classList.add('active');
  lucide.createIcons();
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    lucide.createIcons();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// Organizer Listing Workflow (Step 1: Form -> Step 2: ₹499 Payment)
function handleOrganizerFormSubmit() {
  const title = document.getElementById('org-title').value;
  const sport = document.getElementById('org-sport').value;
  const association = document.getElementById('org-association').value;
  const stateVal = document.getElementById('org-state').value;
  const city = document.getElementById('org-city').value;
  const venue = document.getElementById('org-venue').value;
  const startDate = document.getElementById('org-start-date').value;
  const endDate = document.getElementById('org-end-date').value;
  const entryDeadline = document.getElementById('org-deadline').value;
  const entryFee = document.getElementById('org-entry-fee').value;
  const totalPrizeMoney = document.getElementById('org-prize').value;
  const organizerName = document.getElementById('org-name').value;
  const organizerPhone = document.getElementById('org-phone').value;
  const posterUrl = document.getElementById('org-poster').value || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80';
  const description = document.getElementById('org-desc').value;

  // Collect checked age groups
  const checkedAges = [];
  document.querySelectorAll('.age-group-checkbox:checked').forEach(cb => checkedAges.push(cb.value));

  if (checkedAges.length === 0) checkedAges.push('Open Category');

  state.pendingOrganizerData = {
    id: `tourn-${Date.now()}`,
    title,
    sport,
    association,
    associationFullName: association === 'National' ? 'National Level Event' : (association === 'State' ? 'State Level Event' : 'Local Club Event'),
    tier: association.toLowerCase(), // 'national', 'state', 'local'
    state: stateVal,
    district: city,
    city,
    venue,
    startDate,
    endDate,
    entryDeadline,
    ageGroups: checkedAges,
    level: association === 'National' ? 'National Level' : (association === 'State' ? 'State Level' : 'Local Level'),
    surface: 'Standard Court / Turf',
    ballType: 'Standard Championship',
    entryFee,
    totalPrizeMoney,
    organizerName,
    organizerPhone,
    organizerWhatsApp: organizerPhone.replace(/\D/g, ''),
    isVerified: true,
    listingType: 'Paid Verified Listing (₹499)',
    posterUrl,
    description,
    registeredPlayersCount: 1
  };

  // Close Host Modal & Open ₹499 Payment Checkout Modal
  closeModal('host-modal');
  openPaymentModal();
}

function openPaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.classList.add('active');
    lucide.createIcons();
  }
}

function completeOrganizerPayment() {
  if (state.pendingOrganizerData) {
    state.tournaments.unshift(state.pendingOrganizerData);
    saveTournamentsToStorage();
    state.pendingOrganizerData = null;
    closeModal('payment-modal');
    renderTournaments();

    // Show Success Toast/Alert
    alert('🎉 Payment of ₹499 Successful! Your tournament has been published with a "Verified Organizer" Badge on Sports Desire.');
  }
}



// Helper Date Formatting
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
