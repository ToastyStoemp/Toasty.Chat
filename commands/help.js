var help = function(bot, sender, args)
{
	var cmds = [];

	for(var key in bot.commands)
	{
		cmds.push(key);
	}
	cmds = cmds.sort();
	bot.send("Commands: !" + cmds.join(", !"));
}

module.exports = { h: help, help: help };
