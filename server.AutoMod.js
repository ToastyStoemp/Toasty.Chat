// rate limiter
var donatorlist = require("./data/donators.json"); //WTF?
var responses = require("./data/responses.json");

function AutoMod(config, chatServerBase) {
    this.records = []; //Global user data
    this.config = config;
    this.userData = []; //An array of channels, with user message data user = {text, time, score} this is channel specific
    this.chatServerBase = chatServerBase;
}

AutoMod.prototype.search = function(id) {
    var record = this.records[id];
    if (!record) {
        record = this.records[id] = {
            time: Date.now(),
            score: 0
        }
    }
    return record
};

AutoMod.prototype.frisk = function(id, deltaScore) {
    //Frisk works cross channels, while normal ScanMessage works per channel
    return false;
    var record = this.search(id);
    if (record.arrested || record.dumped) {
        return true
    }

    record.score *= Math.pow(2, -(Date.now() - record.time) / AutoMod.halflife);
    record.score += deltaScore;
    record.time = Date.now();
    return record.score >= this.threshold;
};

AutoMod.prototype.ban = function(id, time) {
    if (id == "127.0.0.1" || id == "::1") {
        return;
    }
    var record = this.search(id);
    if (record) {
        record.arrested = true;
        if (time)
            setTimeout(function() {
                record.arrested = false
            }, time * 1000);
    }
};

AutoMod.prototype.kick = function(id) {
    var record = this.search(id);
    if (record) {
        record.dumped = true;
        setTimeout(function() {
            record.dumped = false
        }, 30 * 1000);
    }
};

AutoMod.prototype.mute = function(id, time) {
    if (id == "127.0.0.1" || id == "::1") {
        return;
    }
    time = typeof time !== 'undefined' ? time : 60;
    var record = this.search(id);
    if (record) {
        record.isSilenced = true;
        setTimeout(function() { record.isSilenced = false }, time * 1000);
    }
};

AutoMod.prototype.isMuted = function(id) {
    var record = this.search(id);
    if (record)
        return record.isSilenced;
    return false;
};

AutoMod.prototype.isAdmin = function(client) {
    if (!client.trip) return false;
    return (this.config.admin == client.nick);
};
AutoMod.prototype.isMod = function(client) {
    if (!client.trip) return false;
    if (this.isAdmin(client)) return true;
    return this.config.mods && this.config.mods.indexOf(client.trip) >= 0;
};

module.exports = AutoMod;


// var http = require('http');
// var request = require('request');
// var nude = require('nude');
// var uu = require('url-unshort');
// var phantom = require('phantom-render-stream');
// var render = phantom();
// var unshort = new uu();
// var HackChat = require("./hackchat.js");

//Data
//var userStats = {}; //require("./userStats.json");
//var config;
var directResponses;
var responses;
//reload();

//Variables
//var users = {};
var links = [];
var connections = {};


//----------
//initialze
//----------

//Connect to the default channel
//connections[config.botChannel] = chat.join(config.botChannel, config.botName, config.botPass);


//---------
//events
//---------

AutoMod.prototype.ScanMessage = function(data, client) { //returns false if message is not spam
    if (client.isAdmin || client.isMod)
        return false;

    //inspect the user
    if (this.config.ignoreTrips.indexOf(client.trip) == -1) {
        //push the image to the users' buffer
        this.logMesage(data, client);

        var outPutMessage = '';
        //outPutMessage += linkCheck(session, text, nick) || '';
        outPutMessage += this.textCheck(data, client) || '';
        if (outPutMessage !== '') {
            var warningData = { cmd: 'chat', text: outPutMessage, nick: 'AutoMod' };
            client.send(null, warningData);
            return true;
        }
    }

    // //parse commands
    // //Should be merged with the normal Bot
    // if (data.text[0] == this.config.commandPrefix)
    //     this.parseCommand(data, client);

    return false;
};

//--------------
//AutoMod Functions
//--------------

