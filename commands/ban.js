var init = function(bot)
{
	bot.bans = [];
};

var ban = function(bot, sender, args)
{

};

var unban = function(bot, sender, args)
{

	var pardonUser = args.join(" ");
	var nickPardon = pardonUser.toLowerCase();

	if(bot.bans.indexOf(nickPardon) === -1)
	{
		bot.send("@" + sender + " user @" + pardonUser + " is not banned yet");
	}
	else
	{
		bot.send("@" + sender + " user @" + pardonUser + " is no longer banned");
		_unban(bot, nickPardon);
	}
};

module.exports =
{
	init: init
	//botBan: ban,
	//botUnban: unban
};
