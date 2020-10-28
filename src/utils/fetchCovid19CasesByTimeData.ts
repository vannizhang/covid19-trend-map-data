const axios = require('axios');
const qs = require('qs');

import {
    USCountiesCovid19CasesByTimeFeatureServiceURL
} from '../const';

import {
    FeatureFromJSON,
    Covid19TrendData,
    USStatesAndCountiesDataJSON
} from '../download-covid19-data';

import {
    FIPSCodes4NYCCounties,
    FIPSCode4NYCounty,
    // YMaxNewCases
} from '../const';

import calcWeeklyAve from './calcAverage';

import saveToCOVID19LatestNumbers from './covid19LatestNumbers';

export type Covid19CasesByTimeQueryResultFeature = {
    attributes: {
        dt: string;
        Confirmed: number;
        Deaths: number;
        NewCases: number;
        Population: number;
        NewDeaths?: number;
    }
};

const features4NYCCounties:{
    [key:string]: {
        results: Covid19CasesByTimeQueryResultFeature[];
        feature: FeatureFromJSON 
    }
} = {};

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

// JHU merged the data for couple NYC Counties (Quuens, Bronx, Brookly and etc) all into NY County,
// therefore need to merge the data before calculate weekly ave
export const fixDataIssue4NYCCounties = (data:Covid19TrendData[]):Covid19TrendData[]=>{

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

    saveToCOVID19LatestNumbers(FIPSCode4NYCounty, 'NEW YORK, NEW YORK', features);

    data.push({
        attributes,
        confirmed,
        deaths,
        newCases,
        geometry
    })

    return data;
};

const fetchCovid19TrendData = async(data:USStatesAndCountiesDataJSON):Promise<Covid19TrendData[]>=>{
    
    const output = [];

    const { features } = data;

    for(let i = 0, len = features.length; i < len; i++){

        const feature = features[i];

        const { attributes, geometry } = feature;

        let results:Covid19CasesByTimeQueryResultFeature[] = [];
        let FIPS = '';
        let name = '';

        if("FIPS" in attributes){
            FIPS = attributes.FIPS;
            name = `${attributes.NAME}, ${attributes.STATE}`
            results = await fetchCovid19CasesByTimeData({
                where: `FIPS = '${attributes.FIPS}'`
            });
        }

        if("STATE_NAME" in attributes){
            FIPS = attributes.STATE_FIPS;
            name = attributes.STATE_NAME
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
    
                saveToCOVID19LatestNumbers(FIPS, name, results);
    
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

export default fetchCovid19TrendData;