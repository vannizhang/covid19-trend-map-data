import express from 'express';
const fs = require('fs');
const path = require("path");

const app = express();
const port = process.env.PORT || 8500;

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(express.static('public'));

app.listen(port, function () {
    console.log('app listening on port ' + port);
});

app.get('/', function(req, res) {
    res.json({"version": "0.1"});
    // res.sendFile(path.join(__dirname + '/index.html'));
});