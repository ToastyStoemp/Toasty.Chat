window.config = {};
window.config.domain = "<%= domain %>";
window.config.port = "<%= port %>";

//Logo must be escaped sometimes
var d = document.createElement("div");
d.innerHTML = "<%= logo %>";
window.config.logo = d.firstChild.nodeValue;