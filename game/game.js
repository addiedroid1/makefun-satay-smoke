// Satay Smoke — Night-Market Grill Rush. A complete offline cooking game:
// pick ingredients (1-6 or click), grill skewers on 3 burners (flip at the green
// zone), assemble the plate to match the order ticket, pick a sauce, serve
// before patience runs out. Score, combos, tips, a 3:00 day timer, results.
//
// Deterministic screenshots: ?shot=start | rush | serve | results (with
// &seed=1) renders a fixed late-game scene with no timers running, so the
// screenshot is the same on every capture. Live play ignores ?shot.

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  // ---- icons: small flat SVGs, drawn by the game itself (no files, no network)
  var ICONS = {
    chicken: '<svg viewBox="0 0 32 32"><ellipse cx="17" cy="15" rx="11" ry="9" fill="#f2b25c"/><ellipse cx="17" cy="15" rx="6" ry="5" fill="#e08a3c"/><path d="M7 20 L3 26" stroke="#fff3df" stroke-width="4" stroke-linecap="round"/><circle cx="3" cy="27" r="2.4" fill="#fff3df"/></svg>',
    beef: '<svg viewBox="0 0 32 32"><rect x="6" y="7" width="20" height="18" rx="4" fill="#b34747"/><rect x="9" y="10" width="14" height="12" rx="3" fill="#d96a6a"/><circle cx="13" cy="15" r="2" fill="#f2a0a0"/><circle cx="20" cy="19" r="2" fill="#f2a0a0"/></svg>',
    tofu: '<svg viewBox="0 0 32 32"><rect x="5" y="9" width="22" height="15" rx="3" fill="#fdf6e3" stroke="#d8c49a" stroke-width="2"/><rect x="9" y="13" width="14" height="2" fill="#e8dcc0"/><rect x="9" y="18" width="9" height="2" fill="#e8dcc0"/></svg>',
    pepper: '<svg viewBox="0 0 32 32"><path d="M16 6 C8 6 6 14 8 22 C9 26 13 28 16 28 C19 28 23 26 24 22 C26 14 24 6 16 6Z" fill="#3fae4e"/><path d="M16 6 C16 3 18 2 20 2" stroke="#2c7a38" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
    onion: '<svg viewBox="0 0 32 32"><circle cx="16" cy="18" r="11" fill="#e8c8e8"/><path d="M16 7 C14 3 12 2 10 2 M16 7 C18 3 20 2 22 2" stroke="#8a5a8a" stroke-width="2" fill="none"/><path d="M10 14 Q16 18 22 14 M10 19 Q16 23 22 19" stroke="#c09ac0" stroke-width="1.6" fill="none"/></svg>',
    mushroom: '<svg viewBox="0 0 32 32"><path d="M4 16 C4 8 10 4 16 4 C22 4 28 8 28 16 Z" fill="#c98a5a"/><rect x="12" y="16" width="8" height="11" rx="3" fill="#f2e3c8"/><circle cx="12" cy="11" r="2" fill="#f2e3c8"/><circle cx="21" cy="9" r="2" fill="#f2e3c8"/></svg>',
    flame: '<svg viewBox="0 0 32 32"><path d="M16 3 C20 9 25 12 25 20 A9 9 0 1 1 7 20 C7 14 11 11 13 7 C14 10 15 11 16 11 C15 8 15 5 16 3Z" fill="#ff8c1a"/><path d="M16 14 C18 17 20 18 20 22 A4 4 0 1 1 12 22 C12 18 14 17 16 14Z" fill="#ffd23e"/></svg>',
    skewer: '<svg viewBox="0 0 32 32"><path d="M3 16 H29" stroke="#c9a06a" stroke-width="2.4"/><rect x="8" y="11" width="7" height="10" rx="2" fill="#f2b25c"/><rect x="17" y="11" width="7" height="10" rx="2" fill="#b34747"/></svg>'
  };

  var INGREDIENTS = [
    { id: 'chicken', name: 'Chicken', key: '1' },
    { id: 'beef', name: 'Beef', key: '2' },
    { id: 'tofu', name: 'Tofu', key: '3' },
    { id: 'pepper', name: 'Pepper', key: '4' },
    { id: 'onion', name: 'Onion', key: '5' },
    { id: 'mushroom', name: 'Mushroom', key: '6' }
  ];
  var SAUCES = ['Peanut', 'Sweet Soy', 'Chilli', 'Lime'];
  var DISHES = [
    { name: 'Chicken Satay Plate', needs: ['chicken', 'chicken', 'pepper'], sauce: 'Peanut', price: 14 },
    { name: 'Beef Satay Plate', needs: ['beef', 'beef', 'onion'], sauce: 'Sweet Soy', price: 16 },
    { name: 'Tofu Veggie Skewer', needs: ['tofu', 'pepper', 'mushroom'], sauce: 'Chilli', price: 12 },
    { name: 'Mixed Grill Platter', needs: ['chicken', 'beef', 'mushroom'], sauce: 'Lime', price: 18 }
  ];

  var DAY_SECONDS = 180;
  var state = null;

  function blankState() {
    return {
      timeLeft: DAY_SECONDS, score: 0, coins: 0, served: 0, target: 12,
      combo: 1, bestCombo: 1, selected: 'chicken', sauce: 'Peanut',
      orders: [], burners: [null, null, null], plate: [],
      plateDish: 0, running: false, over: false, tip: 'Serve fast for bigger tips!'
    };
  }

  function makeOrder(dishIdx, patience) {
    var d = DISHES[dishIdx];
    return { dish: dishIdx, name: d.name, needs: d.needs.slice(), sauce: d.sauce,
      price: d.price, patience: patience, maxPatience: patience, served: false };
  }

  function fmtTime(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }
  function fmtNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function iconFor(id) { return ICONS[id] || ''; }

  // ---- rendering ----
  function render() {
    $('timer').textContent = 'TIME ' + fmtTime(state.timeLeft);
    $('timer').classList.toggle('low', state.timeLeft <= 30);
    $('tbarFill').style.width = (100 * state.timeLeft / DAY_SECONDS) + '%';
    $('score').textContent = fmtNum(state.score);
    $('coins').textContent = state.coins;
    $('served').textContent = state.served + '/' + state.target;
    $('combo').textContent = '×' + state.combo;
    $('bestCombo').textContent = '×' + state.bestCombo;
    $('tipLine').textContent = state.tip;

    // orders
    var tl = $('ticketList'); tl.innerHTML = '';
    state.orders.forEach(function (o) {
      var div = document.createElement('div');
      div.className = 'ticket' + (o.served ? ' done' : o.patience < o.maxPatience * 0.3 ? ' urgent' : '');
      var pct = Math.max(0, 100 * o.patience / o.maxPatience);
      div.innerHTML = '<div class="dish">' + o.name + '</div>' +
        '<div class="price">$' + o.price + '</div>' +
        '<div class="need">' + o.needs.map(function (n) {
          return INGREDIENTS.filter(function (g) { return g.id === n; })[0].name;
        }).join(' + ') + ' · ' + o.sauce + ' sauce</div>' +
        '<div class="pbar"><div style="width:' + pct + '%"></div></div>' +
        '<div class="icons">' + o.needs.map(function (n) {
          return '<span class="mini">' + iconFor(n) + '</span>';
        }).join('') + '<span class="mini" style="background:#ffe9c9">' + o.sauce[0] + '</span></div>';
      tl.appendChild(div);
    });

    // burners
    var bb = $('burners'); bb.innerHTML = '';
    state.burners.forEach(function (b, i) {
      var div = document.createElement('div');
      div.className = 'burner' + (b ? ' hot' : '');
      var label, cls, fill, color;
      if (!b) { label = 'EMPTY — CLICK AN INGREDIENT'; cls = 'empty'; fill = 0; color = '#55555e'; }
      else if (b.done >= 100) { label = 'BURNT!'; cls = 'burnt'; fill = 100; color = '#ff5252'; }
      else if (b.done >= 95) { label = 'ALMOST BURNT!'; cls = 'burnt'; fill = b.done; color = '#ff5252'; }
      else if (b.done >= 68) { label = 'PERFECT — FLIP NOW'; cls = 'perfect'; fill = b.done; color = '#37d67a'; }
      else { label = 'COOKING ' + Math.round(b.done) + '%'; cls = 'cooking'; fill = b.done; color = '#ffd23e'; }
      var chunks = b ? b.items.map(function (it) {
        var c = { chicken: '#f2b25c', beef: '#b34747', tofu: '#fdf6e3', pepper: '#3fae4e', onion: '#e8c8e8', mushroom: '#c98a5a' }[it];
        return '<i style="background:' + c + '"></i>';
      }).join('') : '<span style="color:#66666e;font-size:12px;font-weight:700">— no skewer —</span>';
      div.innerHTML = '<div class="flame">' + (b ? ICONS.flame : '') + '</div>' +
        '<div class="sk">BURNER ' + (i + 1) + (b ? ' · ' + b.items.length + ' PCS' : '') + '</div>' +
        '<div class="skewer-art">' + chunks + '</div>' +
        '<div class="doneness"><div style="width:' + fill + '%;background:' + color + '"></div><div class="zone"></div></div>' +
        '<div class="dlabel ' + cls + '">' + label + '</div>';
      div.onclick = function () { flipBurner(i); };
      bb.appendChild(div);
    });

    // plate (dish mid-assembly)
    var dish = DISHES[state.plateDish];
    $('plateDish').textContent = dish.name + ' — ' + state.plate.length + '/' + dish.needs.length + ' skewers on';
    var ps = $('plateSlots'); ps.innerHTML = '';
    dish.needs.forEach(function (need, i) {
      var s = document.createElement('div');
      var got = state.plate[i];
      s.className = 'slot' + (got ? ' filled' : '');
      s.innerHTML = got ? iconFor(got) + ' ' + INGREDIENTS.filter(function (g) { return g.id === got; })[0].name : 'slot ' + (i + 1) + ': ' + need;
      ps.appendChild(s);
    });
    var sr = $('sauceRow'); sr.innerHTML = '';
    SAUCES.forEach(function (s) {
      var b = document.createElement('div');
      b.className = 'sauce' + (state.sauce === s ? ' on' : '');
      b.textContent = s;
      b.onclick = function () { state.sauce = s; beep(660); render(); };
      sr.appendChild(b);
    });

    // ingredient bins
    var bins = $('bins'); bins.innerHTML = '';
    INGREDIENTS.forEach(function (g) {
      var b = document.createElement('div');
      b.className = 'bin' + (state.selected === g.id ? ' sel' : '');
      b.innerHTML = '<div class="ic">' + iconFor(g.id) + '</div><div class="nm">' + g.name + '</div><div class="key">key ' + g.key + '</div>';
      b.onclick = function () { pickIngredient(g.id); };
      bins.appendChild(b);
    });

    // serve station
    var ready = state.plate.length === dish.needs.length && state.sauce === dish.sauce;
    var cur = state.orders[0];
    var matches = ready && cur && !cur.served && cur.dish === state.plateDish;
    $('readyLabel').textContent = matches ? '✓ PLATE READY — SERVE NOW!' : (ready ? 'PLATE BUILT — WRONG ORDER, CHECK TICKET' : 'BUILD THE PLATE FIRST…');
    $('readyLabel').className = 'ready' + (matches ? '' : ' wait');
    $('servePlate').className = 'serveplate' + (matches ? ' full' : '');
    $('serveFood').innerHTML = state.plate.length === 0 ? '— empty plate —'
      : dish.name + '<br>' + state.plate.length + '/' + dish.needs.length + ' · ' + state.sauce;
    var btn = $('serveBtn');
    btn.disabled = !matches;
    btn.classList.toggle('go', !!matches);
    btn.textContent = matches ? 'SERVE ▸ $' + (cur ? cur.price : 0) : 'SERVE ▸';
  }

  // ---- audio: tiny WebAudio blips, guarded (no files)
  var actx = null;
  function beep(freq) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = freq; o.type = 'triangle';
      g.gain.setValueAtTime(0.12, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.12);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.13);
    } catch (e) { /* sound is garnish; the game plays without it */ }
  }

  // ---- play ----
  function pickIngredient(id) {
    if (!state.running || state.over) return;
    state.selected = id; beep(520);
    var free = state.burners.indexOf(null);
    if (free < 0) { state.tip = 'All burners busy — flip a skewer first!'; render(); return; }
    state.burners[free] = { items: [id], done: 0 };
    state.tip = INGREDIENTS.filter(function (g) { return g.id === id; })[0].name + ' on burner ' + (free + 1) + ' — watch the green zone!';
    render();
  }
  function flipBurner(i) {
    if (!state.running || state.over) return;
    var b = state.burners[i];
    if (!b) { state.tip = 'Empty burner — pick an ingredient first.'; render(); return; }
    if (b.done >= 95) { state.burners[i] = null; state.combo = 1; state.tip = 'Overdone skewer binned. Combo reset.'; beep(180); render(); return; }
    if (b.done >= 68) {
      state.plate.push(b.items[0]);
      state.burners[i] = null;
      state.score += 10; state.tip = 'Perfect grill! +10 — onto the plate.';
      beep(880);
    } else {
      state.tip = 'Too early — wait for the green zone (68%+).';
      beep(300);
    }
    render();
  }
  function serve() {
    if (!state.running || state.over) return;
    var dish = DISHES[state.plateDish];
    var cur = state.orders[0];
    if (!cur || cur.served || cur.dish !== state.plateDish) return;
    if (state.plate.length !== dish.needs.length || state.sauce !== dish.sauce) return;
    var tip = cur.patience > cur.maxPatience * 0.6 ? 6 : 2;
    var earn = cur.price + tip;
    state.coins += earn; state.score += earn * 10 + state.combo * 5;
    state.combo += 1; state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.served += 1;
    cur.served = true;
    state.tip = 'Served! +$' + earn + ' (tip $' + tip + ') — combo ×' + state.combo;
    $('burst').textContent = '+$' + earn + ' TIP!';
    $('burst').classList.remove('hidden');
    setTimeout(function () { $('burst').classList.add('hidden'); }, 1200);
    beep(990);
    state.plate = [];
    state.orders.shift();
    state.orders.push(makeOrder(Math.floor(Math.random() * DISHES.length), 45 + Math.random() * 20));
    state.plateDish = state.orders[0].dish;
    if (state.served >= state.target) endDay(true);
    render();
  }
  function tick() {
    if (!state.running || state.over) return;
    state.timeLeft -= 0.25;
    state.orders.forEach(function (o) { if (!o.served) o.patience -= 0.25; });
    state.burners.forEach(function (b) { if (b) b.done = Math.min(110, b.done + 2.2); });
    var lost = state.orders[0];
    if (lost && !lost.served && lost.patience <= 0) {
      state.orders.shift();
      state.orders.push(makeOrder(Math.floor(Math.random() * DISHES.length), 50));
      state.plateDish = state.orders[0].dish;
      state.combo = 1; state.tip = 'Order walked out! Combo reset.';
    }
    if (state.timeLeft <= 0) { endDay(false); return; }
    render();
  }
  function endDay(won) {
    state.over = true; state.running = false;
    $('endScore').textContent = 'SCORE ' + fmtNum(state.score);
    $('endLine').textContent = state.served + ' ORDERS SERVED · BEST COMBO ×' + state.bestCombo + ' · $' + state.coins + ' EARNED';
    $('endDetail').textContent = (won ? 'All 12 orders served — the night market loves you!' : 'Time up — the crowd goes home hungry.') + ' · PLAY AGAIN FOR DAY 2';
    $('endOverlay').classList.remove('hidden');
    render();
  }
  function startDay() {
    state = blankState();
    state.orders = [makeOrder(0, 60), makeOrder(2, 75), makeOrder(1, 90)];
    state.plateDish = 0; state.running = true;
    $('startOverlay').classList.add('hidden');
    $('endOverlay').classList.add('hidden');
    render();
    setInterval(tick, 250);
  }

  // ---- deterministic shot states (screenshots only; no timers run) ----
  function applyShot(shot) {
    state = blankState();
    state.running = false;
    if (shot === 'start') {
      state.orders = [makeOrder(0, 60), makeOrder(2, 75), makeOrder(1, 90)];
      state.plateDish = 0;
      $('startOverlay').classList.remove('hidden');
    } else if (shot === 'rush') {
      state.timeLeft = 83; state.score = 1240; state.coins = 86; state.served = 8; state.combo = 5; state.bestCombo = 5;
      state.orders = [makeOrder(0, 14), makeOrder(1, 38), makeOrder(3, 70)];
      state.orders[0].patience = 14; state.orders[0].maxPatience = 60;
      state.orders[1].patience = 38; state.orders[1].maxPatience = 70;
      state.orders[2].patience = 70; state.orders[2].maxPatience = 85;
      state.burners = [
        { items: ['chicken'], done: 82 },
        { items: ['beef'], done: 45 },
        { items: ['chicken'], done: 97 }
      ];
      state.plate = ['chicken', 'chicken'];
      state.plateDish = 0; state.sauce = 'Peanut';
      state.selected = 'pepper';
      state.tip = 'One skewer PERFECT — flip it onto the plate!';
    } else if (shot === 'serve') {
      state.timeLeft = 64; state.score = 1870; state.coins = 104; state.served = 10; state.combo = 6; state.bestCombo = 6;
      state.orders = [makeOrder(0, 40), makeOrder(3, 65), makeOrder(2, 80)];
      state.burners = [
        { items: ['tofu'], done: 74 },
        null,
        { items: ['mushroom'], done: 30 }
      ];
      state.plate = ['chicken', 'chicken', 'pepper'];
      state.plateDish = 0; state.sauce = 'Peanut';
      state.selected = 'chicken';
      state.tip = 'Plate matches ticket #1 — SERVE now for +$14 and a fast tip!';
    } else if (shot === 'results') {
      state.timeLeft = 0; state.score = 2480; state.coins = 96; state.served = 12; state.combo = 7; state.bestCombo = 7;
      state.orders = [makeOrder(0, 60), makeOrder(2, 75), makeOrder(1, 90)];
      $('endScore').textContent = 'SCORE 2,480';
      $('endLine').textContent = '12 ORDERS SERVED · BEST COMBO ×7 · $96 EARNED';
      $('endDetail').textContent = '0 burnt skewers · 9 perfect grills · 3 five-star tips';
      $('endOverlay').classList.remove('hidden');
    }
    render();
  }

  // ---- boot ----
  function fit() {
    var s = Math.min(window.innerWidth / 1280, window.innerHeight / 480, 1.6);
    $('stage').style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', fit);

  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot');
  fit();
  if (shot) { applyShot(shot); return; }

  state = blankState();
  state.orders = [makeOrder(0, 60), makeOrder(2, 75), makeOrder(1, 90)];
  state.plateDish = 0;
  render();
  $('startOverlay').classList.remove('hidden');
  $('startOverlay').addEventListener('click', startDay);
  $('serveBtn').addEventListener('click', serve);
  document.addEventListener('keydown', function (e) {
    if (e.key === ' ') { e.preventDefault(); serve(); }
    if (e.key === 'p' || e.key === 'P') { state.running = !state.running; state.tip = state.running ? 'Back to the grill!' : 'Paused — press P to resume.'; render(); }
    var g = INGREDIENTS.filter(function (x) { return x.key === e.key; })[0];
    if (g) pickIngredient(g.id);
  });
})();
