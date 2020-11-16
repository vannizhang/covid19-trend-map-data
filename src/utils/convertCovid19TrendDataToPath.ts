import {
    FeatureFromJSON,
    Covid19TrendData,
} from '../download-covid19-data';

import {
    calcStandardDeviation,max,calcMean
} from './mathFns';

import {
    YMaxNewCases
} from '../const';

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

type Covid19TrendDataAsPaths = FeatureFromJSON & {
    confirmed: PathData;
    deaths: PathData;
    newCases: PathData;
} 

export type ConvertCovid19TrendDataToPathResponse = {
    features: Covid19TrendDataAsPaths[];
    frames:{
        confirmed: PathFrame;
        deaths: PathFrame;
        newCases: PathFrame;
    },
    // last time modified
    modified?: number;
}

let yMaxConfirmed = 0;
let yMaxDeaths = 0;

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

// calc YMax that will be used when calc trend path, the YMax should be 2 standard deviation of max confirmed and deaths from all counties
export const calcYMax = (data: Covid19TrendData[])=>{

    if(yMaxConfirmed && yMaxDeaths){
        return;
    }

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

    yMaxConfirmed = Math.round(meanMaxConfirmed + stdMaxConfirmed * 2),
    yMaxDeaths = Math.round(meanMaxDeaths + stdMaxDeaths * 2)
};

export const convertCovid19TrendDataToPath4States = (data : Covid19TrendData[]): ConvertCovid19TrendDataToPathResponse=>{

    const statesData = [...data].map(d=>{
        const {
            attributes,
            geometry,
            confirmed,
            deaths,
            newCases
        } = d;

        return {
            attributes: {
                FIPS: attributes.STATE_FIPS
            }, 
            geometry,
            confirmed,
            deaths,
            newCases
        }
    });

    return convertCovid19TrendDataToPath(statesData, true)
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

export default convertCovid19TrendDataToPath;