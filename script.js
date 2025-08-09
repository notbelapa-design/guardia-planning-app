/*
 * Enhanced Guardia Planning App
 *
 * This script adds an administrative setup phase for creating
 * available guardia shifts, an interactive planning phase where
 * residents select their shifts, a calendar overview of all
 * assignments, and improved conflict resolution that takes into
 * account Monday and Friday assignments. The goal is to fairly
 * distribute unpopular days and provide a visually appealing
 * interface.
 */

// Define residents and maximum number of guardias per resident
const users = ['Resident 1', 'Resident 2', 'Resident 3', 'Resident 4'];
const maxShiftsPerUser = 4;

// The master list of shift objects. Each shift has an id, date,
// type (Puerta or Traumato) and an array of assigned user names.
const shifts = [];

// Track each resident's picks for enforcing selection limits
const userPicks = {};
users.forEach(u => { userPicks[u] = []; });

// Track which users have finished their selection
const finishedUsers = {};

// Store the currently logged in resident
let currentUser = null;

// Cache DOM elements
const adminSection = document.getElementById('admin-setup');
const newDateInput = document.getElementById('new-date');
const newTypeSelect = document.getElementById('new-type');
const addShiftBtn = document.getElementById('add-shift-btn');
const guardiaListEl = document.getElementById('guardia-list');
const adminFinishBtn = document.getElementById('admin-finish-btn');

const loginSection = document.getElementById('login');
const userSelect = document.getElementById('user-select');
const startBtn = document.getElementById('start-btn');

const planningSection = document.getElementById('planning');
const currentUserSpan = document.getElementById('current-user');
const shiftTableBody = document.getElementById('shift-table-body');
const remainingShiftsEl = document.getElementById('remaining-shifts');
const monFriCountEl = document.getElementById('mon-fri-count');
const finishBtn = document.getElementById('finish-btn');
const resolveBtn = document.getElementById('resolve-btn');

const calendarSection = document.getElementById('calendar');
const calendarContainer = document.getElementById('calendar-container');

/**
 * Utility: Format a date string (YYYY-MM-DD) into a human-friendly
 * representation such as "1 Sep 2025". Avoids timezone issues.
 * @param {string} iso ISO date string (YYYY-MM-DD)
 * @returns {string} formatted date
 */
function formatDate(iso) {
  try {
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[monthIndex] || parts[1];
    return `${day} ${monthName} ${year}`;
  } catch (e) {
    return iso;
  }
}

/**
 * Compute the number of Monday/Friday assignments for a given user.
 * @param {string} user The resident's name
 * @returns {number} count of assignments on Monday or Friday
 */
function computeMonFriCount(user) {
  /*
   * Count how many of the selected shifts for `user` occur on a Monday
   * or a Friday. Instead of relying on Date parsing of ambiguous
   * strings, we parse the date ourselves to avoid locale and timezone
   * issues. Accepts either ISO (YYYY-MM-DD) or US-style (MM/DD/YYYY)
   * date strings and constructs a UTC date before retrieving the day
   * of week. getUTCDay() returns 0 for Sunday, 1 for Monday, ..., 6 for
   * Saturday.
   */
  let count = 0;
  userPicks[user].forEach(shiftId => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;
    let year, monthIndex, day;
    const d = shift.date;
    if (d.includes('-')) {
      // ISO format YYYY-MM-DD
      const parts = d.split('-');
      year = parseInt(parts[0], 10);
      monthIndex = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else if (d.includes('/')) {
      // US format MM/DD/YYYY
      const parts = d.split('/');
      monthIndex = parseInt(parts[0], 10) - 1;
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    } else {
      // Fallback to new Date; may produce timezone issues
      const tempDate = new Date(d);
      const dow = tempDate.getDay();
      if (dow === 1 || dow === 5) count++;
      return;
    }
    const utc = new Date(Date.UTC(year, monthIndex, day));
    const dow = utc.getUTCDay();
    if (dow === 1 || dow === 5) count++;
  });
  return count;
}

/**
 * Render the list of guardias in the admin setup section. It displays
 * each shift with its formatted date and type.
 */
function renderAdminList() {
  guardiaListEl.innerHTML = '';
  if (shifts.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No guardias added yet.';
    guardiaListEl.appendChild(li);
    return;
  }
  // Sort shifts chronologically for display
  const sorted = [...shifts].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  sorted.forEach(shift => {
    const li = document.createElement('li');
    li.textContent = `${formatDate(shift.date)} – ${shift.type}`;
    guardiaListEl.appendChild(li);
  });
}

/**
 * Handler for adding a new guardia from the admin form. Validates
 * input, creates a shift object and appends it to the global list.
 */
