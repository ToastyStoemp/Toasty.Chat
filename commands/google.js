var google = require('googleapis');
var customsearch = google.customsearch('v1');

var googleCallback = function(bot, sender, args, data, client)
{
	var search = args.join(" ").trim();

	if(search == "")
		return bot.sendClient("Syntax is !google [Search term]", client);

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
			bot.sendClient("No reults found! Syntax is !google [Search term]", client);
		}
	});
};

module.exports =
{
	g: googleCallback,
	google: googleCallback
};
