// Minesweeping: Full Minesweeper game, accounts, stats, theming, streak, hints, daily challenge
// --- Account System ---
const USERS_KEY = 'ms_users';
const SESSION_KEY = 'ms_session';
const STATS_KEY = 'ms_stats';
const SETTINGS_KEY = 'ms_settings';
const STREAK_KEY = 'ms_streak';
const LAST_DAILY_KEY = 'ms_last_daily';

// Difficulty presets
const DIFFICULTIES = {
  easy:    { rows: 9, cols: 9, bombs: 10 },
  medium:  { rows: 16, cols: 16, bombs: 40 },
  hard:    { rows: 24, cols: 24, bombs: 99 },
  extreme: { rows: 30, cols: 40, bombs: 180 }
};
const CELL_SIZES = { small: 22, medium: 32, large: 48 };

// --- Elements ---
const $ = id => document.getElementById(id);
const screens = {
  menu: $('menu'),
  game: $('game'),
  stats: $('stats'),
  howto: $('howto'),
  settings: $('settings'),
};
const authModal = $('auth-modal');
const authForm = $('auth-form');
const authError = $('auth-error');
const usernameInput = $('username');
const passwordInput = $('password');
const currentUserEl = $('current-user');
const userStreakEl = $('user-streak');
const dailyNotify = $('daily-notify');
const dailyMessage = $('daily-message');
const dailyClose = $('daily-close');
const startGameBtn = $('start-game-btn');
const dailyChallengeBtn = $('daily-challenge-btn');
const statsBtn = $('stats-btn');
const howToBtn = $('how-to-btn');
const settingsBtn = $('settings-btn');
const logoutBtn = $('logout-btn');
const backBtns = document.querySelectorAll('.back-btn');
const backToMenuBtn = $('back-to-menu');
// --- smileys are now images inside circles
const gameSmileyImg = $('game-smiley');
const gameHintIcon = $('game-hint-icon');
const timerEl = $('timer');
const bombsLeftEl = $('bombs-left');
const fullscreenBtn = $('fullscreen-btn');
const fieldFullscreenBtn = $('field-fullscreen-btn');
const minefield = $('minefield');
const minefieldContainer = $('minefield-container');
const difficultyLabel = $('difficulty-label');
const cellSizeLabel = $('cell-size-label');
const bombsFlaggedLabel = $('bombs-flagged-label');
const themeSelect = $('theme-select');
const difficultySelect = $('difficulty-select');
const cellSizeSelect = $('cell-size-select');
const saveSettingsBtn = $('save-settings-btn');
const statsContent = $('stats-content');
const hintIcon = $('hint-icon');
const smileyImg = $('smiley');

// --- State ---
let session = null;
let settings = null;
let stats = null;
let streak = null;
let mineState = null;
let timerInt = null;
let timerStart = null;
let hintsUsed = 0;
let dailyChallenge = null;

