var mute = function(bot, sender, args, data, client)
{
	if (args[0] != '')
		bot.chatServerBase.handleCommand('mute', client, args);
	else
		bot.sendClient("Usage is '!mute [name]'", client);
};

var kick = function(bot, sender, args, data, client)
{
	if (args[0] != '')
		bot.chatServerBase.handleCommand('kick', client, args);
	else
		bot.sendClient("Usage is '!kick [name]'", client);
};

var ban = function(bot, sender, args, data, client)
{
	console.log('ban');
	if (args[0] != '')
		bot.chatServerBase.handleCommand('ban', client, args);
	else
		bot.sendClient("Usage is '!ban [name] <time>' default time is 60 seconds", client);
};

var hide = function(bot, sender, args, data, client)
{
	bot.sendClient("This command is not in use yet");
	// if (typeof client.hidden === 'undefined' || !client.hidden) {
	// 	bot.chatServerBase.removeClientFromChannel(client.channel, client);
	// 	client.hidden = true;
	// }
	// else {
	// 	bot.chatServerBase.addClientToChannel(channel, client, nick, trip);
	// 	client.hidden = false;
	// }
};

var broadcast = function(bot, sender, args, data, client)
{
	if (args[0] != '')
		bot.chatServerBase.handleCommand('broadcast', client, args);
	else
		bot.sendClient(bot.man.b, client);
};

var br = {
	action: broadcast,
	man: "Syntax is !b <text> or !broadcast <text>; sends a server broadcast."
}
module.exports =
{
	mute: {action: mute},
	kick: {action: kick},
	ban: {action: ban},
	hide: {action: hide},
	b: br,
	broadcast: br
};
