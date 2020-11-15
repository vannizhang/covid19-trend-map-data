import {
    Covid19CasesByTimeQueryResultFeature,
} from './fetchCovid19CasesByTimeData';

import {
    COVID19TrendType
} from './fetchUSCountiesCOVID19TrendCategory'

import {
    getTrendCategoryByFIPS,
} from './fetchUSCountiesCOVID19TrendCategory';

import {
    saveNumbers2CalcRank,
    addRank2Covid19LatestNumbers
} from './covid19Ranks';

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
    // Percentiles for: casesPerCapita, deathsPerCapita, caseFatalityRate, caseFatalityRatePast100Day
    Percentiles?: [number, number, number, number];
    // Ranks for: casesPerCapita, deathsPerCapita, caseFatalityRate, caseFatalityRatePast100Day
    Ranks?: [number, number, number, number];
};

export type Covid19LatestNumbersLookup = {
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

    const latestNumbers:COVID19LatestNumbersItem = {
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
        TrendType: getTrendCategoryByFIPS(FIPS) || ''
    };

    covid19LatestNumbers[FIPS] = latestNumbers;

    saveNumbers2CalcRank({
        FIPS,
        Confirmed,
        Deaths,
        Population,
        newCasesPast100Days,
        newDeathsPast100Days,
    })
};

export const getCOVID19LatestNumbers = ():Covid19LatestNumbersLookup=>{
    const data = addRank2Covid19LatestNumbers(covid19LatestNumbers);
    return data;
}

export default saveToCOVID19LatestNumbers;