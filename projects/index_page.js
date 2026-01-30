function renderProjects(projects) {
  const list = document.getElementById("projectsList");
  clear(list);

  projects.forEach(p => {
    const localUrl = `./${p.slug}/index.html`;

    const titleLine = el("h2", {}, [
      el("a", { href: localUrl }, [p.name])
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

    list.appendChild(el("article", { class: "card" }, [
      titleLine,
      el("p", { class: "muted", style: "margin:0;" }, [p.summary || ""]),
      skillLine,
      demoLine,
      githubLine
    ]));
  });
}

async function loadNav() {
  const res = await fetch("/nav.html");
  if (!res.ok) return;
  document.getElementById("siteNav").innerHTML = await res.text();
}
loadNav();
