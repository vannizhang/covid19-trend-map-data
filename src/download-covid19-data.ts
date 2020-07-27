const fs = require('fs');
const path = require('path');

import axios from 'axios';
import { URLSearchParams } from 'url';

import USCounties from './US-Counties.json';
import USStates from './US-States.json';

const PUBLIC_FOLDER_PATH = path.join(__dirname, '../public');

const OUTPUT_JSON_US_COUNTIES = path.join(PUBLIC_FOLDER_PATH, 'us-counties.json');
const OUTPUT_JSON_US_COUNTIES_PATHS = path.join(PUBLIC_FOLDER_PATH, 'us-counties-paths.json');

const OUTPUT_JSON_US_STATES = path.join(PUBLIC_FOLDER_PATH, 'us-states.json');
const OUTPUT_JSON_US_STATES_PATHS = path.join(PUBLIC_FOLDER_PATH, 'us-states-paths.json');

const USCountiesCovid19CasesByTimeFeatureServiceURL = 'https://services9.arcgis.com/6Hv9AANartyT7fJW/ArcGIS/rest/services/USCounties_cases_V1/FeatureServer/1';

type FeatureFromJSON = {
    attributes?: any;
    geometry: {
        x: number;
        y: number;
    };
}

type Covid19CasesByTimeQueryResultFeature = {
    attributes: {
        dt: string;
        Confirmed: number;
        Deaths: number;
        NewCases: number;
    }
}

type PathData = {
    path: number[][];
    frame: {
        xmin: number;
        ymin: number;
        xmax: number;
        ymax: number;
    };
}

type Covid19TrendData = FeatureFromJSON & {
    confirmed: number[],
    deaths: number[],
    newCases: number[]
} 

type Covid19TrendDataAsPaths = FeatureFromJSON & {
    confirmed: PathData;
    deaths: PathData;
    newCases: PathData;
} 

type CalcMovingAveOptions = {
    features:Covid19CasesByTimeQueryResultFeature[];
    totalPopulation?: number;
    numOfDays?: number;
};

type Calc7DaysAveResponse = {
    confirmed: number[],
    deaths: number[],
    newCases: number[],
    // confirmedPer100k?: number[],
    // deathsPer100k?: number[],
    // newCasesPer100k?: number[]
}

const calcMovingAve = ({
    features, 
    totalPopulation,
    numOfDays = 7
}:CalcMovingAveOptions):Calc7DaysAveResponse=>{

    const movingAveValues: number[][] = [];

    // calculate the 7 day moving ave (confirmed, death and new cases per 100k) for each feature,
    // and save the values into movingAveValues
    for(let i = features.length - 1; i > 0; i--){

        let sumConfirmed = 0;
        let sumDeaths = 0;
        let sumNewCases = 0;

        const startIndex = i - 6 >= 0 ? i - 6 : 0;
        const endIndex = i + 1;

        const featuresInPastWeek = features
            .slice(startIndex, endIndex);

        featuresInPastWeek.forEach(d=>{

            const { Confirmed, Deaths, NewCases } = d.attributes

            sumConfirmed += Confirmed;
            sumDeaths += Deaths;
            sumNewCases += NewCases;
        });

        const movingAvgConfirmedPer100k = Math.round(( (sumConfirmed / numOfDays ) / totalPopulation ) * 100000 );
        const movingAvgDeathsPer100k = Math.round((sumDeaths / numOfDays/ totalPopulation ) * 100000);
        const movingAvgNewCasesPer100k = Math.round((sumNewCases / numOfDays/ totalPopulation ) * 100000);

        movingAveValues.unshift([
            movingAvgConfirmedPer100k,
            movingAvgDeathsPer100k,
            movingAvgNewCasesPer100k
        ])
    }

    let weeklyAveConfirmed: number[] = [];
    let weeklyAveDeaths: number[] = [];
    let weeklyAveNewCases: number[] = [];

    let indexOfLastItemInGroup = movingAveValues.length - 1;

    for(let i = indexOfLastItemInGroup; i >= 0; i --){

        const startIndex = indexOfLastItemInGroup - (numOfDays - 1);

        if(i === indexOfLastItemInGroup && startIndex >= 0 ){

            const movingAveValuesForSelectedGroup = movingAveValues.slice(startIndex, indexOfLastItemInGroup);

            let confirmedSum = 0;
            let deathSum = 0;
            let newCasesSum = 0;

            movingAveValuesForSelectedGroup.forEach(item=>{
                const [
                    Confirmed,
                    Deaths,
                    NewCases
                ] = item;

                confirmedSum += Confirmed >= 0 ? Confirmed : 0;
                deathSum += Deaths >= 0 ? Deaths : 0;
                newCasesSum += NewCases >= 0 ? NewCases : 0;
            })
    
            weeklyAveConfirmed.unshift( Math.round(confirmedSum/numOfDays) );
            weeklyAveDeaths.unshift( Math.round(deathSum/numOfDays) );
            weeklyAveNewCases.unshift( Math.round(newCasesSum/numOfDays) );

            indexOfLastItemInGroup = startIndex - 1;
        }

    }

    return {
        confirmed: weeklyAveConfirmed,
        deaths: weeklyAveDeaths,
        newCases: weeklyAveNewCases
    }
}

