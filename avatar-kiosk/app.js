(() => {
  const CFG = window.KIOSK_CONFIG;
  const FAQ = window.KIOSK_FAQ;
  const $ = (id) => document.getElementById(id);

  const UI = {
    bm: {
      hi: "Hai, saya",
      hint: "Sila pilih topik di bawah untuk mendapatkan maklumat yang anda perlukan.",
      ready: "Sedia membantu anda",
      speaking: "Sedang bercakap…",
      cta: "Sentuh pilihan untuk bermula",
      ctaTopic: "Sentuh soalan untuk mendengar jawapan",
      back: "Kembali",
      home: "Utama",
      stop: "Henti",
      replay: "Ulang",
      pick: "Pilih soalan di bawah dan saya akan menerangkannya kepada anda.",
      days: ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"],
      months: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"],
      am: "PG", pm: "PTG",
      ttsLang: "ms-MY",
    },
    en: {
      hi: "Hi, I'm",
      hint: "Please choose a topic below to get the information you need.",
      ready: "Ready to help you",
      speaking: "Speaking…",
      cta: "Touch an option to begin",
      ctaTopic: "Touch a question to hear the answer",
      back: "Back",
      home: "Home",
      stop: "Stop",
      replay: "Replay",
      pick: "Choose a question below and I'll explain it to you.",
      days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      am: "AM", pm: "PM",
      ttsLang: "en-US",
    },
  };

  const ICONS = {
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 12h-5a2 2 0 0 0 0 4h5v-4z"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8M8 9h2"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 11h18"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/>',
    map: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    home: '<path d="M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    replay: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    volume: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24">${ICONS[name] || ICONS.help}</svg>`;

  // Built-in illustrated avatar (used when CFG.avatar.image is empty)
  const AVATAR_SVG = `
  <svg viewBox="0 0 300 360" class="breathe">
    <defs>
      <linearGradient id="hijab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc2e8"/><stop offset="1" stop-color="#6f9fd3"/></linearGradient>
      <linearGradient id="uniform" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22305e"/><stop offset="1" stop-color="#121a38"/></linearGradient>
      <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c9a8"/><stop offset="1" stop-color="#e6b08c"/></linearGradient>
    </defs>
    <path d="M20 360c4-62 40-96 92-108h76c52 12 88 46 92 108z" fill="url(#uniform)"/>
    <path d="M150 262l-14 98h28z" fill="#0d1430" opacity=".6"/>
    <circle cx="95" cy="305" r="11" fill="#c9a33b"/><circle cx="95" cy="305" r="6" fill="#b3122e"/>
    <rect x="186" y="296" width="44" height="18" rx="4" fill="#fff" opacity=".9"/>
    <text x="208" y="309" font-size="10" font-weight="800" text-anchor="middle" fill="#13204a" font-family="Plus Jakarta Sans, sans-serif">${CFG.avatar.name}</text>
    <path d="M150 28c-58 0-92 44-92 104 0 40 12 72 30 94 16 20 40 34 62 46 22-12 46-26 62-46 18-22 30-54 30-94 0-60-34-104-92-104z" fill="url(#hijab)"/>
    <path d="M70 200c20 40 52 62 80 72 28-10 60-32 80-72-6 42-36 78-80 96-44-18-74-54-80-96z" fill="#5f8fc6"/>
    <ellipse cx="150" cy="140" rx="54" ry="66" fill="url(#skin)"/>
    <path d="M96 116c6-34 28-52 54-52s48 18 54 52c-14-14-32-22-54-22s-40 8-54 22z" fill="url(#hijab)"/>
    <g id="eyes" fill="#2a1a14">
      <ellipse cx="128" cy="138" rx="5.5" ry="6.5"/><ellipse cx="172" cy="138" rx="5.5" ry="6.5"/>
      <circle cx="130" cy="136" r="1.6" fill="#fff"/><circle cx="174" cy="136" r="1.6" fill="#fff"/>
    </g>
    <path d="M116 124q12-7 22-1M162 123q10-6 22 1" stroke="#4a2e22" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M150 146q-4 14 0 18" stroke="#c98f6c" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="118" cy="164" rx="10" ry="6" fill="#f08f8f" opacity=".25"/><ellipse cx="182" cy="164" rx="10" ry="6" fill="#f08f8f" opacity=".25"/>
    <g id="mouth">
      <path d="M134 176q16 14 32 0q-16 6-32 0z" fill="#a8323d"/>
      <path d="M137 177q13 4 26 0" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>
    </g>
  </svg>`;

  let lang = CFG.defaultLang || "bm";
  let state = { view: "home", topic: null, qIndex: null };
  let speaking = false, typingTimer = null, mouthTimer = null, idleTimer = null;
  const t = (obj) => (typeof obj === "string" ? obj : obj?.[lang] ?? obj?.bm ?? "");

  /* ---------- Static chrome ---------- */
  function renderChrome() {
    const ui = UI[lang];
    document.documentElement.lang = lang === "bm" ? "ms" : "en";
    $("orgName").textContent = CFG.org.name;
    $("orgTagline").textContent = `“${t(CFG.org.tagline)}”`;
    $("orgLogo").innerHTML = CFG.org.logo
      ? `<img src="${CFG.org.logo}" alt="">`
      : CFG.org.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    $("hiText").textContent = ui.hi;
    $("avatarName").textContent = CFG.avatar.name;
    $("avatarRole").textContent = `${t(CFG.avatar.role)} ${CFG.org.name}`;
    $("bubbleHint").textContent = ui.hint;
    $("ctaSite").textContent = CFG.org.website;
    $("langBtn").textContent = lang === "bm" ? "BM" : "EN";
    setStatus(speaking);
    $("ctaText").textContent = state.view === "home" ? ui.cta : ui.ctaTopic;
    tickClock();
  }

  function renderAvatar() {
    const el = $("avatar");
    if (CFG.avatar.image) {
      el.classList.add("photo");
      el.innerHTML = `<img src="${CFG.avatar.image}" alt="" class="breathe">`;
    } else {
      el.innerHTML = AVATAR_SVG;
      scheduleBlink();
    }
  }

  function scheduleBlink() {
    setTimeout(() => {
      const el = $("avatar");
      el.classList.add("blink");
      setTimeout(() => el.classList.remove("blink"), 140);
      scheduleBlink();
    }, 2500 + Math.random() * 3500);
  }

  function tickClock() {
    const ui = UI[lang], d = new Date();
    let h = d.getHours();
    const suffix = h < 12 ? ui.am : ui.pm;
    h = h % 12 || 12;
    $("date").textContent = `${ui.days[d.getDay()]}, ${d.getDate()} ${ui.months[d.getMonth()]} ${d.getFullYear()}`;
    $("time").textContent = `${h}:${String(d.getMinutes()).padStart(2, "0")} ${suffix}`;
  }

  function setStatus(isSpeaking) {
    $("statusPill").classList.toggle("speaking", isSpeaking);
    $("statusText").textContent = isSpeaking ? UI[lang].speaking : UI[lang].ready;
  }

  /* ---------- Views ---------- */
  function render() {
    const panel = $("panel"), ui = UI[lang];
    $("kiosk").classList.toggle("mode-topic", state.view === "topic");
    $("ctaText").textContent = state.view === "home" ? ui.cta : ui.ctaTopic;

    if (state.view === "home") {
      showBubble("home");
      panel.innerHTML = `<div class="grid">${FAQ.map((c, i) => `
        <button class="tile" data-topic="${i}" style="animation-delay:${i * 60}ms">
          <div class="tile-top">
            <span class="tile-icon">${icon(c.icon)}</span>
            <span class="tile-meta">${String(i + 1).padStart(2, "0")}<span class="chev">${icon("chev")}</span></span>
          </div>
          <div class="tile-title">${t(c.title)}</div>
          <div class="tile-sub">${t(c.subtitle)}</div>
        </button>`).join("")}</div>`;
      return;
    }

    const c = FAQ[state.topic];
    panel.innerHTML = `
      <div class="topic">
        <div class="topic-head">
          <span class="tile-icon">${icon(c.icon)}</span>
          <div><div class="topic-title">${t(c.title)}</div><div class="topic-sub">${t(c.subtitle)}</div></div>
        </div>
        <div class="q-list">${c.questions.map((q, i) => `
          <button class="q-item ${i === state.qIndex ? "active" : ""}" data-q="${i}" style="animation-delay:${i * 50}ms">
            <span class="q-num">${i === state.qIndex && speaking ? icon("volume") : i + 1}</span>
            <span>${t(q.q)}</span>
          </button>`).join("")}</div>
        <div class="nav-row">
          <button class="nav-btn" data-nav="home">${icon("back")}${ui.back}</button>
          <button class="nav-btn stop" data-nav="stop" ${speaking ? "" : "hidden"}>${icon("stop")}${ui.stop}</button>
          <button class="nav-btn stop" data-nav="replay" ${!speaking && state.qIndex !== null ? "" : "hidden"}>${icon("replay")}${ui.replay}</button>
        </div>
      </div>`;
  }

  function showBubble(mode, question = "", answer = "") {
    $("bubbleHome").hidden = mode !== "home";
    $("bubbleAnswer").hidden = mode === "home";
    if (mode !== "home") {
      $("answerQ").textContent = question;
      $("answerA").textContent = answer;
    }
  }

  /* ---------- Speech (one-way) ---------- */
  function pickVoice(code) {
    const voices = speechSynthesis.getVoices();
    const base = code.split("-")[0];
    return voices.find((v) => v.lang === code)
      || voices.find((v) => v.lang.startsWith(base))
      || (base === "ms" && voices.find((v) => v.lang.startsWith("id"))) // Indonesian is a close fallback for BM
      || null;
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    clearInterval(typingTimer); clearInterval(mouthTimer);
    speaking = false;
    setMouth(0);
    $("avatar").classList.remove("talking");
    setStatus(false);
    const caret = document.querySelector(".answer-a .caret");
    if (caret) caret.remove();
  }

  function setMouth(open) {
    const m = document.getElementById("mouth");
    if (m) m.style.transform = `scale(${1 - open * 0.15}, ${1 + open * 1.4})`;
  }

  function say(text, onDone) {
    stopSpeaking();
    speaking = true;
    setStatus(true);
    $("avatar").classList.add("talking");
    mouthTimer = setInterval(() => setMouth(Math.random()), 110);

    // Type the answer into the bubble alongside the voice
    const box = $("answerA");
    box.innerHTML = '<span class="txt"></span><span class="caret"></span>';
    const txt = box.querySelector(".txt");
    let i = 0;
    const msPerChar = 55 / (CFG.avatar.voiceRate || 1);
    typingTimer = setInterval(() => {
      txt.textContent = text.slice(0, ++i);
      box.scrollTop = box.scrollHeight;
      if (i >= text.length) clearInterval(typingTimer);
    }, msPerChar);

    const finish = () => {
      if (!speaking) return;
      txt.textContent = text;
      stopSpeaking();
      onDone && onDone();
    };

    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = UI[lang].ttsLang;
      const v = pickVoice(u.lang);
      if (v) u.voice = v;
      u.rate = CFG.avatar.voiceRate || 1;
      u.pitch = CFG.avatar.voicePitch || 1;
      u.onend = finish;
      u.onerror = () => setTimeout(finish, Math.max(0, text.length * msPerChar - 0));
      speechSynthesis.speak(u);
    } else {
      setTimeout(finish, text.length * msPerChar + 400);
    }
  }

  function playQuestion(qi) {
    const c = FAQ[state.topic], q = c.questions[qi];
    state.qIndex = qi;
    showBubble("answer", t(q.q), "");
    say(t(q.a), render);
    render();
  }

  /* ---------- Events ---------- */
  document.addEventListener("click", (e) => {
    resetIdle();
    const tile = e.target.closest("[data-topic]");
    const qBtn = e.target.closest("[data-q]");
    const nav = e.target.closest("[data-nav]");

    if (tile) {
      state = { view: "topic", topic: +tile.dataset.topic, qIndex: null };
      const c = FAQ[state.topic];
      showBubble("answer", t(c.title), "");
      say(UI[lang].pick);
      render();
    } else if (qBtn) {
      playQuestion(+qBtn.dataset.q);
    } else if (nav) {
      const a = nav.dataset.nav;
      if (a === "home") goHome();
      if (a === "stop") { stopSpeaking(); render(); }
      if (a === "replay" && state.qIndex !== null) playQuestion(state.qIndex);
    }
  });

  $("langBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    stopSpeaking();
    lang = lang === "bm" ? "en" : "bm";
    renderChrome();
    if (state.view === "topic") showBubble("answer", t(FAQ[state.topic].title), UI[lang].pick);
    state.qIndex = null;
    render();
  });

  function goHome() {
    stopSpeaking();
    state = { view: "home", topic: null, qIndex: null };
    render();
  }

  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (speaking) return resetIdle();
      goHome();
    }, (CFG.idleTimeoutSec || 60) * 1000);
  }

  // Block context menu / long-press on kiosk screens
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  /* ---------- Boot ---------- */
  if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  renderAvatar();
  renderChrome();
  render();
  setInterval(tickClock, 15000);
  resetIdle();
})();
