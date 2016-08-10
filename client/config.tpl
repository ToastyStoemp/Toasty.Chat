window.config = {};
window.config.domain = "<%= domain %>";
window.config.port = "<%= port %>";
window.config.typeLogo = "<%= typeLogo%>";
switch (window.config.typeLogo) {
    case "text":
        //Logo must be escaped sometimes
        var d = document.createElement("div");
        d.innerHTML = "<%= logo %>";
        window.config.logo = d.firstChild.nodeValue;
        break;
    case "img":
        window.config.logo = "<%= logo %>";
        break;
}
