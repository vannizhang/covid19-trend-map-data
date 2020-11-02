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
    const caseFatalityRate = Confirmed ? Deaths / Confirmed : 0;
    const caseFatalityRatePast100Day = newCasesPast100Days ? newDeathsPast100Days / newCasesPast100Days : 0; 

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

export const calcPercentiles = (covid19LatestNumbers:Covid19LatestNumbersLookup):Covid19LatestNumbersLookup=>{

    const data = JSON.parse(JSON.stringify(covid19LatestNumbers))

    const sortNumsInAscendingOrder = (a:number, b:number)=>{ return a-b };

    casesPerCapita4Counties.sort(sortNumsInAscendingOrder);
    caseFatalityRate4Counties.sort(sortNumsInAscendingOrder);
    deathsPerCapita4Counties.sort(sortNumsInAscendingOrder);
    caseFatalityRatePast100Day4Counties.sort(sortNumsInAscendingOrder);
    
    casesPerCapita4States.sort(sortNumsInAscendingOrder);
    caseFatalityRate4States.sort(sortNumsInAscendingOrder);
    deathsPerCapita4States.sort(sortNumsInAscendingOrder);
    caseFatalityRatePast100Day4States.sort(sortNumsInAscendingOrder);

    console.log(casesPerCapita4Counties, caseFatalityRate4Counties, deathsPerCapita4Counties, caseFatalityRatePast100Day4Counties)

    return data;
}