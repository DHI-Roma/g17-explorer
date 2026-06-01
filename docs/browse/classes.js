// const ENDPOINT = "http://localhost:7879/query";
const DEFAULT_ENDPOINT = "https://graph.dhi-roma.it/query";

const DEFAULT_ONTOLOGY_GRAPH = "http://www.w3.org/2002/07/owl#";

const params = new URLSearchParams(location.search);

const ENDPOINT =
  params.get("endpoint")
  || DEFAULT_ENDPOINT;

const ONTOLOGY_GRAPH =
  params.get("ontology")
  || DEFAULT_ONTOLOGY_GRAPH;

console.log("SPARQL endpoint:", ENDPOINT);



const HIDDEN_CLASSES = [
  "http://www.w3.org/2002/07/owl#Thing",
  "https://w3id.org/grace/ontology/description"
];

const HIDDEN_CLASS_BRANCHES = [
  "http://xmlns.com/foaf/0.1/Agent",
  "https://w3id.org/grace/ontology/description"
];

const LANGUAGE = "en";
const LIMIT = 1000;
const RESOURCE_VIEWER =
  location.pathname.replace(/\/$/, "") + "/resource";

const searchEl = document.querySelector("#instance-search");
const instanceCountEl = document.querySelector("#instance-count");
const pageInfoEl = document.querySelector("#page-info");
const prevPageEl = document.querySelector("#prev-page");
const nextPageEl = document.querySelector("#next-page");

const PAGE_SIZE = 100;
let currentClassUri = null; 
let currentPage = 0;
let currentSearch = "";
let currentTotal = 0;

const statusEl = document.querySelector("#status");
const contentEl = document.querySelector("#content");
const classTreeEl = document.querySelector("#class-tree");
const classLabelEl = document.querySelector("#class-label");
const classUriEl = document.querySelector("#class-uri");
const commentBoxEl = document.querySelector("#comment-box");
const commentTextEl = document.querySelector("#comment-text");
const instancesEl = document.querySelector("#instances");
const hiddenClasses = HIDDEN_CLASSES
  .map((iri) => `<${escapeSparqlIri(iri)}>`)
  .join(",\n  ");

const hiddenBranches = HIDDEN_CLASS_BRANCHES
  .map((iri) => `<${escapeSparqlIri(iri)}>`)
  .join("\n    ");
let classes = [];
let classByUri = new Map();

window.addEventListener("hashchange", () => {
  renderCurrentClass();
});

let elasticListData = [];

loadClasses();

async function loadClasses() {
  showStatus("Loading Classes …");

  try {
    const data = await queryClasses();
    classes = normalizeClasses(data.results.bindings);
    classByUri = new Map(classes.map((entry) => [entry.uri, entry]));

    if (classes.length === 0) {
      showStatus("No classes!");
      return;
    }

    renderClassTree(classes);
    loadElasticListData();

    if (!getClassUriFromLocation()) {
      hideStatus();
      contentEl.hidden = false;
      classLabelEl.textContent = "Select a class";
      return;
    }

    renderCurrentClass();
    hideStatus();
    contentEl.hidden = false;
  } catch (error) {
    console.error(error);
    showStatus("Error");
  }
}

async function renderCurrentClass() {
  const uri = getClassUriFromLocation();
  if (uri !== currentClassUri) {
    currentClassUri = uri;
    currentPage = 0;
  }
  const selected = classByUri.get(uri);

  instancesEl.innerHTML = "";
  commentTextEl.innerHTML = "";
  commentBoxEl.hidden = true;
  classUriEl.innerHTML = "";

  if (!selected) {
    classLabelEl.textContent = "Class not found";
    showStatus("Class not found");
    return;
  }

  setActiveClass(uri);

  classLabelEl.textContent = "";
  classLabelEl.appendChild(withCopy(document.createTextNode(selected.label), selected.uri));

  const uriSpan = document.createElement("span");
  uriSpan.className = "resource-uri-text";
  uriSpan.textContent = selected.uri;
  classUriEl.appendChild(withCopy(uriSpan, selected.uri));

  if (selected.comment) {
    const p = document.createElement("p");
    p.textContent = selected.comment;
    commentTextEl.appendChild(p);
    commentBoxEl.hidden = false;
  }

  showStatus("Loading Instances …");

  try {
    const [countData, data] = await Promise.all([
      queryInstanceCount(selected.uri, currentSearch),
      queryInstances(selected.uri, currentSearch, currentPage)
    ]);

    currentTotal = Number(countData.results.bindings[0].count.value);

    renderInstances(data.results.bindings);
    renderPagination();

    hideStatus();
    contentEl.hidden = false;
  } catch (error) {
    console.error(error);
    showStatus("Error");
  }
}

