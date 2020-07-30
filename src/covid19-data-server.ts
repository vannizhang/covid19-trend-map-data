import express from 'express';
const fs = require('fs');
const path = require("path");

const app = express();
const port = process.env.PORT || 8500;

import USStates from '../public/us-states.json';

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(express.static(path.resolve(__dirname, 'public')));

app.listen(port, function () {
    const parentDir = path.resolve(__dirname, '..');
    console.log('app listening on port ' + port);
    console.log(path.resolve(__dirname, 'public'));
    console.log(path.join(__dirname, 'public'));
    console.log(__dirname + 'public');
    console.log(path.join(parentDir, 'public'));
});

app.get('/', function(req, res) {
    res.json({"version": "0.1"});
    // res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/foobar', function(req, res) {
    res.json(USStates);
    // res.sendFile(path.join(__dirname + '/index.html'));
});