var whipser = function(bot, sender, args, data, client)
{
  if (args.length < 2) {
    bot.sendClient("Usage is .w [nick] [message]", client);
    return;
  }
  var targetNick = args.splice(0,1)[0];
  targetNick = targetNick.replace("@", "");
  var friend = bot.chatServerBase.getClientOfChannel(targetNick, client.channel) || null;
  if (friend != null){
    bot.sendClient(sender + " whispers to " + friend.nick + ": " + args.join(' '), friend);
    bot.sendClient("You wispered to " + friend.nick + ":", client);
  } else
    bot.sendClient("User can not be found.", client);
};

module.exports = {w: whipser};
