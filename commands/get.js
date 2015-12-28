var gettrip = function(bot, sender, args, data, client)
{
	if (args[0] == '')
	{
		bot.sendClient("Usage: '!get trip [nick]'", client);
		return;
	}

	var target = bot.chatServerBase.getClientOfChannel(args[0], client.channel);
	if (target == null) {
		bot.sendClient("User not found.", client);
		return;
	}

	bot.sendClient(target.trip, client);
	return target.trip;
};

module.exports =
{
	gettrip: gettrip
};
