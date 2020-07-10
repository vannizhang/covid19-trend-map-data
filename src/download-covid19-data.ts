const fs = require('fs');
const path = require('path');
import axios from 'axios';

const OUTPUT_JSON = path.join(__dirname, '/public/data.json');

const fetchCovid19Data4USCounties = ()=>{

};

const startUp = async()=>{

    // const confirmedCases7DaysAve = await getConfirmedCases7DaysAve();
    // console.log(confirmedCases7DaysAve)

    // if(confirmedCases7DaysAve){
    //     writeToJson(confirmedCases7DaysAve, OUTPUT_JSON_CONFIRMED_CASES_7_DAY_AVG);
    // }
};

const writeToJson = (data, outputPath)=>{
    const json = JSON.stringify(data);
    // const outputFileName = 'data.json';
    fs.writeFile(outputPath, json, 'utf8', ()=>{
        console.log('data.json is updated and saved:', new Date(), '\n');
    });
};

const average = (values) => values.reduce((a, b) => a + b) / values.length;

startUp();