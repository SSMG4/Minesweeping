// --- Minesweeping Main Script ---
// This file handles: authentication, settings, theming, main menu, game logic, daily challenge, stats, streaks, hints, etc.

// --- Storage Keys ---
const STORAGE = {
  users: "minesweeping_users",
  session: "minesweeping_session",
  stats: "minesweeping_stats",
  streak: "minesweeping_streak",
  lastDaily: "minesweeping_last_daily"
};

// --- Helper Functions ---
function $(id) { return document.getElementById(id); }
function shuffle(array) { for (let i = array.length-1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [array[i], array[j]] = [array[j], array[i]]; } }
function pad(n, len=3) { return String(n).padStart(len, '0'); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

let users = JSON.parse(localStorage.getItem(STORAGE.users) || '{}');
let session = JSON.parse(localStorage.getItem(STORAGE.session) || 'null');
let stats = JSON.parse(localStorage.getItem(STORAGE.stats) || '{}');
let streak = JSON.parse(localStorage.getItem(STORAGE.streak) || '{"current":0,"best":0,"last":null}');
let lastDaily = localStorage.getItem(STORAGE.lastDaily) || null;

// --- Authentication ---
function showLogin() {
  $('loginModal').classList.remove('hidden');
  $('mainMenu').classList.add('hidden');
  $('gameContainer').classList.add('hidden');
}
function loginUser(username, password) {
  if (users[username]) {
    if (users[username].password !== password) {
      $('loginError').textContent = 'Incorrect password.';
      return false;
    }
  } else {
    users[username] = { password, theme: 'classic' };
    localStorage.setItem(STORAGE.users, JSON.stringify(users));
  }
  session = { username };
  localStorage.setItem(STORAGE.session, JSON.stringify(session));
  $('loginModal').classList.add('hidden');
  showMenu();
  return true;
}
function logoutUser() {
  session = null;
  localStorage.removeItem(STORAGE.session);
  showLogin();
}

// --- Theming ---
function setTheme(theme) {
  document.body.className = `theme-${theme}`;
  if (session && users[session.username]) {
    users[session.username].theme = theme;
    localStorage.setItem(STORAGE.users, JSON.stringify(users));
  }
}
function setupThemePicker() {
  const picker = $('themePicker');
  picker.innerHTML = '';
  ['classic','light','dark','black'].forEach(t => {
    const btn = document.createElement('button');
    btn.className = t;
    btn.title = t[0].toUpperCase()+t.slice(1);
    btn.onclick = () => { setTheme(t); };
    picker.appendChild(btn);
  });
}

// --- Main Menu ---
function showMenu() {
  $('mainMenu').classList.remove('hidden');
  $('gameContainer').classList.add('hidden');
  $('settingsModal').classList.add('hidden');
  $('statsModal').classList.add('hidden');
  $('howToModal').classList.add('hidden');
  $('currentUser').textContent = session ? `👤 ${session.username}` : '';
  setTheme(users[session.username]?.theme || 'classic');
  setupThemePicker();
  checkDailyNotif();
}

// --- Settings Modal ---
function showSettings() { $('settingsModal').classList.remove('hidden'); }
function hideSettings() { $('settingsModal').classList.add('hidden'); }

// --- Statistics ---
function showStats() {
  const s = stats[session.username] || {};
  let html = '';
  ['easy','medium','hard','extreme','daily'].forEach(mode => {
    html += `<h3>${mode[0].toUpperCase()+mode.slice(1)}:</h3>
    Played: ${s[mode]?.played||0}, Wins: ${s[mode]?.wins||0}, Best Time: ${s[mode]?.bestTime||'-'}
    <br>`;
  });
  html += `<hr>Current streak: ${streak.current}<br>Best streak: ${streak.best}`;
  $('statsContent').innerHTML = html;
  $('statsModal').classList.remove('hidden');
}
function hideStats() { $('statsModal').classList.add('hidden'); }

// --- How To Play ---
function showHowTo() { $('howToModal').classList.remove('hidden'); }
function hideHowTo() { $('howToModal').classList.add('hidden'); }

// --- Daily Notification ---
function checkDailyNotif() {
  if (lastDaily !== todayStr()) {
    $('dailyNotif').classList.remove('hidden');
  }
}
function closeDailyNotif() {
  $('dailyNotif').classList.add('hidden');
}

// --- Game Settings ---
const DIFFICULTY = {
  easy:    { rows: 9, cols: 9, bombs: 10 },
  medium:  { rows: 16, cols: 16, bombs: 40 },
  hard:    { rows: 16, cols: 30, bombs: 99 },
  extreme: { rows: 30, cols: 50, bombs: 240 }
};
let gameState = null;

// --- Game UI ---
function showGame(settings, isDaily=false) {
  $('mainMenu').classList.add('hidden');
  $('gameContainer').classList.remove('hidden');
  // Set minefield size
  let { rows, cols, bombs } = settings;
  let cellSize = $('cellSizeSelect').value || 'small';
  let sizePx = cellSize==='large'?42:cellSize==='medium'?36:32;
  let minefield = $('minefield');
  minefield.style.gridTemplateRows = `repeat(${rows},${sizePx}px)`;
  minefield.style.gridTemplateColumns = `repeat(${cols},${sizePx}px)`;

  // Generate Board
  gameState = createGameState(rows, cols, bombs);
  gameState.isDaily = isDaily;
  gameState.hintsLeft = 2;
  gameState.timer = 0;
  gameState.flags = 0;
  gameState.bombs = bombs;
  gameState.ended = false;
  gameState.started = false;
  updateBombCounter();
  updateTimer();
  updateSmiley('happy');
  updateHints();

  // Render
  renderBoard();
  clearInterval(gameState.timerIntv);
  gameState.timerIntv = setInterval(function() {
    if (gameState.started && !gameState.ended) {
      gameState.timer++;
      updateTimer();
    }
  }, 1000);
}

function createGameState(rows, cols, bombs) {
  // Setup empty board
  let field = [];
  for (let r=0; r<rows; r++) {
    let row = [];
    for (let c=0; c<cols; c++) row.push({ r, c, bomb: false, revealed: false, flagged: false, number: 0 });
    field.push(row);
  }
  // Place bombs randomly
  let positions = [];
  for (let r=0; r<rows; r++) for (let c=0; c<cols; c++) positions.push([r,c]);
  shuffle(positions);
  for (let i=0; i<bombs; i++) {
    let [r,c] = positions[i];
    field[r][c].bomb = true;
  }
  // Calculate numbers
  const drs = [-1,0,1];
  for (let r=0; r<rows; r++) for (let c=0; c<cols; c++) {
    if (field[r][c].bomb) continue;
    let n = 0;
    drs.forEach(dr=>drs.forEach(dc=>{
      let rr=r+dr, cc=c+dc;
      if (dr===0&&dc===0) return;
      if (rr>=0 && rr<rows && cc>=0 && cc<cols && field[rr][cc].bomb) n++;
    }));
    field[r][c].number = n;
  }
  return { field, rows, cols, bombs, started: false, ended: false, flags: 0, timer: 0 };
}

function renderBoard() {
  let minefield = $('minefield');
  minefield.innerHTML = '';
  let { field, rows, cols } = gameState;
  for (let r=0; r<rows; r++) for (let c=0; c<cols; c++) {
    let cell = field[r][c];
    let div = document.createElement('div');
    div.className = 'cell';
    div.dataset.r = r;
    div.dataset.c = c;
    if (cell.revealed) {
      div.classList.add('revealed');
      if (cell.bomb) div.classList.add('bomb');
      else if (cell.number > 0) div.textContent = cell.number;
    } else if (cell.flagged) {
      div.classList.add('flagged');
      div.textContent = '🚩';
    }
    div.onmousedown = (e) => handleCellClick(e, cell, div);
    div.ontouchstart = (e) => {
      e.preventDefault(); handleCellClick({button:0}, cell, div);
    };
    minefield.appendChild(div);
  }
}

function handleCellClick(e, cell, div) {
  if (gameState.ended) return;
  if (!gameState.started) { gameState.started = true; }
  if (e.button === 2 || e.ctrlKey) { // Right click (flag)
    if (!cell.revealed) {
      cell.flagged = !cell.flagged;
      gameState.flags += cell.flagged ? 1 : -1;
      updateBombCounter();
    }
  }
  else if (!cell.revealed && !cell.flagged) {
    revealCell(cell.r, cell.c);
    checkWin();
  }
  renderBoard();
}

function revealCell(r, c) {
  let { field, rows, cols } = gameState;
  let cell = field[r][c];
  if (cell.revealed || cell.flagged) return;
  cell.revealed = true;
  if (cell.bomb) {
    gameOver(false);
    return;
  }
  if (cell.number === 0) {
    [-1,0,1].forEach(dr=>[-1,0,1].forEach(dc=>{
      let rr=r+dr, cc=c+dc;
      if (dr===0&&dc===0) return;
      if (rr>=0 && rr<rows && cc>=0 && cc<cols) revealCell(rr,cc);
    }));
  }
}

function checkWin() {
  let { field, rows, cols, bombs } = gameState;
  let unrevealed = 0;
  for (let r=0; r<rows; r++) for (let c=0; c<cols; c++)
    if (!field[r][c].revealed && !field[r][c].bomb) unrevealed++;
  if (unrevealed === 0) {
    gameOver(true);
  }
}

function gameOver(win) {
  gameState.ended = true;
  updateSmiley(win ? 'win' : 'lose');
  clearInterval(gameState.timerIntv);
  // Reveal all bombs if lost
  if (!win) {
    let { field, rows, cols } = gameState;
    for (let r=0; r<rows; r++) for (let c=0; c<cols; c++)
      if (field[r][c].bomb) field[r][c].revealed = true;
    renderBoard();
  }
  // Save stats
  let mode = gameState.isDaily ? 'daily' : $('difficultySelect').value;
  let userStats = stats[session.username] = stats[session.username] || {};
  let m = userStats[mode] = userStats[mode] || { played:0, wins:0, bestTime:null };
  m.played++;
  if (win) {
    m.wins++;
    if (!m.bestTime || gameState.timer < m.bestTime) m.bestTime = gameState.timer;
    // Streaks
    if (gameState.isDaily) {
      if (streak.last !== todayStr()) {
        streak.current = streak.last === (new Date(Date.now()-864e5)).toISOString().slice(0,10) ? streak.current+1 : 1;
        if (streak.current > streak.best) streak.best = streak.current;
        streak.last = todayStr();
        localStorage.setItem(STORAGE.streak, JSON.stringify(streak));
      }
      lastDaily = todayStr();
      localStorage.setItem(STORAGE.lastDaily, lastDaily);
    }
  }
  localStorage.setItem(STORAGE.stats, JSON.stringify(stats));
}

function restartGame() {
  showGame(gameState.isDaily ? gameState.dailySettings : DIFFICULTY[$('difficultySelect').value], gameState.isDaily);
}

// --- UI Updates ---
function updateBombCounter() {
  $('bombCounter').textContent = pad(gameState.bombs - gameState.flags);
}
function updateTimer() {
  $('timer').textContent = pad(gameState.timer);
}
function updateSmiley(state) {
  const faces = { happy: '😊', win: '😎', lose: '😵' };
  $('smileyIcon').textContent = faces[state] || '😊';
}
function updateHints() {
  if (gameState.hintsLeft > 0 && !gameState.ended) {
    $('hintBulb').classList.remove('hidden');
    $('hintBulb').textContent = `💡x${gameState.hintsLeft}`;
  } else {
    $('hintBulb').classList.add('hidden');
  }
}
function useHint() {
  if (gameState.hintsLeft > 0 && !gameState.ended) {
    // Find a cell that is not revealed, not flagged, and not a bomb
    let safeCells = [];
    let { field, rows, cols } = gameState;
    for (let r=0; r<rows; r++) for (let c=0; c<cols; c++) {
      let cell = field[r][c];
      if (!cell.revealed && !cell.flagged && !cell.bomb) safeCells.push(cell);
    }
    if (safeCells.length) {
      let pick = safeCells[Math.floor(Math.random() * safeCells.length)];
      revealCell(pick.r, pick.c);
      gameState.hintsLeft--;
      updateHints();
      renderBoard();
      checkWin();
    }
  }
}

// --- Daily Challenge ---
function playDaily() {
  // Randomly select a difficulty (not extreme) and cell size
  let diffs = ['easy','medium','hard'];
  let diff = diffs[Math.floor(Math.random()*diffs.length)];
  let settings = DIFFICULTY[diff];
  let cellSizes = ['small','medium','large'];
  let cellSize = cellSizes[Math.floor(Math.random()*cellSizes.length)];
  $('difficultySelect').value = diff;
  $('cellSizeSelect').value = cellSize;
  showGame(settings, true);
  gameState.dailySettings = settings;
}

// --- Event Listeners ---
window.onload = function() {
  // Authentication
  if (!session || !users[session.username]) showLogin();
  else showMenu();

  $('loginForm').onsubmit = function(e) {
    e.preventDefault();
    let username = $('username').value.trim();
    let password = $('password').value;
    if (!username || !password) return;
    if (users[username] && users[username].password !== password) {
      $('loginError').textContent = "Incorrect password.";
      return;
    }
    if (users[username]) {
      loginUser(username, password);
    } else {
      if (Object.keys(users).includes(username)) {
        $('loginError').textContent = "Username taken.";
        return;
      }
      loginUser(username, password);
    }
  };

  $('logoutBtn').onclick = logoutUser;
  $('playBtn').onclick = () => showGame(DIFFICULTY[$('difficultySelect').value || 'easy']);
  $('settingsBtn').onclick = showSettings;
  $('settingsClose').onclick = hideSettings;
  $('statsBtn').onclick = showStats;
  $('statsClose').onclick = hideStats;
  $('howToBtn').onclick = showHowTo;
  $('howToClose').onclick = hideHowTo;
  $('notifClose').onclick = closeDailyNotif;
  $('backBtn').onclick = showMenu;
  $('fullscreenBtn').onclick = () => {
    let el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  };
  $('smileyFace').onclick = restartGame;
  $('hintBulb').onclick = useHint;
  $('cellSizeSelect').onchange = () => {
    if (gameState) showGame(DIFFICULTY[$('difficultySelect').value || 'easy']);
  };
  $('difficultySelect').onchange = () => {
    if (gameState) showGame(DIFFICULTY[$('difficultySelect').value || 'easy']);
  };
  $('dailyBtn').onclick = playDaily;

  // Right click = flag
  $('minefield').oncontextmenu = function(e) { e.preventDefault(); };

  // Theming
  setupThemePicker();
  $('themeSelect').onchange = (e) => setTheme(e.target.value);
};

// --- Mobile support ---
window.addEventListener('resize', () => {
  if (gameState) showGame(DIFFICULTY[$('difficultySelect').value || 'easy']);
});
