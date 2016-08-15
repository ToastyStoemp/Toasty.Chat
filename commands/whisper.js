var whipser = function (bot, sender, args, data, client) {
    if (args.length < 2) {
        bot.sendClient("Usage is .w [nick] [message]", client);
        return;
    }
    var targetNick = args.splice(0, 1)[0];
    targetNick = targetNick.replace("@", "");
    var friend = bot.chatServerBase.getClientOfChannel(targetNick, client.channel) || null;
    if (friend != null) {
        bot.sendClient("You whispered to " + targetNick + " : " + args.join(" "), client);
        bot.sendClient(sender + " whispers: " + args.join(' '), friend);
    }
    else
        bot.sendClient("User cannot be found.", client);
};

module.exports = {w: whipser};
