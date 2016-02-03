function sendManual(bot, sender, args, data, client) {
  if (!args[0])
    return bot.sendClient(bot.man.man, client);
  args[0] = args[0].split("!").join(""); // remove all !
  if (bot.man[args[0]])
    return bot.sendClient(bot.man[args[0]], client);
  return bot.sendClient("Command !" + args[0] + " doesn't exist or doesn't have a manual", client);
}

module.exports = {
  man: {
    action: sendManual,
    man: "Syntax is !man <bot cmd>; sends the manual of <bot cmd>."
  }
}
