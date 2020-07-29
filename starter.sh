#!/bin/sh

if [ $(ps -e -o uid,cmd | grep $UID | grep node | grep -v grep | wc -l | tr -s "\n") -eq 0 ]
then
        export PATH=/usr/local/bin:$PATH
        forever start /root/covid19-trend-map-data/dist/covid19-data-server.js >> /root/covid19-trend-map-data/log.txt 2>&1
fi