function addNewShift() {
  const date = newDateInput.value;
  const type = newTypeSelect.value;
  if (!date) {
    alert('Please select a date for the guardia.');
    return;
  }
  // Build unique id: YYYY-MM-DD-type-lowercase
  const id = `${date}-${type.toLowerCase()}`;
  // Ensure no duplicate shifts
  if (shifts.some(s => s.id === id)) {
    alert('This guardia already exists.');
    return;
  }
  shifts.push({ id, date, type, assigned: [] });
  newDateInput.value = '';
  renderAdminList();
}

/**
 * Finalise the admin setup. Hides the admin section and shows the
 * login section, allowing residents to begin selecting their guardias.
 * Also initialises the calendar view and the shift table.
 */
function finishSetup() {
  if (shifts.length === 0) {
    alert('Please add at least one guardia before finishing setup.');
    return;
  }
  adminSection.style.display = 'none';
  loginSection.style.display = '';
  calendarSection.style.display = '';
  renderTable();
  updateCalendar();
  alert('Setup complete! Residents can now choose their guardias.');
}

/**
 * Render the interactive shift table for residents. Displays each
 * shift date, type, assigned users, conflict highlighting, and
 * selection checkboxes for the current user. Also shows remaining
 * shifts and Monday/Friday tallies for the user.
 */
function renderTable() {
  // Clear table
  shiftTableBody.innerHTML = '';
  // Sort shifts chronologically for display
  const sorted = [...shifts].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  sorted.forEach(shift => {
    const tr = document.createElement('tr');
    // Date
    const dateTd = document.createElement('td');
    dateTd.textContent = formatDate(shift.date);
    tr.appendChild(dateTd);
    // Type
    const typeTd = document.createElement('td');
    typeTd.textContent = shift.type;
    tr.appendChild(typeTd);
    // Assigned
    const assignedTd = document.createElement('td');
    assignedTd.classList.add('assigned-col');
    if (shift.assigned.length > 0) {
      assignedTd.textContent = shift.assigned.join(', ');
    } else {
      assignedTd.textContent = '—';
    }
    tr.appendChild(assignedTd);
    // Conflict highlight
    if (shift.assigned.length > 1) {
      tr.classList.add('conflict');
    }
    // Checkbox
    const selectTd = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.disabled = !currentUser || finishedUsers[currentUser];
    checkbox.checked = shift.assigned.includes(currentUser);
    checkbox.addEventListener('change', () => handleSelect(shift.id));
    selectTd.appendChild(checkbox);
    tr.appendChild(selectTd);
    shiftTableBody.appendChild(tr);
  });
  // Update remaining count and Monday/Friday tally
  if (currentUser) {
    const remaining = maxShiftsPerUser - userPicks[currentUser].length;
    remainingShiftsEl.textContent = `${remaining} shift${remaining !== 1 ? 's' : ''} remaining`;
    const countMonFri = computeMonFriCount(currentUser);
    monFriCountEl.textContent = `Monday/Friday guardias: ${countMonFri}`;
  } else {
    remainingShiftsEl.textContent = '';
    monFriCountEl.textContent = '';
  }
  // Disable finish button if user has finished or not logged in
  finishBtn.disabled = !currentUser || finishedUsers[currentUser];
  // Update calendar
  updateCalendar();
}

/**
 * Handle a resident selecting or deselecting a shift. Ensures
 * residents cannot exceed the maximum number of shifts.
 * @param {string} shiftId The unique identifier of the shift
 */
function handleSelect(shiftId) {
  if (!currentUser) return;
  if (finishedUsers[currentUser]) return;
  const shift = shifts.find(s => s.id === shiftId);
  if (!shift) return;
  const already = shift.assigned.includes(currentUser);
  if (already) {
    // Remove
    shift.assigned = shift.assigned.filter(u => u !== currentUser);
    const idx = userPicks[currentUser].indexOf(shiftId);
    if (idx >= 0) userPicks[currentUser].splice(idx, 1);
  } else {
    // Check limit
    if (userPicks[currentUser].length >= maxShiftsPerUser) {
      alert(`You have already selected ${maxShiftsPerUser} guardias.`);
      return;
    }
    shift.assigned.push(currentUser);
    userPicks[currentUser].push(shiftId);
  }
  renderTable();
}

/**
 * Mark the current user as finished. This locks their selections
 * and allows them to view the schedule without making changes.
 */
function finishSelection() {
  if (!currentUser) return;
  finishedUsers[currentUser] = true;
  renderTable();
  alert(`${currentUser} has finished selecting guardias.`);
}

/**
 * Resolve conflicts by assigning contested guardias to residents
 * fairly. The algorithm prioritises residents with the fewest
 * Monday/Friday assignments for each contested shift. If there is
 * still a tie, the resident with fewer total assignments wins; if
 * still tied, a random resident is chosen. Afterwards, the user
 * picks are rebuilt from the resolved assignments.
 */
