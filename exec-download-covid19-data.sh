#!/bin/sh

/usr/bin/node /root/covid19-trend-map-data/dist/download-covid19-data.js >> /root/covid19-trend-map-data/log.txt 2>&1

cp /root/covid19-trend-map-data/public/us-counties-paths.json /var/www/static.vannizhang.com/html/covid19
cp /root/covid19-trend-map-data/public/us-counties.json /var/www/static.vannizhang.com/html/covid19
cp /root/covid19-trend-map-data/public/us-states-paths.json /var/www/static.vannizhang.com/html/covid19
cp /root/covid19-trend-map-data/public/us-states.json /var/www/static.vannizhang.com/html/covid19
cp /root/covid19-trend-map-data/public/latest-numbers.json /var/www/static.vannizhang.com/html/covid19