const fetchCovid19CasesByTimeData = async({
    where,
    returnStateLevelData = false
}:{
    where: string;
    returnStateLevelData?: boolean
}):Promise<Covid19CasesByTimeQueryResultFeature[]>=>{

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
            outFields: ['dt','Confirmed','Deaths','NewCases','Population'],
            orderByFields: 'dt'
        }

    const requestUrl = `${USCountiesCovid19CasesByTimeFeatureServiceURL}/query/`;

    const { data } = await axios.get(requestUrl, {
        params: new URLSearchParams(params)
    });

    return data && data.features 
        ? data.features 
        : [];
};

const fetchCovid19Data4USStates = async():Promise<Covid19TrendData[]>=>{

    const output = [];

    const { features } = USStates;

    for(let i = 0, len = features.length; i < len; i++){

        const feature = features[i];

        const { attributes, geometry } = feature;

        const results = await fetchCovid19CasesByTimeData({
            where: `ST_Name = '${attributes.STATE_NAME}'`,
            returnStateLevelData: true
        });

        const {
            confirmed,
            deaths,
            newCases,
        } = calcMovingAve({
            features: results,
            totalPopulation: attributes.POPULATION
        });
        // console.log(confirmed, deaths, newCases)

        output.push({
            attributes,
            confirmed,
            deaths,
            newCases,
            geometry
        })

    }

    return output;

}

const fetchCovid19Data4USCounties = async():Promise<Covid19TrendData[]>=>{

    const output = [];

    const { features } = USCounties;

    for(let i = 0, len = features.length; i < len; i++){

        const county = features[i];

        const { attributes, geometry } = county;

        const results = await fetchCovid19CasesByTimeData({
            where: `FIPS = '${attributes.FIPS}'`
        });

        const {
            confirmed,
            deaths,
            newCases,
        } = calcMovingAve({
            features: results,
            totalPopulation: attributes.POPULATION
        });

        output.push({
            attributes,
            geometry,
            confirmed,
            deaths,
            newCases
        })
    }

    return output;

};

const calculatePath = (values: number[], ymax?:number): PathData=>{

    const path = values.map((val, idx)=>[ idx, val ]);

    const xmin = 0;
    const ymin = 0;
    const xmax = values.length;
    ymax = ymax || values.reduce((prev, curr) => Math.max(prev, curr), Number.NEGATIVE_INFINITY);

    const AspectRatio = .75;

    if ( ymax < xmax ){
        // console.log('use xmax as ymax', ymax, xmax);	
        ymax = xmax;

        path.forEach((p) => {
            p[1] = Math.round(p[1] * AspectRatio);
        });

    } else {	            

        const ratio = Math.floor(( xmax / ymax ) * 100000) / 100000;
        // console.log('ratio', ratio)
    
        path.forEach((p) => {
            p[1] = Math.round(p[1] * ratio * AspectRatio);
        });
        
        ymax = xmax //Math.ceil(ymax * ratio);
    } 

    return {
        path,
        frame: {
            xmin,
            ymin,
            xmax,
            ymax
        }
    }
    
}

// convert to path so it can be rendered using CIMSymbol in ArcGIS JS API
const convertCovid19TrendDataToPath = (data : Covid19TrendData[]): Covid19TrendDataAsPaths[]=>{

    const covid19TrendDataAsPaths = data.map(d=>{
        const {
            attributes,
            geometry,
            confirmed,
            deaths,
            newCases
        } = d;

        const pathConfirmed = calculatePath(confirmed);
        const pathDeaths = calculatePath(deaths);
        const pathNewCases = calculatePath(newCases);

        return {
            // attributes,
            geometry,
            confirmed: pathConfirmed,
            deaths: pathDeaths,
            newCases: pathNewCases
        }
    });

    return covid19TrendDataAsPaths;

}

const startUp = async()=>{

    makeFolder(PUBLIC_FOLDER_PATH);
    
    try {
        const dataUSCounties = await fetchCovid19Data4USCounties();
        writeToJson(dataUSCounties, OUTPUT_JSON_US_COUNTIES);
        // console.log(JSON.stringify(data));
        
        const dataUSCountiesPaths = convertCovid19TrendDataToPath(dataUSCounties);
        writeToJson(dataUSCountiesPaths, OUTPUT_JSON_US_COUNTIES_PATHS);


        const dataUSStates = await fetchCovid19Data4USStates();
        writeToJson(dataUSStates, OUTPUT_JSON_US_STATES);
        // console.log(JSON.stringify(dataUSStates));

        const dataUSStatesPaths = convertCovid19TrendDataToPath(dataUSStates);
        writeToJson(dataUSStatesPaths, OUTPUT_JSON_US_STATES_PATHS);
        
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