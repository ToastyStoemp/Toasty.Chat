var init = function(bot)
{
	bot.afks = [];

	bot.on("chat", function(data)
	{
		var index = bot.afks.indexOf(data.nick);
		if(index !== -1)
		{
			bot.afks.splice(index, 1);
			bot.send("Welcome back @" + data.nick + "");
		}

		if(data.nick !== bot.nick)
		{
			for(var i = 0; i < bot.afks.length; i++)
			{
				var name = "@" + bot.afks[i];
				if(data.text.indexOf(name) !== -1)
					bot.send(name + " is afk!");
			}
		}
	});

	bot.on("onlineRemove", function (data)
	{
		var index = bot.afks.indexOf(data.nick);
		if(index !== -1)
			bot.afks.splice(index, 1);
	});
};

var afk = function(bot, sender, args, data, client)
{
	var index = bot.afks.indexOf(sender);
	if(index !== -1)
	{
		bot.afks.splice(index, 1);
		bot.sendAll("Welcome back @" + sender + "", client);
	}
	else
	{
		bot.sendAll("User @" + sender + " is now AFK", client);
		bot.afks.push(sender);
	}
};

module.exports =
{
	init: init,
	afk: afk
};