function resolveConflicts() {
  shifts.forEach(shift => {
    if (shift.assigned.length <= 1) return;
    // Determine winner among assigned residents
    let chosen = null;
    shift.assigned.forEach(res => {
      if (!chosen) {
        chosen = res;
        return;
      }
      const countA = computeMonFriCount(res);
      const countB = computeMonFriCount(chosen);
      if (countA < countB) {
        chosen = res;
      } else if (countA === countB) {
        // Tie: compare total assignments
        if (userPicks[res].length < userPicks[chosen].length) {
          chosen = res;
        } else if (userPicks[res].length === userPicks[chosen].length) {
          // Tie again: random pick
          if (Math.random() < 0.5) {
            chosen = res;
          }
        }
      }
    });
    // Keep only chosen
    shift.assigned = [chosen];
  });
  // Rebuild userPicks
  users.forEach(u => { userPicks[u] = []; });
  shifts.forEach(shift => {
    shift.assigned.forEach(u => {
      userPicks[u].push(shift.id);
    });
  });
  renderTable();
  alert('Conflicts have been resolved fairly based on Monday/Friday assignments.');
}

/**
 * Build a calendar view of all guardias grouped by month. Each cell
 * displays the date number and any guardia shifts on that date with
 * assigned users or a placeholder if unassigned. Mondays and Fridays
 * are highlighted. Called whenever shifts or assignments change.
 */
function updateCalendar() {
  // Clear container
  calendarContainer.innerHTML = '';
  if (shifts.length === 0) {
    calendarContainer.textContent = 'No guardias to display.';
    return;
  }
  // Group shifts by month (YYYY-MM)
  const months = {};
  shifts.forEach(shift => {
    const key = shift.date.slice(0, 7); // YYYY-MM
    if (!months[key]) months[key] = [];
    months[key].push(shift);
  });
  // For each month, generate a calendar
  Object.keys(months).sort().forEach(monthKey => {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1;
    const shiftsInMonth = months[monthKey];
    // Create a container for this month
    const monthDiv = document.createElement('div');
    monthDiv.classList.add('calendar-month');
    const title = document.createElement('h3');
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    title.textContent = `${monthNames[monthIndex]} ${year}`;
    monthDiv.appendChild(title);
    // Create table
    const table = document.createElement('table');
    table.classList.add('calendar-table');
    // Header row (Monday - Sunday)
    const header = document.createElement('tr');
    const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    dayNames.forEach(d => {
      const th = document.createElement('th');
      th.textContent = d;
      header.appendChild(th);
    });
    table.appendChild(header);
    // Determine start day index (Monday-first)
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const startIndex = (firstDay + 6) % 7; // convert Sunday=0 to last column
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    // Build rows of calendar
    let row = document.createElement('tr');
    // Fill initial empty cells
    for (let i = 0; i < startIndex; i++) {
      const td = document.createElement('td');
      row.appendChild(td);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('td');
      // Determine day of week for styling (Monday index 0, Friday index 4)
      const cellIndex = (startIndex + day - 1) % 7;
      if (cellIndex === 0) cell.classList.add('mon-cell');
      if (cellIndex === 4) cell.classList.add('fri-cell');
      // Date number
      const dateSpan = document.createElement('div');
      dateSpan.classList.add('calendar-cell-date');
      dateSpan.textContent = day;
      cell.appendChild(dateSpan);
      // Find shifts on this date
      const dateStr = `${yearStr}-${monthStr.padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const shiftsOnDate = shiftsInMonth.filter(s => s.date === dateStr);
      shiftsOnDate.forEach(shift => {
        const entry = document.createElement('span');
        entry.classList.add('shift-entry');
        // Add type-specific class
        if (shift.type.toLowerCase() === 'puerta') entry.classList.add('shift-puerta');
        else entry.classList.add('shift-trauma');
        // Build label
        const assigned = shift.assigned.length > 0 ? shift.assigned.join(', ') : '—';
        entry.textContent = `${shift.type}: ${assigned}`;
        cell.appendChild(entry);
      });
      row.appendChild(cell);
      // End of week
      if ((startIndex + day) % 7 === 0) {
        table.appendChild(row);
        row = document.createElement('tr');
      }
    }
    // Append any remaining row
    if (row.children.length > 0) {
      // Fill remaining cells to complete the week
      while (row.children.length < 7) {
        row.appendChild(document.createElement('td'));
      }
      table.appendChild(row);
    }
    monthDiv.appendChild(table);
    calendarContainer.appendChild(monthDiv);
  });
}

// Event listeners
addShiftBtn.addEventListener('click', addNewShift);
adminFinishBtn.addEventListener('click', finishSetup);

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

// Initially, only the admin setup section is visible. Login and calendar
// sections are hidden by default (via inline styles in HTML). Render
// the admin list to show placeholder text.
renderAdminList();