// --- Utility ---
function load(key, def) {
  try {
    return JSON.parse(localStorage.getItem(key)) || def;
  } catch { return def; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function daysBetween(date1, date2) {
  return Math.floor((date2 - date1) / (1000 * 3600 * 24));
}
function todayStr() {
  return (new Date()).toISOString().slice(0,10);
}
function shuffle(arr) {
  for(let i=arr.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// --- Account Handling ---
function requireLogin() {
  session = load(SESSION_KEY, null);
  if (!session) {
    authModal.classList.remove('hidden');
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    return false;
  }
  authModal.classList.add('hidden');
  return true;
}
authForm.onsubmit = function(e) {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) { authError.textContent = 'Fill both fields.'; return; }
  let users = load(USERS_KEY, {});
  if (users[username]) { authError.textContent = 'Username already taken.'; return; }
  users[username] = { password };
  save(USERS_KEY, users);
  session = { username };
  save(SESSION_KEY, session);
  // Setup stats and streak
  stats = load(STATS_KEY, {});
  stats[username] = stats[username] || { easy: { win:0, lose:0 }, medium: { win:0,lose:0 }, hard: { win:0,lose:0 }, extreme: {win:0,lose:0}, streak: 0, bestStreak: 0, gamesPlayed: 0, hintsUsed: 0 };
  save(STATS_KEY, stats);
  streak = load(STREAK_KEY, {});
  streak[username] = { lastDay: todayStr(), streak: 0, best: 0 };
  save(STREAK_KEY, streak);
  settings = load(SETTINGS_KEY, {});
  settings[username] = settings[username] || { theme:'classic', diff:'easy', size:'medium' };
  save(SETTINGS_KEY, settings);
  location.reload();
};

// --- Navigation ---
function showScreen(scr) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  scr.classList.remove('hidden');
  document.body.className = 'theme-' + (settings[session.username]?.theme || 'classic');
}
backBtns.forEach(btn => btn.onclick = () => showScreen(screens.menu));
backToMenuBtn.onclick = () => { clearGame(); showScreen(screens.menu); };

// --- Menu ---
function updateMenu() {
  currentUserEl.textContent = session.username;
  streak = load(STREAK_KEY, {});
  const st = streak[session.username] || { streak: 0, best: 0 };
  userStreakEl.textContent = `Streak: ${st.streak} (Best: ${st.best})`;
}
logoutBtn.onclick = function() {
  localStorage.removeItem(SESSION_KEY);
  location.reload();
};

// --- Daily Challenge ---
function setupDailyChallenge() {
  const lastDaily = load(LAST_DAILY_KEY, {});
  const today = todayStr();
  if (lastDaily[session.username] !== today) {
    // Generate daily
    const diffs = ['easy','medium','hard'];
    const diff = diffs[Math.floor(Math.random()*diffs.length)];
    const size = ['small','medium','large'][Math.floor(Math.random()*3)];
    dailyChallenge = { date: today, diff, size, completed: false };
    lastDaily[session.username] = today;
    save(LAST_DAILY_KEY, lastDaily);
    dailyNotify.classList.remove('hidden');
    dailyMessage.textContent = `New Daily Challenge! Difficulty: ${diff}, Cell Size: ${size}`;
    dailyClose.onclick = () => dailyNotify.classList.add('hidden');
  }
}
dailyChallengeBtn.onclick = function() {
  setupDailyChallenge();
  startGame('daily');
};

// --- Settings ---
function loadSettings() {
  settings = load(SETTINGS_KEY, {});
  settings[session.username] = settings[session.username] || { theme:'classic', diff:'easy', size:'medium' };
  themeSelect.value = settings[session.username].theme;
  difficultySelect.value = settings[session.username].diff;
  cellSizeSelect.value = settings[session.username].size;
}
settingsBtn.onclick = () => {
  loadSettings();
  showScreen(screens.settings);
};
saveSettingsBtn.onclick = function() {
  settings[session.username] = {
    theme: themeSelect.value,
    diff: difficultySelect.value,
    size: cellSizeSelect.value
  };
  save(SETTINGS_KEY, settings);
  showScreen(screens.menu);
  document.body.className = 'theme-' + themeSelect.value;
};

// --- Statistics ---
statsBtn.onclick = function() {
  stats = load(STATS_KEY, {});
  const s = stats[session.username] || {};
  statsContent.innerHTML = `
    <table>
      <tr><th>Mode</th><th>Win</th><th>Lose</th></tr>
      <tr><td>Easy</td><td>${s.easy?.win||0}</td><td>${s.easy?.lose||0}</td></tr>
      <tr><td>Medium</td><td>${s.medium?.win||0}</td><td>${s.medium?.lose||0}</td></tr>
      <tr><td>Hard</td><td>${s.hard?.win||0}</td><td>${s.hard?.lose||0}</td></tr>
      <tr><td>Extreme</td><td>${s.extreme?.win||0}</td><td>${s.extreme?.lose||0}</td></tr>
    </table>
    <p>Games Played: ${s.gamesPlayed||0}</p>
    <p>Hints Used: ${s.hintsUsed||0}</p>
    <p>Current Streak: ${s.streak||0}</p>
    <p>Best Streak: ${s.bestStreak||0}</p>
  `;
  showScreen(screens.stats);
};

// --- How To Play ---
howToBtn.onclick = () => showScreen(screens.howto);

// --- Game Setup ---
startGameBtn.onclick = function() { startGame('normal'); };
function startGame(mode) {
  clearGame();
  let diff, size;
  if (mode === 'daily' && dailyChallenge) {
    diff = dailyChallenge.diff;
    size = dailyChallenge.size;
  } else {
    diff = settings[session.username]?.diff || 'easy';
    size = settings[session.username]?.size || 'medium';
  }
  const preset = DIFFICULTIES[diff];
  const cellSz = CELL_SIZES[size];
  difficultyLabel.textContent = `Difficulty: ${diff}`;
  cellSizeLabel.textContent = `Cell Size: ${size}`;
  bombsFlaggedLabel.textContent = '';
  minefield.innerHTML = '';
  minefield.style.gridTemplateRows = `repeat(${preset.rows}, ${cellSz}px)`;
  minefield.style.gridTemplateColumns = `repeat(${preset.cols}, ${cellSz}px)`;
  mineState = makeMineState(preset.rows, preset.cols, preset.bombs);
  renderMinefield(cellSz);
  showScreen(screens.game);
  timerStart = Date.now();
  setSevenSegment(timerEl, 0);
  setSevenSegment(bombsLeftEl, preset.bombs);
  hintsUsed = 0;
  gameHintIcon.classList.remove('hidden');
  gameHintIcon.title = 'Click for hint';
  gameSmileyImg.src = 'littleguydefault.png';
  gameSmileyImg.classList.remove('lost','won');
  fullscreenBtn.onclick = () => document.documentElement.requestFullscreen();
  fieldFullscreenBtn.onclick = () => minefieldContainer.requestFullscreen();
  timerInt = setInterval(updateTimer, 1000);
}
function clearGame() {
  minefield.innerHTML = '';
  clearInterval(timerInt);
  setSevenSegment(timerEl, 0);
  setSevenSegment(bombsLeftEl, 0);
  bombsFlaggedLabel.textContent = '';
  mineState = null;
  hintsUsed = 0;
}

// --- Minefield Logic ---
function makeMineState(rows, cols, bombs) {
  let grid = Array.from({length: rows}, () =>
    Array.from({length: cols}, () => ({ revealed:false, bomb:false, flagged:false, num:0 }))
  );
  let allCells = [];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)allCells.push([r,c]);
  shuffle(allCells);
  for(let i=0;i<bombs;i++) {
    const [r,c] = allCells[i];
    grid[r][c].bomb = true;
  }
  for(let r=0;r<rows;r++) {
    for(let c=0;c<cols;c++) {
      if(grid[r][c].bomb)continue;
      let n=0;
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++) {
        if(dr===0&&dc===0)continue;
        const nr = r+dr, nc = c+dc;
        if(nr>=0&&nr<rows&&nc>=0&&nc<cols&&grid[nr][nc].bomb)n++;
      }
      grid[r][c].num = n;
    }
  }
  return {grid, rows, cols, bombs, flags:0, revealed:0, lost:false, won:false};
}
function renderMinefield(cellSz) {
  minefield.innerHTML = '';
  minefield.style.width = (mineState.cols * cellSz) + 'px';
  minefield.style.height = (mineState.rows * cellSz) + 'px';
  for(let r=0;r<mineState.rows;r++) {
    for(let c=0;c<mineState.cols;c++) {
      const cell = document.createElement('div');
      cell.className = `cell ${cellSz===CELL_SIZES.small?'small':cellSz===CELL_SIZES.large?'large':''}`;
      cell.dataset.r = r; cell.dataset.c = c;
      cell.onmousedown = e => handleCellClick(e, r, c);
      cell.ontouchstart = e => handleCellClick(e, r, c, true);
      minefield.appendChild(cell);
    }
  }
  updateField();
}
function updateField() {
  for(let r=0;r<mineState.rows;r++) {
    for(let c=0;c<mineState.cols;c++) {
      const cell = minefield.querySelector(`[data-r="${r}"][data-c="${c}"]`);
      const data = mineState.grid[r][c];
      cell.classList.remove('revealed','bomb','flag');
      cell.textContent = '';
      if(data.revealed) {
        cell.classList.add('revealed');
        if(data.bomb) { cell.classList.add('bomb'); cell.textContent = '💣'; }
        else if(data.num>0) cell.textContent = data.num;
      } else if(data.flagged) {
        cell.classList.add('flag');
        cell.textContent = '🚩';
      }
    }
  }
  setSevenSegment(bombsLeftEl, mineState.bombs - mineState.flags);
  bombsFlaggedLabel.textContent = `Flags placed: ${mineState.flags}`;
}
function handleCellClick(e, r, c, touch=false) {
  e.preventDefault();
  if(mineState.lost||mineState.won)return;
  const rightClick = touch ? false : (e.button === 2 || e.which === 3);
  if(rightClick || (touch && e.touches && e.touches.length>1)) {
    // Flag
    toggleFlag(r,c);
  } else {
    // Reveal
    revealCell(r,c);
  }
  updateField();
  checkWinLose();
}
minefield.oncontextmenu = e => e.preventDefault();
function toggleFlag(r,c) {
  const cell = mineState.grid[r][c];
  if(cell.revealed)return;
  cell.flagged = !cell.flagged;
  mineState.flags += cell.flagged ? 1 : -1;
}
function revealCell(r,c) {
  const cell = mineState.grid[r][c];
  if(cell.revealed||cell.flagged)return;
  cell.revealed = true;
  mineState.revealed++;
  if(cell.bomb) {
    mineState.lost = true;
    gameSmileyImg.src = 'littleguysad.png';
    gameSmileyImg.classList.add('lost');
    gameSmileyImg.classList.remove('won');
    endGame(false);
    return;
  } else if(cell.num===0) {
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++) {
      const nr=r+dr, nc=c+dc;
      if(nr>=0&&nr<mineState.rows&&nc>=0&&nc<mineState.cols)
        if(!mineState.grid[nr][nc].revealed && !mineState.grid[nr][nc].flagged) revealCell(nr,nc);
    }
  }
  if(mineState.revealed + mineState.bombs === mineState.rows*mineState.cols) {
    mineState.won = true;
    gameSmileyImg.src = 'littleguyhappy.png';
    gameSmileyImg.classList.add('won');
    gameSmileyImg.classList.remove('lost');
    endGame(true);
  }
}
function checkWinLose() {
  if(mineState.lost||mineState.won) {
    clearInterval(timerInt);
    gameHintIcon.classList.add('hidden');
  }
}
function endGame(win) {
  // Update stats & streak
  stats = load(STATS_KEY, {});
  const diff = difficultyLabel.textContent.split(':')[1].trim();
  stats[session.username][diff][win?'win':'lose']++;
  stats[session.username].gamesPlayed++;
  stats[session.username].hintsUsed += hintsUsed;
  if(win) {
    streak = load(STREAK_KEY, {});
    let st = streak[session.username];
    if(st.lastDay === todayStr()) st.streak++;
    else st.streak = 1;
    st.lastDay = todayStr();
    if(st.streak > st.best) st.best = st.streak;
    stats[session.username].streak = st.streak;
    stats[session.username].bestStreak = st.best;
    save(STREAK_KEY, streak);
  } else {
    stats[session.username].streak = 0;
  }
  save(STATS_KEY, stats);
  // Daily challenge
  if(dailyChallenge && !dailyChallenge.completed && win) {
    dailyChallenge.completed = true;
    dailyNotify.classList.remove('hidden');
    dailyMessage.textContent = 'You completed today\'s Daily Challenge!';
    dailyClose.onclick = () => dailyNotify.classList.add('hidden');
  }
  updateMenu();
}

