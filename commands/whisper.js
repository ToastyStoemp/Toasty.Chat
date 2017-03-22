var whipser = function(bot, sender, args, data, client) {
    if (args.length < 2)
        return bot.sendClient("Usage is .w [nick] [message]", client);
    if (!args[1])
        return bot.sendClient("Usage is .w [nick] [message]", client);
    var targetNick = args.splice(0, 1)[0];
    targetNick = targetNick.replace("@", "");
    var data = {
        cmd: 'whisper',
        nick: client.nick,
        trip: client.trip,
        text: args,
        target: targetNick
    };
    bot.chatServerBase.handleCommand("whisper", client, data);
};

module.exports = {
    w: whipser
};