const fs = require("fs");
const path = require("path");

const start = process.hrtime.bigint();

const data = JSON.parse(fs.readFileSync("pages.json", "utf8"));
const shell = fs.readFileSync("./index-shell.html", "utf8");

const SERVER_DIR = `/build`;
const ROOTPATH = path.join(__dirname, "");

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/* ---------------------------
   Sidebar
----------------------------*/
function buildSidebar(data, currentRoute) {
  let html = `
<aside class="sticky top-18.25 h-[calc(100vh-73px)] w-96 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white">
  <div class="p-6">
`;

  for (const group of data) {
    html += `
    <div class="mb-8">
      <h3 class="sidebar-heading">${group.group}</h3>

      <nav class="space-y-1">
`;

    group.pages.forEach((page, idx) => {
      const isActive = page.route === currentRoute;

      const href = page.route
        ? `${SERVER_DIR}/${page.route}/`
        : `${SERVER_DIR}/`;

      html += `
        <a href="${href}"
           class="nav-link ${isActive ? "nav-link-active" : ""}">
          ${idx + 1}. ${page.sidebarTitle}
        </a>
      `;
    });

    html += `
      </nav>
    </div>
`;
  }

  html += `
  </div>
</aside>
`;

  return html;
}

/* ---------------------------
   Minimal Markdown compiler
   supports:
   - paragraphs
   - ## headings
   - **bold**
   - *italic*
   - - lists
----------------------------*/
function compileMarkdown(md = "") {
  let html = md;



  html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // auto-link https URLs
  html = html.replace(
    /(https:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" class="underline text-blue-500" rel="noopener noreferrer">$1</a>'
  );

  // headings
  html = html.replace(/^##\s(.+)$/gm, (_, t) => {
    return `<h2 class="mt-12 text-2xl font-semibold tracking-tight">${t}</h2>`;
  });

  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // italic (simple)
  html = html.replace(/(^|[^*])\*(?!\*)(.+?)\*/g, "$1<em>$2</em>");

  // list items
  html = html.replace(/^- (.+)$/gm, "<li class='list-disc pl-2 ml-5'>$1</li>");

  // wrap lists
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => {
    return `<ul class="mt-6 space-y-3 text-zinc-700">${m}</ul>`;
  });

  // paragraphs
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const t = block.trim();
      if (!t) return "";

      if (
        t.startsWith("<h2") ||
        t.startsWith("<ul") ||
        t.startsWith("<li")
      ) return t;

      return `<p class="leading-8 text-zinc-700 my-4">${t}</p>`;
    })
    .join("\n");

  return html;
}

/* ---------------------------
   Stops
----------------------------*/
function buildStopsArray(page) {
  if (!page.stops || page.stops.length === 0) {
    return "const CONFIG_VIDEO_STOPS = [];";
  }

  return `const CONFIG_VIDEO_STOPS = ${JSON.stringify(page.stops, null, 2)};`;
}

/* ---------------------------
   Breadcrumb
----------------------------*/
function buildBreadcrumb(page, groupName) {
  return `
<div class="mb-8 text-sm text-zinc-500">
  <span class="font-medium text-zinc-900">${groupName}</span>
  <span class="mx-2">/</span>
  ${page.breadcrumb}
</div>
`;
}

/* ---------------------------
   Page build
----------------------------*/
function buildPage(page, sidebarHTML, groupName) {
  const mdPath = path.join(ROOTPATH, page.bodyPath);
  const md = fs.readFileSync(mdPath, "utf8");
  const articleHTML = compileMarkdown(md);

  const breadcrumb = buildBreadcrumb(page, groupName);
  const stopsArray = buildStopsArray(page);

  console.log(page.videoPath)
  const hasVideo = !!page.videoPath;

  let html = shell;

  html = html.split("{{CSSPATH}}").join(`${SERVER_DIR}/output.css`);
  html = html.split("{{JSPATH}}").join(`${SERVER_DIR}/core.js`);

  html = html.split("{{SIDEBAR}}").join(sidebarHTML);
  html = html.split("{{BREADCRUMB}}").join(breadcrumb);
  html = html.split("{{ARTICLE}}").join(articleHTML);

  html = html.split("{{STOPS_ARRAY}}").join(stopsArray);

  if (page.videoPath!="") {
    html = html.split("{{VIDEO_BLOCK}}").join(`
<video id="player"
  src="${page.videoPath}"
  class="absolute inset-0 w-full h-full object-contain block"
  preload="auto"
  playsinline
  muted></video>
`);
  } else {
    html = html.split("{{VIDEO_BLOCK}}").join("");
    html = html.split("{{HIDE_INDEX}}").join("style='display:none;'");
  }

  return html;
}

/* ---------------------------
   Build pipeline
----------------------------*/
function buildAll(data) {
  fs.mkdirSync("build", { recursive: true });

  for (const group of data) {
    for (const page of group.pages) {
      const sidebar = buildSidebar(data, page.route);
      const html = buildPage(page, sidebar, group.group);

      const outDir = path.join("build", page.route || "");
      fs.mkdirSync(outDir, { recursive: true });

      fs.writeFileSync(path.join(outDir, "index.html"), html);
    }
  }

  // assets
  copyFile("./output.css", "./build/output.css");
  copyFile("./core.js", "./build/core.js");
}

/* ---------------------------
   run
----------------------------*/
buildAll(data);

const end = process.hrtime.bigint();
console.log(`Build time: ${(Number(end - start) / 1e6).toFixed(2)} ms`);