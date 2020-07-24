const fs = require('fs');
const path = require('path');

import axios from 'axios';
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

    let confirmedMovingAve: number[] = [];
    let deathsMovingAve: number[] = [];
    let newCasesMovingAve: number[] = [];

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

                confirmedSum += Confirmed >= 0 ? Confirmed : 0;
                deathSum += Deaths >= 0 ? Deaths : 0;
                newCasesSum += NewCases >= 0 ? NewCases : 0;
            })
    
            confirmedMovingAve.unshift( Math.round(confirmedSum/numOfDays) );
            deathsMovingAve.unshift( Math.round(deathSum/numOfDays) );
            newCasesMovingAve.unshift( Math.round(newCasesSum/numOfDays) );

            indexOfLastItemInGroup = startIndex - 1;
        }

    }

    // normalize the values to 100k per cases
    if(totalPopulation > 0){

        confirmedMovingAve = confirmedMovingAve.map(num=>{
            return Math.round(num/totalPopulation * 100000)
        });

        deathsMovingAve = deathsMovingAve.map(num=>{
            return Math.round(num/totalPopulation * 100000)
        });

        newCasesMovingAve = newCasesMovingAve.map(num=>{
            return Math.round(num/totalPopulation * 100000)
        });
    }

    return {
        confirmed: confirmedMovingAve,
        deaths: deathsMovingAve,
        newCases: newCasesMovingAve,
        // confirmedPer100k: confirmedMovingAvePer100K,
        // deathsPer100k: deathsMovingAvePer100K,
        // newCasesPer100k: newCasesMovingAvePer100K
    }
}

const fetchCovid19Data4USStates = async():Promise<Covid19TrendData[]>=>{

    const output = [];

    const { features } = USStates;

    for(let i = 0, len = features.length; i < len; i++){

        const feature = features[i];

        const { attributes, geometry } = feature;

        const { STATE_NAME, POPULATION } = attributes;

        /*
            e.g. https://services9.arcgis.com/6Hv9AANartyT7fJW/ArcGIS/rest/services/USCounties_cases_V1/FeatureServer/1/query?where=ST_Name+%3D+%27California%27&objectIds=&time=&resultType=none&outFields=*&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnDistinctValues=false&cacheHint=false&orderByFields=dt&groupByFieldsForStatistics=ST_Name%2C+dt&outStatistics=%5B%0D%0A++%7B%0D%0A++++%22statisticType%22%3A+%22sum%22%2C%0D%0A++++%22onStatisticField%22%3A+%22Confirmed%22%2C+%0D%0A++++%22outStatisticFieldName%22%3A+%22Confirmed%22%0D%0A++%7D%2C%0D%0A++%7B%0D%0A++++%22statisticType%22%3A+%22sum%22%2C%0D%0A++++%22onStatisticField%22%3A+%22Deaths%22%2C+%0D%0A++++%22outStatisticFieldName%22%3A+%22Deaths%22%0D%0A++%7D%2C%0D%0A++%7B%0D%0A++++%22statisticType%22%3A+%22sum%22%2C%0D%0A++++%22onStatisticField%22%3A+%22NewCases%22%2C%0D%0A++++%22outStatisticFieldName%22%3A+%22NewCases%22%0D%0A++%7D++%0D%0A%5D&having=&resultOffset=&resultRecordCount=&sqlFormat=none&f=html&token=

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
                newCases,
                // confirmedPer100k,
                // deathsPer100k,
                // newCasesPer100k
            } = calcMovingAve({
                features: results,
                totalPopulation: POPULATION
            });
            // console.log(confirmed, deaths, newCases)

            output.push({
                attributes,
                confirmed,
                deaths,
                newCases,
                // confirmedPer100k,
                // deathsPer100k,
                // newCasesPer100k,
                geometry
            })
        }

    }

    return output;

}

const fetchCovid19Data4USCounties = async():Promise<Covid19TrendData[]>=>{

    const output = [];

    const { features } = USCounties;

    // console.log(new Date(), `start fetching data`);

    for(let i = 0, len = features.length; i < len; i++){

        const county = features[i];

        const { attributes, geometry } = county;

        const { POPULATION } = attributes;

        const requestUrl = `${USCountiesCovid19CasesByTimeFeatureServiceURL}/query/?f=json&where=FIPS=${attributes.FIPS}&outFields=dt,Confirmed,Deaths,NewCases`;

        const queryResCovid19Data = await axios.get(requestUrl);

        if(queryResCovid19Data.data && queryResCovid19Data.data.features){

            const results: Covid19CasesByTimeQueryResultFeature[] = queryResCovid19Data.data.features;

            const {
                confirmed,
                deaths,
                newCases,
                // confirmedPer100k,
                // deathsPer100k,
                // newCasesPer100k
            } = calcMovingAve({
                features: results,
                totalPopulation: POPULATION
            });
            // console.log(confirmed, deaths, newCases)

            output.push({
                attributes,
                confirmed,
                deaths,
                newCases,
                // confirmedPer100k,
                // deathsPer100k,
                // newCasesPer100k,
                geometry
            })
        }
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
    // // max values from each state/county
    // const maxValues: {
    //     confirmed: number[],
    //     deaths: number[],
    //     newCases: number[],
    // } = {
    //     confirmed: [],
    //     deaths: [],
    //     newCases: []
    // };

    // data.forEach(d=>{
    //     const confirmed = d.confirmed.reduce((prev, curr) => Math.max(prev, curr));
    //     maxValues.confirmed.push(confirmed);

    //     const deaths = d.deaths.reduce((prev, curr) => Math.max(prev, curr));
    //     maxValues.deaths.push(deaths);

    //     const newCases = d.newCases.reduce((prev, curr) => Math.max(prev, curr));
    //     maxValues.newCases.push(newCases);
    // });

    // // final max values for the entire US, will be used as max y scale 
    // const maxConfirmed = maxValues.confirmed.reduce((prev, curr) => Math.max(prev, curr));
    // const maxDeaths = maxValues.deaths.reduce((prev, curr) => Math.max(prev, curr));
    // const maxNewCases = maxValues.newCases.reduce((prev, curr) => Math.max(prev, curr));

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
        // const dataUSCounties = await fetchCovid19Data4USCounties();
        // writeToJson(dataUSCounties, OUTPUT_JSON_US_COUNTIES);
        // // console.log(JSON.stringify(data));
        
        // const dataUSCountiesPaths = convertCovid19TrendDataToPath(dataUSCounties);
        // writeToJson(dataUSCountiesPaths, OUTPUT_JSON_US_COUNTIES_PATHS);


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