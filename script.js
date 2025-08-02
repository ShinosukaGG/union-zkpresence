let season0 = [];
let season1 = [];

// Load both JSONs
Promise.all([
  fetch('top_2000_from_network.json').then(r => r.json()),
  fetch('season1.json').then(r => r.json())
]).then(([s0, s1]) => {
  season0 = s0;
  season1 = s1;
});

// === Stat Calculations ===
function percentile(value, arr) {
  if (!arr.length) return 33;
  const sorted = arr.slice().sort((a, b) => b - a);
  const better = sorted.filter(v => v > value).length;
  const percentile = 1 - (better / sorted.length);
  return 33 + (percentile * 67);
}

// Main scoring logic (now caches per-username stats in localStorage)
function calculateStats(username) {
  const uname = username.toLowerCase();

  // Try to load from localStorage first
  const stored = localStorage.getItem("zkPresence-" + uname);
  if (stored) {
    try { return JSON.parse(stored); } catch(e){}
  }

  const userS0 = season0.find(u => u.username.toLowerCase() === uname);
  const userS1 = season1.find(u => u.username.toLowerCase() === uname);

  // Arrays for percentile
  const s0Array = season0.map(u => parseFloat(u.mindshare.replace('%', '')) || 0);
  const s1Array = season1.map(u => parseFloat(u.mindshare.replace('%', '')) || 0);

  // === Case 1: User not found in either ===
  if (!userS0 && !userS1) {
    const result = {
      pfp: `https://unavatar.io/twitter/${username}`,
      username,
      consistency: 0,
      effectiveness: 0,
      unionmaxi: 0,
      score: 0
    };
    localStorage.setItem("zkPresence-" + uname, JSON.stringify(result));
    return result;
  }

  // === Case 2: User found in only one ===
  // If in S0 only:
  if (userS0 && !userS1) {
    const mindshareS0 = parseFloat(userS0.mindshare.replace('%', '')) || 0;
    const consistency = percentile(mindshareS0, s0Array);
    // Random between 33-50 for missing S1
    const effectiveness = Math.floor(Math.random() * 18) + 33;
    // UnionMaxi: harmonic mean (but with random as second value)
    let unionmaxi = 2 * (consistency * effectiveness) / (consistency + effectiveness);
    const score = Math.round((consistency + effectiveness + unionmaxi) / 3);
    let pfp = userS0.pfp || userS0.avatar || `https://unavatar.io/twitter/${username}`;
    const result = {
      pfp,
      username,
      consistency: Math.round(consistency),
      effectiveness: Math.round(effectiveness),
      unionmaxi: Math.round(unionmaxi),
      score
    };
    localStorage.setItem("zkPresence-" + uname, JSON.stringify(result));
    return result;
  }

  // If in S1 only:
  if (!userS0 && userS1) {
    const mindshareS1 = parseFloat(userS1.mindshare.replace('%', '')) || 0;
    const effectiveness = percentile(mindshareS1, s1Array);
    // Random between 33-50 for missing S0
    const consistency = Math.floor(Math.random() * 18) + 33;
    // UnionMaxi: harmonic mean (but with random as second value)
    let unionmaxi = 2 * (consistency * effectiveness) / (consistency + effectiveness);
    const score = Math.round((consistency + effectiveness + unionmaxi) / 3);
    let pfp = userS1.pfp || userS1.avatar || `https://unavatar.io/twitter/${username}`;
    const result = {
      pfp,
      username,
      consistency: Math.round(consistency),
      effectiveness: Math.round(effectiveness),
      unionmaxi: Math.round(unionmaxi),
      score
    };
    localStorage.setItem("zkPresence-" + uname, JSON.stringify(result));
    return result;
  }

  // === Case 3: User in both ===
  const mindshareS0 = parseFloat(userS0.mindshare.replace('%', '')) || 0;
  const mindshareS1 = parseFloat(userS1.mindshare.replace('%', '')) || 0;
  const consistency = percentile(mindshareS0, s0Array);
  const effectiveness = percentile(mindshareS1, s1Array);
  let unionmaxi = 2 * (consistency * effectiveness) / (consistency + effectiveness);
  const score = Math.round((consistency + effectiveness + unionmaxi) / 3);
  let pfp = userS0.pfp || userS0.avatar || userS1.pfp || userS1.avatar || `https://unavatar.io/twitter/${username}`;
  const result = {
    pfp,
    username,
    consistency: Math.round(consistency),
    effectiveness: Math.round(effectiveness),
    unionmaxi: Math.round(unionmaxi),
    score
  };
  localStorage.setItem("zkPresence-" + uname, JSON.stringify(result));
  return result;
}

