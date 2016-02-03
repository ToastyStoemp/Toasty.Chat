var google = require('googleapis');
var customsearch = google.customsearch('v1');

var googleCallback = function(bot, sender, args, data, client)
{
	var search = args.join(" ").trim();

	if(!search)
		return bot.sendClient(bot.man.g, client);

	var apikey = bot.config.google.apiKey;
	var cx = bot.config.google.customsearchId;

	customsearch.cse.list({ cx: cx, q: search, auth: apikey }, function(err, resp)
	{
		if (err)
			return bot.sendClient(err.toString(), client);

		require("fs").writeFileSync("dump.json", JSON.stringify(resp, undefined, 4));
		if (resp.items && resp.items.length > 0)
		{
			var result = [];

			for(var i = 0; i < resp.items.length && i < 3; i++)
			{
				result.push(resp.items[i].title + " - " + resp.items[i].link);
			}

			bot.sendAll(result.join("\n"), client);
		}
		else
		{
			bot.sendClient("No results found! " + bot.man.g, client);
		}
	});
};

var e = {
	action: googleCallback,
	man: "Syntax is !google <term>; searches for <term> on google."
}
module.exports =
{
	g: e,
	google: e
};
