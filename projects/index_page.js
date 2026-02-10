/**
 * Projects page (JSON-driven)
 * - Live search over name + summary + skills
 * - Skill filter dropdown (checkboxes), OR logic, staged apply
 * - Sort newest-first by created "YYYY-MM" (missing dates go bottom)
 * - Hide projects where showOnProjectsPage === false
 * - Simple pagination with ?page= (pageSize=20)
 */

const DATA_URL = "./content.json";
const pageSize = 20;

// State
let allProjects = [];
let filteredProjects = [];

let queryText = "";
let appliedSkills = new Set();   // skills currently applied to filtering
let stagedSkills = new Set();    // skills checked in dropdown before Apply

let currentPage = 1;

// ---------- DOM helpers ----------
function $(id) { return document.getElementById(id); }

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.entries(v).forEach(([dk, dv]) => node.dataset[dk] = dv);
    else if (k.startsWith("aria-")) node.setAttribute(k, v);
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  });
  children.forEach(ch => node.appendChild(typeof ch === "string" ? document.createTextNode(ch) : ch));
  return node;
}

// ---------- Sorting ----------
function parseCreatedYYYYMM(created) {
  // returns number for sorting or null if invalid/missing
  if (!created || typeof created !== "string") return null;
  const m = created.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  // sortable numeric (bigger = newer)
  return year * 100 + month;
}

function sortProjects(list) {
  return [...list].sort((a, b) => {
    const av = parseCreatedYYYYMM(a.created);
    const bv = parseCreatedYYYYMM(b.created);

    // missing dates go bottom
    if (av === null && bv === null) {
      return (a.name || "").localeCompare(b.name || "");
    }
    if (av === null) return 1;
    if (bv === null) return -1;

    if (bv !== av) return bv - av; // newest first
    return (a.name || "").localeCompare(b.name || "");
  });
}

// ---------- Rendering ----------
function renderProjects(projects) {
  const list = $("projectsList");
  clear(list);

  const pageProjects = paginate(projects, currentPage, pageSize);

  pageProjects.items.forEach(p => {
    const localUrl = `./${p.slug}/index.html`;

    const titleLine = el("h2", {}, [
      el("a", { href: localUrl }, [p.name || p.slug || "Untitled Project"])
    ]);

    const githubLine = p.github
      ? el("p", { class: "links", style: "margin:.5rem 0 0 0;" }, [
          el("a", { href: p.github, target: "_blank", rel: "noopener noreferrer" }, ["GitHub"])
        ])
      : null;

    const skillLine = (p.skills && p.skills.length)
      ? el("p", { class: "muted", style: "margin:.5rem 0 0 0;" }, [
          "Skills: ", p.skills.join(", ")
        ])
      : null;

    const demoLine = p.demo?.status
      ? el("p", { class: "muted", style: "margin:.5rem 0 0 0;" }, [
          "Demo: ", p.demo.status
        ])
      : null;

    const createdLine = p.created
      ? el("p", { class: "muted", style: "margin:.5rem 0 0 0;" }, [
          "Created: ", p.created
        ])
      : null;

    list.appendChild(el("article", { class: "card" }, [
      titleLine,
      el("p", { class: "muted", style: "margin:0;" }, [p.summary || ""]),
      skillLine,
      demoLine,
      createdLine,
      githubLine
    ]));
  });

  $("resultsMeta").textContent = `${projects.length} project${projects.length === 1 ? "" : "s"} found`;

  renderPagination(pageProjects.totalPages, currentPage);
  updateUrlPage(currentPage);
}

