/*
 * Guardia Planning App
 *
 * This script drives the interactivity for the simple guardia planning
 * application. Each resident must select a certain number of guardias
 * (shifts) from a predefined list of dates. Shifts may be of type
 * "Puerta" (door guard) or "Traumato" (trauma guard). Multiple
 * residents can temporarily choose the same shift, but conflicts are
 * highlighted in the UI. A conflict resolution function attempts
 * to assign duplicates fairly based on how many shifts each user has.
 */

// Predefined residents and maximum shifts per person
const users = ['Resident 1', 'Resident 2', 'Resident 3', 'Resident 4'];
const maxShiftsPerUser = 4;

// Generate a list of dates (ISO strings) for demonstration. These could be
// replaced with real guardia dates provided by the clinic or hospital.
const dates = [
  '2025-09-01', '2025-09-08', '2025-09-15', '2025-09-22',
  '2025-09-29', '2025-10-06', '2025-10-13', '2025-10-20'
];

// Each date has two possible shift types. We build a flat array of shift
// objects containing an identifier, the date, type, and an array of
// assigned users. The `assigned` array makes it easy to track
// conflicts (more than one resident assigned to the same shift).
const shifts = [];
dates.forEach(date => {
  shifts.push({ id: `${date}-puerta`, date, type: 'Puerta', assigned: [] });
  shifts.push({ id: `${date}-trauma`, date, type: 'Traumato', assigned: [] });
});

// Track selections per user. The keys correspond to user names and the
// values are arrays of shift identifiers. This helps enforce the 4
// selection limit.
const userPicks = {};
users.forEach(u => { userPicks[u] = []; });

// Track which users have finished their selection. Once a user finishes,
// they can no longer modify their picks (until they reload).
const finishedUsers = {};

// State variable for the currently selected user. This is set when
// a resident picks their name from the dropdown.
let currentUser = null;

// Cache DOM elements for later use
const loginSection = document.getElementById('login');
const planningSection = document.getElementById('planning');
const userSelect = document.getElementById('user-select');
const startBtn = document.getElementById('start-btn');
const currentUserSpan = document.getElementById('current-user');
const shiftTableBody = document.getElementById('shift-table-body');
const remainingShiftsEl = document.getElementById('remaining-shifts');
const finishBtn = document.getElementById('finish-btn');
const resolveBtn = document.getElementById('resolve-btn');

// Utility: format a date (YYYY-MM-DD) into something friendlier (e.g.
// "1 Sep 2025"). We rely on the browser's locale. If running in an
// environment without Intl, it will fall back to the ISO string.
function formatDate(iso) {
  /*
   * Convert an ISO date (YYYY-MM-DD) into a more readable format without
   * invoking the browser's date parsing. This avoids timezone offsets
   * that can cause dates to be off by a day. Month names are English
   * abbreviations; you can localise them if needed.
   */
  try {
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    const year = parts[0];
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[month] || parts[1];
    return `${day} ${monthName} ${year}`;
  } catch (e) {
    return iso;
  }
}

/**
 * Render the entire shift table. Each row displays the date, type,
 * assigned residents and a checkbox for the current user to make a
 * selection. Rows with conflicts (assigned to more than one resident)
 * are highlighted using a CSS class.
 */
function renderTable() {
  // Clear existing rows
  shiftTableBody.innerHTML = '';

  // Build new rows
  shifts.forEach(shift => {
    const tr = document.createElement('tr');

    // Date cell
    const dateTd = document.createElement('td');
    dateTd.textContent = formatDate(shift.date);
    tr.appendChild(dateTd);

    // Type cell
    const typeTd = document.createElement('td');
    typeTd.textContent = shift.type;
    tr.appendChild(typeTd);

    // Assigned residents cell
    const assignedTd = document.createElement('td');
    assignedTd.classList.add('assigned-col');
    if (shift.assigned.length > 0) {
      assignedTd.textContent = shift.assigned.join(', ');
    } else {
      assignedTd.textContent = '—';
    }
    tr.appendChild(assignedTd);

    // Conflict highlighting if more than one resident selected
    if (shift.assigned.length > 1) {
      tr.classList.add('conflict');
    }

    // Checkbox cell for current user selection
    const selectTd = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.disabled = finishedUsers[currentUser] || !currentUser;
    checkbox.checked = shift.assigned.includes(currentUser);
    checkbox.addEventListener('change', () => selectShift(shift.id));
    selectTd.appendChild(checkbox);
    tr.appendChild(selectTd);

    shiftTableBody.appendChild(tr);
  });

  // Update remaining shift count text
  if (currentUser) {
    const remaining = maxShiftsPerUser - userPicks[currentUser].length;
    remainingShiftsEl.textContent = `${remaining} shift${remaining !== 1 ? 's' : ''} remaining`;
  } else {
    remainingShiftsEl.textContent = '';
  }

  // If the current user has finished, disable the finish button
  finishBtn.disabled = finishedUsers[currentUser] || !currentUser;
}