//addes the lattest message to a buffer
AutoMod.prototype.logMesage = function(data, client) {
    //if user is not initialized yet, initialze it
    if (!this.userData[client.channel])
        this.userData[client.channel] = [];
    if (this.userData[client.channel][client.trip]) {
        this.userData[client.channel][client.trip].push({
            "time": Date.now(),
            "text": data.text,
            "score": 0
        }); //add the message to the users buffer
    } else {
        this.userData[client.channel][client.trip] = [{
            "time": Date.now(),
            "text": data.text,
            "score": 0
        }];
    }

    //Substract a mesvsage counter after 5 minutes for this user
    var that = this;
    setTimeout(function() {
        that.userData[client.channel][client.trip].shift();
    }, 5 * 60 * 1000);
};

//Give a user a warning
AutoMod.prototype.warnUser = function(client, reason) {

    this.userData[client.channel][client.trip] = [];

    //Handle user score
    client.score++;
    console.log('User: ' + client.nick + ' ' + reason);
    setTimeout(function() {
        client.score--;
    }, 1 * 60 * 60 * 1000);

    //Handle canTalk
    client.canTalk = false;
    client.timeoutTime += client.score * 10; // in seconds
    var timer = setInterval(function() {
        client.timeoutTime--;
        if (client.timeoutTime == 0)
            clearInterval(timer);
    }, 1000);

    return ("@" + client.nick + " warning #" + client.score + ": " + reason + "\n");
}

//return an arry with results from one nick name in the user stats
AutoMod.prototype.getName = function(nick) {
    var matches = [];
    for (var user in userStats) {
        if (user.indexOf(nick) != -1)
            matches.push(user);
    }
    return matches;
}

//-----------
//spam detection functions
//-----------

//controll text
AutoMod.prototype.textCheck = function(data, client) {

    //could be that link check already passed a warning
    if (!(this.userData[client.channel]))
        return;
    if (!(this.userData[client.channel][client.trip]))
        return;

    var thisUserData = this.userData[client.channel][client.trip];

    //Spam Region
    var maxMessages = this.config.maxMessagesPer5Min; //Max amount of messages every 5 min
    var maxAvgtime = this.config.minMessageSpeed; //Max difference that just baerly triggers the warning
    var maxSimilarityMultiLine = this.config.maxSimilarityMultiMessages; //Max similarity between the first and third message
    var maxSimilaritySingleLine = this.config.maxSimilaritySingleMessage; //Max similarity between the words in the text
    var maxLinecount = this.config.maxLinecount; //amount of lines a message can be max
    var maxWordLength = this.config.maxWordLength;
    var maxCharCount = this.config.maxCharCount;

    var hasMulitpleMessages = thisUserData.length > 2;

    var lastMessage = thisUserData[thisUserData.length - 1]; //last message send
    var secondlastMessage = hasMulitpleMessages ? thisUserData[thisUserData.length - 2] : ""; //second from last message send 
    var thirdLastMessage = hasMulitpleMessages ? thirdLastMessage = thisUserData[thisUserData.length - 3] : ""; //third from last message send

    if (lastMessage) {

        //checks if a series of words is not longer then maxLinecount thresh hold
        if (lastMessage.text.split(/\r\n|\r|\n/).length > maxLinecount)
            return this.warnUser(client, responses.longText); //long text

        //checks if there are not too many characters in a text
        if (this.charCount(lastMessage.text) > maxCharCount)
            return this.warnUser(client, responses.longText); //long text 2

        //check if a single word is not too long
        if (this.longestWord(lastMessage.text).length > maxWordLength)
            return this.warnUser(client, responses.longWord); //long word

        //check if a word is too repetitive within a text ( spam spam spam ) for example
        if (this.similar_inlineText(lastMessage.text, maxSimilaritySingleLine, maxSimilarityMultiLine))
            return this.warnUser(client, responses.similarWords); // similar words

        //check if the user did not post too many message in the last n minutes
        if (thisUserData.length > maxMessages)
            return this.warnUser(client, responses.longTermSpeed); // long term speed count

        if (hasMulitpleMessages) { //spam checks that require multiple messages ( 3 )

            //check if this message is similar to the third from last message
            if ((this.similar_text(lastMessage.text, secondlastMessage.text) + this.similar_text(lastMessage.text, thirdLastMessage.text)) / 2 >= maxSimilarityMultiLine)
                return this.warnUser(client, responses.similarMessage); // similar messages

            //check the speed between the last and third from last is not too fast
            if (lastMessage.time - thirdLastMessage.time < maxAvgtime)
                return this.warnUser(client, responses.shortTermSpeed); // Short term speed count

            if (this.shortMessages(lastMessage.text, secondlastMessage.text, thirdLastMessage) && lastMessage.time - thirdLastMessage.time < maxAvgtime * 5)
                return this.warnUser(nick, responses.shortTermSpeedSpam); // Short term speed count
        }
    }
}

