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
const qs = require('qs');
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
    const movingAveValues = [];
    for (let i = features.length - 1; i > 0; i--) {
        let sumConfirmed = 0;
        let sumDeaths = 0;
        let sumNewCases = 0;
        const startIndex = i - 6 >= 0 ? i - 6 : 0;
        const endIndex = i + 1;
        const featuresInPastWeek = features
            .slice(startIndex, endIndex);
        featuresInPastWeek.forEach(d => {
            const { Confirmed, Deaths, NewCases } = d.attributes;
            sumConfirmed += Confirmed;
            sumDeaths += Deaths;
            sumNewCases += NewCases;
        });
        const movingAvgConfirmedPer100k = Math.round(((sumConfirmed / numOfDays) / totalPopulation) * 100000);
        const movingAvgDeathsPer100k = Math.round((sumDeaths / numOfDays / totalPopulation) * 100000);
        const movingAvgNewCasesPer100k = Math.round((sumNewCases / numOfDays / totalPopulation) * 100000);
        movingAveValues.unshift([
            movingAvgConfirmedPer100k,
            movingAvgDeathsPer100k,
            movingAvgNewCasesPer100k
        ]);
    }
    let weeklyAveConfirmed = [];
    let weeklyAveDeaths = [];
    let weeklyAveNewCases = [];
    let indexOfLastItemInGroup = movingAveValues.length - 1;
    for (let i = indexOfLastItemInGroup; i >= 0; i--) {
        const startIndex = indexOfLastItemInGroup - (numOfDays - 1);
        if (i === indexOfLastItemInGroup && startIndex >= 0) {
            const movingAveValuesForSelectedGroup = movingAveValues.slice(startIndex, indexOfLastItemInGroup);
            let confirmedSum = 0;
            let deathSum = 0;
            let newCasesSum = 0;
            movingAveValuesForSelectedGroup.forEach(item => {
                const [Confirmed, Deaths, NewCases] = item;
                confirmedSum += Confirmed >= 0 ? Confirmed : 0;
                deathSum += Deaths >= 0 ? Deaths : 0;
                newCasesSum += NewCases >= 0 ? NewCases : 0;
            });
            weeklyAveConfirmed.unshift(Math.round(confirmedSum / numOfDays));
            weeklyAveDeaths.unshift(Math.round(deathSum / numOfDays));
            weeklyAveNewCases.unshift(Math.round(newCasesSum / numOfDays));
            indexOfLastItemInGroup = startIndex - 1;
        }
    }
    return {
        confirmed: weeklyAveConfirmed,
        deaths: weeklyAveDeaths,
        newCases: weeklyAveNewCases
    };
};
const fetchCovid19CasesByTimeData = ({ where, returnStateLevelData = false }) => __awaiter(void 0, void 0, void 0, function* () {
    const params = returnStateLevelData
        ? {
            f: 'json',
            where,
            outFields: '*',
            orderByFields: 'dt',
            groupByFieldsForStatistics: 'ST_Name,dt',
            outStatistics: JSON.stringify([
                {
                    "statisticType": "sum",
                    "onStatisticField": "Confirmed",
                    "outStatisticFieldName": "Confirmed"
                },
                {
                    "statisticType": "sum",
                    "onStatisticField": "Deaths",
                    "outStatisticFieldName": "Deaths"
                },
                {
                    "statisticType": "sum",
                    "onStatisticField": "NewCases",
                    "outStatisticFieldName": "NewCases"
                },
                {
                    "statisticType": "sum",
                    "onStatisticField": "Population",
                    "outStatisticFieldName": "Population"
                }
            ])
        }
        : {
            f: 'json',
            where,
            outFields: "dt,Confirmed,Deaths,NewCases,Population",
            orderByFields: 'dt'
        };
    const requestUrl = `${USCountiesCovid19CasesByTimeFeatureServiceURL}/query/?${qs.stringify(params)}`;
    const res = yield axios_1.default.get(requestUrl);
    return res.data && res.data.features
        ? res.data.features
        : [];
});
const fetchCovid19Data4USStates = () => __awaiter(void 0, void 0, void 0, function* () {
    const output = [];
    const { features } = US_States_json_1.default;
    for (let i = 0, len = features.length; i < len; i++) {
        const feature = features[i];
        const { attributes, geometry } = feature;
        const results = yield fetchCovid19CasesByTimeData({
            where: `ST_Name = '${attributes.STATE_NAME}'`,
            returnStateLevelData: true
        });
        const { confirmed, deaths, newCases, } = calcMovingAve({
            features: results,
            totalPopulation: attributes.POPULATION
        });
        output.push({
            attributes,
            confirmed,
            deaths,
            newCases,
            geometry
        });
    }
    return output;
});
const fetchCovid19Data4USCounties = () => __awaiter(void 0, void 0, void 0, function* () {
    const output = [];
    const { features } = US_Counties_json_1.default;
    for (let i = 0, len = features.length; i < len; i++) {
        const county = features[i];
        const { attributes, geometry } = county;
        const results = yield fetchCovid19CasesByTimeData({
            where: `FIPS = '${attributes.FIPS}'`
        });
        const { confirmed, deaths, newCases, } = calcMovingAve({
            features: results,
            totalPopulation: attributes.POPULATION
        });
        output.push({
            attributes,
            geometry,
            confirmed,
            deaths,
            newCases
        });
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
        ymax = 25;
    }
    const ratio = Math.floor((xmax / ymax) * 100000) / 100000;
    path.forEach((p) => {
        p[1] = Math.round(p[1] * ratio * AspectRatio);
    });
    ymax = xmax;
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
    const startTime = new Date().getTime();
    try {
        const dataUSCounties = yield fetchCovid19Data4USCounties();
        writeToJson(dataUSCounties, OUTPUT_JSON_US_COUNTIES);
        const dataUSCountiesPaths = convertCovid19TrendDataToPath(dataUSCounties);
        writeToJson(dataUSCountiesPaths, OUTPUT_JSON_US_COUNTIES_PATHS);
        const dataUSStates = yield fetchCovid19Data4USStates();
        writeToJson(dataUSStates, OUTPUT_JSON_US_STATES);
        const dataUSStatesPaths = convertCovid19TrendDataToPath(dataUSStates);
        writeToJson(dataUSStatesPaths, OUTPUT_JSON_US_STATES_PATHS);
        const endTime = new Date();
        const processTimeInMinutes = ((endTime.getTime() - startTime) / 1000 / 60);
        console.log(new Date(), `Processed data for ${dataUSCounties.length} Counties; processing time: ${processTimeInMinutes.toFixed(1)} min`, '\n');
    }
    catch (err) {
        console.log(JSON.stringify(err));
    }
});
const writeToJson = (data, outputPath) => {
    const json = JSON.stringify(data);
    fs.writeFile(outputPath, json, 'utf8', () => {
    });
};
const makeFolder = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
};
startUp();
