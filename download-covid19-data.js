const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OUTPUT_JSON_CONFIRMED_CASES_7_DAY_AVG = path.join(__dirname, '/public/data.json');
const CSSECovid19TimeSeriesCsv = 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_US.csv';

const getConfirmedCases7DaysAve = async()=>{

    try{
        const rawCsv = await axios.get(CSSECovid19TimeSeriesCsv);

        const csvRows = csvToArray(rawCsv.data);
    
        // const headers = csvRows[0];
    
        const rows = csvRows.slice(1);
    
        const data = rows
            .map(row=>{
    
                const [
                    UID,
                    iso2,
                    iso3,
                    code3,
                    FIPS,
                    Admin2,
                    Province_State,
                    Country_Region,
                    Lat,
                    Long_,
                    Combined_Key,
                ] = row.slice(0, 11);
    
                const avgValues = [];
    
                const covid19ConfirmedCases = row
                    .slice(11)
                    .map(d=>+d);
    
                for(let i = 0, len = covid19ConfirmedCases.length; i < len; i++){
    
                    if(i%7 === 0){
                        // console.log('calc avg for', i)
    
                        const weeklyAvg = Math.floor(average(covid19ConfirmedCases.slice(i, i + 7)))
    
                        avgValues.push(weeklyAvg)
    
                    } else {
                        // console.log('skip calc for', i)
                    }
                }
    
                return {
                    lat: +Lat,
                    lon: +Long_,
                    county: Admin2,
                    state: Province_State,
                    confirmed_cases: avgValues
                };
    
            })
            .filter(d=>{
                const isValdLatLon = d.lat && d.lon;
                return d.county && d.county !== 'Unassigned' && isValdLatLon
            })
    
        return data;

    } catch(err){
        console.error(err);
    }
};

const startUp = async()=>{

    const confirmedCases7DaysAve = await getConfirmedCases7DaysAve();
    console.log(confirmedCases7DaysAve)

    if(confirmedCases7DaysAve){
        writeToJson(confirmedCases7DaysAve, OUTPUT_JSON_CONFIRMED_CASES_7_DAY_AVG);
    }
};

const writeToJson = (data, outputPath)=>{
    const json = JSON.stringify(data);
    // const outputFileName = 'data.json';
    fs.writeFile(outputPath, json, 'utf8', ()=>{
        console.log('data.json is updated and saved:', new Date(), '\n');
    });
};

// use the solution found from this StackOverflow thread: https://stackoverflow.com/questions/1293147/javascript-code-to-parse-csv-data
const csvToArray = (strData, strDelimiter)=>{
    // Check to see if the delimiter is defined. If not,
    // then default to comma.
    strDelimiter = (strDelimiter || ",");

    // Create a regular expression to parse the CSV values.
    const objPattern = new RegExp(
        (
            // Delimiters.
            "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

            // Quoted fields.
            "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

            // Standard fields.
            "([^\"\\" + strDelimiter + "\\r\\n]*))"
        ),
        "gi"
    );


    // Create an array to hold our data. Give the array
    // a default empty first row.
    const arrData = [[]];

    // Create an array to hold our individual pattern
    // matching groups.
    let arrMatches = null;

    // Keep looping over the regular expression matches
    // until we can no longer find a match.
    while (arrMatches = objPattern.exec( strData )){

        // Get the delimiter that was found.
        let strMatchedDelimiter = arrMatches[ 1 ];

        // Check to see if the given delimiter has a length
        // (is not the start of string) and if it matches
        // field delimiter. If id does not, then we know
        // that this delimiter is a row delimiter.
        if (
            strMatchedDelimiter.length &&
            strMatchedDelimiter !== strDelimiter
            ){

            // Since we have reached a new row of data,
            // add an empty row to our data array.
            arrData.push( [] );

        }

        let strMatchedValue;

        // Now that we have our delimiter out of the way,
        // let's check to see which kind of value we
        // captured (quoted or unquoted).
        if (arrMatches[ 2 ]){

            // We found a quoted value. When we capture
            // this value, unescape any double quotes.
            strMatchedValue = arrMatches[ 2 ].replace(
                new RegExp( "\"\"", "g" ),
                "\""
                );

        } else {
            // We found a non-quoted value.
            strMatchedValue = arrMatches[ 3 ];
        }


        // Now that we have our value string, let's add
        // it to the data array.
        arrData[ arrData.length - 1 ].push( strMatchedValue );
    }

    // Return the parsed data.
    return( arrData );
}

const average = (values) => values.reduce((a, b) => a + b) / values.length;

startUp();