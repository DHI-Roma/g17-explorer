//
// Place any custom JS here
//

// reference to the sparnatural webcomponent
const sparnatural = document.querySelector("spar-natural");

// display on the page the endpoint URL with which sparnatural is configured
document.querySelector("#displayEndpoint").setAttribute("href", sparnatural.getAttribute("endpoint"));
document.querySelector("#displayEndpoint").textContent = sparnatural.getAttribute("endpoint");

// init yasQE query editor
const yasqe = new Yasqe(document.getElementById("yasqe"), {
	requestConfig: {
	  // make sure the endpoint is the same as sparnatural
	  endpoint: sparnatural.getAttribute("endpoint"),
	  method: "GET",
	  header: {}
	},
	copyEndpointOnNewTab: false  
});

// init yasR result display
// register a specific plugin that is capable of displaying clikable label + URI
Yasr.registerPlugin("TableX",SparnaturalYasguiPlugins.TableX);
Yasr.registerPlugin("Grid",SparnaturalYasguiPlugins.GridPlugin);
Yasr.registerPlugin("Stats",SparnaturalYasguiPlugins.StatsPlugin);
Yasr.registerPlugin("Map",SparnaturalYasguiPlugins.MapPlugin);

delete Yasr.plugins['table'];
delete Yasr.plugins['response'];
const yasr = new Yasr(document.getElementById("yasr"), {
  pluginOrder: ["TableX", "Grid", "Stats", "Map"],
  defaultPlugin: "TableX",
  // disable persistency
  persistencyExpire: 0,
  maxPersistentResponseSize: 0
});

// link yasqe and yasr
yasqe.on("queryResponse", function(_yasqe, response, duration) {
	yasr.setResponse(response, duration);
	// when response is received, enable the button
	sparnatural.enablePlayBtn();
});

// listener when sparnatural updates the query
// see http://docs.sparnatural.eu/Javascript-integration.html#sparnatural-events
sparnatural.addEventListener("queryUpdated", (event) => {
	// get the SPARQL query string, and pass it to yasQE
	queryString = sparnatural.expandSparql(event.detail.queryString);
	yasqe.setValue(queryString);
	// display the JSON query on the console
	console.log("Sparnatural JSON query structure:");
	console.dir(event.detail.queryJson);
	const queryJsonElement = document.getElementById('query-json');
	if (queryJsonElement) {
		queryJsonElement.value = JSON.stringify(event.detail.queryJson);
	} else {
		console.error('no "query-json" field.');
	}
});

document.getElementById('export').onclick = function(event) {
	event.preventDefault();
	const jsonString = JSON.stringify(JSON.parse(document.getElementById('query-json').value), null, 2);
	document.getElementById('export-json').value = jsonString;
	new bootstrap.Modal(document.getElementById('exportModal')).show();
};

// listener when the sparnatural submit button is clicked
// see http://docs.sparnatural.eu/Javascript-integration.html#sparnatural-events
sparnatural.addEventListener("submit", (event) => {
	// enable loader on button
	sparnatural.disablePlayBtn() ; 
	// trigger the query from YasQE
	yasqe.query();
});

// listener when the sparnatural reset button is clicked
// see http://docs.sparnatural.eu/Javascript-integration.html#sparnatural-events
sparnatural.addEventListener("reset", (event) => {
	// empties the SPARQL query on yasQE
	yasqe.setValue("");
});

// hide/show yasQE
document.getElementById('sparql-toggle').onclick = function() {
	if(document.getElementById('yasqe').style.display == 'none') {
	  document.getElementById('yasqe').style.display = 'block';
	  yasqe.setValue(yasqe.getValue());
	  yasqe.refresh();
	} else {
	  document.getElementById('yasqe').style.display = 'none';
	}
	return false;        
} ;

const tableXConfig = yasr.plugins["TableX"].config;
Object.assign(tableXConfig, {
  includeControls: true,
  openIriInNewWindow: true,  
//   uriHrefAdapter: (uri) => 
//     uri.startsWith("https://g17.dhi-roma.it/")
//       ? `${window.location.protocol}//${window.location.hostname}/shmarql?g=&e=_local_&s=%3C${encodeURIComponent(uri)}%3E`
//       : uri
});

const importModal = new bootstrap.Modal(document.getElementById('importModal'));

document.getElementById('import').addEventListener('click', function(event) {
	event.preventDefault();
	importModal.show();
});

document.getElementById('importButton').addEventListener('click', function() {
	const importJson = document.getElementById('import-json').value;
	const json = JSON.parse(importJson);
	importModal.hide();
	sparnatural.loadQuery(json);
});

// document.addEventListener("DOMContentLoaded", function() {
// 	let c_query = window.sparnaturalConfig.c_query;
//     try {
//         if (!c_query) {
//             console.warn("c_query is undefined or null.");
//             return;
//         }
//         if (Object.keys(c_query).length === 0) {
//             console.warn("c_query is an empty object.");
//             return;
//         }
// 		document.querySelector("spar-natural").loadQuery(c_query);
// 	} catch (e) {
// 		console.error("Error:", e);
// 	}
// });

// binds Sparnatural with the YasR plugins
bindSparnaturalWithYasrPlugins(sparnatural, yasr);
// binds Sparnatural with itself for the query execution and integration with yasqe and yasr
bindSparnaturalWithItself(sparnatural, yasqe, yasr);