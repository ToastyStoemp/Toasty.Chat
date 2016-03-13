var mute = function(bot, sender, args, data, client)
{
	if (args[0] != '')
		bot.chatServerBase.handleCommand('mute', client, args[0]);
	else
		bot.sendClient("Usage is '!mute [name]'", client);
};

var kick = function(bot, sender, args, data, client)
{
	if (args[0] != '')
		bot.chatServerBase.handleCommand('kick', client, args[0]);
	else
		bot.sendClient("Usage is '!kick [name]'", client);
};

var ban = function(bot, sender, args, data, client)
{
	console.log('ban');
	if (args[0] != '')
		bot.chatServerBase.handleCommand('ban', client, args[0]);
	else
		bot.sendClient("Usage is '!ban [name] <time>' default time is 60 seconds", client);
};

var unban = function(bot, sender, args, data, client)
{
	console.log('unban');
	if (args[0] != '')
	        bot.chatServerBase.handleCommand("unban", client, args[0]);
	else
	        bot.sendClient("Usage is '!unban [name]'");
}

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
		bot.sendClient("Usage is '!b [text]' or '!broadcast [text]''", client);
};


module.exports =
{
	mute: mute,
	kick: kick,
	ban: ban,
	unban: unban,
	hide: hide,
	b: broadcast,
	broadcast: broadcast
};
