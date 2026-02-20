async function loadContent() {
  const res = await fetch("./content.json");
  if (!res.ok) throw new Error("Failed to load content.json");
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

function clear(node) {
  node.innerHTML = "";
}

function renderBasics(data) {
  document.getElementById("name").textContent = data.basics.name;
  document.getElementById("tagline").textContent = data.basics.tagline;

  const linksUl = document.getElementById("links");
  clear(linksUl);

  for (const link of data.basics.links) {
    linksUl.appendChild(el("li", {}, [
      el("a", { href: link.url, target: "_blank", rel: "noopener noreferrer" }, [link.label])
    ]));
  }

  linksUl.appendChild(el("li", {}, [data.basics.location]));
}

function renderSummary(data) {
  const summary = document.getElementById("summary");
  clear(summary);

  data.summary.forEach(p => summary.appendChild(el("p", {}, [p])));
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || "Other";
    acc[k] = acc[k] || [];
    acc[k].push(item);
    return acc;
  }, {});
}

function renderExperience(data) {
  const root = document.getElementById("experience");
  clear(root);

  data.experience.forEach(role => {
    const header = el("div", {}, [
      el("h3", { style: "margin:0 0 .25rem 0;" }, [`${role.title} — ${role.org}`]),
      el("p", { class: "muted", style: "margin:0 0 .5rem 0;" }, [`${role.location} · ${role.dates}`])
    ]);

    const bullets = el("ul", {}, role.bullets.map(b => el("li", {}, [b])));
    root.appendChild(el("article", { style: "margin-bottom: 1.5rem;" }, [header, bullets]));
  });
}

function renderEducation(data) {
  const root = document.getElementById("education");
  clear(root);

  data.experience.forEach(role => {
    const header = el("div", {}, [
      el("h3", { style: "margin:0 0 .25rem 0;" }, [`${role.title} — ${role.org}`]),
      el("p", { class: "muted", style: "margin:0 0 .5rem 0;" }, [`${role.location} · ${role.dates}`])
    ]);

    const bullets = el("ul", {}, role.bullets.map(b => el("li", {}, [b])));
    root.appendChild(el("article", { style: "margin-bottom: 1.5rem;" }, [header, bullets]));
  });
}

function renderFooter(data) {
  document.getElementById("footerNote").textContent = data.footer.note;

  const emailLink = document.getElementById("emailLink");
  emailLink.textContent = data.basics.email;
  emailLink.href = `mailto:${data.basics.email}`;
}

function buildProjectIndex(projects) {
  const byId = new Map();
  projects.forEach(p => byId.set(p.id, p));
  return byId;
}

function renderRelatedProjects(skillName, projectIds, projectIndex) {
  const hint = document.getElementById("skillHint");
  const root = document.getElementById("relatedProjects");

  clear(root);

  hint.textContent = skillName
    ? `Projects tagged to: ${skillName}`
    : "Pick a skill to see project matches.";

  if (!skillName) return;

  if (!projectIds || projectIds.length === 0) {
    root.appendChild(el("p", { class: "muted", style: "margin:0;" }, [
      "No projects mapped yet — you can add them in content.json."
    ]));
    return;
  }

  projectIds.forEach(id => {
    const p = projectIndex.get(id);
    if (!p) return;

    const links = (p.links || []).map(l =>
      el("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, [l.label])
    );

    const linksLine = links.length
      ? el("p", { class: "muted", style: "margin:.25rem 0 0 0;" }, [
          ...links.flatMap((a, i) => i === 0 ? [a] : [" · ", a])
        ])
      : null;

    root.appendChild(el("div", { style: "margin-bottom: 1rem;" }, [
      el("strong", {}, [p.name]),
      el("p", { class: "muted", style: "margin:.25rem 0 0 0;" }, [p.summary]),
      linksLine
    ]));
  });
}

function renderSkills(data) {
  const root = document.getElementById("skills");
  clear(root);

  const grouped = groupBy(data.skills, "group");
  const projectIndex = buildProjectIndex(data.projects);

  // Default: no selection
  renderRelatedProjects(null, null, projectIndex);

  Object.entries(grouped).forEach(([groupName, skills]) => {
    root.appendChild(el("h3", { style: "margin: 0.75rem 0 0.25rem 0;" }, [groupName]));

    const container = el("div", {}, []);

    skills.forEach(skill => {
      // Make each skill focusable for keyboard users (tab)
      const pill = el("span", {
        class: "pill",
        tabindex: "0",
        role: "button",
        "aria-label": `Show projects related to ${skill.name}`,
        onmouseenter: () => renderRelatedProjects(skill.name, skill.projectIds, projectIndex),
        onfocus: () => renderRelatedProjects(skill.name, skill.projectIds, projectIndex),
        onclick: () => renderRelatedProjects(skill.name, skill.projectIds, projectIndex),
        onkeydown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            renderRelatedProjects(skill.name, skill.projectIds, projectIndex);
          }
        }
      }, [skill.name]);

      container.appendChild(pill);
    });

    root.appendChild(container);
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
    const data = await loadContent();
    renderBasics(data);
    renderSummary(data);
    renderSkills(data);
    renderExperience(data);
    renderEducation(data);
    renderFooter(data);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = "<main style='max-width:900px;margin:0 auto;padding:2rem;font-family:system-ui'>Failed to load content. Check console.</main>";
  }
})();

document.getElementById("projectsBtn")?.addEventListener("click", () => {
  window.location.href = "../projects/index.html";
});
