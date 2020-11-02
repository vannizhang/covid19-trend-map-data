import {
    Covid19LatestNumbersLookup
} from './covid19LatestNumbers';

// save values into array and it will be used to calculate the percentiles
let casesPerCapita4Counties: number[] = [];
let caseFatalityRate4Counties: number[] = [];
let deathsPerCapita4Counties: number[] = [];
let caseFatalityRatePast100Day4Counties: number[] = [];

let casesPerCapita4States: number[] = [];
let caseFatalityRate4States: number[] = [];
let deathsPerCapita4States: number[] = [];
let caseFatalityRatePast100Day4States: number[] = [];

type Item2CalcPercentiles = {
    FIPS: string;
    casesPerCapita: number;
    deathsPerCapita: number;
    caseFatalityRate: number;
    caseFatalityRatePast100Day: number;
}

const items2CalcPercentiles: Item2CalcPercentiles[] = [];

const calcPercentile = (num:number, values:number[]):number => {

    if(!values || !values.length){
        return 0;
    }

    let index = values.indexOf(num);

    if(index === -1){
        return 0;
    }

    if(values[index] < values[index + 1]){
        index = index + 1;
    } else {

        while(values[index] === values[index + 1]){
            index++;
        }
    }

    return Math.round((index / values.length) * 100) / 100;
}

export const saveNumbers2CalcPercentiles = ({
    FIPS='',
    Confirmed=0,
    Deaths=0,
    newCasesPast100Days=0,
    newDeathsPast100Days=0,
    Population=0
}):void=>{

    if(!FIPS || !Population){
        return
    };
    
    const casesPerCapita = Confirmed ? +((Confirmed / Population) * 100000).toFixed(2) : 0;
    const deathsPerCapita = Deaths ? +((Deaths / Population) * 10000000).toFixed(2) : 0;
    const caseFatalityRate = Confirmed ? +((Deaths / Confirmed).toFixed(4)) : 0;
    const caseFatalityRatePast100Day = newCasesPast100Days ? +((newDeathsPast100Days / newCasesPast100Days).toFixed(4)) : 0; 

    if(FIPS.length === 5){
        casesPerCapita4Counties.push(casesPerCapita)
        deathsPerCapita4Counties.push(deathsPerCapita)
        caseFatalityRate4Counties.push(caseFatalityRate)
        caseFatalityRatePast100Day4Counties.push(caseFatalityRatePast100Day)
    } else {
        casesPerCapita4States.push(casesPerCapita)
        deathsPerCapita4States.push(deathsPerCapita)
        caseFatalityRate4States.push(caseFatalityRate)
        caseFatalityRatePast100Day4States.push(caseFatalityRatePast100Day)
    }

    items2CalcPercentiles.push({
        FIPS,
        casesPerCapita,
        deathsPerCapita,
        caseFatalityRate,
        caseFatalityRatePast100Day
    })
}

export const addPercentiles2Covid19LatestNumbers = (covid19LatestNumbers:Covid19LatestNumbersLookup):Covid19LatestNumbersLookup=>{

    const data:Covid19LatestNumbersLookup = JSON.parse(JSON.stringify(covid19LatestNumbers))

    const sortNumsInAscendingOrder = (a:number, b:number)=>{ return a-b };

    casesPerCapita4Counties.sort(sortNumsInAscendingOrder);
    caseFatalityRate4Counties.sort(sortNumsInAscendingOrder);
    deathsPerCapita4Counties.sort(sortNumsInAscendingOrder);
    caseFatalityRatePast100Day4Counties.sort(sortNumsInAscendingOrder);
    
    casesPerCapita4States.sort(sortNumsInAscendingOrder);
    caseFatalityRate4States.sort(sortNumsInAscendingOrder);
    deathsPerCapita4States.sort(sortNumsInAscendingOrder);
    caseFatalityRatePast100Day4States.sort(sortNumsInAscendingOrder);

    items2CalcPercentiles.forEach(item=>{

        const {
            FIPS,
            casesPerCapita,
            deathsPerCapita,
            caseFatalityRate,
            caseFatalityRatePast100Day
        } = item;

        const isState = FIPS.length === 2;

        const casesPerCapitaValues = isState ? casesPerCapita4States : casesPerCapita4Counties;
        const deathsPerCapitaValues = isState ? deathsPerCapita4States : deathsPerCapita4Counties;
        const caseFatalityRateValues = isState ? caseFatalityRate4States : caseFatalityRate4Counties;
        const caseFatalityRatePast100DayValues = isState ? caseFatalityRatePast100Day4States : caseFatalityRatePast100Day4Counties;

        // Percentiles for: casesPerCapita, deathsPerCapita, caseFatalityRate, caseFatalityRatePast100Day
        data[FIPS].Percentiles = [
            calcPercentile(casesPerCapita, casesPerCapitaValues),
            calcPercentile(deathsPerCapita, deathsPerCapitaValues),
            calcPercentile(caseFatalityRate, caseFatalityRateValues),
            calcPercentile(caseFatalityRatePast100Day, caseFatalityRatePast100DayValues)
        ]

    });

    return data;
}