function renderPagination(totalPages, page) {
  const wrap = $("pagination");
  clear(wrap);

  if (totalPages <= 1) return;

  const makeBtn = (label, targetPage, opts = {}) => el("button", {
    type: "button",
    class: "page-btn",
    "aria-label": opts.ariaLabel || label,
    ...(opts.disabled ? { disabled: "true" } : {}),
    ...(opts.current ? { "aria-current": "page" } : {})
  }, [label]);

  // Prev
  const prevBtn = makeBtn("Prev", Math.max(1, page - 1), {
    disabled: page === 1,
    ariaLabel: "Previous page"
  });
  prevBtn.addEventListener("click", () => goToPage(page - 1));
  wrap.appendChild(prevBtn);

  // Windowed pages (keeps it clean if you have many)
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  if (start > 1) {
    const first = makeBtn("1", 1);
    first.addEventListener("click", () => goToPage(1));
    wrap.appendChild(first);
    if (start > 2) wrap.appendChild(el("span", { class: "muted" }, ["…"]));
  }

  for (let p = start; p <= end; p++) {
    const btn = makeBtn(String(p), p, { current: p === page });
    btn.addEventListener("click", () => goToPage(p));
    wrap.appendChild(btn);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) wrap.appendChild(el("span", { class: "muted" }, ["…"]));
    const last = makeBtn(String(totalPages), totalPages);
    last.addEventListener("click", () => goToPage(totalPages));
    wrap.appendChild(last);
  }

  // Next
  const nextBtn = makeBtn("Next", Math.min(totalPages, page + 1), {
    disabled: page === totalPages,
    ariaLabel: "Next page"
  });
  nextBtn.addEventListener("click", () => goToPage(page + 1));
  wrap.appendChild(nextBtn);
}

function paginate(items, page, size) {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * size;
  const end = start + size;
  return {
    items: items.slice(start, end),
    totalPages,
    page: safePage
  };
}

// ---------- Filters ----------
function normalize(s) {
  return String(s || "").toLowerCase().trim();
}

function applyFilters() {
  const q = normalize(queryText);

  const skills = appliedSkills;

  filteredProjects = allProjects.filter(p => {
    // visibility
    if (p.showOnProjectsPage === false) return false;

    // search: name + summary + skills
    if (q) {
      const hay = [
        p.name,
        p.summary,
        Array.isArray(p.skills) ? p.skills.join(" ") : ""
      ].map(normalize).join(" ");
      if (!hay.includes(q)) return false;
    }

    // skill OR logic
    if (skills.size > 0) {
      const projSkills = new Set((p.skills || []).map(s => String(s)));
      let match = false;
      for (const s of skills) {
        if (projSkills.has(s)) { match = true; break; }
      }
      if (!match) return false;
    }

    return true;
  });

  filteredProjects = sortProjects(filteredProjects);

  currentPage = getPageFromUrl(); // keep URL in sync when filtering
  currentPage = 1; // reset to first page on filter change
  renderProjects(filteredProjects);
  renderActiveFiltersText();
}

function renderActiveFiltersText() {
  const parts = [];
  if (queryText.trim()) parts.push(`Search: “${queryText.trim()}”`);
  if (appliedSkills.size) parts.push(`Skills: ${[...appliedSkills].join(", ")}`);
  $("activeFiltersText").textContent = parts.length ? parts.join(" • ") : "";
}

// ---------- Skills dropdown ----------
function uniqueSkills(projects) {
  const set = new Set();
  projects.forEach(p => (p.skills || []).forEach(s => set.add(String(s))));
  return [...set].sort((a, b) => a.localeCompare(b));
}

function renderSkillsList(skills) {
  const wrap = $("skillsList");
  clear(wrap);

  skills.forEach(skill => {
    const id = `skill_${skill.replace(/\W+/g, "_")}`;

    const cb = el("input", {
      type: "checkbox",
      id,
      value: skill
    });

    // staged selection (not applied until Apply)
    cb.checked = stagedSkills.has(skill);
    cb.addEventListener("change", () => {
      if (cb.checked) stagedSkills.add(skill);
      else stagedSkills.delete(skill);
    });

    const label = el("label", { for: id }, [skill]);

    wrap.appendChild(el("div", { class: "skill-item" }, [cb, label]));
  });
}

