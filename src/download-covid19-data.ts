const fs = require('fs');
const path = require('path');
const qs = require('qs');
const axios = require('axios');

import * as USCounties from './US-Counties.json';
import * as USStates from './US-States.json';

const PUBLIC_FOLDER_PATH = path.join(__dirname, '../public');

const OUTPUT_JSON_US_COUNTIES = path.join(PUBLIC_FOLDER_PATH, 'us-counties.json');
const OUTPUT_JSON_US_COUNTIES_PATHS = path.join(PUBLIC_FOLDER_PATH, 'us-counties-paths.json');

const OUTPUT_JSON_US_STATES = path.join(PUBLIC_FOLDER_PATH, 'us-states.json');
const OUTPUT_JSON_US_STATES_PATHS = path.join(PUBLIC_FOLDER_PATH, 'us-states-paths.json');

const OUTPUT_JSON_LATEST_NUMBERS = path.join(PUBLIC_FOLDER_PATH, 'latest-numbers.json');

const USCountiesCovid19CasesByTimeFeatureServiceURL = 'https://services9.arcgis.com/6Hv9AANartyT7fJW/ArcGIS/rest/services/USCounties_cases_V1/FeatureServer/1';
const USCountiesCOVID19TrendCategoryServiceURL = 'https://services1.arcgis.com/4yjifSiIG17X0gW4/ArcGIS/rest/services/US_County_COVID19_Trends/FeatureServer/0';

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
        Population: number;
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

type CalcWeeklyAveOptions = {
    features:Covid19CasesByTimeQueryResultFeature[];
    totalPopulation?: number;
    numOfDays?: number;
};

type CalcWeeklyAveResponse = {
    confirmed: number[],
    deaths: number[],
    newCases: number[],
    // confirmedPer100k?: number[],
    // deathsPer100k?: number[],
    // newCasesPer100k?: number[]
};

type COVID19TrendType = 'Emergent' | 'Spreading' | 'Epidemic' | 'Controlled' | 'End Stage' | 'Zero Cases';

type USCountiesCOVID19TrendCategoryFeature = {
    attributes: {
        Cty_FIPS: string;
        Cty_NAME: string;
        ST_ABBREV: string;
        TrendType: COVID19TrendType;
    }
};

type COVID19LatestNumbersItem = {
    Confirmed: number;
    Deaths: number;
    NewCases: number;
    Population: number;
    TrendType: COVID19TrendType | '';
};

type USStatesAndCountiesDataJSON = typeof USStates | typeof USCounties;

const USCountiesCOVID19TrendCategoryLookup: {
    [key:string]: COVID19TrendType
} = {};

// this table will be used by the app to populate tooltip
const COVID19LatestNumbers: {
    [key: string]: COVID19LatestNumbersItem
} = {};

