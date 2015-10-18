module.exports.skills = function(bot, sender, args, data) {
  if (typeof args[0] == 'undefined' || args[0].trim() == "") {
    _skills(bot, sender, sender);
  } else if (args[0].trim() == "add") {
    var user = args[1].trim();
    var userTrip = args[2].trim();
    args.splice(0, 3);
    _addSkill(bot, sender, args, data.trip, user, userTrip);
  } else if (args[0].trim() == "remove") {
    var user = args[1].trim();
    var userTrip = args[2].trim();
    args.splice(0, 3);
    _removeSkills(bot, sender, args, data.trip, user, userTrip);
  } else {
    var user = args[0].trim();
    _skills(bot, sender, user);
  }
}

var _addSkill = function(bot, sender, skills, trip, user, userTrip) {
  if (bot.config.tripCodes[sender] != trip) {
    bot.send("@" + sender + " Sorry, you can't do that. You're not valid.");
  } else if (userTrip == null || bot.config.tripCodes[user] != userTrip) {
    return bot.send("@" + sender + " Sorry, you can't do that. " + user + " is not valid.");
  } else if (skills.length == 0) {
    return bot.send("@" + sender + " Usage: /skills add <user> <tripCode> <skill> <skill> etc...");
  } else {
    for (var skill in skills) {
      var index = bot.config.skills[bot.config.tripCodes[user]].indexOf(skill);
      if (index !== -1) {
        skills.slice(skills.indexOf(skill), 1);
      }
    }
    bot.config.skills[bot.config.tripCodes[user]] = bot.config.skills[bot.config.tripCodes[user]].concat(skills);
    bot.commands["config"](bot, "raf924", ["save"]);
    _skills(bot, sender, trip, sender);
  }
}

var _removeSkills = function(bot, sender, skills, trip, user, userTrip) {
  if (bot.config.tripCodes[sender] != trip) {
    return bot.send("@" + sender + " Sorry, you can't do that. You're not valid.");
  } else if (userTrip == null || bot.config.tripCodes[user] != userTrip) {
    return bot.send("@" + sender + " Sorry, you can't do that. " + user + " is not valid.");
  } else if (skills.length == 0) {
    return bot.send("@" + sender + " Usage: /skills remove <user> <tripCode> <skill> <skill> etc...");
  } else {
    for (var skill in skills) {
      bot.config.skills[userTrip].splice(bot.config.skills[userTrip].indexOf(skills[skill]), 1);
    }
    bot.commands["config"](bot, "raf924", ["save"]);
    _skills(bot, sender, trip, sender);
  }
}

var _skills = function(bot, sender, user) {
  var trip = bot.config.tripCodes[user];
  if (trip) {
    var skills = bot.config.skills[trip];
    if (skills && skills.length > 0) {
      return bot.send("@" + sender + " user " + user + " has registered the following skills: " + skills.join(", "));
    } else {
      return bot.send("@" + sender + " user " + user + " has not registered any skill (you'll have to ask them)");
    }
  } else {
    return bot.send("@" + sender + " user " + user + " is not on the list of known users");
  }
}