function getClassUriFromLocation() {
  if (location.hash.length > 1) {
    return decodeURIComponent(location.hash.slice(1));
  }

  return new URLSearchParams(location.search).get("class");
}

let searchTimer;

searchEl.addEventListener("input", () => {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    currentSearch = searchEl.value;
    currentPage = 0;
    renderCurrentClass();
  }, 250);
});


async function queryClasses() {
  const graphOpen = ONTOLOGY_GRAPH ? `GRAPH <${ONTOLOGY_GRAPH}> {` : "";
  const graphClose = ONTOLOGY_GRAPH ? "}" : "";

  const query = `
    PREFIX owl:  <http://www.w3.org/2002/07/owl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?class
           (SAMPLE(?label) AS ?classLabel)
           (SAMPLE(?comment) AS ?classComment)
           (GROUP_CONCAT(DISTINCT STR(?parent); separator="|") AS ?parents)
    WHERE {
      ${graphOpen}

        ?class a owl:Class .
        FILTER(isIRI(?class))

        OPTIONAL {
          ?class rdfs:subClassOf ?parent .
          FILTER(isIRI(?parent))
        }

        ?class rdfs:label ?label .

        OPTIONAL {
          ?class rdfs:comment ?comment .
          FILTER(lang(?comment) = "${LANGUAGE}" || lang(?comment) = "")
        }
      ${graphClose}

      FILTER(?class NOT IN (
        ${hiddenClasses}
      ))

      FILTER NOT EXISTS {
        ${graphOpen}
          ?class rdfs:subClassOf+ ?blocked .
        ${graphClose}

        VALUES ?blocked {
          ${hiddenBranches}
        }
      }

    }
    GROUP BY ?class
    ORDER BY LCASE(STR(COALESCE(SAMPLE(?label), ?class)))
    LIMIT ${LIMIT}
  `;

  return sparql(query);
}

async function sparql(query) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/sparql-query",
      "Accept": "application/sparql-results+json"
    },
    body: query
  });

  if (!response.ok) {
    throw new Error(`SPARQL endpoint returned ${response.status}`);
  }

  return response.json();
}

async function queryInstanceCount(classUri, search = "") {
  const searchFilter = search.trim()
    ? `
      FILTER(
        CONTAINS(LCASE(STR(?instance)), LCASE("${escapeSparqlString(search)}")) ||
        CONTAINS(LCASE(STR(?label)), LCASE("${escapeSparqlString(search)}"))
      )
    `
    : "";

  const query = `
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT (COUNT(DISTINCT ?instance) AS ?count) WHERE {
      ?instance rdf:type <${escapeSparqlIri(classUri)}> .
      FILTER(isIRI(?instance))
      
      ?instance rdfs:label ?label .      

      ${searchFilter}
    }
  `;

  return sparql(query);
}

async function queryInstances(classUri, search = "", page = 0) {
  const searchFilter = search.trim()
    ? `
      FILTER(
        CONTAINS(LCASE(STR(?instance)), LCASE("${escapeSparqlString(search)}")) ||
        CONTAINS(LCASE(STR(?label)), LCASE("${escapeSparqlString(search)}"))
      )
    `
    : "";

  const query = `
    PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?instance (SAMPLE(?label) AS ?instanceLabel) WHERE {
      ?instance rdf:type <${escapeSparqlIri(classUri)}> .
      FILTER(isIRI(?instance))
      
      ?instance rdfs:label ?label .

      ${searchFilter}
    }
    GROUP BY ?instance
    ORDER BY LCASE(STR(COALESCE(SAMPLE(?label), ?instance)))
    LIMIT ${PAGE_SIZE}
    OFFSET ${page * PAGE_SIZE}
  `;

  return sparql(query);
}

