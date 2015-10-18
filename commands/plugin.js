var octonode = require('octonode');
var atob = require('atob');

var client = octonode.client();

var ghrepo = client.repo('ToastyStoemp/Hack.Chat-Enhancement-kit');

var plugin_mimes = {
  "application/x-chrome-extension": "chrome",
  "application/x-xpinstall": "firefox"
};


module.exports.plugin = function(bot, sender, args, data) {
  ghrepo.releases(function(err, data, headers) {
    var latestRelease = data[0];
    var assets = latestRelease.assets;
    var version = latestRelease.tag_name;
    var links = {};
    for (var index in assets) {
      var asset = assets[index];
      var browser = plugin_mimes[asset.content_type];
      if (plugin_mimes[asset.content_type]) {
        links[browser] = asset.browser_download_url;
      }
    }
    ghrepo.contents("VersionControll.MD",function(err, data, headers) {
      var text = atob(data.content);
      var links_str = "Links :\n";
      for (var link in links) {
        links_str += "\tFor " + link + ":" + links[link] + "\n";
      }
      text += links_str;
      return bot.send(text);
    });
  });
};
