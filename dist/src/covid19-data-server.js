"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs = require('fs');
const path = require("path");
const app = express_1.default();
const port = process.env.PORT || 8500;
const us_states_json_1 = __importDefault(require("../public/us-states.json"));
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(express_1.default.static(path.resolve(__dirname, 'public')));
app.listen(port, function () {
    const parentDir = path.resolve(__dirname, '..');
    console.log('app listening on port ' + port);
    console.log(path.resolve(__dirname, 'public'));
    console.log(path.join(__dirname, 'public'));
    console.log(__dirname + 'public');
    console.log(path.join(parentDir, 'public'));
});
app.get('/', function (req, res) {
    res.json({ "version": "0.1" });
});
app.get('/foobar', function (req, res) {
    res.json(us_states_json_1.default);
});
