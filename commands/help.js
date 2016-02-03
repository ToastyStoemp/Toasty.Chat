var help = function(bot, sender, args, data, client)
{
	var cmds = [];

	for(var key in bot.commands)
	{
		if (!(bot.perm[key] > 0)){
			cmds.push(key);
		}

	}
	cmds = cmds.sort();
	bot.sendClient("Commands: !" + cmds.join(", !"), client);
}

var e = {
	action: help,
	man: "No arguments; sends all the available command of this bot, sorted alphabetically."
}
module.exports = { h: e, help: e };
