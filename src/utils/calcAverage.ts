import {
    Covid19CasesByTimeQueryResultFeature
} from './fetchCovid19CasesByTimeData';

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

export default calcWeeklyAve;