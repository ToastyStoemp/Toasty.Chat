FROM ubuntu:latest

RUN apt-get update
RUN apt-get install -y nodejs npm
RUN ln -s /usr/bin/nodejs /usr/bin/node
RUN mkdir -p /data/Toasty.Chat
RUN cd /data/Toasty.Chat
RUN git clone https://github.com/ToastyStoemp/Toasty.Chat .
RUN npm install
RUN apt-get clean \
 && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ADD entrypoint.sh /

WORKDIR /
ENTRYPOINT "entrypoint.sh"
