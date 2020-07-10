const fs = require('fs');
const path = require('path');
import axios from 'axios';
import USCounties from './US-Counties.json';

const PUBLIC_FOLDER_PATH = path.join(__dirname, '../public');
const OUTPUT_JSON = path.join(PUBLIC_FOLDER_PATH, 'data.json');

const USCountiesCovid19CasesByTimeFeatureServiceURL = 'https://services9.arcgis.com/6Hv9AANartyT7fJW/ArcGIS/rest/services/USCounties_cases_V1/FeatureServer/1';

type USCountiesCovid19CasesTimeQueryResultFeature = {
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

interface USCountiesDataItem {
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

interface Covid19Data4USCounty extends USCountiesDataItem {
    confirmed: number[],
    deaths: number[],
    newCases: number[]
}

const calcMovingAve = (features:USCountiesCovid19CasesTimeQueryResultFeature[], numOfDays = 7):Calc7DaysAveResponse=>{

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

const fetchCovid19Data4USCounties = async():Promise<Covid19Data4USCounty[]>=>{

    const output = [];

    const { features } = USCounties;

    console.log(new Date(), `start fetching data`);

    for(let i = 0, len = features.length; i < len; i++){

        const county = features[i];

        const { attributes, geometry } = county;

        const requestUrl = `${USCountiesCovid19CasesByTimeFeatureServiceURL}/query/?f=json&where=FIPS=${attributes.FIPS}&outFields=dt,Confirmed,Deaths,NewCases`;

        const queryResCovid19Data = await axios.get(requestUrl);

        if(queryResCovid19Data.data && queryResCovid19Data.data.features){

            const results: USCountiesCovid19CasesTimeQueryResultFeature[] = queryResCovid19Data.data.features;

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
        const data = await fetchCovid19Data4USCounties();
        // console.log(JSON.stringify(data));
        writeToJson(data, OUTPUT_JSON);
    } catch(err){
        console.log(JSON.stringify(err))
    }

};

const writeToJson = (data, outputPath)=>{
    const json = JSON.stringify(data);
    // const outputFileName = 'data.json';
    fs.writeFile(outputPath, json, 'utf8', ()=>{
        console.log(new Date(), `data.json is updated and saved`, '\n');
    });
};

const makeFolder = (dir)=>{
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
};

startUp();