function escapeSparqlString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeClasses(bindings) {
  return bindings.map((binding) => ({
    uri: binding.class.value,
    label: binding.classLabel?.value || shortenIri(binding.class.value),
    comment: binding.classComment?.value || "",
    parents: binding.parents?.value
      ? binding.parents.value.split("|").filter(Boolean)
      : []
  }));
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(currentTotal / PAGE_SIZE));

  instanceCountEl.textContent = `${currentTotal} results`;
  pageInfoEl.textContent = `Page ${currentPage + 1} of ${totalPages}`;

  prevPageEl.disabled = currentPage === 0;
  nextPageEl.disabled = currentPage >= totalPages - 1;
}

prevPageEl.addEventListener("click", () => {
  if (currentPage > 0) {
    currentPage--;
    renderCurrentClass();
  }
});

nextPageEl.addEventListener("click", () => {
  const totalPages = Math.ceil(currentTotal / PAGE_SIZE);

  if (currentPage < totalPages - 1) {
    currentPage++;
    renderCurrentClass();
  }
});


function renderClassTree(entries) {
  classTreeEl.innerHTML = "";

  const knownUris = new Set(entries.map((entry) => entry.uri));
  const childrenByParent = new Map();

  for (const entry of entries) {
    const visibleParents = entry.parents.filter((parent) => knownUris.has(parent));

    if (visibleParents.length === 0) {
      addChild(childrenByParent, null, entry);
    } else {
      for (const parent of visibleParents) {
        addChild(childrenByParent, parent, entry);
      }
    }
  }

  appendChildren(classTreeEl, childrenByParent, null, new Set());
}

function addChild(map, parent, child) {
  if (!map.has(parent)) {
    map.set(parent, []);
  }
  map.get(parent).push(child);
}

function appendChildren(parentEl, childrenByParent, parentUri, seen) {
  const children = [...(childrenByParent.get(parentUri) || [])]
    .sort((a, b) => a.label.localeCompare(b.label));

  for (const child of children) {
    const li = document.createElement("li");
    const a = document.createElement("a");

    a.href = "#" + encodeURIComponent(child.uri);
    a.textContent = child.label;
    a.title = child.uri;
    a.dataset.classUri = child.uri;

    li.appendChild(a);

    if (!seen.has(child.uri)) {
      const nestedChildren = childrenByParent.get(child.uri) || [];

      if (nestedChildren.length > 0) {
        const ul = document.createElement("ul");
        appendChildren(ul, childrenByParent, child.uri, new Set([...seen, child.uri]));
        li.appendChild(ul);
      }
    }

    parentEl.appendChild(li);
  }
}

function setActiveClass(uri) {
  for (const link of classTreeEl.querySelectorAll("a")) {
    link.classList.toggle("active", link.dataset.classUri === uri);
  }
}

function renderInstances(bindings) {
  if (bindings.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.textContent = "No instances.";
    tr.appendChild(td);
    instancesEl.appendChild(tr);
    return;
  }

  for (const binding of bindings) {
    const tr = document.createElement("tr");
    const labelTd = document.createElement("td");
    const uriTd = document.createElement("td");

    const params = new URLSearchParams();

    if (ENDPOINT !== DEFAULT_ENDPOINT) {
      params.set("endpoint", ENDPOINT);
    }

    if (ONTOLOGY_GRAPH) {
      params.set("ontology", ONTOLOGY_GRAPH);
    }

    const resourceUrl =
      `${RESOURCE_VIEWER}?${params.toString()}#${encodeURIComponent(binding.instance.value)}`;

    const labelLink = document.createElement("a");
    labelLink.href = resourceUrl;

    labelLink.target = "_blank";
    labelLink.rel = "noopener noreferrer";
    labelLink.textContent = binding.instanceLabel?.value || shortenIri(binding.instance.value);
    labelLink.title = binding.instance.value;

    const uriSpan = document.createElement("span");
    uriSpan.className = "resource-uri-text";
    uriSpan.textContent = binding.instance.value;

    labelTd.appendChild(withCopy(labelLink, binding.instance.value));
    uriTd.appendChild(withCopy(uriSpan, binding.instance.value));

    tr.appendChild(labelTd);
    tr.appendChild(uriTd);
    instancesEl.appendChild(tr);
  }
}

