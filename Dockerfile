FROM ubuntu:latest

RUN apt-get update
RUN apt-get install -y nodejs npm
RUN npm install -g less jade http-server
