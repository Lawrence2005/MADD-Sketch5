const COLS = 90;
const ROWS = 42;

const glyphs = [
  ".", "·", ":", "…",
  "-", "=", "+", "*",
  "#", "%", "@", "?",
  "/", "\\", "|", "~",
  "0", "1",
  "░", "▒", "▓",
  "⌁", "⌂", "⌘",
  "◌", "◎", "◍",
  "⟡", "✶", "✹",
  "⧉", "⧗", "⧖",
  "♪", "♫"
];

let cells = [];
let frame = 0;
let events = [];
let lifeGrid = [];
let prevLifeGrid = [];
let currentEvent = null;

window.visualMetrics = {
  density: 0,
  change: 0,
  chaos: 0,
  currentEvent: null
};

window.addEventListener("load", initVisuals);

function initVisuals() {
  prepareEvents();
  createGrid();
  initLifeGrid();

  setInterval(drawFrame, 50); // about 20 FPS
}

function prepareEvents() {
  const raw = typeof AOL_DATA !== "undefined" ? AOL_DATA : [];

  events = raw.map((d, i) => {
    const query = d.query || "";
    const hour = getHour(d.time);
    const clicked = d.url && d.url.length > 0;
    const rank = parseInt(d.rank) || 0;
    const h = hash(String(d.user) + query + d.time + i);

    return {
      index: i,
      user: String(d.user || "0"),
      query,
      hidden: obscure(query),
      time: d.time || "",
      rank,
      url: d.url || "",
      qLength: query.length,
      wordCount: query.trim().split(/\s+/).filter(Boolean).length,
      hour,
      clicked,
      h
    };
  });

  if (events.length === 0) {
    events = fallbackEvents();
  }
}

function createGrid() {
  const grid = document.getElementById("grid");
  grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;

  for (let i = 0; i < COLS * ROWS; i++) {
    const span = document.createElement("span");
    span.className = "cell";
    span.textContent = ".";
    grid.appendChild(span);
    cells.push(span);
  }
}

function initLifeGrid() {
  lifeGrid = [];
  prevLifeGrid = [];

  for (let y = 0; y < ROWS; y++) {
    lifeGrid[y] = [];
    prevLifeGrid[y] = [];

    for (let x = 0; x < COLS; x++) {
      lifeGrid[y][x] = Math.random() < 0.04 ? 1 : 0;
      prevLifeGrid[y][x] = lifeGrid[y][x];
    }
  }
}

function drawFrame() {
  frame++;

  const f = Math.floor(frame * 0.25);
  const t = f * 0.05;

  currentEvent = events[f % events.length];

  // Every few frames, inject the current AOL search into the memory grid.
  if (frame % 8 === 0) {
    injectSearchIntoGrid(currentEvent);
  }

  if (frame % 3 === 0) {
    stepLifeGrid();
  }

  const density = getDensity();
  const change = getChange();
  const chaos = clamp(density * 1.8 + change * 4.2, 0, 1);

  window.visualMetrics = {
    density,
    change,
    chaos,
    currentEvent
  };

  if (frame % 8 === 0) {
    window.dispatchEvent(
      new CustomEvent("aol-search-step", {
        detail: {
          event: currentEvent,
          density,
          change,
          chaos
        }
      })
    );
  }

  updateOverlay(currentEvent, density, change, chaos);
  drawCharGrid(currentEvent, f, t, density, change, chaos);
}

function drawCharGrid(e, f, t, density, change, chaos) {
  const qLength = e.qLength;
  const wordCount = Math.max(1, e.wordCount);
  const hour = e.hour;
  const clicked = e.clicked;
  const rank = e.rank || 0;

  // AOL data controls the old minimum-rule wave.
  const dataPressure = mapValue(qLength, 0, 80, 0.35, 0.88);
  const waveCount = mapValue(wordCount, 1, 8, 2, 9);
  const speed = mapValue(hour, 0, 23, 0.15, 1.25);
  const waveHeight = clicked ? 0.25 : 0.12;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const yr = ROWS - 1 - y;
      const yt = (yr + f) % ROWS;

      const px = Math.floor((x + 0.2) * 17 + 83);
      const py = Math.floor(yt * 13 + 61);

      const alive = lifeGrid[y][x] === 1;

      let glyphIndex = Math.abs(
        px ^ py ^ ((px * py) >> 6) ^ f ^ e.h
      ) % glyphs.length;

      if (alive) {
        glyphIndex = (glyphIndex + 5 + Math.floor(chaos * 8)) % glyphs.length;
      }

      const edge =
        ROWS * dataPressure +
        Math.sin((x / COLS) * Math.PI * waveCount - t * speed) *
          ROWS *
          waveHeight;

      const heat = clamp(1 - yr / edge, 0, 1);
      const above = Math.max(0, (yr - edge) / (ROWS - edge));

      let hue;
      let sat;
      let lit;

      if (heat > 0.05) {
        // Warm search-pressure zone.
        hue = heat * 45;
        sat = 80 + heat * 20;
        lit = 25 + heat * 45;
      } else {
        // Cold digital shadow zone.
        hue = (115 + above * 110 + Math.sin(x * 0.2 + t * 0.3) * 25) % 360;
        sat = 55 - above * 20;
        lit = 8 + above * 24;
      }

      if (alive) {
        lit += 20;
        sat += 20;
      }

      if (clicked) {
        lit += 8;
      }

      if (rank > 0 && rank <= 3) {
        sat += 15;
      }

      hue = Math.floor(hue);
      sat = Math.floor(clamp(sat, 0, 100));
      lit = Math.floor(clamp(lit, 0, 85));

      const rotation =
        Math.sin(t + x * 0.5 + e.h * 0.001) * 30 +
        Math.cos(t * 0.8 + yr * 0.4) * 20;

      const opacity = alive ? 0.95 : 0.25 + heat * 0.65 + above * 0.15;

      const cell = cells[y * COLS + x];
      cell.textContent = glyphs[glyphIndex];
      cell.style.color = `hsl(${hue}, ${sat}%, ${lit}%)`;
      cell.style.opacity = opacity.toFixed(2);
      cell.style.transform = `rotate(${rotation.toFixed(1)}deg)`;
    }
  }
}

