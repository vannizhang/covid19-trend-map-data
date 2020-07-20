const fs = require('fs');
const path = require('path');

import axios from 'axios';
import USCounties from './US-Counties.json';
import USStates from './US-States.json';

const PUBLIC_FOLDER_PATH = path.join(__dirname, '../public');
const OUTPUT_JSON_US_COUNTIES = path.join(PUBLIC_FOLDER_PATH, 'us-counties.json');
const OUTPUT_JSON_US_STATES = path.join(PUBLIC_FOLDER_PATH, 'us-states.json');

const USCountiesCovid19CasesByTimeFeatureServiceURL = 'https://services9.arcgis.com/6Hv9AANartyT7fJW/ArcGIS/rest/services/USCounties_cases_V1/FeatureServer/1';

type Covid19CasesByTimeQueryResultFeature = {
    attributes: {
        dt: string;
        Confirmed: number;
        Deaths: number;
        NewCases: number;
    }
}

type Calc7DaysAveResponse = {
    confirmed: number[],
    deaths: number[],
    newCases: number[]
}

type USCountiesDataItem = {
    attributes: {
        NAME: string;
        STATE: string;
        FIPS: string;
    }
    geometry: {
        x: number;
        y: number;
    };
}

type USStatesDataItem = {
    attributes: {
        STATE_NAME: string;
        STATE_FIPS: string;
        STATE_ABBR: string;
        POPULATION: number;
    }
    geometry: {
        x: number;
        y: number;
    };
}

type AggregatedValues = {
    confirmed: number[],
    deaths: number[],
    newCases: number[]
} 

type Covid19Data4USCounty = USCountiesDataItem & AggregatedValues;

type Covid19Data4USState = USStatesDataItem & AggregatedValues; 

const calcMovingAve = (features:Covid19CasesByTimeQueryResultFeature[], numOfDays = 7):Calc7DaysAveResponse=>{

    const confirmedMovingAve: number[] = [];
    const deathsMovingAve: number[] = [];
    const newCasesMovingAve: number[] = [];

    let indexOfLastItemInGroup = features.length - 1;

    for(let i = indexOfLastItemInGroup; i >= 0; i --){

        if(i === indexOfLastItemInGroup){

            const startIndex = indexOfLastItemInGroup - (numOfDays - 1) >= 0 
                ? indexOfLastItemInGroup - (numOfDays - 1) 
                : 0;

            const featuresInGroup = features.slice(startIndex, indexOfLastItemInGroup);

            let confirmedSum = 0;
            let deathSum = 0;
            let newCasesSum = 0;

            featuresInGroup.forEach(f=>{
                const {
                    Confirmed,
                    Deaths,
                    NewCases
                } = f.attributes;

                confirmedSum += Confirmed;
                deathSum += Deaths;
                newCasesSum += NewCases;
            })
    
            confirmedMovingAve.unshift( Math.round(confirmedSum/numOfDays) );
            deathsMovingAve.unshift( Math.round(deathSum/numOfDays) );
            newCasesMovingAve.unshift( Math.round(newCasesSum/numOfDays) );

            indexOfLastItemInGroup = startIndex - 1;
        }

    }

    return {
        confirmed: confirmedMovingAve,
        deaths: deathsMovingAve,
        newCases: newCasesMovingAve
    }
}

const fetchCovid19Data4USStates = async():Promise<Covid19Data4USState[]>=>{

    const output = [];

    const { features } = USStates;

    for(let i = 0, len = features.length; i < len; i++){

        const state = features[i];

        const { attributes, geometry } = state;

        const { STATE_NAME } = attributes;

        /*
            Order By Fields: dt

            Group By Fields (For Statistics): ST_Name, dt

            Output Statistics:
            [
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
                }  
            ]
        */

        const requestUrl = `${USCountiesCovid19CasesByTimeFeatureServiceURL}/query/?where=ST_Name+%3D+%27${STATE_NAME}%27&objectIds=&time=&resultType=none&outFields=*&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=dt&groupByFieldsForStatistics=ST_Name%2C+dt&outStatistics=%5B%0D%0A++%7B%0D%0A++++%22statisticType%22%3A+%22sum%22%2C%0D%0A++++%22onStatisticField%22%3A+%22Confirmed%22%2C+%0D%0A++++%22outStatisticFieldName%22%3A+%22Confirmed%22%0D%0A++%7D%2C%0D%0A++%7B%0D%0A++++%22statisticType%22%3A+%22sum%22%2C%0D%0A++++%22onStatisticField%22%3A+%22Deaths%22%2C+%0D%0A++++%22outStatisticFieldName%22%3A+%22Deaths%22%0D%0A++%7D%2C%0D%0A++%7B%0D%0A++++%22statisticType%22%3A+%22sum%22%2C%0D%0A++++%22onStatisticField%22%3A+%22NewCases%22%2C%0D%0A++++%22outStatisticFieldName%22%3A+%22NewCases%22%0D%0A++%7D++%0D%0A%5D&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=pjson&token=`;

        const queryResCovid19Data = await axios.get(requestUrl);

        if(queryResCovid19Data.data && queryResCovid19Data.data.features){

            const results: Covid19CasesByTimeQueryResultFeature[] = queryResCovid19Data.data.features;

            const {
                confirmed,
                deaths,
                newCases
            } = calcMovingAve(results);
            // console.log(confirmed, deaths, newCases)

            output.push({
                attributes,
                confirmed,
                deaths,
                newCases,
                geometry
            })
        }

    }

    return output;

}

const fetchCovid19Data4USCounties = async():Promise<Covid19Data4USCounty[]>=>{

    const output = [];

    const { features } = USCounties;

    // console.log(new Date(), `start fetching data`);

    for(let i = 0, len = features.length; i < len; i++){

        const county = features[i];

        const { attributes, geometry } = county;

        const requestUrl = `${USCountiesCovid19CasesByTimeFeatureServiceURL}/query/?f=json&where=FIPS=${attributes.FIPS}&outFields=dt,Confirmed,Deaths,NewCases`;

        const queryResCovid19Data = await axios.get(requestUrl);

        if(queryResCovid19Data.data && queryResCovid19Data.data.features){

            const results: Covid19CasesByTimeQueryResultFeature[] = queryResCovid19Data.data.features;

            const {
                confirmed,
                deaths,
                newCases
            } = calcMovingAve(results);
            // console.log(confirmed, deaths, newCases)

            output.push({
                attributes,
                confirmed,
                deaths,
                newCases,
                geometry
            })
        }
    }

    return output;

};

const startUp = async()=>{

    makeFolder(PUBLIC_FOLDER_PATH);
    
    try {
        const dataUSCounties = await fetchCovid19Data4USCounties();
        // console.log(JSON.stringify(data));
        writeToJson(dataUSCounties, OUTPUT_JSON_US_COUNTIES);

        const dataUSStates = await fetchCovid19Data4USStates();
        // console.log(JSON.stringify(data));
        writeToJson(dataUSStates, OUTPUT_JSON_US_STATES);
        
    } catch(err){
        console.log(JSON.stringify(err))
    }

};

const writeToJson = (data, outputPath)=>{
    const json = JSON.stringify(data);
    // const outputFileName = 'data.json';
    fs.writeFile(outputPath, json, 'utf8', ()=>{
        console.log(new Date(), `${outputPath} is saved`, '\n');
    });
};

const makeFolder = (dir)=>{
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
};

startUp();