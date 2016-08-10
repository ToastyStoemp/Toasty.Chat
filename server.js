var fs = require('fs');

var configFileName = "config.json";
var versionFileName = "./client/data.js";

function loadFile(filename) {
    var file = null;

    if (fs.existsSync(filename)) {
        file = fs.readFileSync(filename, 'utf8');
        console.log("Loaded '" + filename + "'");
        return file;
    }
    else if (filename == "config.json") {
        file = fs.readFileSync("config-sample.json", 'utf8');
        console.log("Loaded default config-sample.json file");
        configFileName = "config-sample.json";
        return file;
    }

    console.log("File " + filename + "does not exists");
    return file;
}

function main() {
    var config = JSON.parse(loadFile(configFileName));
    var version = loadFile(versionFileName).match(/"([0-9]+)"/)[1];
    console.log("Running version " + version);

    var chatServerBase = require("./server.ChatServerBase.js")();
    var POLICE = require("./server.Police.js");
    var police = new POLICE(config.base);
    chatServerBase.initialize(config.base, version, police);

    if (config.webSocketServer && config.webSocketServer.enabled) {
        var webSocketServer = require("./server.WebSocketServer.js")();
        webSocketServer.initialize(config.webSocketServer);
        webSocketServer.run(chatServerBase);
    }
    if (config.ircServer && config.ircServer.enabled) {
        var ircServer = require("./server.IrcServer.js")();
        ircServer.initialize(config.ircServer);
        ircServer.run(chatServerBase);
    }
    if (config.restApiServer && config.restApiServer.enabled) {
        var restApiServer = require("./server.RestApiServer.js")();
        restApiServer.initialize(config.restApiServer);
        restApiServer.run(chatServerBase);
    }
    if (config.webSocketServer && config.webSocketServer.enabled && config.client && config.client.enabled) {
        var client = require("./server.client.js")();
        config.client.socketPort = config.webSocketServer.port;
        client.initialize(config.client);
        client.run();
    }
    else if (config.bouncer && config.bouncer.enabled && config.bouncer.hasOwnProperty("wss")) {
        var bouncer = require("./server.Bouncer.js")();
        bouncer.initialize(config.bouncer, police);
        bouncer.run();
        if (config.bouncer.client) {
            var client = require("./server.client")();
            config.client.socketPort = config.bouncer.socketPort;
            config.client.port = config.bouncer.port;
            config.client.domain = config.bouncer.domain;
            client.initialize(config.client);
            client.run();
        }
    }

    fs.watchFile(configFileName, {
        persistent: false
    }, function () {
        config = JSON.parse(loadFile(configFileName));
        chatServerBase.initialize(config.base, version, police);
        if (config.webSocketServer.enabled) webSocketServer.initialize(config.webSocketServer);
        if (config.ircServer.enabled) ircServer.initialize(config.ircServer);
    });
    fs.watchFile(versionFileName, {
        persistent: false
    }, function () {
        version = loadFile(versionFileName).match(/"([0-9]+)"/)[1];
        console.log("Running version " + version);
        chatServerBase.initialize(config.base, version, police);
        if (config.webSocketServer && config.webSocketServer.enabled) webSocketServer.initialize(config.webSocketServer);
        if (config.ircServer && config.ircServer.enabled) ircServer.initialize(config.ircServer);
        if (config.restApiServer && config.restApiServer.enabled) ircServer.initialize(config.ircServer);
    });
}

main();
