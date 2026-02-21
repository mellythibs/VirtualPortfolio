const DATA_URL = "./post.json";
const pageSize = 10;

let allPosts = [];
let filteredPosts = [];
let currentPage = 1;
let queryText = "";

// Tag filter state
let appliedTags = new Set();  // tags currently applied to filtering
let stagedTags = new Set();   // checked tags in dropdown before Apply

function $(id) { return document.getElementById(id); }

function parseCreated(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d) ? null : d.getTime();
}

function sortPosts(list) {
  return [...list].sort((a, b) => {
    const av = parseCreated(a.date); // NOTE: your JSON uses "date"
    const bv = parseCreated(b.date);
    return (bv || 0) - (av || 0);
  });
}

function uniqueTags(posts) {
  const set = new Set();
  posts.forEach(p => (p.tags || []).forEach(t => set.add(String(t))));
  return [...set].sort((a, b) => a.localeCompare(b));
}

function renderTagsList(tags) {
  const wrap = $("skillsList"); // reuse your existing HTML ids
  wrap.innerHTML = "";

  tags.forEach(tag => {
    const id = `tag_${tag.replace(/\W+/g, "_")}`;

    const row = document.createElement("div");
    row.className = "skill-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = id;
    cb.value = tag;
    cb.checked = stagedTags.has(tag);

    cb.addEventListener("change", () => {
      if (cb.checked) stagedTags.add(tag);
      else stagedTags.delete(tag);
    });

    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = tag;

    row.appendChild(cb);
    row.appendChild(label);
    wrap.appendChild(row);
  });
}

function syncTagCheckboxes() {
  const wrap = $("skillsList");
  if (!wrap) return;
  wrap.querySelectorAll("input[type='checkbox']").forEach(cb => {
    cb.checked = stagedTags.has(cb.value);
  });
}

function openTags() {
  $("skillsPanel").hidden = false;
  $("skillsBtn").setAttribute("aria-expanded", "true");
}

function closeTags() {
  $("skillsPanel").hidden = true;
  $("skillsBtn").setAttribute("aria-expanded", "false");
}

function isTagsOpen() {
  return !$("skillsPanel").hidden;
}

function initTagsDropdown() {
  const btn = $("skillsBtn");
  const panel = $("skillsPanel");
  const dropdown = $("skillsDropdown");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isTagsOpen()) closeTags();
    else openTags();
  });

  document.addEventListener("click", (e) => {
    if (!isTagsOpen()) return;
    if (!dropdown.contains(e.target)) {
      // revert staged changes to currently applied
      stagedTags = new Set(appliedTags);
      syncTagCheckboxes();
      closeTags();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isTagsOpen()) {
      stagedTags = new Set(appliedTags);
      syncTagCheckboxes();
      closeTags();
    }
  });

  $("skillsResetBtn").addEventListener("click", () => {
    stagedTags = new Set();
    syncTagCheckboxes();
  });

  $("skillsApplyBtn").addEventListener("click", () => {
    appliedTags = new Set(stagedTags);
    closeTags();
    applyFilters();
  });

  panel.addEventListener("click", (e) => e.stopPropagation());
}

function renderActiveFiltersText() {
  const parts = [];
  if (queryText.trim()) parts.push(`Search: “${queryText.trim()}”`);
  if (appliedTags.size) parts.push(`Tags: ${[...appliedTags].join(", ")}`);
  $("activeFiltersText").textContent = parts.length ? parts.join(" • ") : "";
}

function renderPosts(posts) {
  const list = $("blogList");
  list.innerHTML = "";

  posts.forEach(p => {
    // Your current convention:
    const url = `./blog_posts/${p.slug}.html`;  // change if you switch to post.html?slug=

    const article = document.createElement("article");
    article.className = "card";

    article.innerHTML = `
      <h2><a href="${url}">${p.title}</a></h2>
      <p class="muted">${p.summary || ""}</p>
      <p class="muted">Published: ${p.date || ""}</p>
      ${(p.tags && p.tags.length) ? `<p class="muted">Tags: ${p.tags.join(", ")}</p>` : ""}
    `;

    list.appendChild(article);
  });

  $("resultsMeta").textContent =
    `${posts.length} post${posts.length === 1 ? "" : "s"} found`;
}

function applyFilters() {
  const q = queryText.toLowerCase().trim();

  filteredPosts = allPosts.filter(p => {
    // Only published posts (your JSON uses status)
    if (p.status !== "published") return false;

    // Search title + summary + tags
    if (q) {
      const hay = [
        p.title,
        p.summary,
        Array.isArray(p.tags) ? p.tags.join(" ") : ""
      ].join(" ").toLowerCase();

      if (!hay.includes(q)) return false;
    }

    // Tag OR logic
    if (appliedTags.size > 0) {
      const postTags = new Set((p.tags || []).map(String));
      let match = false;
      for (const t of appliedTags) {
        if (postTags.has(t)) { match = true; break; }
      }
      if (!match) return false;
    }

    return true;
  });

  filteredPosts = sortPosts(filteredPosts);
  renderPosts(filteredPosts);
  renderActiveFiltersText();
}

async function loadPosts() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);
  const data = await res.json();

  allPosts = Array.isArray(data.posts) ? data.posts : [];
  allPosts = sortPosts(allPosts);

  // Build tag list from published posts only (optional but cleaner)
  const tags = uniqueTags(allPosts.filter(p => p.status === "published"));
  renderTagsList(tags);

  appliedTags = new Set();
  stagedTags = new Set();

  applyFilters();
}

document.addEventListener("DOMContentLoaded", () => {
  initTagsDropdown();

  $("searchInput").addEventListener("input", e => {
    queryText = e.target.value;
    applyFilters();
  });

  $("clearBtn").addEventListener("click", () => {
    queryText = "";
    appliedTags = new Set();
    stagedTags = new Set();
    $("searchInput").value = "";
    syncTagCheckboxes();
    applyFilters();
  });

  loadPosts().catch(err => console.error(err));
});