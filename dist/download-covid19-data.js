"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('fs');
const path = require('path');
const US_Counties_json_1 = __importDefault(require("./US-Counties.json"));
const PUBLIC_FOLDER_PATH = path.join(__dirname, '../public');
const OUTPUT_JSON = path.join(PUBLIC_FOLDER_PATH, 'data.json');
const fetchCovid19Data4USCounties = () => {
};
const startUp = () => __awaiter(void 0, void 0, void 0, function* () {
    makeFolder(PUBLIC_FOLDER_PATH);
    writeToJson(US_Counties_json_1.default, OUTPUT_JSON);
});
const writeToJson = (data, outputPath) => {
    const json = JSON.stringify(data);
    fs.writeFile(outputPath, json, 'utf8', () => {
        console.log(new Date(), `data.json is updated and saved: ${outputPath}`, '\n');
    });
};
const makeFolder = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
};
const average = (values) => values.reduce((a, b) => a + b) / values.length;
startUp();
