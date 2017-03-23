var userIgnore;
var send;

var notifySound = new Audio('https://toastystoemp.com/public/notifi-sound.wav');
var friendSound = new Audio('https://toastystoemp.com/public/friendSound.wav');


$(function() {

    // localstorage wrappers //
    function localStorageGet(key) {
        try {
            return window.localStorage[key];
        } catch (e) {
            return false;
        }
    }

    function localStorageSet(key, val) {
        try {
            window.localStorage[key] = val;
        } catch (e) {
            return false;
        }
    }

    // favorite functions & vars start //
    var unFavedIcon = "https://toastystoemp.com/public/removeFav.png";
    var favedIcon = "https://toastystoemp.com/public/addFav.png";

    function storeFavArray(favArray) {
        localStorageSet('favs', JSON.stringify(favArray));
    }

    function getFavArray() {
        var toReturn = localStorageGet('favs');
        if (!toReturn || typeof toReturn === 'undefined')
            return ['programming'];

        return JSON.parse(toReturn);
    }

    function getFavArrayFormatted() {
        var toReturn = "Favorited Channels:\n";
        var favs = getFavArray();

        for (var i = 0, j = favs.length; i < j; i++)
            toReturn += " - ?" + favs[i] + "\n";

        return toReturn;
    }

    function addToFavs(channel) {
        var favs = getFavArray();
        favs.push(channel);
        storeFavArray(favs);
    }

    function removeFromFavs(channel) {
        var favs = getFavArray();

        for (var i = 0, j = favs.length; i < j; i++)
            if (favs[i] == channel)
                favs.splice(i, 1);

        storeFavArray(favs);
    }

    function isInFavChan(qChan) {
        var favs = getFavArray();
        for (var i = 0, j = favs.length; i < j; i++)
            if (favs[i] == qChan) return true;

        return false;
    }

    // favorite functions end //

    $("#link-block").hide();

    var frontpage = [
        window.config.typeLogo === "text" ? window.config.logo : "",
        "",
        "",
        "Welcome to Toasty.chat, an extended version of hack.chat.",
        "This is an opensource project, we can be found here: https://github.com/ToastyStoemp/Toasty.Chat",
        "",
        "You can create any channel you want, just type: ?<ChannelName> behind the url",
        "",
        "The chat is now also accessable through IRC, server: chat.toastystoemp.com:6667",
        "channel: #<Channel Name>",
        "",
        "Server and web client released under the GNU General Public License.",
        "No message history is retained on the toasty.chat server.",
        "",
        ""
    ].join("\n") + getFavArrayFormatted();

    var ws;
    var myNick = "";
    var myChannel = window.location.search.replace(/^\?/, '');
    var lastSent = [""];
    var lastSentPos = 0;
    var disconnectCodes = ['666'];
    var links = [];
    var imageData = [];
    var mSelector = false;
    var bSelector = false;
    var lastWhisper = "";

    //Login
    let mixedLogin = new MixedLoginPopup(document.querySelector("#login"));
    mixedLogin.onsuccess = function(channel, nick, password) {
        myNick = `${nick}#${password}`;
        $(document).trigger("login", channel);
    };
    mixedLogin.ondone = function(channel) {
        this.close();
    };

    // Timeout handling
    var connectTime = 0;
    var joinTryCount = 0; // More delay till reconnect when more errors
    var lastMessageElement = null;

    // Ping server every 50 seconds to retain WebSocket connection
    window.setInterval(function() {
        send({
            cmd: 'ping'
        });
    }, 50 * 1000);

    function calculateRejoinTimeout() {
        switch (joinTryCount) {
            case 0:
            case 1:
                return 2000;
            case 2:
                return 3000;
            case 3:
                return 6000;
            case 4:
                return 12000;
            case 5:
                return 22000;
        }
        return 30000;
    }

    function join(channel) {
        connectTime = new Date(); // here also for 'normal' connect fails

        if (document.domain === window.config.domain) {
            // For a registered domain
            ws = new WebSocket('wss://' + document.domain + '/chatws');
        } else {
            // for local installs
            ws = new WebSocket('ws://' + document.domain + ':6060');
        }

        var lastPong = new Date();

        ws.onopen = function() {
            if (bSelector)
                send({
                    cmd: 'warn',
                    text: "Connection could not be established"
                });
            else
                send({
                    cmd: 'verify',
                    version: webClientVersion
                });
        };

        var pongCheck = setInterval(function() {
            var secondsSinceLastPong = (lastPong - new Date()) / 1000;
            if (secondsSinceLastPong > 50 + 20) {
                //ws.close();
                lastPong = new Date();
            }
        }, 5 * 1000);

        ws.onclose = function() {
            clearInterval(pongCheck);

            var secondsSinceConnection = (new Date() - connectTime) / 1000;
            if (secondsSinceConnection > 2) {
                joinTryCount = 0;
            } else {
                joinTryCount++; // Caused by connection error
            }
            var timeout = calculateRejoinTimeout() / 1000;

            pushMessage({
                nick: '!',
                text: "Disconnected. Waiting for <span id=\"reconnectTimer\">" +
                    timeout + "</span> seconds till retry (" + joinTryCount +
                    ").",
                elementId: 'disconnect_message',
                replaceIfSameAsLast: true
            }, false);
            document.title = "⚡️ Disconnected";


            var timerEl = document.getElementById("reconnectTimer");
            var reconnectInterval = window.setInterval(function() {
                timeout -= 1;
                timerEl.innerHTML = timeout;

                if (timeout <= 0) {
                    clearInterval(reconnectInterval);
                    timerEl.id = "oldReconnectTimer";
                    join(this.channel);
                }
            }, 1000);
        };

        ws.onmessage = function(message) {
            lastPong = new Date();
            var args = JSON.parse(message.data);
            var cmd = args.cmd;
            var command = COMMANDS[cmd];
            if (command !== void 0)
                command.call(null, args);
            else
                console.log('Unknown command: ' + String(cmd));
        };
    }

    var wasConnected = false;

    function connect(channel) {
        myNick = localStorageGet('my-nick') || "";

        var autoLoginOk = $('#auto-login').is(":checked") && myNick != "";
        if (!wasConnected && !autoLoginOk) {
            var parts = myNick.split("#");
            var password = "";
            if (parts.length === 2) {
                password = parts[1].replace(/./g, "*");
            }
            mixedLogin.input.value = myNick.replace(/[#](.*)/, "#" + password);
            mixedLogin.realNick = myNick;
            mixedLogin.open(channel);
        } else {
            $(document).trigger("login", channel);
        }
    }

    $(document).on("login", function(e, channel) {
        if (myNick) {
            localStorageSet('my-nick', myNick);
            var nick = myNick.split("#")[0];
            var pass = myNick.split("#")[1] || ''; // a random password will be generated on server side if empty
            send({
                cmd: 'join',
                channel: channel,
                nick: nick,
                pass: pass
            });
            myNick = nick;
            $("#tsLink").attr("href",
                "ts3server://toastystoemp.com?nickname=" + myNick +
                "&cid=17&channelpassword=1234");
        }
        // if !myNick: do nothing - reload continued to try again
        wasConnected = true;
    });

    var COMMANDS = {
        pong: function(args) {
            // nothing to do
        },
        verify: function(args) {
            if (args.valid == true) {
                connect(myChannel);
            } else
                pushMessage({
                    nick: 'warn',
                    errCode: 'E000',
                    text: "You have an outdated client, CTRL + F5 to load the latest verison"
                });
        },
        chat: function(args) {
            if (ignoredUsers.indexOf(args.nick) >= 0)
                return;
            pushMessage(args);
        },
        whisper: function(args) {
            if (ignoredUsers.indexOf(args.nick) >= 0)
                return;
            if (args.owner)
                lastWhisper = args.owner;
            pushMessage(args);
        },
        action: function(args) {
            args.text = args.nick + args.text.substr(3);
            args.nick = '*';
            pushMessage(args);
        },
        info: function(args) {
            args.nick = '*';
            pushMessage(args);
        },
        shout: function(args) {
            args.nick = "<Server>";
            pushMessage(args);
            if (disconnectCodes.indexOf(args.errCode) != -1) {
                ws.close();
            }

        },
        warn: function(args) {
            args.nick = '!';
            pushMessage(args);
            if (disconnectCodes.indexOf(args.errCode) != -1) {
                ws.close();
            }
        },
        onlineSet: function(args) {
            var nicks = args.nicks;
            var trips = args.trips;
            usersClear();
            for (var i = 0; i < nicks.length; i++) {
                userAdd(nicks[i], trips[i]);
            }
            //		pushMessage({nick: '!', text: "Due to a change in powercost, the cost of the server has increased drastically and is leaving me with one option and one option only, making the chat a paid service. Soon I will enroll payment plans.  More info later."});
            pushMessage({
                nick: '*',
                text: "Users online: " + nicks.join(", ")
            });
        },
        onlineAdd: function(args) {
            var nick = args.nick;
            var trip = args.trip;
            userAdd(nick, trip);
            if ($('#joined-left').is(":checked")) {
                pushMessage({
                    nick: '*',
                    text: nick + " joined"
                });
            }
        },
        onlineRemove: function(args) {
            var nick = args.nick;
            if ($('#joined-left').is(":checked")) {
                pushMessage({
                    nick: '*',
                    text: nick + " left"
                });
            }
            userRemove(nick);
        },
        play: function(args) {
            var nick = args.nick;
            handleViewer(parseUrl(args.url));
            pushMessage({
                nick: "*",
                text: nick + " would like everyone to enjoy this"
            });
        },
        dataSet: function(args) {
            if (args.bSet)
                bSelector = true;
            if (args.mSet)
                mSelector = true;
        },
        close: function() {
            ws.close();
        }
    }

    var lastPoster = "";

    function pushMessage(args, usePre) {
        var date = new Date(args.time || Date.now());
        var messageEl = document.createElement('div');
        messageEl.classList.add('message');
        if (args.admin && args.nick != '*') {
            messageEl.classList.add('admin');
        } else if (args.nick == myNick) {
            messageEl.classList.add('me');
        } else if (args.nick == '!') {
            messageEl.classList.add('warn');
        } else if (args.nick == '*') {
            if (args.cmd == 'action') {
                lastPoster = '';
                messageEl.classList.add('action');
            } else {
                messageEl.classList.add('info');
            }
        } else if (args.nick == '<Server>') {
            messageEl.classList.add('shout');
        }

        if (args.elementId) { // for referencing special message
            var oldElement = document.getElementById(args.elementId);
            if (oldElement) oldElement.removeAttribute('id');
            messageEl.id = args.elementId;
            if (oldElement && args.replaceIfSameAsLast && oldElement ==
                lastMessageElement)
                oldElement.parentNode.removeChild(oldElement);
        }

        // Nickname
        var nickSpanEl = document.createElement('span');
        if (args.trip && !args.admin)
            nickSpanEl.style.color = onlineUsers[args.nick];
        nickSpanEl.classList.add('nick');
        messageEl.appendChild(nickSpanEl);

        if (args.trip && args.nick != lastPoster) {
            var tripEl = document.createElement('span');
            tripEl.textContent = args.trip + " ";
            tripEl.classList.add('trip');
            nickSpanEl.appendChild(tripEl);
        }

        if (args.nick && args.nick != lastPoster) {
            if (args.llama) {
                var llamaLinkEl = document.createElement('img');
                llamaLinkEl.src = "https://toastystoemp.com/m/1bb24b.png";
                llamaLinkEl.style.marginRight = "4px";
                llamaLinkEl.title = "Random Llama".toLocaleString();
                nickSpanEl.appendChild(llamaLinkEl);
            }

            var nickLinkEl = document.createElement('a');
            nickLinkEl.onclick = function() {
                if (args.whisper) {
                    if (args.target) {
                        nickLinkEl.textContent = "to " + args.target;
                        insertAtCursor(".w @" + args.target + " ");
                    } else {
                        nickLinkEl.textContent = "from " + args.owner;
                        insertAtCursor(".w @" + args.owner + " ");
                    }
                } else
                    insertAtCursor("@" + args.nick + " ");
                $('#chatinput').focus();
            }
            nickLinkEl.textContent = args.nick;

            nickLinkEl.title = date.toLocaleString();
            nickSpanEl.appendChild(nickLinkEl);

            //Donator Icon
            if (args.donator) {
                var donatorLinkEl = document.createElement('img');
                donatorLinkEl.src =
                    "https://toastystoemp.com/public/donator-icon.png";
                donatorLinkEl.style.marginLeft = "8px";
                donatorLinkEl.title = "Donator".toLocaleString();
                nickSpanEl.appendChild(donatorLinkEl);
            }
        }

        // Text
        var textEl;
        if (usePre !== false) {
            textEl = document.createElement('pre');
            textEl.textContent = args.text;
        } else {
            textEl = document.createElement('div');
            textEl.innerHTML = args.text;
        }
        textEl.classList.add('text');
        textEl.title = date.toLocaleString();

        links = [];
        textEl.innerHTML = textEl.innerHTML.replace(
            /(\?|https?:\/\/|ts3server:\/\/)\S+?(?=[,.!?:)]?\s|$)/g, parseLinks
        );
        textEl.innerHTML = textEl.innerHTML.replace(/```(.|\s)*```/g, parseCode)

        //textEl.innerHTML = markdown.toHTML(textEl.innerHTML);

        messageEl.appendChild(textEl);

        //Nick highligting
        if (!(args.nick == '!' || args.nick == '<Server>')) {
            for (var nick in onlineUsers) {
                var nickReg = new RegExp("(\\s|^)(@?" + nick + "\\b)", "i");
                if (nickReg.test(args.text)) {
                    var matches = args.text.match(nickReg);
                    var user = document.createElement('span');
                    user.textContent = "@" + nick;
                    user.style.color = onlineUsers[nick];
                    try {
                        textEl.innerHTML = textEl.innerHTML.replace(matches[2], user.outerHTML);
                    } catch (err) {
                        console.log(err.message);
                    }
                }
            }
        }

        //Mentioning + whispering
        if (myNick && args.nick != '*' && !args.whisper) {
            if ((new RegExp("(\\s|^)(@?" + myNick + "\\b)|(\\s|^)(@\\*)\\s", "i"))
                .test(args.text)) {
                messageEl.classList.add('mention');
                if ($('#notifications').is(":checked") && !document.hasFocus())
                    notifyMe(args.nick + " mentioned you", args.text, false);
            }
        } else if (args.whisper) {
            messageEl.classList.add('whisper');
            if ($('#notifications').is(":checked") && !document.hasFocus())
                notifyMe(args.nick + " mentioned you", args.text, false);
        }

        if (links.length != 0) {
            messageEl.appendChild(parseMedia());
        }

        // Scroll to bottom
        var atBottom = isAtBottom();
        $('#messages').append(messageEl);
        lastMessageElement = messageEl;
        if (atBottom) {
            window.scrollTo(0, document.body.scrollHeight);
        }

        lastPoster = args.nick;
        if (args.nick != '*' || args.nick != '!')
            unread += 1;
        updateTitle(args.owner, args.text);
    }


    function removeCharsTillIndex(index) {
        var input = $('#chatinput');
        var start = input[0].selectionStart || input.val().length || 0;
        if (index >= start)
            return;
        var before = input.val().substr(0, index);
        var after = input.val().substr(start);

        input.val(before + after);

        if (input[0].selectionStart)
            input[0].selectionEnd = input[0].selectionStart = before.length;
    }

    function insertAtCursor(text) {
        var input = $('#chatinput');
        var start = input[0].selectionStart || input.val().length || 0;
        var before = input.val().substr(0, start);
        var after = input.val().substr(start);
        before += text;

        input.val(before + after);

        if (input[0].selectionStart)
            input[0].selectionEnd = input[0].selectionStart = before.length;
    }


    send = function(data) {
        if (ws && ws.readyState == ws.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    function parseNicks(g0) {
        var a = document.createElement('a');
        a.innerHTML = g0;
        a.style.color = onlineUsers[args.nick];
        return a.outerHTML;
    }

    function parseCode(code) {
        var codeEl = document.createElement('code')
        codeEl.innerHTML = code.substr(4, code.length - 8);
        var lineCount = code.split(/\r\n|\r|\n/).length;
        if (lineCount > 15)
            codeEl.classList.add('largeScript');
        else
            codeEl.classList.add('script');
        return codeEl.outerHTML;
    }

    function parseLinks(g0) {
        var a = document.createElement('a');
        a.innerHTML = g0;
        var url = a.textContent;
        if (url[0] == '?') {
            url = "/" + url;
        }
        a.href = url;
        a.target = '_blank';

        var match = parseUrl(g0);
        if (match) {
            links.push(match);
        }
        return a.outerHTML;
    }

    function parseUrl(url) {
        //var urls = newData.text.match(/((https?:\/\/|www)\S+)|(\w*.(com|org|net|moe)\b)/ig);
        var youtubeLinks = url.match(
            /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*t/
        );

        //Image link
        if ((/\.(jpe?g|png|gif|bmp)$/i).test(url))
            return {
                type: "image",
                url: url
            };
        //Video link
        else if ((/\.(webm|mp4|ogg|gifv)$/i).test(url))
            return {
                type: "video",
                url: url
            };
        //Youtube
        else if (youtubeLinks)
            return {
                type: "youtube",
                token: youtubeLinks[7]
            };
        else
            return false;
    }

    function parseMedia() {
        var media = [];
        var _links = links.slice(0); //create copy of links
        var display = false;
        var p = document.createElement('p');
        for (var i = 0; i < links.length; i++) {
            if (links[i].type == "image")
                p.appendChild(createImageElement(links[i].url, media));
            else if (links[i].type == "video")
                p.appendChild(createVideoElement(links[i].url, media));
            else if (links[i].type == "youtube")
                p.appendChild(createYouTubeElement(links[i].token, media));
            else
                console.log("Unknown media type " + links[i].type); // good coding
        }
        var el = document.createElement('a');
        el.innerHTML = '[+]';
        el.style.border = 'none';
        el.style.background = 'none';
        el.onclick = function() {
            if (!display) {
                for (var i in media) {
                    var link = media[i];
                    link.style.display = "inline";
                }
                el.innerHTML = '[-]';
                display = true;
            } else {
                for (var i in media) {
                    var link = media[i];
                    link.style.display = "none";
                }
                el.innerHTML = '[+]';
                display = false;
            }
        };
        el.addEventListener("mouseover", function() {
            el.style.cursor = "pointer";
        });
        p.appendChild(el);
        var tv = document.createElement('a');
        tv.innerHTML = '[v]';
        tv.style.border = 'none';
        tv.style.background = 'none';
        tv.onclick = function() {
            handleViewer(_links[0]);
        };
        tv.addEventListener("mouseover", function() {
            tv.style.cursor = "pointer";
        });
        p.appendChild(tv);
        return p;
    }

    function createImageElement(link, media) {
        var image = document.createElement('img')
        image.setAttribute('src', link);
        image.style.display = "none";
        image.style.maxWidth = "50%";
        image.style.maxHeight = "50%";
        imageData[image] = {};
        imageData[image].resized = false;
        makeImageZoomable(image);
        media.push(image);
        return image;
    }

    function createVideoElement(link, media) {
        var video = document.createElement('video')
        video.setAttribute('src', link);
        video.style.display = "none";
        video.style.width = "100%";
        video.style.height = "100%";
        video.loop = true;
        video.controls = true;
        media.push(video);
        return video;
    }

    function createYouTubeElement(link, media) {
        var iframe = document.createElement('iframe')
        iframe.setAttribute('src', "https://www.youtube.com/embed/" + link +
            "?version=3&enablejsapi=1");
        iframe.setAttribute('width', "640");
        iframe.setAttribute('height', "385");
        iframe.setAttribute('frameborder', "0");
        iframe.setAttribute('allowFullScreen', '');
        iframe.style.display = "none";
        media.push(iframe);

        return iframe;
    }

    function getDragSize(e) {
        return (p = Math.pow)(p(e.clientX - (rc = e.target.getBoundingClientRect())
            .left, 2) + p(e.clientY - rc.top, 2), .5);
    }

    function getHeight() {
        return window.innerHeight || document.documentElement.clientHeight ||
            document.body.clientHeight;
    }

    function makeImageZoomable(imgTag) {
        dragTargetData = {};

        imgTag.addEventListener('mousedown', function(e) {
            if (e.ctrlKey != 0)
                return true;
            if (e.metaKey != null) // Can be on some platforms
                if (e.metaKey != 0)
                    return true;
            if (e.button == 0) {
                if (imageData[e.target].position == null) {
                    imageData[e.target].zIndex = e.target.style.zIndex;
                    imageData[e.target].width = e.target.style.width;
                    imageData[e.target].height = e.target.style.height;
                    imageData[e.target].position = e.target.style.position;
                }
                dragTargetData.iw = e.target.width;
                dragTargetData.d = getDragSize(e);
                dragTargetData.dr = false;
                e.preventDefault();
            }
        }, true);

        imgTag.addEventListener('contextmenu', function(e) {
            if (imageData[e.target].resized) {
                imageData[e.target].resized = false;
                e.target.style.zIndex = imageData[e.target].zIndex;
                e.target.style.maxWidth = e.target.style.width = imageData[e.target]
                    .width;
                e.target.style.maxHeight = e.target.style.height = imageData[e.target]
                    .height;
                e.target.style.position = imageData[e.target].position;
                e.preventDefault();
                e.returnValue = false;
                e.stopPropagation();
                return false;
            }
        }, true);
        imgTag.addEventListener('mousemove', function(e) {
            if (dragTargetData.d) {
                e.target.style.maxWidth = e.target.style.width = ((getDragSize(
                    e)) * dragTargetData.iw / dragTargetData.d) + "px";
                e.target.style.maxHeight = '';
                e.target.style.height = 'auto';
                e.target.style.zIndex = 1000; // Make sure the image is on top.

                if (e.target.style.position == '') {
                    e.target.style.position = 'relative';
                }
                dragTargetData.dr = true;
                imageData[e.target].resized = true;
            }
        }, false);

        imgTag.addEventListener('mouseout', function(e) {
            dragTargetData.d = false;
            if (dragTargetData.dr) return false;
        }, false);

        imgTag.addEventListener('mouseup', function(e) {
            dragTargetData.d = false;
            if (dragTargetData.dr) return false;
        }, true);

        imgTag.addEventListener('click', function(e) {
            if (e.ctrlKey != 0)
                return true;
            if (e.metaKey != null) // Can be on some platforms
                if (e.metaKey != 0)
                    return true;
            dragTargetData.d = false;
            if (dragTargetData.dr) {
                e.preventDefault();
                return false;
            }
            if (imageData[e.target].resized) {
                e.preventDefault();
                e.returnValue = false;
                e.stopPropagation();
                return false;
            }
        }, false);
    }

    document.addEventListener('dragstart', function() {
        return false
    }, false);

    var unread = 0;

    window.onfocus = function(e) {
        for (var i = 0; i < notifications.length; i++) {
            notifications[i].close();
        }
        notifications = [];
        unread = 0;
        updateTitle();
        if (e.target === window) {
            $('#chatinput').focus();
        }
    };

    window.onscroll = function() {
        if (isAtBottom()) {
            updateTitle();
        }
    };

    function isAtBottom() {
        return (window.innerHeight + window.scrollY) >= (document.body.scrollHeight -
            1);
    }

    function updateTitle(nick, message) {
        if (document.hasFocus() && isAtBottom())
            unread = 0;

        var title;
        if (myChannel)
            title = "?" + myChannel;
        else
            title = "Toasty.Chat";

        if (unread > 0)
            title = '(' + unread + ') ' + title;

        if (nick)
            title = "[W] " + nick + ": " + message;

        document.title = title;
    }

    /* footer */

    $('#footer').onclick = function() {
        $('#chatinput').focus();
    }

    var typedTabNick = null; // remember _typed_ letters for TAB autocompletion
    var nickTabIndex = -1; // last presented username index for TAB autocompletion
    var lengthOfInsertedNick = 0; // used for TAB autocompletion
    $('#chatinput').keydown(function(e) {
        if (e.keyCode == 13 /* ENTER */ && e.altKey) {
            e.preventDefault();
            // Submit whisper
            if (e.target.value != '') {
                var text = e.target.value;
                e.target.value = '';
                if (mSelector)
                    pushMessage({
                        nick: myNick,
                        target: target,
                        text: text,
                        whisper: true
                    });
                else
                    send({
                        cmd: 'whisper',
                        text: text,
                        target: lastWhisper
                    });

                command, client, args
                lastSent[0] = text;
                lastSent.unshift("");
                lastSentPos = 0;
            }
        }
        if (e.keyCode == 13 /* ENTER */ && !e.shiftKey) {
            e.preventDefault();
            // Submit message
            if (e.target.value != '') {
                var text = e.target.value;
                e.target.value = '';
                if (mSelector)
                    pushMessage({
                        nick: myNick,
                        text: text
                    });
                else
                    send({
                        cmd: 'chat',
                        text: text
                    });
                lastSent[0] = text;
                lastSent.unshift("");
                lastSentPos = 0;
            }
        } else if (e.keyCode == 38 /* UP */ ) {
            // Restore previous sent messages
            if (e.target.selectionStart === 0 && lastSentPos < lastSent.length -
                1) {
                e.preventDefault();
                if (lastSentPos == 0) {
                    lastSent[0] = e.target.value;
                }
                lastSentPos += 1;
                e.target.value = lastSent[lastSentPos];
                e.target.selectionStart = e.target.selectionEnd = e.target.value
                    .length;
            }
        } else if (e.keyCode == 40 /* DOWN */ ) {
            if (e.target.selectionStart === e.target.value.length &&
                lastSentPos > 0) {
                e.preventDefault();
                lastSentPos -= 1;
                e.target.value = lastSent[lastSentPos];
                e.target.selectionStart = e.target.selectionEnd = 0;
            }
        } else if (e.keyCode == 27 /* ESC */ ) {
            e.preventDefault();
            // Clear input field
            e.target.value = "";
            lastSentPos = 0;
            lastSent[lastSentPos] = "";
        } else if (e.keyCode == 9 /* TAB */ ) {
            // Tab complete nicknames starting with a whitespace
            e.preventDefault();
            var pos = e.target.selectionStart || 0;
            var text = e.target.value;
            var index = text.substr(0, pos).lastIndexOf(' ') + 1;
            if (index >= 0) {
                if (!typedNick)
                    typedNick = text.substring(index, pos);
                else
                    index = text.substr(0, pos - 1).lastIndexOf(' ') + 1;
                typedNick = typedNick[0] == '@' ? typedNick.substr(1, typedNick
                    .length) : typedNick;
                var stub = typedNick.toLowerCase();
                if (stub != "") {
                    if ((stub == ".r" || stub == ".r ") && lastWhisper != "") {
                        removeCharsTillIndex(index);
                        insertAtCursor(".w @" + lastWhisper + " ");
                    } else {
                        var nicks = [];
                        for (var nick in onlineUsers) {
                            var lowerNick = nick.toLowerCase();
                            if (lowerNick.indexOf(stub) === 0)
                                nicks.push(nick);
                        }
                        if (nicks.length === 0)
                            nicks = onlineUsers;
                        if (nicks.length > 0) {
                            nickTabIndex = (nickTabIndex + 1) % nicks.length; // loop through nicks
                            removeCharsTillIndex(index);
                            insertAtCursor("@" + nicks[nickTabIndex] + " ");
                        }
                    }
                }
            }
        } else if (e.keyCode != 9) { /* TAB*/
            typedNick = null;
            nickTabIndex = -1;
            lengthOfInsertedNick = 0;
            $(this).data("index", null);
        }
    });


    /* sidebar */
    var firstSlide = true;

    $('#favLink').click(function() {
        if (isInFavChan(myChannel)) {
            removeFromFavs(myChannel);
            $(this).children('img').attr('src', unFavedIcon);
        } else {
            addToFavs(myChannel);
            $(this).children('img').attr('src', favedIcon);
        }
    });

    $('#settingsicon').click(function() {
        if (!firstSlide) {
            $("#sidebar-content").toggle("fold", {
                size: "0"
            });
            $("#sidebar-content").toggleClass("sidebar-extra");
            firstSlide = true;
        } else {
            $("#sidebar-content").toggleClass("sidebar-extra");
            $("#sidebar-content").toggle("fold", {
                size: "0"
            });
            firstSlide = false;
        }
    });

    $('#clear-messages').click(function() {
        // Delete children elements
        $('#messages .message').remove();
    });

    $('#llamas').click(function() {
        if ($(this).is(":checked")) {
            $('#llama').removeClass('hidden');
        } else {
            $('#llama').addClass('hidden');
        }
    });

    // Restore settings from localStorage

    if (localStorageGet('auto-login') == 'true') {
        $("#auto-login").prop('checked', true);
    }
    if (localStorageGet('joined-left') == 'false') {
        $("#joined-left").prop('checked', false);
    }
    if (localStorageGet('leave-warning') == 'false') {
        $("#leave-warning").prop('checked', false);
    }
    if (localStorageGet('notifications') == 'false') {
        $("#notifications").prop('checked', false);
    }
    if (localStorageGet('sounds') == 'false') {
        $("#sounds").prop('checked', false);
    }
    mSelector = (localStorageGet('mSelector') == 'true');
    bSelector = (localStorageGet('bSelector') == 'true');
    var friends = localStorageGet('friends');
    if (friends == "" || typeof friends == 'undefined')
        friends = [];
    else
        friends = friends.split(' ');

    $('#auto-login').change(function(e) {
        localStorageSet('auto-login', !!e.target.checked);
    });
    $('#joined-left').change(function(e) {
        localStorageSet('joined-left', !!e.target.checked);
    });
    $('#leave-warning').change(function(e) {
        localStorageSet('leave-warning', !!e.target.checked);
    });
    $('#notifications').change(function(e) {
        localStorageSet('notifications', !!e.target.checked);
    });
    $('#sounds').change(function(e) {
        localStorageSet('sounds', !!e.target.checked);
    });

    // User list

    var onlineUsers = {};
    var ignoredUsers = [];

    function userAdd(nick, trip) {
        onlineUsers[nick] = colorRender(trip);
        if (friends.indexOf(nick) != -1)
            if ($('#sounds').is(":checked"))
                friendSound.play();
        var user = document.createElement('a');
        if (nick != myNick.split('#')[0]) {
            user.textContent = nick + ' ▾';
            var menu = document.createElement('ul');
            var friendUser = document.createElement('a');
            if (friends.indexOf(nick) == -1)
                friendUser.textContent = "Add Friend";
            else
                friendUser.textContent = "Remove Friend";
            friendUser.onclick = function(e) {
                if (friendUser.textContent == "Add Friend") {
                    friendUser.textContent = "Remove Friend";
                    friends.push(nick);
                    pushMessage({
                        nick: '*',
                        text: "User " + nick + " has been added to your friends list."
                    });
                } else {
                    friendUser.textContent = "Add Friend";
                    friends.splice(friends.indexOf(nick), 1);
                    pushMessage({
                        nick: '*',
                        text: "User " + nick + " has been removed to your friends list."
                    });
                }
            }
            var menuLi = document.createElement('li');
            menuLi.appendChild(friendUser);
            menuLi.classList.add('menuList');
            menu.appendChild(menuLi);

            var inviteUser = document.createElement('a');
            inviteUser.textContent = "Invite";
            inviteUser.onclick = function(e) {
                userInvite(nick);
            };
            menuLi = document.createElement('li')
            menuLi.appendChild(inviteUser)
            menuLi.classList.add('menuList');
            menu.appendChild(menuLi);

            var ignoreUser = document.createElement('a');
            ignoreUser.textContent = "Ignore";
            ignoreUser.onclick = function(e) {
                userIgnore(nick);
                pushMessage({
                    nick: '*',
                    text: "User " + nick + " has been added to your ignore list."
                });
            }
            menuLi = document.createElement('li')
            menuLi.appendChild(ignoreUser)
            menuLi.classList.add('menuList');
            menu.appendChild(menuLi);

            menu.classList.add('dropdown');
            user.appendChild(menu);
        } else
            user.textContent = nick;
        user.style.cssText = 'color:' + onlineUsers[nick];
        user.classList.add('userList');
        var userLi = document.createElement('li');
        userLi.appendChild(user);
        $('#users').append(userLi);
        //onlineUsers.push(nick);
    }

    function userRemove(nick) {
        var children = $('#users').children();
        for (var i = 0; i < children.length; i++) {
            var user = children[i]
            if (user.textContent.substr(0, user.textContent.indexOf(' ')) == nick)
                users.removeChild(user)
        }
        delete onlineUsers[nick];
    }

    function usersClear() {
        $('#users li').remove();
        for (var i in onlineUsers) // loop keeps same reference
            delete onlineUsers[i];
    }

    function userInvite(nick) {
        send({
            cmd: 'invite',
            nick: nick
        });
    }

    function colorRender(trip, admin) {
        if (trip == "vmowGH")
            return "#cd3333";
        var color1 = (Math.floor((trip[0].charCodeAt(0) - 33) * 2.865)).toString(
            16);
        var color3 = (Math.floor((trip[1].charCodeAt(0) - 33) * 2.865)).toString(
            16);
        var color2 = (Math.floor((trip[2].charCodeAt(0) - 33) * 2.865)).toString(
            16);
        return "#" + color1 + color2 + color3;
    }

    if (!Notification)
        console.log(
            'Desktop notifications not available in your browser. Try Chrome.');
    else if (Notification.permission !== "granted")
        Notification.requestPermission();

    var notifications = [];

    function notifyMe(title, text, channel) {
        if (typeof text != 'undefined') {
            if ($('#notifications').is(":checked"))
                notifySound.play();
            var Channel = channel;
            var not = new Notification(title, {
                body: text,
                icon: 'https://toastystoemp.com/public/notifi-icon.png'
            });

            not.onclick = function() {
                if (Channel) {
                    window.open('https://' + document.domain + '/?' + Channel,
                        '_blank');
                } else
                    window.focus()
            };
            setTimeout(function() {
                not.close();
                notifications.splice(notifications.indexOf(not), 1);
            }, 8000);
            notifications.push(not);
        }
    }


    // set global var
    userIgnore = function(nick) {
        ignoredUsers.push(nick);
    }

    /* color scheme switcher */

    var schemes = [
        'android',
        'atelier-dune',
        'atelier-forest',
        'atelier-heath',
        'atelier-lakeside',
        'atelier-seaside',
        'bright',
        'chalk',
        'default',
        'eighties',
        'greenscreen',
        'mocha',
        'monokai',
        'nese',
        'ocean',
        'pop',
        'railscasts',
        'solarized',
        'tomorrow',
    ];

    var currentScheme = 'solarized';

    function setScheme(scheme) {
        currentScheme = scheme;
        $("#scheme-link").attr("href", "/schemes/" + scheme + ".css");
        localStorageSet('scheme', scheme);
    }

    // Add scheme options to dropdown selector
    schemes.forEach(function(scheme) {
        var option = document.createElement('option');
        option.textContent = scheme;
        option.value = scheme;
        $('#scheme-selector').append(option);
    })

    $('#scheme-selector').change(function(e) {
        setScheme(e.target.value);
    });

    // Load sidebar configaration values from local storage if available
    if (localStorageGet('scheme')) {
        setScheme(localStorageGet('scheme'));
    }

    $('#scheme-selector').value = currentScheme;

    /*theatre*/
    var isTheatre = false;
    var isLinkWindow = false;

    function handleViewer(obj) {
        return;
        var link;
        if (!obj)
            link = null;
        else if (obj.type == "youtube")
            link = "https://www.youtube.com/embed/" + obj.token +
            "?autoplay=1&origin=" + document.domain;
        else
            link = obj.url;

        if (isTheatre && link == null) {
            $("#viewer").remove();
            isTheatre = false;
            if (isLinkWindow) {
                $("#link-block").toggle("hide", function() {
                    $('#chat').animate({
                        width: "100%"
                    });
                });
                isLinkWindow = false;
                return;
            }
            $("#theatre").css({
                height: "0"
            });
            $('#chat').animate({
                width: "100%"
            });;
            return;
        } else if (isTheatre) {
            editViewer(link);
        }
        $('#chat').animate({
            width: "25%"
        }, function() {
            isTheatre = true;
            if (typeof link == 'undefined') {
                $("#link-block").toggle("hide");
                isLinkWindow = true;
            } else
                createViewer(link);
        });
    }

    function createViewer(link) {
        var iframe = document.createElement('iframe');
        iframe.id = "viewer";
        iframe.src = link;
        $("#theatre").append(iframe);
    }

    function editViewer(link) {
        $("#viewer").src = link;
        $("#viewer").contentWindow.location.reload(true);
    }

    $("#toggle-viewer").click(function() {
        var atBottom = isAtBottom();
        handleViewer();
        if (atBottom)
            window.scrollTo(0, document.body.scrollHeight);
    });

    $("#load-link").click(function() {
        createViewer($("#link-input").val());
        $("#link-block").toggle("hide");
        isLinkWindow = false;
    });


    /* main */
    if (myChannel == '') {
        pushMessage({
            text: frontpage
        });
        var img = document.createElement("img");
        img.src = window.config.logo;
        img.id = "logo";
        $("pre.text").prepend(img);
        $('#footer').addClass('hidden');
        $('#sidebar').addClass('hidden');
    } else {
        if (isInFavChan(myChannel))
            $("#favLink").children('img').attr('src', unFavedIcon);

        join(myChannel);
    }

    $(window).resize(function() {
        if (isTheatre) {
            $("#theatre").css({
                height: ($(window).height())
            });
            $('#link-block').css({
                position: 'absolute',
                left: ($("#theatre").width() - $('#link-block').width()) /
                    2,
                top: ($("#theatre").height() - $('#link-block').height()) /
                    2
            });
        } else {
            $("#theatre").css({
                height: "0"
            });
        }
    });

    // To initially run the function:
    $(window).resize();

    //AutoResizer
    jQuery.each(jQuery('textarea[data-autoresize]'), function() {
        var offset = this.offsetHeight - this.clientHeight;

        var resizeTextarea = function(el) {
            // Scroll to bottom
            var atBottom = isAtBottom();
            jQuery(el).css('height', 'auto').css('height', el.scrollHeight +
                offset);
            $('#messages').css('margin-bottom', el.scrollHeight + offset +
                5);
            if (atBottom)
                window.scrollTo(0, document.body.scrollHeight);
        };
        jQuery(this).on('keyup input', function() {
            resizeTextarea(this);
        }).removeAttr('data-autoresize');
    });

    window.onbeforeunload = function() {
        localStorageSet('friends', friends.join(' '));
        localStorageSet('mSelector', mSelector);
        localStorageSet('bSelector', bSelector);
        if (wasConnected && myChannel != '' && $('#leave-warning').is(
                ":checked")) {
            return 'Are you sure you want to leave?';
        }
    };
});


class MixedLoginPopup {
    constructor(root) {
        this.realNick = "";
        this.keyPressedDown = false;
        let that = this;
        this.root = root;
        this.input = root.querySelector("#nick");
        this.confirmButton = root.querySelector("[type='submit]");
        this.overlay = document.querySelector("#loginOverlay");
        this.loginForm = this.root.querySelector("form");
        this.loginForm.onsubmit = function(ev) {
            ev.preventDefault();
            if (typeof that.onsuccess === "function") {
                that.onsuccess(that.channel, that.realNick.split("#")[0], that.realNick.split("#")[1]);
            }
            if (typeof that.ondone === "function") {
                that.ondone(that.channel);
            }
            that.realNick = "";
        };
        let selectionStart = 0;
        let selectionEnd = 0;
        this.input.addEventListener("textInput", this.keyInput.bind(this));
        this.input.addEventListener("keydown", this.keyInput.bind(this));
        this.input.addEventListener("keydown", function(e) {
            selectionStart = e.currentTarget.selectionStart;
            selectionEnd = e.currentTarget.selectionEnd;
        });
        this.input.addEventListener("keyup", function(ev) {
            let key = null;
            let target = ev.currentTarget;
            if (target.value.length === 0) {
                that.realNick = "";
            } else if (!that.keyPressedDown && target.value.length < that.realNick.length && navigator.userAgent.match(/Android/i)) {
                if (selectionStart === target.selectionStart) {
                    key = "Delete";
                } else if (selectionStart > target.selectionStart) {
                    key = "Backspace";
                }
                that.applyComposition(key, selectionStart, selectionEnd);
            }
            that.keyPressedDown = false;
        });
        this.loginForm.addEventListener("reset", function() {
            that.realNick = "";
            if (typeof that.oncancel === "function") {
                that.oncancel(that.channel);
            }
            if (typeof that.ondone === "function") {
                that.ondone(that.channel);
            }
        });
    }

    open(channel) {
        this.channel = channel;
        this.overlay.classList.remove("hidden");
        this.root.classList.add("open");
        let that = this;
        window.setTimeout(function() {
            that.input.focus();
        }, 100);
        document.addEventListener("keyup", (function(e) {
            if (e.key === "Escape") {
                this.loginForm.reset();
            }
        }).bind(this));
    }

    close() {
        this.overlay.classList.add("hidden");
        this.input.value = "";
        this.realNick = "";
        document.removeEventListener("keyup", (function(e) {
            if (e.key === "Escape") {
                this.loginForm.reset();
            }
        }).bind(this));
        this.channel = null;
    }

    keyInput(event) {
        this.keyPressedDown = true;
        let target = event.currentTarget;
        let before;
        let after;
        let key = event.key || event.data;
        switch (key) {
            case "Backspace":
            case "Delete":
                this.applyComposition(key, target.selectionStart, target.selectionEnd);
                break;
            case "Enter":
                break;
            default:
                if (key.length === 1) {
                    event.preventDefault();
                    before = this.realNick.substring(0, target.selectionStart);
                    after = this.realNick.substring(target.selectionEnd);
                    this.realNick = before + key + after;
                    let matches = this.realNick.split("#");
                    let oldSelectionStart = event.currentTarget.selectionStart;
                    event.currentTarget.value = matches.length < 2 ? this.realNick : this.realNick.replace(/#(.+)/, `#${matches[1].replace(/./g, "*")}`);
                    event.currentTarget.selectionStart = oldSelectionStart + 1;
                    event.currentTarget.selectionEnd = oldSelectionStart + 1;
                }
                break;
        }
    }

    applyComposition(key, selectionStart, selectionEnd) {
        let before;
        let after;
        switch (key) {
            case "Backspace":
                before = this.realNick.substring(0, selectionStart - 1);
                after = this.realNick.substring(selectionEnd);
                this.realNick = before + after;
                break;
            case "Delete":
                before = this.realNick.substring(0, selectionStart);
                if (selectionStart === selectionEnd) {
                    selectionEnd++;
                }
                after = this.realNick.substring(selectionEnd);
                this.realNick = before + after;
                break;
        }
    }
}