function injectSearchIntoGrid(e) {
  const cx = e.h % COLS;
  const cy = Math.floor(mapValue(e.hour, 0, 23, ROWS - 1, 0));

  const radius = Math.floor(mapValue(e.qLength, 0, 80, 1, 7));
  const intensity = e.clicked ? 0.65 : 0.38;

  for (let yy = -radius; yy <= radius; yy++) {
    for (let xx = -radius; xx <= radius; xx++) {
      const gx = (cx + xx + COLS) % COLS;
      const gy = (cy + yy + ROWS) % ROWS;

      const dist = Math.sqrt(xx * xx + yy * yy);
      if (dist <= radius && Math.random() < intensity) {
        lifeGrid[gy][gx] = 1;
      }
    }
  }
}

function stepLifeGrid() {
  const next = [];

  for (let y = 0; y < ROWS; y++) {
    next[y] = [];

    for (let x = 0; x < COLS; x++) {
      const n = countNeighbors(x, y);
      const alive = lifeGrid[y][x] === 1;

      // Mostly Game of Life, with slight mutation to keep it alive.
      let nextVal = n === 3 || (alive && n === 2) ? 1 : 0;

      if (Math.random() < 0.0015) {
        nextVal = nextVal ? 0 : 1;
      }

      next[y][x] = nextVal;
    }
  }

  prevLifeGrid = lifeGrid;
  lifeGrid = next;
}

function countNeighbors(x, y) {
  let total = 0;

  for (let yy = -1; yy <= 1; yy++) {
    for (let xx = -1; xx <= 1; xx++) {
      if (xx === 0 && yy === 0) continue;

      const nx = (x + xx + COLS) % COLS;
      const ny = (y + yy + ROWS) % ROWS;

      total += lifeGrid[ny][nx];
    }
  }

  return total;
}

function getDensity() {
  let alive = 0;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      alive += lifeGrid[y][x];
    }
  }

  return alive / (ROWS * COLS);
}

function getChange() {
  let changed = 0;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (lifeGrid[y][x] !== prevLifeGrid[y][x]) {
        changed++;
      }
    }
  }

  return changed / (ROWS * COLS);
}

function updateOverlay(e, density, change, chaos) {
  const current = document.getElementById("current-search");
  const metrics = document.getElementById("metrics");

  current.textContent =
    `user ${e.user} / ${e.time} / query shadow: ${e.hidden}`;

  metrics.innerHTML =
    `density: ${density.toFixed(3)}<br>` +
    `change: ${change.toFixed(3)}<br>` +
    `chaos: ${chaos.toFixed(3)}`;
}

function obscure(q) {
  if (!q) return "░░░";

  return q
    .trim()
    .split(/\s+/)
    .map(word => {
      if (word.length <= 2) return "░".repeat(word.length);
      return word[0] + "░".repeat(Math.min(word.length - 1, 10));
    })
    .join(" ");
}

function getHour(t) {
  const match = String(t).match(/\s(\d\d):/);
  if (match) return parseInt(match[1]);
  return 12;
}

function hash(str) {
  let h = 0;

  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }

  return Math.abs(h);
}

function mapValue(value, low1, high1, low2, high2) {
  const v = clamp((value - low1) / (high1 - low1), 0, 1);
  return low2 + (high2 - low2) * v;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function fallbackEvents() {
  return [
    {
      index: 0,
      user: "000000",
      query: "hidden search",
      hidden: "h░░░░░ s░░░░░",
      time: "2006-03-01 12:00:00",
      rank: 1,
      url: "",
      qLength: 13,
      wordCount: 2,
      hour: 12,
      clicked: true,
      h: 12345
    }
  ];
}