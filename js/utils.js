// js/utils.js — Helper functions

function haversineDistance(lat1, lon1, lat2, lon2) {
  var p = 0.017453292519943295; // Math.PI / 180
  var c = Math.cos;
  var a = 0.5 - c((lat2 - lat1) * p) / 2 +
    c(lat1 * p) * c(lat2 * p) *
    (1 - c((lon2 - lon1) * p)) / 2;
  return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
}

function formatSciName(sciname) {
  sciname = sciname.charAt(0).toUpperCase() + sciname.toLowerCase().slice(1);
  sciname = sciname.trim();
  if (sciname.endsWith("L.")) {
    sciname = sciname.substr(0, sciname.length - 2);
  }
  let sections = sciname.split(" ");
  let italicise = true;
  let html = '';
  sections.forEach((section) => {
    if (section.startsWith("'")) {
      italicise = !italicise;
    } else if (section.startsWith("(")) {
      italicise = false;
    }
    if (!italicise || section === "var.") {
      html += section + " ";
    } else {
      html += '<i>' + section + ' </i>';
    }
    if (section.endsWith("'")) {
      italicise = !italicise;
    } else if (section.endsWith(")")) {
      italicise = true;
    }
  });
  return html.trim();
}

function rewriteUrls(data) {
  if (!data) return;
  const rewrite = (url) => {
    if (!url || typeof url !== 'string') return url;
    const match = url.match(/imgur\.com\/([A-Za-z0-9]+)\.(jpg|png)/i);
    if (match) return 'assets/' + match[1] + '.' + match[2];
    return url;
  };
  if (data['flora&fauna']) {
    for (let id in data['flora&fauna']) {
      let entry = data['flora&fauna'][id];
      if (Array.isArray(entry.imageRef)) {
        entry.imageRef = entry.imageRef.map(rewrite);
      } else if (typeof entry.imageRef === 'string') {
        entry.imageRef = rewrite(entry.imageRef);
      }
      if (entry.smallImage) entry.smallImage = rewrite(entry.smallImage);
    }
  }
  if (data['map']) {
    for (let trailId in data['map']) {
      let trail = data['map'][trailId];
      if (trail.route) {
        for (let routeId in trail.route) {
          let route = trail.route[routeId];
          if (typeof route.imageRef === 'string') {
            route.imageRef = rewrite(route.imageRef);
          }
          if (route.smallImage) route.smallImage = rewrite(route.smallImage);
        }
      }
    }
  }
  if (data['historical']) {
    for (let id in data['historical']) {
      let entry = data['historical'][id];
      if (typeof entry.imageRef === 'string') {
        entry.imageRef = rewrite(entry.imageRef);
      }
    }
  }
}

function getFFEntryDetails(dbName, floraFaunaData) {
  if (!floraFaunaData || !dbName) return undefined;
  return floraFaunaData[dbName] || undefined;
}


