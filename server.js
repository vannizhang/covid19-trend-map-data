const express = require('express');
const fs = require('fs');
const jsonfile = require('jsonfile');
const path = require("path");

const app = express();
const port = process.env.PORT || 8500;
const jsonFilePath = './public/data.json';

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
    // res.json({"version": "0.1"});
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/getData', function(req, res) {

    const errorMsg = {
        "error": "cannot find data.json"
    };
    
    if (fs.existsSync(jsonFilePath)){
        console.log('found file', jsonFilePath);

        jsonfile.readFile(jsonFilePath, function(err, obj) {
            if(err){
                res.json(errorMsg);
            } else {
                res.json(obj);
            }
        });
    } else {
        // console.log('data.json found for');
        res.json(errorMsg);
    }
});