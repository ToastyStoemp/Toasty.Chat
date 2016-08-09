#!/bin/bash

trap "stop" SIGINT SIGTERM

cd /data/Toasty.Chat
(npm start)&
toastyChatPid=$!

function stop() {
    kill $toastyChatPid
}

wait $toastyChatPid