// === UI Logic ===
const landingBox = document.getElementById('landing-box');
const mainBox = document.getElementById('main-box');
const input = document.getElementById('username-input');
const calcBtn = document.getElementById('calculate-btn');
const shareBtn = document.getElementById('share-btn');

// --- Loading Steps ---
const loadingSteps = [
  { percent: 0,   text: "Fetching UserData..." },
  { percent: 18,  text: "Checking Mindshare Consistency..." },
  { percent: 36,  text: "Scanning Yapper Activity..." },
  { percent: 57,  text: "Checking zkGM Count..." },
  { percent: 77,  text: "Calculating UnionMaxi Synergy..." },
  { percent: 94,  text: "Compiling Stats & Score..." },
  { percent: 100, text: "Complete! Welcome to your zkPresence!" }
];

function sanitizeUsername(raw) {
  let u = raw.trim();
  if (u.startsWith('@')) u = u.slice(1);
  return u.toLowerCase();
}

// Animate/Set Stat
function setStat(key, value) {
  const bar = document.getElementById(`${key}-bar`);
  const val = document.getElementById(`${key}-val`);
  bar.style.width = `${value}%`;
  val.textContent = value + "%";
}

// --- Loader ---
function startZkPresenceLoading(onDone) {
  const overlay = document.getElementById('loading-overlay');
  const bar = document.getElementById('loading-bar-fg');
  const status = document.getElementById('loading-status');
  let progress = 0;
  overlay.style.display = 'flex';

  // Duration: 3s total, ~60 frames
  const duration = 3000;
  const stepTime = duration / 60;

  function step() {
    progress += 100 / 60; // 60 steps to 100
    if (progress > 100) progress = 100;
    bar.style.width = `${progress}%`;

    // Find the current loading step text
    let msg = loadingSteps[0].text;
    for (const step of loadingSteps) {
      if (progress >= step.percent) msg = step.text;
    }
    status.textContent = msg;

    if (progress < 100) {
      setTimeout(step, stepTime);
    } else {
      setTimeout(() => {
        overlay.style.display = 'none';
        if (onDone) onDone();
      }, 600);
    }
  }
  bar.style.width = `0%`;
  status.textContent = loadingSteps[0].text;
  setTimeout(step, 250);
}

// --- Main Entry ---
calcBtn.addEventListener('click', () => {
  const raw = input.value.trim();
  if (!raw) return;
  const username = sanitizeUsername(raw);

  // Calculate stats now, but only display after loading
  const stats = calculateStats(username);

  // Show main box and overlay loader
  landingBox.style.display = 'none';
  mainBox.style.display = 'flex';

  startZkPresenceLoading(() => {
    // Fill in after loading completes
    document.getElementById('pfp-img').src = stats.pfp;
    document.getElementById('main-username').textContent = "@" + username;
    setStat('consistency', stats.consistency);
    setStat('effectiveness', stats.effectiveness);
    setStat('unionmaxi', stats.unionmaxi);
    setStat('presence', stats.score);
  });
});

// --- Share Button ---
shareBtn.addEventListener('click', () => {
  const c = document.getElementById('consistency-val').textContent;
  const e = document.getElementById('effectiveness-val').textContent;
  const u = document.getElementById('unionmaxi-val').textContent;
  const p = document.getElementById('presence-val').textContent;

  const tweet = 
`My zkPresence stats in @union_build:

🧭 zkConsistency: ${c}
⚡ zkEffectiveness: ${e}
🫀 zkUnionMaxi: ${u}
🌐 zkPresence Score: ${p}

Calculate your zkPresence: union-zkpresence.vercel.app`;

  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
  window.open(url, '_blank');
});

// Allow Enter key for username input
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') calcBtn.click();
});