//Check if all messages are too short
AutoMod.prototype.shortMessages = function(first, second, third) {
    return (first.length <= 3 && second.length <= 3 && third.length <= 3)
}

//returns how similar 2 texts are
AutoMod.prototype.similar_text = function(first, second) {
    if (first == second)
        return 1;

    firstArr = first.split(' ');
    for (var word in firstArr) {
        if (firstArr[word].indexOf('@') != -1)
            firstArr.splice(firstArr[word], 1);
        else
            firstArr[word] = firstArr[word].split('').sort().join('');
    }
    firstArr = firstArr.sort();
    secondArr = second.split(' ');
    for (word in secondArr) {
        if (secondArr[word].indexOf('@') != -1)
            secondArr.splice(secondArr[word], 1);
        else
            secondArr[word] = secondArr[word].split('').sort().join('');
    }
    secondArr = secondArr.sort();

    var similarityCounter = 0;
    for (word in first)
        if (first[word] == second[word])
            similarityCounter++;

    return similarityCounter / ((first.length + second.length) / 2.0);
}

//checks for repeating words within a text
AutoMod.prototype.similar_inlineText = function(text, maxWordOccurence, maxSimilarity) {
    var checkedWords = [];
    var textArr = text.split(' ');
    if (textArr.length < 7)
        return false;
    for (var i = 0; i < textArr.length - 1; i++) {
        var wordCount = 1;
        if (checkedWords.indexOf(textArr[i]) == -1) {
            for (var k = i + 1; k < textArr.length; k++)
                if (textArr[i] == textArr[k] || this.similar_text(textArr[i], textArr[k]) > maxSimilarity)
                    wordCount++;
            if (wordCount / textArr.length >= maxWordOccurence)
                return true;
        }
        checkedWords.push(textArr[i]);
    }
    return false;
}

//returns the longers word in a text
AutoMod.prototype.longestWord = function(text) {
    var textArr = text.split(' ');
    var longest = textArr[0];
    for (var word of textArr) {
        if (word != "" && word.length > longest.length) {
            longest = word;
        }
    }
    return longest;
};

//returns the amount of characters a text is in length
AutoMod.prototype.charCount = function(text) {
    return text.length;
}