// --- Timer ---
function updateTimer() {
  if (!timerStart) return;
  const sec = Math.floor((Date.now()-timerStart)/1000);
  setSevenSegment(timerEl, sec);
}

// --- Seven Segment display rendering ---
function setSevenSegment(el, num) {
  let str = Number(num).toString().padStart(3,'0');
  el.textContent = str;
}

// --- Smiley + Hint ---
gameSmileyImg.onclick = function() {
  if(mineState && (mineState.lost||mineState.won)) startGame('normal');
};
gameHintIcon.onclick = function() {
  if(hintsUsed>=2) return;
  const hint = getHint();
  if(hint) {
    revealCell(hint.r,hint.c);
    hintsUsed++;
    if(hintsUsed>=2) gameHintIcon.classList.add('hidden');
    updateField();
    checkWinLose();
  }
};
function getHint() {
  for(let r=0;r<mineState.rows;r++)for(let c=0;c<mineState.cols;c++) {
    const cell = mineState.grid[r][c];
    if(!cell.revealed && !cell.flagged && !cell.bomb) return {r,c};
  }
  return null;
}

// --- Smiley in menu (for daily/hint visual) ---
function updateMenuSmiley() {
  smileyImg.src = "littleguydefault.png";
  smileyImg.classList.remove('lost','won');
  if(dailyChallenge && !dailyChallenge.completed && dailyChallenge.date === todayStr()) {
    hintIcon.classList.remove('hidden');
    hintIcon.title = "Daily Challenge hint";
  } else {
    hintIcon.classList.add('hidden');
  }
}
smileyImg.onclick = () => startGame('normal');
hintIcon.onclick = () => gameHintIcon.onclick();

// --- Fullscreen ---
fullscreenBtn.onclick = () => document.documentElement.requestFullscreen();
fieldFullscreenBtn.onclick = () => minefieldContainer.requestFullscreen();

// --- On Load ---
window.onload = function() {
  if(requireLogin()) {
    session = load(SESSION_KEY, null);
    settings = load(SETTINGS_KEY, {});
    updateMenu();
    setupDailyChallenge();
    updateMenuSmiley();
    showScreen(screens.menu);
    document.body.className = 'theme-' + (settings[session.username]?.theme || 'classic');
  }
};