function openSkills() {
  const panel = $("skillsPanel");
  const btn = $("skillsBtn");
  panel.hidden = false;
  btn.setAttribute("aria-expanded", "true");
}

function closeSkills() {
  const panel = $("skillsPanel");
  const btn = $("skillsBtn");
  panel.hidden = true;
  btn.setAttribute("aria-expanded", "false");
}

function isSkillsOpen() {
  return !$("skillsPanel").hidden;
}

function initSkillsDropdown() {
  const btn = $("skillsBtn");
  const panel = $("skillsPanel");
  const dropdown = $("skillsDropdown");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isSkillsOpen()) closeSkills();
    else openSkills();
  });

  // click outside closes WITHOUT applying (your choice)
  document.addEventListener("click", (e) => {
    if (!isSkillsOpen()) return;
    if (!dropdown.contains(e.target)) {
      // revert staged changes to what is currently applied
      stagedSkills = new Set(appliedSkills);
      syncSkillsCheckboxes();
      closeSkills();
    }
  });

  // ESC closes without applying
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isSkillsOpen()) {
      stagedSkills = new Set(appliedSkills);
      syncSkillsCheckboxes();
      closeSkills();
    }
  });

  $("skillsResetBtn").addEventListener("click", () => {
    stagedSkills = new Set();
    syncSkillsCheckboxes();
  });

  $("skillsApplyBtn").addEventListener("click", () => {
    appliedSkills = new Set(stagedSkills);
    closeSkills();
    applyFilters();
  });

  // prevent click inside panel from bubbling to document and closing
  panel.addEventListener("click", (e) => e.stopPropagation());
}

function syncSkillsCheckboxes() {
  const wrap = $("skillsList");
  if (!wrap) return;
  wrap.querySelectorAll("input[type='checkbox']").forEach(cb => {
    cb.checked = stagedSkills.has(cb.value);
  });
}

// ---------- URL page param ----------
function getPageFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("page");
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function updateUrlPage(page) {
  const params = new URLSearchParams(window.location.search);
  params.set("page", String(page));
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  history.replaceState({}, "", newUrl);
}

function goToPage(page) {
  currentPage = page;
  renderProjects(filteredProjects);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Load JSON + init ----------
async function loadProjects() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);
  const data = await res.json();

  const raw = Array.isArray(data.projects) ? data.projects : [];
  // hide placeholders if field omitted? default true
  allProjects = raw.map(p => ({
    showOnProjectsPage: p.showOnProjectsPage !== false,
    ...p
  }));

  allProjects = sortProjects(allProjects);

  // skills list from visible projects only (so hidden placeholders don't pollute)
  const skills = uniqueSkills(allProjects.filter(p => p.showOnProjectsPage !== false));
  renderSkillsList(skills);

  // init staged/applied sets empty
  appliedSkills = new Set();
  stagedSkills = new Set();

  // init page from URL
  currentPage = getPageFromUrl();

  filteredProjects = allProjects.filter(p => p.showOnProjectsPage !== false);
  renderProjects(filteredProjects);
}

function initSearchAndClear() {
  const search = $("searchInput");
  const clearBtn = $("clearBtn");

  // live search (simple + fast for static page)
  search.addEventListener("input", () => {
    queryText = search.value;
    applyFilters();
  });

  clearBtn.addEventListener("click", () => {
    queryText = "";
    appliedSkills = new Set();
    stagedSkills = new Set();
    $("searchInput").value = "";
    syncSkillsCheckboxes();
    applyFilters();
  });
}

async function loadNav() {
  const res = await fetch("/nav.html");
  if (!res.ok) return;
  $("siteNav").innerHTML = await res.text();
}

(async function init() {
  await loadNav();

  initSkillsDropdown();
  initSearchAndClear();

  try {
    await loadProjects();
    applyFilters(); // ensures meta line, ordering, and URL page reset
  } catch (err) {
    $("resultsMeta").textContent = "Could not load projects.";
    console.error(err);
  }
})();
