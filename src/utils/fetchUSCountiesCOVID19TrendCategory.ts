const axios = require('axios');
const qs = require('qs');

import {
    USCountiesCOVID19TrendCategoryServiceURL,
} from '../const';

import {
    Covid19TrendData
} from '../download-covid19-data';

export type COVID19TrendType = 'Emergent' | 'Spreading' | 'Epidemic' | 'Controlled' | 'End Stage' | 'Zero Cases';

type USCountiesCOVID19TrendCategoryFeature = {
    attributes: {
        Cty_FIPS: string;
        Cty_NAME: string;
        ST_ABBREV: string;
        TrendType: COVID19TrendType;
    }
};

const USCountiesCOVID19TrendCategoryLookup: {
    [key:string]: COVID19TrendType
} = {};

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
};

export const getTrendCategoryByFIPS = (FIPS:string):COVID19TrendType =>{
    return USCountiesCOVID19TrendCategoryLookup[FIPS]
}

export const getCovid19Data4USCountiesWithTrendType = (features: Covid19TrendData[])=>{

    return features.map(d=>{
        const { FIPS } = d.attributes;
        const trendType = getTrendCategoryByFIPS(FIPS);

        d.attributes = { 
            FIPS,
            trendType
        };

        return d;
    })
};

export default fetchUSCountiesCOVID19TrendCategory;