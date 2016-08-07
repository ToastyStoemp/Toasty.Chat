// rate limiter

function POLICE(config) {
    this.config = config;
    this.records = {};
    this.halflife = 30000; // ms
    this.threshold = 15;
    this.loadJail('jail.txt');
}

POLICE.prototype.loadJail = function (filename) {
    var ids;
    try {
        var text = fs.readFileSync(filename, 'utf8');
        ids = text.split(/\r?\n/);
    } catch (e) {
        return
    }
    for (var i in ids) {
        if (ids[i] && ids[i][0] != '#') {
            this.arrest(id)
        }
    }
    console.log("Loaded jail '" + filename + "'")
};

POLICE.prototype.search = function (id) {
    var record = this.records[id];
    if (!record) {
        record = this.records[id] = {
            time: Date.now(),
            score: 0
        }
    }
    return record
};

POLICE.prototype.frisk = function (id, deltaScore) {
    var record = this.search(id);
    if (record.arrested || record.dumped) {
        return true
    }

    record.score *= Math.pow(2, -(Date.now() - record.time) / POLICE.halflife);
    record.score += deltaScore;
    record.time = Date.now();
    return record.score >= this.threshold;
};

POLICE.prototype.arrest = function (id, time) {
    if (id == "127.0.0.1" || id == "::1") {
        return;
    }
    var record = this.search(id);
    if (record) {
        record.arrested = true;
        if (time)
            setTimeout(function () {
                record.arrested = false
            }, time * 1000);
    }
};

POLICE.prototype.dump = function (id) {
    var record = this.search(id);
    if (record) {
        record.dumped = true;
        setTimeout(function () {
            record.dumped = false
        }, 30 * 1000);
    }
};

POLICE.prototype.stfu = function (id, time) {
    if (id == "127.0.0.1" || id == "::1") {
        return;
    }
    time = typeof time !== 'undefined' ? time : 60;
    var record = this.search(id);
    if (record) {
        record.stfud = true;
        //	setTimeout(function(){ record.stfud = false }, time * 1000);
    }
};

POLICE.prototype.isStfud = function (id) {
    var record = this.search(id);
    if (record)
        return record.stfud;
    return false;
};

POLICE.prototype.isAdmin = function (client) {
    return client.nick.toLowerCase() === this.config.admin.toLowerCase();
};
POLICE.prototype.isMod = function (client) {
    if (!client.trip) return false;
    if (this.isAdmin(client)) return true;
    return this.config.mods && this.config.mods.indexOf(client.trip) >= 0;
};
POLICE.prototype.isDonator = function (client) {
    return typeof donatorlist[client.trip] != 'undefined';
};

module.exports = POLICE;
