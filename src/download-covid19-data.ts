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

const USCountiesCovid19CasesByTimeFeatureServiceURL = 'https://services9.arcgis.com/6Hv9AANartyT7fJW/ArcGIS/rest/services/USCounties_cases_V1/FeatureServer/1';
const USCountiesCOVID19TrendCategoryServiceURL = 'https://services1.arcgis.com/4yjifSiIG17X0gW4/ArcGIS/rest/services/US_County_COVID19_Trends/FeatureServer/0';

import * as USCounties from './US-Counties.json';
import * as USStates from './US-States.json';

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
        NewDeaths?: number;
    }
}

type PathFrame = {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
}

type PathData = {
    path: number[][];
    frame?: PathFrame;
}

type Covid19TrendData = FeatureFromJSON & {
    confirmed: number[],
    // daily new deaths
    deaths: number[],
    // daily new cases
    newCases: number[]
} 

type Covid19TrendDataAsPaths = FeatureFromJSON & {
    confirmed: PathData;
    deaths: PathData;
    newCases: PathData;
} 

type ConvertCovid19TrendDataToPathResponse = {
    features: Covid19TrendDataAsPaths[];
    frames:{
        confirmed: PathFrame;
        deaths: PathFrame;
        newCases: PathFrame;
    },
    // last time modified
    modified?: number;
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
    NewDeaths: number;
    Population: number;
    TrendType: COVID19TrendType | '';
};

type USStatesAndCountiesDataJSON = typeof USStates | typeof USCounties;

const YMaxNewCases = 200;
let yMaxConfirmed = 0;
let yMaxDeaths = 0;

const FIPSCodes4NYCCounties = [ '36085', '36047', '36081', '36005', '36061' ];
const FIPSCode4NYCounty = '36061';
const features4NYCCounties:{
    [key:string]: {
        results: Covid19CasesByTimeQueryResultFeature[];
        feature: FeatureFromJSON 
    }
} = {};

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
    numOfDays = 10
}:CalcWeeklyAveOptions):CalcWeeklyAveResponse=>{

    let weeklyAveConfirmed: number[] = [];
    let weeklyAveNewDeaths: number[] = [];
    let weeklyAveNewCases: number[] = [];

    for ( let i = 0, len = features.length; i < len; i++){

        const feature = features[i];

        const previousFeature = i > 0 
            ? features[i - 1] 
            : undefined;

        const newDeaths = previousFeature 
            ? feature.attributes.Deaths - previousFeature.attributes.Deaths 
            : 0;

        feature.attributes.NewDeaths = newDeaths
    }

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
                    // Deaths,
                    NewCases,
                    NewDeaths
                } = item.attributes;

                confirmedSum += Confirmed >= 0 ? Confirmed : 0;
                deathSum += NewDeaths >= 0 ? NewDeaths : 0;
                newCasesSum += NewCases >= 0 ? NewCases : 0;
            });

            const aveConfirmedPer100k = Math.round(((confirmedSum / numOfDays ) / totalPopulation ) * 100000 );
            // const aveNewDeathsPer100k = Math.round(((deathSum / numOfDays ) / totalPopulation ) * 100000 );
            const aveNewDeathsPer10M = Math.round(((deathSum / numOfDays ) / totalPopulation ) * 10000000 );
            const aveNewCasesPer100k = Math.round(((newCasesSum / numOfDays ) / totalPopulation ) * 100000 );
    
            weeklyAveConfirmed.unshift(aveConfirmedPer100k);
            weeklyAveNewDeaths.unshift(aveNewDeathsPer10M);
            weeklyAveNewCases.unshift(aveNewCasesPer100k);

            indexOfLastItemInGroup = startIndex - 1;
        }

    }

    return {
        confirmed: weeklyAveConfirmed,
        deaths: weeklyAveNewDeaths,
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
    
    try {
        const requestUrl = `${USCountiesCovid19CasesByTimeFeatureServiceURL}/query/?${qs.stringify(params)}`;
        const res = await axios.get(requestUrl);
        // console.log(`fetch data: ${where}`);
    
        return res.data && res.data.features 
            ? res.data.features 
            : [];

    } catch(err){
        console.log(JSON.stringify(err));
        return [];
    }

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

            // save the NYC Counties results that will be used to fix data issue
            if(FIPSCodes4NYCCounties.indexOf(FIPS) > -1){
                features4NYCCounties[FIPS] = { results, feature };

            } else {

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
    }

    return output;

}

