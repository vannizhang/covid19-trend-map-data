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
const axios_1 = __importDefault(require("axios"));
const US_Counties_json_1 = __importDefault(require("./US-Counties.json"));
const PUBLIC_FOLDER_PATH = path.join(__dirname, '../public');
const OUTPUT_JSON = path.join(PUBLIC_FOLDER_PATH, 'data.json');
const USCountiesCovid19CasesByTimeFeatureServiceURL = 'https://services9.arcgis.com/6Hv9AANartyT7fJW/ArcGIS/rest/services/USCounties_cases_V1/FeatureServer/1';
const calcMovingAve = (features, numOfDays = 7) => {
    const confirmedMovingAve = [];
    const deathsMovingAve = [];
    const newCasesMovingAve = [];
    let indexOfLastItemInGroup = features.length - 1;
    for (let i = indexOfLastItemInGroup; i >= 0; i--) {
        if (i === indexOfLastItemInGroup) {
            const startIndex = indexOfLastItemInGroup - (numOfDays - 1) >= 0
                ? indexOfLastItemInGroup - (numOfDays - 1)
                : 0;
            const featuresInGroup = features.slice(startIndex, indexOfLastItemInGroup);
            let confirmedSum = 0;
            let deathSum = 0;
            let newCasesSum = 0;
            featuresInGroup.forEach(f => {
                const { Confirmed, Deaths, NewCases } = f.attributes;
                confirmedSum += Confirmed;
                deathSum += Deaths;
                newCasesSum += NewCases;
            });
            confirmedMovingAve.unshift(Math.round(confirmedSum / numOfDays));
            deathsMovingAve.unshift(Math.round(deathSum / numOfDays));
            newCasesMovingAve.unshift(Math.round(newCasesSum / numOfDays));
            indexOfLastItemInGroup = startIndex - 1;
        }
    }
    return {
        confirmed: confirmedMovingAve,
        deaths: deathsMovingAve,
        newCases: newCasesMovingAve
    };
};
const fetchCovid19Data4USCounties = () => __awaiter(void 0, void 0, void 0, function* () {
    const output = [];
    const { features } = US_Counties_json_1.default;
    for (let i = 0, len = features.length; i < len; i++) {
        const county = features[i];
        const { attributes, geometry } = county;
        const requestUrl = `${USCountiesCovid19CasesByTimeFeatureServiceURL}/query/?f=json&where=FIPS=${attributes.FIPS}&outFields=dt,Confirmed,Deaths,NewCases`;
        const queryResCovid19Data = yield axios_1.default.get(requestUrl);
        if (queryResCovid19Data.data && queryResCovid19Data.data.features) {
            const results = queryResCovid19Data.data.features;
            const { confirmed, deaths, newCases } = calcMovingAve(results);
            output.push({
                attributes,
                confirmed,
                deaths,
                newCases,
                geometry
            });
        }
    }
    return output;
});
const startUp = () => __awaiter(void 0, void 0, void 0, function* () {
    makeFolder(PUBLIC_FOLDER_PATH);
    const data = yield fetchCovid19Data4USCounties();
    writeToJson(data, OUTPUT_JSON);
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