/**
 * Handler when a checkbox is clicked. Adds or removes the current user
 * from a shift assignment. A user cannot exceed the maximum number
 * of allowed guardias. When a user tries to pick more than allowed,
 * an alert is shown.
 *
 * @param {string} shiftId The identifier of the shift being toggled.
 */
function selectShift(shiftId) {
  if (!currentUser) return;
  if (finishedUsers[currentUser]) return;
  const shift = shifts.find(s => s.id === shiftId);
  if (!shift) return;

  // Determine if the user has already selected this shift
  const alreadyAssigned = shift.assigned.includes(currentUser);

  // If user is unchecking the shift
  if (alreadyAssigned) {
    shift.assigned = shift.assigned.filter(u => u !== currentUser);
    const index = userPicks[currentUser].indexOf(shiftId);
    if (index >= 0) userPicks[currentUser].splice(index, 1);
  } else {
    // Check max shifts
    if (userPicks[currentUser].length >= maxShiftsPerUser) {
      alert(`You have already selected ${maxShiftsPerUser} guardias.`);
      return;
    }
    // Add the user to the shift assignment
    shift.assigned.push(currentUser);
    userPicks[currentUser].push(shiftId);
  }

  renderTable();
}

/**
 * Mark the current user as finished. This prevents further changes to
 * their selections until the page is refreshed. A finished user can
 * still view the schedule and the conflicts from other users.
 */
function finishSelection() {
  if (!currentUser) return;
  finishedUsers[currentUser] = true;
  renderTable();
  alert(`${currentUser} has finished selecting guardias.`);
}

/**
 * Resolve conflicts by automatically assigning each contested shift to
 * one resident. The algorithm chooses the resident who currently
 * has the fewest assignments; in case of a tie, the first resident
 * who selected the shift (order of assignment) wins. This function
 * modifies the shift assignments and updates user picks accordingly.
 */
function resolveConflicts() {
  // For each shift, if more than one resident is assigned, keep only
  // the resident with the smallest number of assignments. Ties are
  // broken by the order in which residents were added to the shift.
  shifts.forEach(shift => {
    if (shift.assigned.length <= 1) return;
    // Determine the chosen resident
    let chosen = shift.assigned[0];
    shift.assigned.forEach(res => {
      if (userPicks[res].length < userPicks[chosen].length) {
        chosen = res;
      }
    });
    // Remove this shift from all other residents and update their picks
    shift.assigned = [chosen];
  });

  // Rebuild userPicks based on the resolved assignments
  users.forEach(u => { userPicks[u] = []; });
  shifts.forEach(shift => {
    shift.assigned.forEach(u => {
      userPicks[u].push(shift.id);
    });
  });

  renderTable();
  alert('Conflicts have been resolved.');
}

// Attach event listeners to buttons
startBtn.addEventListener('click', () => {
  const selected = userSelect.value;
  if (!selected) {
    alert('Please choose your name to start planning.');
    return;
  }
  currentUser = selected;
  currentUserSpan.textContent = selected;
  loginSection.style.display = 'none';
  planningSection.style.display = '';
  renderTable();
});

finishBtn.addEventListener('click', finishSelection);
resolveBtn.addEventListener('click', resolveConflicts);

// Initial rendering ensures the table is ready if a user starts immediately.
renderTable();