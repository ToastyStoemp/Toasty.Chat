### Credit
This project is worked around the base of https://hack.chat,
a beautiful project by Andrew Belt (https://github.com/AndrewBelt)

List of contributors Hack.Chat:
* https://github.com/AndrewBelt
* https://github.com/ac1dburnn
* https://github.com/zckrs
* https://github.com/jaflo
* https://github.com/M4GNV5
* https://github.com/gkbrk
* https://github.com/WebFreak001
* https://github.com/marclundgren
* https://github.com/maxerize

List of contributors Toasty.Chat:
* https://github.com/ToastyStoemp
* https://github.com/0x17de
* https://github.com/raf924
* https://github.com/M4GNV5

## Local install

### Server

node v0.12 or higher is required to run the server.

* `git clone https://github.com/ToastyStoemp/Toasty.Chat.git`
* `cd Toasty.Chat`
* `npm install`
* Copy `config-sample.json` to `config.json` and edit if needed.
* `sudo node server`

Change the "frontpage" text in `client.js` to your liking, and go to http://127.0.0.1:8080.

### Error Codes
* `E001` Your IP is being rate-limited or blocked.
* `E002` You are joining channels too fast. Wait a moment and try again.
* `E003` Nickname must consist of up to 24 letters, numbers, and underscores.
* `E004` Cannot impersonate the admin.
* `E005` Nickname taken.
* `E006` You are sending too much text. Wait a moment and try again.
* `E007` You are sending invites too fast.
* `E008` Could not find user in channel.
* `E009` Could not find user. (Banning user)
* `E010` Cannot ban moderator. (Banning user)

### Info Codes
* `I001` You invited [nick] to [channel].
* `I002` [nick] invited you to [channel].
* `I003` stats
* `I004` Banned [nick]
* `I005` Server broadcast.
