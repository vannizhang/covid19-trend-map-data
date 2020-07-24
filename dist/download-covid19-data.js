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
const US_States_json_1 = __importDefault(require("./US-States.json"));
const PUBLIC_FOLDER_PATH = path.join(__dirname, '../public');
const OUTPUT_JSON_US_COUNTIES = path.join(PUBLIC_FOLDER_PATH, 'us-counties.json');
const OUTPUT_JSON_US_COUNTIES_PATHS = path.join(PUBLIC_FOLDER_PATH, 'us-counties-paths.json');
const OUTPUT_JSON_US_STATES = path.join(PUBLIC_FOLDER_PATH, 'us-states.json');
const OUTPUT_JSON_US_STATES_PATHS = path.join(PUBLIC_FOLDER_PATH, 'us-states-paths.json');
const USCountiesCovid19CasesByTimeFeatureServiceURL = 'https://services9.arcgis.com/6Hv9AANartyT7fJW/ArcGIS/rest/services/USCounties_cases_V1/FeatureServer/1';
const calcMovingAve = ({ features, totalPopulation, numOfDays = 7 }) => {
    let confirmedMovingAve = [];
    let deathsMovingAve = [];
    let newCasesMovingAve = [];
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
                confirmedSum += Confirmed >= 0 ? Confirmed : 0;
                deathSum += Deaths >= 0 ? Deaths : 0;
                newCasesSum += NewCases >= 0 ? NewCases : 0;
            });
            confirmedMovingAve.unshift(Math.round(confirmedSum / numOfDays));
            deathsMovingAve.unshift(Math.round(deathSum / numOfDays));
            newCasesMovingAve.unshift(Math.round(newCasesSum / numOfDays));
            indexOfLastItemInGroup = startIndex - 1;
        }
    }
    if (totalPopulation > 0) {
        confirmedMovingAve = confirmedMovingAve.map(num => {
            return Math.round(num / totalPopulation * 100000);
        });
        deathsMovingAve = deathsMovingAve.map(num => {
            return Math.round(num / totalPopulation * 100000);
        });
        newCasesMovingAve = newCasesMovingAve.map(num => {
            return Math.round(num / totalPopulation * 100000);
        });
    }
    return {
        confirmed: confirmedMovingAve,
        deaths: deathsMovingAve,
        newCases: newCasesMovingAve,
    };
};
const fetchCovid19Data4USStates = () => __awaiter(void 0, void 0, void 0, function* () {
    const output = [];
    const { features } = US_States_json_1.default;
    for (let i = 0, len = features.length; i < len; i++) {
        const feature = features[i];
        const { attributes, geometry } = feature;
        const { STATE_NAME, POPULATION } = attributes;
        const requestUrl = `${USCountiesCovid19CasesByTimeFeatureServiceURL}/query/?where=ST_Name+%3D+%27${STATE_NAME}%27&objectIds=&time=&resultType=none&outFields=*&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=dt&groupByFieldsForStatistics=ST_Name%2C+dt&outStatistics=%5B%0D%0A++%7B%0D%0A++++%22statisticType%22%3A+%22sum%22%2C%0D%0A++++%22onStatisticField%22%3A+%22Confirmed%22%2C+%0D%0A++++%22outStatisticFieldName%22%3A+%22Confirmed%22%0D%0A++%7D%2C%0D%0A++%7B%0D%0A++++%22statisticType%22%3A+%22sum%22%2C%0D%0A++++%22onStatisticField%22%3A+%22Deaths%22%2C+%0D%0A++++%22outStatisticFieldName%22%3A+%22Deaths%22%0D%0A++%7D%2C%0D%0A++%7B%0D%0A++++%22statisticType%22%3A+%22sum%22%2C%0D%0A++++%22onStatisticField%22%3A+%22NewCases%22%2C%0D%0A++++%22outStatisticFieldName%22%3A+%22NewCases%22%0D%0A++%7D++%0D%0A%5D&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=pjson&token=`;
        const queryResCovid19Data = yield axios_1.default.get(requestUrl);
        if (queryResCovid19Data.data && queryResCovid19Data.data.features) {
            const results = queryResCovid19Data.data.features;
            const { confirmed, deaths, newCases, } = calcMovingAve({
                features: results,
                totalPopulation: POPULATION
            });
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
const fetchCovid19Data4USCounties = () => __awaiter(void 0, void 0, void 0, function* () {
    const output = [];
    const { features } = US_Counties_json_1.default;
    for (let i = 0, len = features.length; i < len; i++) {
        const county = features[i];
        const { attributes, geometry } = county;
        const { POPULATION } = attributes;
        const requestUrl = `${USCountiesCovid19CasesByTimeFeatureServiceURL}/query/?f=json&where=FIPS=${attributes.FIPS}&outFields=dt,Confirmed,Deaths,NewCases`;
        const queryResCovid19Data = yield axios_1.default.get(requestUrl);
        if (queryResCovid19Data.data && queryResCovid19Data.data.features) {
            const results = queryResCovid19Data.data.features;
            const { confirmed, deaths, newCases, } = calcMovingAve({
                features: results,
                totalPopulation: POPULATION
            });
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
const calculatePath = (values, ymax) => {
    const path = values.map((val, idx) => [idx, val]);
    const xmin = 0;
    const ymin = 0;
    const xmax = values.length;
    ymax = ymax || values.reduce((prev, curr) => Math.max(prev, curr), Number.NEGATIVE_INFINITY);
    const AspectRatio = .75;
    if (ymax < xmax) {
        ymax = xmax;
        path.forEach((p) => {
            p[1] = Math.round(p[1] * AspectRatio);
        });
    }
    else {
        const ratio = Math.floor((xmax / ymax) * 100000) / 100000;
        path.forEach((p) => {
            p[1] = Math.round(p[1] * ratio * AspectRatio);
        });
        ymax = xmax;
    }
    return {
        path,
        frame: {
            xmin,
            ymin,
            xmax,
            ymax
        }
    };
};
const convertCovid19TrendDataToPath = (data) => {
    const covid19TrendDataAsPaths = data.map(d => {
        const { attributes, geometry, confirmed, deaths, newCases } = d;
        const pathConfirmed = calculatePath(confirmed);
        const pathDeaths = calculatePath(deaths);
        const pathNewCases = calculatePath(newCases);
        return {
            geometry,
            confirmed: pathConfirmed,
            deaths: pathDeaths,
            newCases: pathNewCases
        };
    });
    return covid19TrendDataAsPaths;
};
const startUp = () => __awaiter(void 0, void 0, void 0, function* () {
    makeFolder(PUBLIC_FOLDER_PATH);
    try {
        const dataUSStates = yield fetchCovid19Data4USStates();
        writeToJson(dataUSStates, OUTPUT_JSON_US_STATES);
        const dataUSStatesPaths = convertCovid19TrendDataToPath(dataUSStates);
        writeToJson(dataUSStatesPaths, OUTPUT_JSON_US_STATES_PATHS);
    }
    catch (err) {
        console.log(JSON.stringify(err));
    }
});
const writeToJson = (data, outputPath) => {
    const json = JSON.stringify(data);
    fs.writeFile(outputPath, json, 'utf8', () => {
        console.log(new Date(), `${outputPath} is saved`, '\n');
    });
};
const makeFolder = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
};
startUp();