const saveToCOVID19LatestNumbers = (FIPS:string, features: Covid19CasesByTimeQueryResultFeature[])=>{

    // const indexOfLatestFeature = features.length - 1;

    const latestFeature = features[features.length - 1];
    const feature7DaysAgo = features[features.length - 8]

    const { attributes } = latestFeature;

    const { Confirmed, Deaths, Population } = attributes;

    // const [year, month, day] = dt.split('-');
    // const date = new Date(+year, +month - 1, +day);

    // const dayOfWeek = date.getDay();

    // const featureOfLastSunday = dayOfWeek === 0 
    //     ? latestFeature // 
    //     : features[ indexOfLatestFeature - dayOfWeek ];

    const newCasesPast7Days =  latestFeature.attributes.Confirmed - feature7DaysAgo.attributes.Confirmed;
    const newDeathsPast7Days =  latestFeature.attributes.Deaths - feature7DaysAgo.attributes.Deaths;

    COVID19LatestNumbers[FIPS] = {
        Confirmed,
        Deaths,
        Population,
        // new cases and deaths of past 7 days
        NewCases: newCasesPast7Days,
        NewDeaths: newDeathsPast7Days,
        TrendType: USCountiesCOVID19TrendCategoryLookup[FIPS] || ''
    }
};

const calculatePath = (values: number[], ymax:number, xyRatio=1): PathData=>{

    const ymaxFromValues = values.reduce((prev, curr) => Math.max(prev, curr), Number.NEGATIVE_INFINITY);
    const yRatio = ymaxFromValues > ymax ? ymax / ymaxFromValues : 1;

    const xmax =  xyRatio === 1 
        ? ymax 
        : Math.ceil(ymax * xyRatio);

    const xRatio = xmax / values.length;

    const path = values.map((val, index)=>{

        const x = +Math.round(xRatio * index).toFixed(0);
        // const y = val <= ymax ? val : ymax;
        let y = yRatio === 1 
            ? val 
            : +Math.round(val * yRatio).toFixed(0);

        if( y > ymax ){
            y = ymax;
        }

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

const calcYMax = (data: Covid19TrendData[])=>{
    const maxValues4Confirmed: number[] = [];
    const maxValues4Deaths: number[] = [];

    data.forEach(d=>{
        const {
            confirmed,
            deaths
        } = d;

        const maxDeath = max(deaths);
        const maxConfirmed = max(confirmed);
        
        maxValues4Deaths.push(maxDeath);
        maxValues4Confirmed.push(maxConfirmed);
    });

    const stdMaxConfirmed = calcStandardDeviation(maxValues4Confirmed);
    const meanMaxConfirmed = calcMean(maxValues4Confirmed);

    const stdMaxDeaths = calcStandardDeviation(maxValues4Deaths);
    const meanMaxDeaths = calcMean(maxValues4Deaths);

    return {
        Confirmed: Math.round(meanMaxConfirmed + stdMaxConfirmed * 2),
        Deaths:  Math.round(meanMaxDeaths + stdMaxDeaths * 2)
    };
};

// convert to path so it can be rendered using CIMSymbol in ArcGIS JS API
const convertCovid19TrendDataToPath = (data : Covid19TrendData[], includeAttributes?:boolean): ConvertCovid19TrendDataToPathResponse=>{

    let confirmedFrame:PathFrame;
    let deathsFrame:PathFrame;
    let newCasesFrame:PathFrame;

    const covid19TrendDataAsPaths = data
        .map(d=>{
            const {
                attributes,
                geometry,
                confirmed,
                deaths,
                newCases
            } = d;

            const pathConfirmed = calculatePath(confirmed, yMaxConfirmed);
            const pathDeaths = calculatePath(deaths, yMaxDeaths);
            const pathNewCases = calculatePath(newCases, YMaxNewCases, .5);

            if(!confirmedFrame){
                confirmedFrame = pathConfirmed.frame;
            }

            if(!deathsFrame){
                deathsFrame = pathDeaths.frame;
            }

            if(!newCasesFrame){
                newCasesFrame = pathNewCases.frame;
            }

            const outputData = {
                // attributes,
                geometry,
                confirmed: {
                    path: pathConfirmed.path
                },
                deaths: {
                    path: pathDeaths.path
                },
                newCases: {
                    path: pathNewCases.path
                }
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
        });
    
    return {
        features: covid19TrendDataAsPaths,
        frames: {
            confirmed: confirmedFrame,
            deaths: deathsFrame,
            newCases: newCasesFrame
        },
        modified: new Date().getTime()
    };

}

// query trend category from  https://www.arcgis.com/home/item.html?id=49c25e0ce50340e08fcfe51fe6f26d1e#data
const fetchUSCountiesCOVID19TrendCategory = async()=>{

    try {
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
        
        try {
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
        } catch(err){
            console.log(JSON.stringify(err));
        }


        return USCountiesCOVID19TrendCategoryLookup;

    } catch(err){
        console.error(err);
    }
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
};

// JHU merged the data for couple NYC Counties (Quuens, Bronx, Brookly and etc) all into NY County,
// therefore need to merge the data before calculate weekly ave
const fixDataIssue4NYCCounties = (data:Covid19TrendData[]):Covid19TrendData[]=>{

    // counties don't include NY County
    const FIPSCodes4OtherNYCCounties = FIPSCodes4NYCCounties.filter(FIPS=> FIPS !== FIPSCode4NYCounty);
    // console.log(FIPSCodes4OtherNYCCounties)

    const NYCounty = features4NYCCounties[FIPSCode4NYCounty];
    // console.log(NYCounty)

    const { attributes, geometry } = NYCounty.feature;
    
    // add numbers from all NYC Counties into NY County
    const features = NYCounty.results.map((feature, index)=>{

        FIPSCodes4OtherNYCCounties.forEach(FIPS=>{

            // get items for each NYC County ast specific date
            const { results } = features4NYCCounties[FIPS];

            if(results && results[index]){
                const item = results[index];

                feature.attributes.Confirmed += item.attributes.Confirmed;
                feature.attributes.NewCases += item.attributes.NewCases;
                feature.attributes.Deaths += item.attributes.Deaths;
                feature.attributes.Population += item.attributes.Population;
            }
        })

        return feature;
    });

    const {
        confirmed,
        deaths,
        newCases,
    } = calcWeeklyAve({
        features,
        totalPopulation: features[0].attributes.Population
    });
    // console.log(FIPSCode4NYCounty, confirmed, deaths, newCases)

    saveToCOVID19LatestNumbers(FIPSCode4NYCounty, features);

    data.push({
        attributes,
        confirmed,
        deaths,
        newCases,
        geometry
    })

    return data;
};


const shouldExecuteDownloadTask = ():Promise<boolean>=>{

    return new Promise(async(resolve, reject)=>{

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
            let dataUSCounties = await fetchCovid19TrendData(USCounties);
            dataUSCounties = fixDataIssue4NYCCounties(dataUSCounties);
            writeToJson(dataUSCounties, OUTPUT_JSON_US_COUNTIES);
            // console.log(JSON.stringify(data));
    
            // calc YMax that will be used when calc trend path, the YMax should be 2 standard deviation of max confirmed and deaths from all counties
            if(!yMaxConfirmed || !yMaxDeaths){
                const {
                    Confirmed,
                    Deaths
                } = calcYMax(dataUSCounties);
    
                yMaxConfirmed = Confirmed;
                yMaxDeaths = Deaths;
            }
    
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

    } 
    // else {
    //     console.log(new Date(), `no change in JHU data, skip execution\n`);
    // }
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

const max = (values:number[])=>{
    return values.reduce((prev, curr) => Math.max(prev, curr), Number.NEGATIVE_INFINITY)
};

const calcMean = (values:number[])=>{
    const mean = values.reduce((a, b) => a + b) / values.length;
    return mean;
}

const calcStandardDeviation = (values:number[])=>{
    const n = values.length
    const mean = calcMean(values);
    const standardDeviation = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);

    return standardDeviation
};

startUp();