var whipser = function(bot, sender, args, data, client) {
  if (args.length < 2)
    return bot.sendClient("Usage is .w [nick] [message]", client);
  if (!args[1])
    return bot.sendClient("Usage is .w [nick] [message]", client);
  var targetNick = args.splice(0, 1)[0];
  targetNick = targetNick.replace("@", "");
  if (sender == targetNick) return;
  var friend = bot.chatServerBase.getClientOfChannel(targetNick, client.channel) ||
    null;
  if (friend != null) {
    bot.sendWhisper(args.join(' '), client, friend);
  } else
    bot.sendClient("User can not be found.", client);
};

module.exports = {
  w: whipser
};
