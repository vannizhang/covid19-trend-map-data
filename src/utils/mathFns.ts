export const max = (values:number[])=>{
    return values.reduce((prev, curr) => Math.max(prev, curr), Number.NEGATIVE_INFINITY)
};

export const calcMean = (values:number[])=>{
    const mean = values.reduce((a, b) => a + b) / values.length;
    return mean;
}

export const calcStandardDeviation = (values:number[])=>{
    const n = values.length
    const mean = calcMean(values);
    const standardDeviation = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);

    return standardDeviation
};