const calcWeeklyAve = ({
    features, 
    totalPopulation,
    numOfDays = 7
}:CalcWeeklyAveOptions):CalcWeeklyAveResponse=>{

    let weeklyAveConfirmed: number[] = [];
    let weeklyAveDeaths: number[] = [];
    let weeklyAveNewCases: number[] = [];

    let indexOfLastItemInGroup = features.length - 1;

    for(let i = indexOfLastItemInGroup; i >= 0; i --){

        const startIndex = indexOfLastItemInGroup - (numOfDays - 1);

        if(i === indexOfLastItemInGroup && startIndex >= 0 ){

            const itemsForSelectedGroup = features.slice(startIndex, indexOfLastItemInGroup);

            let confirmedSum = 0;
            let deathSum = 0;
            let newCasesSum = 0;

            itemsForSelectedGroup.forEach(item=>{
                const {
                    Confirmed,
                    Deaths,
                    NewCases
                } = item.attributes;

                confirmedSum += Confirmed >= 0 ? Confirmed : 0;
                deathSum += Deaths >= 0 ? Deaths : 0;
                newCasesSum += NewCases >= 0 ? NewCases : 0;
            });

            const aveConfirmedPer100k = Math.round(((confirmedSum / numOfDays ) / totalPopulation ) * 100000 );
            const aveDeathPer100k = Math.round(((deathSum / numOfDays ) / totalPopulation ) * 100000 );
            const aveNewCasesPer100k = Math.round(((newCasesSum / numOfDays ) / totalPopulation ) * 100000 );
    
            weeklyAveConfirmed.unshift(aveConfirmedPer100k);
            weeklyAveDeaths.unshift(aveDeathPer100k);
            weeklyAveNewCases.unshift(aveNewCasesPer100k);

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
            outFields: "dt,Confirmed,Deaths,NewCases,Population",
            orderByFields: 'dt'
        }

    const requestUrl = `${USCountiesCovid19CasesByTimeFeatureServiceURL}/query/?${qs.stringify(params)}`;
    const res = await axios.get(requestUrl);
    // console.log(requestUrl);

    return res.data && res.data.features 
        ? res.data.features 
        : [];
};

const fetchCovid19TrendData = async(data:USStatesAndCountiesDataJSON):Promise<Covid19TrendData[]>=>{
    
    const output = [];

    const { features } = data;

    for(let i = 0, len = features.length; i < len; i++){

        const feature = features[i];

        const { attributes, geometry } = feature;

        let results:Covid19CasesByTimeQueryResultFeature[] = [];
        let FIPS:string = '';

        if("FIPS" in attributes){
            FIPS = attributes.FIPS;
            results = await fetchCovid19CasesByTimeData({
                where: `FIPS = '${attributes.FIPS}'`
            });
        }

        if("STATE_NAME" in attributes){
            FIPS = attributes.STATE_FIPS;
            results = await fetchCovid19CasesByTimeData({
                where: `ST_Name = '${attributes.STATE_NAME}'`,
                returnStateLevelData: true
            });
        }

        if(results.length){

            const totalPopulation = results[0]?.attributes?.Population || attributes.POPULATION;

            attributes.POPULATION = totalPopulation;

            const {
                confirmed,
                deaths,
                newCases,
            } = calcWeeklyAve({
                features: results,
                totalPopulation
            });
            // console.log(confirmed, deaths, newCases)

            saveToCOVID19LatestNumbers(FIPS, results);

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

const saveToCOVID19LatestNumbers = (FIPS:string, features: Covid19CasesByTimeQueryResultFeature[])=>{

    const indexOfLatestFeature = features.length - 1;

    const latestFeature = features[indexOfLatestFeature];

    const { attributes } = latestFeature;

    const { dt, Confirmed, Deaths, Population, NewCases } = attributes;

    const [year, month, day] = dt.split('-');
    const date = new Date(+year, +month - 1, +day);

    const dayOfWeek = date.getDay();

    const featureOfLastSunday = dayOfWeek === 0 
        ? features[ indexOfLatestFeature - 6 ]
        : features[ indexOfLatestFeature - dayOfWeek ];

    const weeklyNewCases =  latestFeature.attributes.Confirmed - featureOfLastSunday.attributes.Confirmed;

    COVID19LatestNumbers[FIPS] = {
        Confirmed,
        Deaths,
        Population,
        // new cases of this week
        NewCases: weeklyNewCases,
        TrendType: USCountiesCOVID19TrendCategoryLookup[FIPS] || ''
    }
};

const calculatePath = (values: number[], ymax:number): PathData=>{

    const xmax = ymax * 0.4;
    const xRatio = xmax / values.length;

    const path = values.map((val, index)=>{

        const x = Math.round(xRatio * index);
        const y = val <= ymax ? val : ymax;

        return [x, y];
    });

    // const path = values.map((val, idx)=>[ idx, val ]);

    // const xmin = 0;
    // const ymin = 0;
    // const xmax = values.length;

    // ymax = ymax || values.reduce((prev, curr) => Math.max(prev, curr), Number.NEGATIVE_INFINITY);
    // const AspectRatio = .75;

    // if ( ymax <= 25 ){
    //     // console.log('use xmax as ymax', ymax, xmax);	
    //     ymax = 25;
    // } 

    // const ratio = Math.floor(( xmax / ymax ) * 100000) / 100000;
    // // console.log('ratio', ratio)

    // path.forEach((p) => {
    //     p[1] = Math.round(p[1] * ratio * AspectRatio);
    // });
    
    // ymax = xmax //Math.ceil(ymax * ratio);

    return {
        path,
        frame: {
            xmin: 0,
            ymin: 0,
            xmax,
            ymax
        }
    }
    
}

// convert to path so it can be rendered using CIMSymbol in ArcGIS JS API
const convertCovid19TrendDataToPath = (data : Covid19TrendData[], includeAttributes?:boolean): Covid19TrendDataAsPaths[]=>{

    const covid19TrendDataAsPaths = data
        .map(d=>{
            const {
                attributes,
                geometry,
                confirmed,
                deaths,
                newCases
            } = d;

            const pathConfirmed = calculatePath(confirmed, 4000);
            const pathDeaths = calculatePath(deaths, 200);
            const pathNewCases = calculatePath(newCases, 200);

            const outputData = {
                // attributes,
                geometry,
                confirmed: pathConfirmed,
                deaths: pathDeaths,
                newCases: pathNewCases
            } as Covid19TrendDataAsPaths;

            if(includeAttributes){
                outputData.attributes = attributes
            }

            return outputData;
        })
        .filter(d=>{
            const isBadPath = d.confirmed.path.length === 0 || d.deaths.path.length === 0 || d.newCases.path.length === 0;

            if(isBadPath){
                console.log(`found item with bad path: ${JSON.stringify(d)}`)
            }

            return !isBadPath;
        })

    return covid19TrendDataAsPaths;

}

// query trend category from  https://www.arcgis.com/home/item.html?id=49c25e0ce50340e08fcfe51fe6f26d1e#data
const fetchUSCountiesCOVID19TrendCategory = async()=>{

    const params = {
        f: 'json',
        where: '1=1',
        outFields: "Cty_FIPS, Cty_NAME,ST_ABBREV,TrendType",
        orderByFields: 'Cty_FIPS',
        returnGeometry: false
    };

    const params4feature = {
        ...params,
        resultOffset: 2000
    };

    const res4FeaturesSets1 = await axios.get(`${USCountiesCOVID19TrendCategoryServiceURL}/query?${qs.stringify(params)}`);
    // console.log(res4FeaturesSets1.data);

    const res4FeaturesSets2 = await axios.get(`${USCountiesCOVID19TrendCategoryServiceURL}/query?${qs.stringify(params4feature)}`);
    // console.log(res4FeaturesSets2.data);

    const features:USCountiesCOVID19TrendCategoryFeature[] = [
        ...res4FeaturesSets1.data.features,
        ...res4FeaturesSets2.data.features
    ];

    features.forEach(feature=>{
        const { attributes } = feature;
        const { Cty_FIPS, TrendType } = attributes;

        USCountiesCOVID19TrendCategoryLookup[Cty_FIPS] = TrendType;
    });

    return USCountiesCOVID19TrendCategoryLookup;
}

const getCovid19Data4USCountiesWithTrendType = (features: Covid19TrendData[])=>{

    return features.map(d=>{
        const { FIPS } = d.attributes;
        const trendType = USCountiesCOVID19TrendCategoryLookup[FIPS];

        d.attributes = { 
            trendType
        };

        return d;
    })
}

const startUp = async()=>{

    makeFolder(PUBLIC_FOLDER_PATH);

    const startTime = new Date().getTime()
    
    try {
        await fetchUSCountiesCOVID19TrendCategory();
        // console.log(USCountiesCOVID19TrendCategoryLookup)

        // handle Counties
        const dataUSCounties = await fetchCovid19TrendData(USCounties);
        writeToJson(dataUSCounties, OUTPUT_JSON_US_COUNTIES);
        // console.log(JSON.stringify(data));

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
        writeToJson(COVID19LatestNumbers, OUTPUT_JSON_LATEST_NUMBERS);

        const endTime = new Date();
        const processTimeInMinutes = ((endTime.getTime() - startTime) / 1000 / 60 );
        console.log(new Date(), `Processed data for ${dataUSCounties.length} Counties; processing time: ${processTimeInMinutes.toFixed(1)} min`, '\n');
        
    } catch(err){
        console.log(JSON.stringify(err))
    }

};

const writeToJson = (data, outputPath)=>{
    const json = JSON.stringify(data);
    // const outputFileName = 'data.json';
    fs.writeFile(outputPath, json, 'utf8', ()=>{
        // console.log(new Date(), `${outputPath} is saved`, '\n');
    });
};

const makeFolder = (dir)=>{
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
};

startUp();