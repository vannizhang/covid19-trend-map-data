const fs = require('fs');
const path = require('path');
const qs = require('qs');
const axios = require('axios');

const PUBLIC_FOLDER_PATH = path.join(__dirname, '../public');
const OUTPUT_JSON_US_COUNTIES = path.join(PUBLIC_FOLDER_PATH, 'us-counties.json');
const OUTPUT_JSON_US_COUNTIES_PATHS = path.join(PUBLIC_FOLDER_PATH, 'us-counties-paths.json');
const OUTPUT_JSON_US_STATES = path.join(PUBLIC_FOLDER_PATH, 'us-states.json');
const OUTPUT_JSON_US_STATES_PATHS = path.join(PUBLIC_FOLDER_PATH, 'us-states-paths.json');
const OUTPUT_JSON_LATEST_NUMBERS = path.join(PUBLIC_FOLDER_PATH, 'latest-numbers.json');

export const IsDevMode = process.argv[3] === 'development';

import * as USCounties from './US-Counties.json';
import * as USStates from './US-States.json';

import fetchCovid19TrendData, {
    fixDataIssue4NYCCounties
} from './utils/fetchCovid19CasesByTimeData';

import fetchUSCountiesCOVID19TrendCategory, {
    getCovid19Data4USCountiesWithTrendType,
} from './utils/fetchUSCountiesCOVID19TrendCategory';

import convertCovid19TrendDataToPath, {
    ConvertCovid19TrendDataToPathResponse,
    calcYMax
} from './utils/convertCovid19TrendDataToPath';

import {
    getCOVID19LatestNumbers
} from './utils/covid19LatestNumbers';

import {
    USCountiesCovid19CasesByTimeFeatureServiceURL,
} from './const';

import {
    writeToJson,
    makeFolder
} from './utils/fileFns';

export type FeatureFromJSON = {
    attributes?: any;
    geometry: {
        x: number;
        y: number;
    };
}

export type Covid19TrendData = FeatureFromJSON & {
    confirmed: number[],
    // daily new deaths
    deaths: number[],
    // daily new cases
    newCases: number[]
} 

export type USStatesAndCountiesDataJSON = typeof USStates | typeof USCounties;

const shouldExecuteDownloadTask = ():Promise<boolean>=>{

    return new Promise(async(resolve, reject)=>{

        if(IsDevMode){
            resolve(true)
        }

        try {
            // get lastEditDate from JHU USCountiesCovid19CasesByTimeFeatureService
            const url4JHUFeatureServiceJSON = `${USCountiesCovid19CasesByTimeFeatureServiceURL}?f=json`;

            const res = await axios.get(url4JHUFeatureServiceJSON);
        
            const data: {
                editingInfo: {
                    lastEditDate: number
                } 
            } = res.data;
        
            const JHUFeatureServiceModified = data.editingInfo.lastEditDate;

            // read US_STATES_PATHS json file and get the modified property
            fs.readFile(OUTPUT_JSON_US_STATES_PATHS, 'utf8', (err, data)=>{

                if (err || !data) {
                    resolve(true);
                } else {
                    const USStatePaths:ConvertCovid19TrendDataToPathResponse = JSON.parse(data);
            
                    const USStatesPathsFileModified = USStatePaths && USStatePaths.modified ? +USStatePaths.modified : 0;
            
                    const hasModified = JHUFeatureServiceModified > USStatesPathsFileModified;
        
                    resolve(hasModified);
                }
            });

        } catch(err){
            resolve(true);
        }

    })
}

const getUSCountyFeatures = ()=>{

    const counties = {
        ...USCounties 
    };

    if(IsDevMode){
        counties.features = counties.features.filter(f=>{
            return f.attributes.STATE === 'California'
        })
    }

    return counties;
}

const startUp = async()=>{

    makeFolder(PUBLIC_FOLDER_PATH);

    // only execute download tasks if JHU data has modified since last execution
    const shouldExec = await shouldExecuteDownloadTask();

    if(shouldExec){

        const startTime = new Date().getTime();

        try {
            await fetchUSCountiesCOVID19TrendCategory();
            // console.log(USCountiesCOVID19TrendCategoryLookup)

            // handle Counties
            let dataUSCounties = await fetchCovid19TrendData(getUSCountyFeatures());
            // console.log('Counties with COVD19 Data', JSON.stringify(dataUSCounties));

            dataUSCounties = fixDataIssue4NYCCounties(dataUSCounties);
            // console.log('Counties with COVD19 Data and fixed NYC issue', JSON.stringify(dataUSCounties));

            writeToJson(dataUSCounties, OUTPUT_JSON_US_COUNTIES);
            // console.log(JSON.stringify(dataUSCounties));
    
            // calc YMax that will be used when calc trend path, the YMax should be 2 standard deviation of max confirmed and deaths from all counties
            calcYMax(dataUSCounties);

            const dataUSCountiesWithTrendType = getCovid19Data4USCountiesWithTrendType(dataUSCounties)
    
            const dataUSCountiesPaths = convertCovid19TrendDataToPath(dataUSCountiesWithTrendType, true);
            writeToJson(dataUSCountiesPaths, OUTPUT_JSON_US_COUNTIES_PATHS);
    
            // handle States
            const dataUSStates = await fetchCovid19TrendData(USStates);
            writeToJson(dataUSStates, OUTPUT_JSON_US_STATES);
            // console.log(JSON.stringify(dataUSStates));
    
            const dataUSStatesPaths = convertCovid19TrendDataToPath(dataUSStates);
            writeToJson(dataUSStatesPaths, OUTPUT_JSON_US_STATES_PATHS);
    
            // save latest numbers
            writeToJson(getCOVID19LatestNumbers(), OUTPUT_JSON_LATEST_NUMBERS);
    
            const endTime = new Date();
            const processTimeInMinutes = ((endTime.getTime() - startTime) / 1000 / 60 );
            console.log(new Date(), `Processed data for ${dataUSCounties.length} Counties; processing time: ${processTimeInMinutes.toFixed(1)} min`, '\n');
            
        } catch(err){
            console.log(JSON.stringify(err))
        }

    } 
    // else {
    //     console.log(new Date(), `no change in JHU data, skip execution\n`);
    // }
};

startUp();