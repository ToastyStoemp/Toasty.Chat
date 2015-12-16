var Wiki = require("wikijs");
var wiki = new Wiki();

var wikiCallback = function(bot, sender, args, data, client)
{
	var input = args.join(" ");

	wiki.search(input).then(function(result)
	{
		var page = result.results[0];

		if(typeof page == 'undefined')
		{
			bot.sendClient("No results found!", client);
			return;
		}

		wiki.page(page).then(function(page)
		{
			page.summary().then(function(summary)
			{
				if(summary.length > 500)
				{
					summary = summary.substring(0, 500) + "...";
				}
				summary += " - " + page.fullurl;

				bot.sendAll(summary, client);
			});
		});
	});
};

module.exports = { wiki: wikiCallback };