function withCopy(node, value) {
  const wrap = document.createElement("span");
  wrap.className = "value-wrap";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-btn";
  button.textContent = "⧉";
  button.title = "Copy to Clipboard (may not work)";

  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(value);
    button.textContent = "✓";
    setTimeout(() => button.textContent = "⧉", 900);
  });

  wrap.appendChild(node);
  wrap.appendChild(button);

  return wrap;
}

function shortenIri(iri) {
  const prefixed = iri
    .replace("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf:")
    .replace("http://www.w3.org/2000/01/rdf-schema#", "rdfs:")
    .replace("http://www.w3.org/2002/07/owl#", "owl:")
    .replace("http://www.w3.org/2001/XMLSchema#", "xsd:");

  if (prefixed !== iri) {
    return prefixed;
  }

  try {
    const url = new URL(iri);
    const host = url.hostname.replace(/^www\./, "").split(".")[0];
    const local = url.hash.replace(/^#/, "") || url.pathname.split("/").filter(Boolean).pop();
    return local ? `${host}:${local}` : host;
  } catch {
    return iri;
  }
}

function escapeSparqlIri(iri) {
  return iri.replace(/[<>"{}|^`\\]/g, encodeURIComponent);
}

function showStatus(message) {
  statusEl.textContent = message;
  statusEl.hidden = false;
}

function hideStatus() {
  statusEl.hidden = true;
}

function queryElasticData() {
  var query = `
    PREFIX grace: <https://w3id.org/grace/ontology/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT DISTINCT ?event ?eventLabel ?personLabel ?placeLabel ?instLabel ?typeLabel ?dateLabel WHERE {
      ?event <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> grace:apostolic_provision .
      ?event rdfs:label ?eventLabel .
      OPTIONAL { ?event grace:refers_to ?person . ?person <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> grace:person . ?person rdfs:label ?personLabel . }
      OPTIONAL { ?event grace:place_of_event ?place . ?place rdfs:label ?placeLabel . }
      OPTIONAL { ?event grace:institution_object ?inst . ?inst rdfs:label ?instLabel . }
      OPTIONAL { ?event grace:type_object ?type . ?type rdfs:label ?typeLabel . }
      OPTIONAL { ?event grace:event_date ?dateNode . ?dateNode grace:called ?dateLabel . }
    } LIMIT 2000
  `;
  return sparql(query);
}

var ELASTIC_PAGE_SIZE = 12;
var elasticCurrentPage = 0;
var elasticFilteredData = [];
var elasticListInstance = null;

var elasticResultsEl = document.getElementById("elastic-results-row");
var elasticResetBtn = document.getElementById("elastic-reset");
var elasticPrevBtn = document.getElementById("elastic-prev");
var elasticNextBtn = document.getElementById("elastic-next");
var elasticPageInfo = document.getElementById("elastic-page-info");
var elasticResultCount = document.getElementById("elastic-result-count");

elasticResetBtn.addEventListener("click", resetElasticFilters);
elasticPrevBtn.addEventListener("click", function () {
  if (elasticCurrentPage > 0) {
    elasticCurrentPage--;
    renderElasticPage();
  }
});
elasticNextBtn.addEventListener("click", function () {
  var totalPages = Math.ceil(elasticFilteredData.length / ELASTIC_PAGE_SIZE);
  if (elasticCurrentPage < totalPages - 1) {
    elasticCurrentPage++;
    renderElasticPage();
  }
});

function resetElasticFilters() {
  var builder = elasticListInstance.builder;
  builder.el.find("li.active").removeClass("active");
  builder.el.find("li").removeClass(builder.hideClass);
  for (var elId in builder.countMap) {
    builder.el.find("#" + elId).text(builder.countMap[elId]);
  }
  builder.el.find("input.elastic-filter").val("");
  builder.el.find("style").html("");
  builder.onchange({});
}

function renderElasticPage() {
  var totalPages = Math.max(1, Math.ceil(elasticFilteredData.length / ELASTIC_PAGE_SIZE));
  var start = elasticCurrentPage * ELASTIC_PAGE_SIZE;
  var end = Math.min(start + ELASTIC_PAGE_SIZE, elasticFilteredData.length);
  var pageItems = elasticFilteredData.slice(start, end);

  elasticResultsEl.innerHTML = "";

  pageItems.forEach(function (item) {
    elasticResultsEl.appendChild(createEventCard(item));
  });

  elasticPrevBtn.disabled = elasticCurrentPage === 0;
  elasticNextBtn.disabled = elasticCurrentPage >= totalPages - 1;
  elasticPageInfo.textContent = "Page " + (elasticCurrentPage + 1) + " of " + totalPages;
  elasticResultCount.textContent = elasticFilteredData.length + " results";
}

async function loadElasticListData() {
  try {
    var results = await queryElasticData();
    var bindings = results.results.bindings;

    elasticListData = bindings.map(function (b) {
      var dateLabel = b.dateLabel ? b.dateLabel.value : "";
      var year = "";
      var m = dateLabel.match(/(\d{4})/);
      if (m) year = m[1];

      return {
        event_uri: b.event ? b.event.value : "",
        event_label: b.eventLabel ? b.eventLabel.value : "",
        person_label: b.personLabel ? b.personLabel.value : null,
        place_label: b.placeLabel ? b.placeLabel.value : null,
        inst_label: b.instLabel ? b.instLabel.value : null,
        type_label: b.typeLabel ? b.typeLabel.value : null,
        year_label: year
      };
    });

    elasticListInstance = new ElasticList({
      el: $("#elastic-list"),
      data: elasticListData,
      hasFilter: true,
      align: "horizontal",
      columns: [
        { title: "Person", attr: "person_label" },
        { title: "Institution", attr: "inst_label" },
        { title: "Place", attr: "place_label" },
        { title: "Type", attr: "type_label" },
        { title: "Year", attr: "year_label" }
      ],
      onchange: function (filters) {
        elasticResultsEl.innerHTML = "";

        if (Object.keys(filters).length === 0) {
          elasticFilteredData = [];
          elasticCurrentPage = 0;
          elasticPrevBtn.disabled = true;
          elasticNextBtn.disabled = true;
          elasticPageInfo.textContent = "";
          elasticResultCount.textContent = "";
          return;
        }

        elasticFilteredData = elasticListData.filter(function (item) {
          return Object.entries(filters).every(function (_ref) {
            var key = _ref[0];
            var value = _ref[1];
            return String(item[key] || "").toLowerCase() === String(value).toLowerCase();
          });
        });

        elasticCurrentPage = 0;
        renderElasticPage();
      }
    });
  } catch (error) {
    console.error("Elastic list data error:", error);
  }
}

function createEventCard(item) {
  var container = document.createElement("div");
  container.className = "col-md-4 mb-4";

  var card = document.createElement("div");
  card.className = "card h-100";

  var cardBody = document.createElement("div");
  cardBody.className = "card-body";

  var title = document.createElement("h5");
  title.className = "card-title";
  var link = document.createElement("a");
  link.href = RESOURCE_VIEWER + "#" + encodeURIComponent(item.event_uri);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = item.event_label;
  link.className = "text-decoration-none";
  title.appendChild(link);

  cardBody.appendChild(title);

  if (item.person_label) {
    var p = document.createElement("p");
    p.className = "card-text small";
    p.textContent = "Person: " + item.person_label;
    cardBody.appendChild(p);
  }

  if (item.inst_label) {
    var p = document.createElement("p");
    p.className = "card-text small";
    p.textContent = "Institution: " + item.inst_label;
    cardBody.appendChild(p);
  }

  if (item.place_label) {
    var p = document.createElement("p");
    p.className = "card-text small";
    p.textContent = "Place: " + item.place_label;
    cardBody.appendChild(p);
  }

  if (item.type_label) {
    var p = document.createElement("p");
    p.className = "card-text small text-muted";
    p.textContent = "Type: " + item.type_label;
    cardBody.appendChild(p);
  }

  if (item.year_label) {
    var p = document.createElement("p");
    p.className = "card-text small text-muted";
    p.textContent = "Year: " + item.year_label;
    cardBody.appendChild(p);
  }

  card.appendChild(cardBody);
  container.appendChild(card);

  return container;
}
