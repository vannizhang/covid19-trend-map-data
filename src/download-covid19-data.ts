const fs = require('fs');
const path = require('path');
import axios from 'axios';
import USCounties from './US-Counties.json';

const PUBLIC_FOLDER_PATH = path.join(__dirname, '../public');
const OUTPUT_JSON = path.join(PUBLIC_FOLDER_PATH, 'data.json');

const fetchCovid19Data4USCounties = ()=>{

};

const startUp = async()=>{

    makeFolder(PUBLIC_FOLDER_PATH);

    // const confirmedCases7DaysAve = await getConfirmedCases7DaysAve();
    // console.log(confirmedCases7DaysAve)

    // if(confirmedCases7DaysAve){
    //     writeToJson(confirmedCases7DaysAve, OUTPUT_JSON_CONFIRMED_CASES_7_DAY_AVG);
    // }

    writeToJson(USCounties, OUTPUT_JSON);
};

const writeToJson = (data, outputPath)=>{
    const json = JSON.stringify(data);
    // const outputFileName = 'data.json';
    fs.writeFile(outputPath, json, 'utf8', ()=>{
        console.log(new Date(), `data.json is updated and saved: ${outputPath}`, '\n');
    });
};

const makeFolder = (dir)=>{
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
};

const average = (values) => values.reduce((a, b) => a + b) / values.length;

startUp();