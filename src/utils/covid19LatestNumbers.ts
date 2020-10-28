import {
    Covid19CasesByTimeQueryResultFeature,
} from './fetchCovid19CasesByTimeData';

import {
    COVID19TrendType
} from './fetchUSCountiesCOVID19TrendCategory'

import {
    getTrendCategoryByFIPS,
} from './fetchUSCountiesCOVID19TrendCategory';

type COVID19LatestNumbersItem = {
    Name: string;
    Confirmed: number;
    Deaths: number;
    NewCases: number;
    NewDeaths: number;
    NewCases100Days: number;
    NewDeaths100Days: number;
    Population: number;
    TrendType: COVID19TrendType | '';
};

type Covid19LatestNumbersLookup = {
    [key: string]: COVID19LatestNumbersItem
}

// this table will be used by the app to populate tooltip
const covid19LatestNumbers:Covid19LatestNumbersLookup = {};

const saveToCOVID19LatestNumbers = (FIPS:string, Name:string, features: Covid19CasesByTimeQueryResultFeature[])=>{

    const latestFeature = features[features.length - 1];
    const feature7DaysAgo = features[features.length - 8];
    const features100DaysAgo = features[features.length - 101];

    const { attributes } = latestFeature;

    const { Confirmed, Deaths, Population } = attributes;

    const newCasesPast7Days =  latestFeature.attributes.Confirmed - feature7DaysAgo.attributes.Confirmed;
    const newDeathsPast7Days =  latestFeature.attributes.Deaths - feature7DaysAgo.attributes.Deaths;
    
    const newCasesPast100Days =  latestFeature.attributes.Confirmed - features100DaysAgo.attributes.Confirmed;
    const newDeathsPast100Days =  latestFeature.attributes.Deaths - features100DaysAgo.attributes.Deaths;

    covid19LatestNumbers[FIPS] = {
        Name,
        Confirmed,
        Deaths,
        Population,
        // new cases and deaths of past 7 days
        NewCases: newCasesPast7Days,
        NewDeaths: newDeathsPast7Days,
        // new cases and deaths of past 100 days
        NewCases100Days: newCasesPast100Days,
        NewDeaths100Days: newDeathsPast100Days,
        TrendType: getTrendCategoryByFIPS(FIPS) || '',
    }
};

export const getCOVID19LatestNumbers = ():Covid19LatestNumbersLookup=>{
    return JSON.parse(JSON.stringify(covid19LatestNumbers))
}

export default saveToCOVID19LatestNumbers;