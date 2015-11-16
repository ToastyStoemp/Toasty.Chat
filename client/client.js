var userIgnore; // public function
$(function() {

	//UPDATE THIS ON EVERY COMMIT
	var versionNumber = '201511200003';

$("#link-block").hide();
var frontpage = [
	" __                                                 ",
	" /|                 /                  /         /   ",
	"( |  ___  ___  ___ (___           ___ (___  ___ (___ ",
	"  | |   )|   )|___ |    /\   )    |    |   )|   )|    ",
	"  | |__/ |__/| __/ |__   /\_/     |__  |  / |__/||__  ",
  "                      	  /  -                          ",

	"",
	"",
	"Welcome to Toasty.chat, an extended version of hack.chat.",
	"",
	"Here is the only channel you will join:",
	"?programming",
	"",
	"You can create any channel you want, just type: ?<Channel Name> behind the url",
	"",
	"The chat is now also accessable through IRC, server: chat.toastystoemp.com:6667",
	"channel: #<Channel Name>",
	"",
	"Server and web client released under the GNU General Public License.",
	"No message history is retained on the toasty.chat server.",
].join("\n")

function localStorageGet(key) {
	try {
		return window.localStorage[key]
	}
	catch(e) {}
}

function localStorageSet(key, val) {
	try {
		window.localStorage[key] = val
	}
	catch(e) {}
}

var ws
var myNick = ""
var myChannel = window.location.search.replace(/^\?/, '')
var lastSent = [""]
var lastSentPos = 0
var disconnectCodes = ['E002', 'E003', 'E004', 'E005'];
var links = [];
var imageData = [];

// Timeout handling
var connectTime = 0;
var joinTryCount = 0; // More delay till reconnect when more errors
var lastMessageElement = null;

// Ping server every 50 seconds to retain WebSocket connection
window.setInterval(function() {
	send({cmd: 'ping'})
}, 50*1000)

function calculateRejoinTimeout() {
	switch (joinTryCount) {
		case 0:
		case 1: return  2000;
		case 2: return  3000;
		case 3: return  6000;
		case 4: return 12000;
		case 5: return 22000;
	}
	return 30000;
}

function join(channel) {
	connectTime = new Date(); // here also for 'normal' connect fails

	if (document.domain == 'chat.toastystoemp.com') {
		// For http://toastystoemp.com/
		ws = new WebSocket('wss://chat.toastystoemp.com/chatws')
	}
	else {
		// for local installs
		ws = new WebSocket('ws://' + document.domain + ':6060')
	}

	var lastPong = new Date();

	ws.onopen = function() {
		send({cmd: 'verify', version: versionNumber })
	}


	var pongCheck = setInterval(function() {
		var secondsSinceLastPong = (lastPong - new Date()) / 1000;
		if (secondsSinceLastPong > 50+20) {
			ws.close();
			lastPong = new Date();
		}
	}, 5*1000);

	ws.onclose = function() {
		clearInterval(pongCheck);

		var secondsSinceConnection = (new Date() - connectTime) / 1000;
		if (secondsSinceConnection > 2) {
			joinTryCount = 0;
		} else {
			joinTryCount++; // Caused by connection error
		}
		var timeout = calculateRejoinTimeout();

		pushMessage({nick: '!', text: "Disconnected. Waiting for "+Math.floor(timeout/1000)+" seconds till retry ("+joinTryCount+").", elementId: 'disconnect_message', replaceIfSameAsLast: true});

		window.setTimeout(function() {
			join(this.channel)
		}, timeout)
	}

	ws.onmessage = function(message) {
		lastPong = new Date();
		var args = JSON.parse(message.data)
		var cmd = args.cmd
		var command = COMMANDS[cmd]
		if (command !== void 0)
			command.call(null, args)
		else
			console.warning('Unknown command: '+String(cmd));
	}
}

var wasConnected = false;
function connect(channel)
{
	myNick = localStorageGet('my-nick') || ""
	if (!(!wasConnected && ($('#auto-login').is(":checked")) && myNick != "")){
		$("#link-block").hide();
		myNick = prompt('Nickname:', myNick);
	}
	if (myNick) {
		localStorageSet('my-nick', myNick)
		var nick = myNick.split("#")[0];
		var pass = myNick.split("#")[1] || ''; // a random password will be generated on server side if empty
		if (nick == 'M4GNV5') nick = 'Komputar_Kid';
		send({cmd: 'join', channel: channel, nick: nick, pass: pass})
		myNick = nick;
	}
	wasConnected = true
}

var COMMANDS = {
	pong: function(args) {
		// nothing to do
	},
	verify: function(args) {
		if (args.valid == true)
			connect(myChannel);
		else
			pushMessage({nick: 'warn', errCode: 'E000', text: "You have an outdated client, CTRL + F5 to load the latest verison"});
	},
	chat: function(args) {
		if (ignoredUsers.indexOf(args.nick) >= 0) {
			return
		}
		pushMessage(args)
	},
	info: function(args) {
		args.nick = '*'
		pushMessage(args)
	},
	shout: function(args) {
		args.nick = "<Server>"
		pushMessage(args)
	},
	warn: function(args) {
		args.nick = '!'
		pushMessage(args)
		if (disconnectCodes.indexOf(args.errCode) != -1) {
			ws.close();
		}
	},
	onlineSet: function(args) {
		var nicks = args.nicks
		usersClear()
		nicks.forEach(function(nick) {
			userAdd(nick)
		})
		pushMessage({nick: '*', text: "Users online: " + nicks.join(", ")})
	},
	onlineAdd: function(args) {
		var nick = args.nick
		userAdd(nick)
		if ($('#joined-left').is(":checked")) {
			pushMessage({nick: '*', text: nick + " joined"})
		}
	},
	onlineRemove: function(args) {
		var nick = args.nick
		userRemove(nick)
		if ($('#joined-left').is(":checked")) {
			pushMessage({nick: '*', text: nick + " left"})
		}
	},
}

var lastPoster = "";

function pushMessage(args) {
	var messageEl = document.createElement('div')
		messageEl.classList.add('message')
		if (args.admin) {
			messageEl.classList.add('admin')
		}
		else if (args.nick == myNick) {
			messageEl.classList.add('me')
		}
		else if (args.nick == '!') {
			messageEl.classList.add('warn')
		}
		else if (args.nick == '*') {
			messageEl.classList.add('info')
		}
		else if (args.nick == '<Server>') {
			messageEl.classList.add('shout')
		}


		if (args.elementId) { // for referencing special message
			var oldElement = document.getElementById(args.elementId);
			if (oldElement) oldElement.removeAttribute('id');
			messageEl.id = args.elementId;
			if (oldElement && args.replaceIfSameAsLast && oldElement == lastMessageElement)
				oldElement.parentNode.removeChild(oldElement);
		}

		//Mentioning
		if (args.text.indexOf("@" + myNick.split("#")[0] + " ") != -1)
        messageEl.classList.add('mention');


		// Nickname
		var nickSpanEl = document.createElement('span')
		if (args.trip && !args.admin) {
			var color1 = (Math.floor((args.trip[0].charCodeAt(0) - 33) * 2.865)).toString(16);
			var color3 = (Math.floor((args.trip[1].charCodeAt(0) - 33) * 2.865)).toString(16);
			var color2 = (Math.floor((args.trip[2].charCodeAt(0) - 33) * 2.865)).toString(16);
			var color = "#" + color1 + color2 + color3;
			nickSpanEl.style.color = color;
		}
		nickSpanEl.classList.add('nick');
		messageEl.appendChild(nickSpanEl)

		if (args.trip && args.nick != lastPoster) {
			var tripEl = document.createElement('span')
			if (args.admin)
				tripEl.textContent = "Admin ";
			else if (args.trip.substr(0,6) == "KFbgGV")
				tripEl.textContent = "00010111 ";
			else
				tripEl.textContent = args.trip.substr(0,6) + " "
			tripEl.classList.add('trip')
			nickSpanEl.appendChild(tripEl)
		}

		if (args.nick && args.nick != lastPoster) {
			var nickLinkEl = document.createElement('a')
			nickLinkEl.textContent = args.nick
			nickLinkEl.onclick = function() {
				insertAtCursor("@" + args.nick + " ")
				$('#chatinput').focus()
			}
			var date = new Date(args.time || Date.now())
			nickLinkEl.title = date.toLocaleString()
			nickSpanEl.appendChild(nickLinkEl)
		}

	// Text
	var textEl = document.createElement('pre')
	textEl.classList.add('text')

	links = [];
	textEl.textContent = args.text || ''
	textEl.innerHTML = textEl.innerHTML.replace(/(\?|https?:\/\/)\S+?(?=[,.!?:)]?\s|$)/g, parseLinks)

	messageEl.appendChild(textEl)

	if (links.length != 0) {
		messageEl.appendChild(parseMedia());
	}

	// Scroll to bottom
	var atBottom = isAtBottom()
	$('#messages').append(messageEl)
	lastMessageElement = messageEl;
	if (atBottom) {
		window.scrollTo(0, document.body.scrollHeight)
	}

	lastPoster = args.nick;
	if (args.nick != '*')
		unread += 1
	updateTitle()
}


function insertAtCursor(text) {
	var input = $('#chatinput')
	var start = input.val().length || 0
	var before = input.val().substr(0, start)
	var after = input.val().substr(start)
	before += text

	input.val(before + after);
}


function send(data) {
	if (ws && ws.readyState == ws.OPEN) {
		ws.send(JSON.stringify(data))
	}
}

function parseLinks(g0) {
	var a = document.createElement('a')
	a.innerHTML = g0
	var url = a.textContent
	if (url[0] == '?') {
		url = "/" + url
	}
	a.href = url
	a.target = '_blank'
	if (checkURL(g0)) {
		links.push(g0);
	}
	return a.outerHTML
}

function checkURL(url) {
    return(url.match(/(http(s|)):\/\/(www\.|)(prntscr|)\.com\/([^.]+)/i) != null
		 || url.match(/(http(s|)):\/\/(www\.|i\.|)(imgur|)\.com\/([^.]+)/i) != null
		 || url.match(/(http(s|)):\/\/(www\.|)youtu(\.|)be(\.com\/watch\?v=|\/)(.+)/i) != null);
}
//url.match(/\.(jpeg|jpg|gif|png)$/)


function parse_yturl(url) {
	if (url != null) {
		var matches = url.match(/(http(s|)):\/\/(www\.|)youtu(\.|)be(\.com\/watch\?v=|\/)(.+)/i);
		if(matches!=null){
    	return matches[6].split("?")[0];
		}
	}
  return;
}

function parseMedia(){
	var media = [];
	var display = false;
	var p = document.createElement('p');
	var el = document.createElement('p');
	el.innerHTML = '[+]';
	el.style.border = 'none';
	el.style.background = 'none';
	for (var i = 0; i < links.length; i++) {
		//if (localLinks[i].match(/\.(jpeg|jpg|gif|png)$/) != null)
			//p.appendChild(createImageElement(localLinks[i], media));
		//else if (localLinks[i].match(/\.(ogg|webm|mp4)$/) != null)
			//p.appendChild(createvideoElement(localLinks[i], media));
	 	if (links[i].match(/(http(s|)):\/\/(www\.|)(prntscr|)\.com\/([^.]+)/i) != null) {
			var test=document.getElementById(links[i]).innerHTML;
			// if ((localLinks[i].match(/(http(s|)):\/\/(www\.prntscr)\.com\/([^.]+)/i) != null)
			// {
			// 	//Get imugr url
			// }
			// else
		}
		if (links[i].match(/(http(s|)):\/\/(www\.|i\.|)(imgur|)\.com\/([^.]+)/i) != null) {
			if (links[i].match(/\.(jpeg|jpg|gif|png|webm)$/) != null)
				p.appendChild(createImageElement(links[i], media));
			else
				p.appendChild(createImageElement(links[i] + '.png', media));
		}
		else if(parse_yturl(links[i]) != null)
			p.appendChild(createYouTubeElement(parse_yturl(links[i]), media));
	}
	el.onclick = function() {
		if (!display) {
				for(link of media)
						link.style.display = "inline";
				el.innerHTML = '[-]';
				display = true;
			}
    else {
				for(link of media)
					link.style.display = "none";
				el.innerHTML = '[+]';
				display = false;
			}
	};
	el.addEventListener("mouseover", function() {
	  el.style.cursor = "pointer";
	});
	p.appendChild(el);
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

function createvideoElement(link, media) {
  var video = document.createElement('video')
  video.setAttribute('src', link);
  video.style.display = "none";
  video.style.width = "100%";
  video.style.height = "100%";
  video.play();
  video.loop = true;
  media.push(video);
  return video;
}

function createYouTubeElement(link, media) {
  var iframe = document.createElement('iframe')
  iframe.setAttribute('src', "https://www.youtube.com/embed/" + link + "?version=3&enablejsapi=1");
  iframe.setAttribute('width', "640");
  iframe.setAttribute('height', "385");
  iframe.setAttribute('frameborder', "0");
  iframe.setAttribute('allowFullScreen', '');
  iframe.style.display = "none";
  media.push(iframe);

  return iframe;
}

function getDragSize(e) {
  return (p = Math.pow)(p(e.clientX - (rc = e.target.getBoundingClientRect()).left, 2) + p(e.clientY - rc.top, 2), .5);
}

function getHeight() {
  return window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
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
      e.target.style.maxWidth = e.target.style.width = imageData[e.target].width;
      e.target.style.maxHeight = e.target.style.height = imageData[e.target].height;
      e.target.style.position = imageData[e.target].position;
      e.preventDefault();
      e.returnValue = false;
      e.stopPropagation();
      return false;
    }
  }, true);
  imgTag.addEventListener('mousemove', function(e) {
    if (dragTargetData.d) {
      e.target.style.maxWidth = e.target.style.width = ((getDragSize(e)) * dragTargetData.iw / dragTargetData.d) + "px";
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

var windowActive = true
var unread = 0

window.onfocus = function() {
	windowActive = true
	updateTitle()
}

window.onblur = function() {
	windowActive = false
}

window.onscroll = function() {
	if (isAtBottom()) {
		updateTitle()
	}
}

function isAtBottom() {
	return (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 1)
}

function updateTitle() {
	if (windowActive && isAtBottom()) {
		unread = 0
	}

	var title
	if (myChannel) {
		title = "?" + myChannel
	}
	else {
		title = "Toasty.Chat"
	}
	if (unread > 0) {
		title = '(' + unread + ') ' + title
	}
	document.title = title
}

/* footer */

$('#footer').onclick = function() {
	$('#chatinput').focus()
}

$('#chatinput').keydown(function(e) {
	if (e.keyCode == 13 /* ENTER */ && !e.shiftKey) {
		e.preventDefault()
		// Submit message
		if (e.target.value != '') {
			var text = e.target.value
			e.target.value = ''
			if (text.substr(0,2) == "!b") {
				send({cmd: 'broadcast', text: text.substr(3)})
			}
			else {
				send({cmd: 'chat', text: text})
			}
			lastSent[0] = text
			lastSent.unshift("")
			lastSentPos = 0
		}
	}
	else if (e.keyCode == 38 /* UP */) {
		// Restore previous sent messages
		if (e.target.selectionStart === 0 && lastSentPos < lastSent.length - 1) {
			e.preventDefault()
			if (lastSentPos == 0) {
				lastSent[0] = e.target.value
			}
			lastSentPos += 1
			e.target.value = lastSent[lastSentPos]
			e.target.selectionStart = e.target.selectionEnd = e.target.value.length
		}
	}
	else if (e.keyCode == 40 /* DOWN */) {
		if (e.target.selectionStart === e.target.value.length && lastSentPos > 0) {
			e.preventDefault()
			lastSentPos -= 1
			e.target.value = lastSent[lastSentPos]
			e.target.selectionStart = e.target.selectionEnd = 0
		}
	}
	else if (e.keyCode == 27 /* ESC */) {
		e.preventDefault()
		// Clear input field
		e.target.value = ""
		lastSentPos = 0
		lastSent[lastSentPos] = ""
	}
	else if (e.keyCode == 9 /* TAB */) {
		// Tab complete nicknames starting with @
		e.preventDefault()
		var pos = e.target.selectionStart || 0
		var text = e.target.value
		var index = text.lastIndexOf('@', pos)
		if (index >= 0) {
			var stub = text.substring(index + 1, pos).toLowerCase()
			// Search for nick beginning with stub
			var nicks = onlineUsers.filter(function(nick) {
				return nick.toLowerCase().indexOf(stub) == 0
			})
			if (nicks.length == 1) {
				insertAtCursor(nicks[0].substr(stub.length) + " ")
			}
		}
	}
});


/* sidebar */
var firstSlide = true;
$('#settingsicon').click(function () {
	if (!firstSlide) {
		$( "#sidebar-content" ).toggle( "fold", {size: "0"} );
		$( "#sidebar-content" ).toggleClass( "sidebar-extra" );
		firstSlide = true;
	}
	else {
		 $( "#sidebar-content" ).toggleClass( "sidebar-extra" );
     $( "#sidebar-content" ).toggle( "fold", {size: "0"} );
		 firstSlide = false;
	}
});

$('#clear-messages').click = function() {
	// Delete children elements
	var messages = $('#messages')
	while (messages.firstChild) {
		messages.removeChild(messages.firstChild)
	}
}

// Restore settings from localStorage

if (localStorageGet('auto-login') == 'true') {
	$("#auto-login").prop('checked', true);
}
if (localStorageGet('joined-left') == 'false') {
	$("#joined-left").prop('checked', false);;
}

$('#joined-left').change(function(e) {
	localStorageSet('joined-left', !!e.target.checked)
});
$('#auto-login').change(function(e) {
	localStorageSet('auto-login', !!e.target.checked)
});

// User list

var onlineUsers = []
var ignoredUsers = []

function userAdd(nick) {
	var user = document.createElement('a')
	user.textContent = nick
	user.onclick = function(e) {
		userInvite(nick)
	}
	var userLi = document.createElement('li')
	userLi.appendChild(user)
	$('#users').append(userLi)
	onlineUsers.push(nick)
}

function userRemove(nick) {
	var children = $('#users').children();
	for (var i = 0; i < children.length; i++) {
		var user = children[i]
		if (user.textContent == nick) {
			users.removeChild(user)
		}
	}
	var index = onlineUsers.indexOf(nick)
	if (index >= 0) {
		onlineUsers.splice(index, 1)
	}
}

function usersClear() {
	$('#users li').remove();
	onlineUsers.length = 0
}

function userInvite(nick) {
	send({cmd: 'invite', nick: nick})
}

// set global var
userIgnore = function(nick) {
	ignoredUsers.push(nick)
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
]

var currentScheme = 'solarized'

function setScheme(scheme) {
	currentScheme = scheme
	$("#scheme-link").attr("href", "/schemes/" + scheme + ".css");
	localStorageSet('scheme', scheme)
}

// Add scheme options to dropdown selector
schemes.forEach(function(scheme) {
	var option = document.createElement('option')
	option.textContent = scheme
	option.value = scheme
	$('#scheme-selector').append(option)
})

$('#scheme-selector').change(function(e) {
	setScheme(e.target.value)
});

// Load sidebar configaration values from local storage if available
if (localStorageGet('scheme')) {
	setScheme(localStorageGet('scheme'))
}

$('#scheme-selector').value = currentScheme

/*theatre*/
var isTheatre = false;
var isLinkWindow = false;
function handleViewer(link){
	if (isTheatre) {
		$( "#viewer" ).remove();
		isTheatre = false;
		if (isLinkWindow) {
			$("#link-block").toggle("hide", function(){$('#chat').animate({ width: "100%" });});
			isLinkWindow = false;
			return
		}
		$("#theatre").css({height: "0"})
		$('#chat').animate({ width: "100%" });
		return
	}
	$('#chat').animate({ width: "25%" }, function(){
		isTheatre = true;
		if (typeof link == 'undefined') {
			$("#link-block").toggle("hide");
			isLinkWindow = true;
		}
		else
			createViewer(link);
	});
}

function createViewer(link) {
	var iframe = document.createElement('iframe');
	iframe.id = "viewer";
	iframe.src = link;
	$("#theatre").append(iframe);
}

$( "#toggle-viewer" ).click(function(){
	handleViewer();
});

$( "#load-link" ).click(function(){
	createViewer($("#link-input").val());
	$("#link-block").toggle("hide");
	isLinkWindow = false;
});


/* main */
if (myChannel == '') {
	pushMessage({text: frontpage})
	$('#footer').classList.add('hidden')
	$('#sidebar').classList.add('hidden')
}
else {
	join(myChannel)
}


$(window).resize(function(){
	if (isTheatre) {
		$("#theatre").css({
			height: ($(window).height())
		});
		$('#link-block').css({
			position:'absolute',
			left: ($("#theatre").width() - $('#link-block').width())/2,
			top: ($("#theatre").height() - $('#link-block').height())/2
		});
	}
	else {
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
				var atBottom = isAtBottom()
        jQuery(el).css('height', 'auto').css('height', el.scrollHeight + offset);
				$('#messages').css('margin-bottom', el.scrollHeight + offset + 5);
				if (atBottom) {
					window.scrollTo(0, document.body.scrollHeight)
				}
    };
    jQuery(this).on('keyup input', function() { resizeTextarea(this); }).removeAttr('data-autoresize');
});

window.beforeunload = function(){
  if(isPerformingOperation) {
    return 'Are you sure you want to leave?';
  }
}
});