//Controll links
AutoMod.prototype.linkCheck = function(session, text, nick) {
    var urls = text.match(/(https?:\/\/)\S+?(?=[,.!?:)]?\s|$)/g); //returns an array with all links in the current message
    if (urls) {
        for (var url of urls) {
            if (links.indexOf(url) == -1) {
                //add the link to a list, to keep track of previously posted links
                links.push(url);
                setTimeout(function() {
                    links.shift();
                }, 10 * 60 * 1000); //Substract a link after 1 minutes

                //Preform a malicious link test, using the google API
                request('https://sb-ssl.google.com/safebrowsing/api/lookup?client=demo-app&key=' + config.gooleApiKey + '&appver=1.5.2&pver=3.1&url=' + url, function(error, response, body) {
                    if (!error && response.statusCode == 200)
                        session.sendMessage(warnUser(nick, "this link has been flagged as $\\color{red}{" + body + "}$"));
                });

                unshort.expand(url, function(err, urlnew) {
                    if (urlnew)
                        url = urlnew;

                    if (url.match(/(?:jpe?g|png)/g)) {
                        //preform nudity scan
                        scanFile(session, url, text);
                    } else {
                        //if the site was succesfully unshortend, render a preview, including the target domain
                        urlDomain = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im)[1];
                        urlName = urlDomain.split('.')[0] + Math.floor(Math.random() * 1000);
                        previewSite(session, url, urlName, urlnew ? urlDomain : null);
                    }
                });
            } else
                session.sendMessage(warnUser(nick, "this link has been posted recently"));
        }
    }
}

//-----------
//file related Functions
//-----------

//Scan a file for nudity
var scanFile = function(session, url, message) {
    var filename = "temp.jpg";
    downloadFile(url, filename, true,
        function() {
            try {
                //nude.scan(filename, function(res) {
                var fileName = url.split("/");
                fileName = fileName[fileName.length - 1];
                fs.rename(filename, config.path + fileName);
                var message = "Nudity scan has been temp dissabled. ";
                //if (message.toLowerCase().indexOf("nsfw") == -1 && res) {
                //message += fileName + " flagged as possible [NSFW]\n";
                //}
                session.sendMessage(message + "Alternative link: " + config.domain + fileName + " available for 1 hour.");
                setTimeout(function() {
                    try {
                        fs.unlink(config.path + fileName)
                    } catch (e) {
                        console.log(e + " error");
                    }
                }, 1 * 60 * 60 * 1000); //remove file after 1 hour
                //});
            } catch (e) {
                console.log(e + "\nYour server might be out of memory (RAM)");
            }
        });
};

//download file
var downloadFile = function(uri, filename, validate, callback) {
    var valid = true;
    request.get(uri)
        .on('response', function(response) {
            if (response.statusCode != 200)
                valid = false;
            if (response.headers['content-type'].indexOf('image') == -1) // 'image/png'
                valid = false;
        })
        .pipe(fs.createWriteStream(filename))
        .on('close', function() {
            if (validate) {
                if (valid)
                    callback();
            } else callback();
        });
};

//render a preview of a Website
var previewSite = function(session, uri, name, domain) {
    render(uri, config.previewSettings)
        .on('error', function() {
            if (domain)
                session.sendMessage("Target domain is: " + domain + "\nPreview could not be generated");
            else
                session.sendMessage("Preview could not be generated");
        })
        .pipe(fs.createWriteStream(config.path + name + '.jpg'))
        .on('close', function() {
            if (domain)
                session.sendMessage("Target domain is: " + domain + "\nWebsite preview: " + config.domain + name + ".jpg");
            else
                session.sendMessage("Website preview: " + config.domain + name + ".jpg");
            setTimeout(function() {
                try {
                    fs.unlink(config.path + name + '.jpg');
                } catch (e) {
                    console.log(e);
                }
            }, 1 * 60 * 60 * 1000); //remove file after 1 hour
        });
}

//Async file loader
function loadFile(name) {
    return JSON.parse(fs.readFileSync(name).toString());
}

//---------
//commands
//---------

AutoMod.prototype.parseCommand = function(session, nick, message, isMod) {
    var args = message.split(" ");
    var command = String(args.splice(0, 1));
    command = command.substr(1, command.length);

    //Moderator commands
    if (isMod) {
        switch (command) {
            //bans a user
            case "ban":
                var target = message.split(" ")[1];
                if (target[0] == '@')
                    target = target.substr(1, target.length);
                if (config.banIgnore.indexOf(target) != -1)
                    return;
                session.sendRaw({
                    cmd: "ban",
                    nick: message.split(" ")[1]
                });
                return;
        }
    }
}