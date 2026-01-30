async function loadPosts() {
  const res = await fetch("./posts.json");
  if (!res.ok) throw new Error("Failed to load posts.json");
  return res.json();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}

function clear(node) { node.innerHTML = ""; }
function normalize(str) { return (str || "").toLowerCase().trim(); }

function uniqueTags(posts) {
  const set = new Set();
  posts.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function matchesSearch(post, query) {
  if (!query) return true;
  const q = normalize(query);
  const hay = normalize([post.title, post.summary, ...(post.tags || [])].join(" "));
  return hay.includes(q);
}

function matchesTag(post, tag) {
  if (!tag) return true;
  return (post.tags || []).includes(tag);
}

function formatDate(iso) {
  // bare bones: keep ISO or make it nicer later
  return iso || "";
}

function renderTagFilters(tags, selectedTag, onSelect) {
  const root = document.getElementById("tagFilters");
  clear(root);

  tags.forEach(tag => {
    const pressed = tag === selectedTag;
    const pill = el("span", {
      class: "pill",
      role: "button",
      tabindex: "0",
      "aria-pressed": String(pressed),
      "aria-label": `Filter by ${tag}`,
      onclick: () => onSelect(pressed ? null : tag),
      onkeydown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(pressed ? null : tag);
        }
      }
    }, [tag]);

    root.appendChild(pill);
  });
}

function renderMeta(count, total, selectedTag, query) {
  const meta = document.getElementById("resultsMeta");
  const parts = [];
  parts.push(`${count} of ${total} posts`);
  if (selectedTag) parts.push(`tag: ${selectedTag}`);
  if (query) parts.push(`search: "${query}"`);
  meta.textContent = parts.join(" · ");
}

function renderPosts(posts) {
  const list = document.getElementById("postsList");
  clear(list);

  posts.forEach(p => {
    const localUrl = `./${p.slug}/`; // /blog/<slug>/
    const tagLine = (p.tags && p.tags.length)
      ? el("p", { class: "muted", style: "margin:.5rem 0 0 0;" }, ["Tags: ", p.tags.join(", ")])
      : null;

    list.appendChild(el("article", { class: "card" }, [
      el("h2", {}, [el("a", { href: localUrl }, [p.title])]),
      el("p", { class: "muted", style: "margin:0;" }, [formatDate(p.date)]),
      el("p", { style: "margin:.5rem 0 0 0;" }, [p.summary || ""]),
      tagLine
    ]));
  });
}

async function loadNav() {
  const res = await fetch("/nav.html");
  if (!res.ok) return;
  document.getElementById("siteNav").innerHTML = await res.text();
}

loadNav();


(async function init() {
  try {
    const data = await loadPosts();
    const allPosts = (data.posts || [])
      .filter(p => (p.status || "published") === "published") // hide drafts by default
      .sort((a, b) => (b.date || "").localeCompare(a.date || "")); // newest first

    const tags = uniqueTags(allPosts);

    let selectedTag = null;
    let query = "";

    const searchInput = document.getElementById("searchInput");
    const clearBtn = document.getElementById("clearBtn");

    function applyAndRender() {
      const filtered = allPosts.filter(p => matchesTag(p, selectedTag) && matchesSearch(p, query));
      renderTagFilters(tags, selectedTag, (nextTag) => { selectedTag = nextTag; applyAndRender(); });
      renderMeta(filtered.length, allPosts.length, selectedTag, query);
      renderPosts(filtered);
    }

    searchInput.addEventListener("input", (e) => {
      query = e.target.value || "";
      applyAndRender();
    });

    clearBtn.addEventListener("click", () => {
      selectedTag = null;
      query = "";
      searchInput.value = "";
      applyAndRender();
    });

    applyAndRender();
  } catch (err) {
    console.error(err);
    document.body.innerHTML =
      "<main style='max-width:900px;margin:0 auto;padding:2rem;font-family:system-ui'>Failed to load blog posts. Check console.</main>";
  }
})();
