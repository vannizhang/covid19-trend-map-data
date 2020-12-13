# CovidPulse Data

Fetch Covid-19 Data for the US from [JHU Covid-19 County Cases](https://www.arcgis.com/home/item.html?id=4cb598ae041348fb92270f102a6783cb) and transform them into the JSON files with paths that can be rendered as sparklines by the [CovidPulse](https://livingatlas.arcgis.com/covidpulse/) app.

## Instructions

- Before we begin, make sure you have a fresh version of [Node.js](https://nodejs.org/en/) and NPM installed. The current Long Term Support (LTS) release is an ideal starting point. 

- To begin, clone this repository to your computer:

    ```sh
    https://github.com/vannizhang/covid19-trend-map-data.git
    ```

- From the project's root directory, install the required packages (dependencies):

    ```sh
    npm install
    ```

 - Now you can run the command to download and convert the JHU covid-19 data into `.JSON` files the CovidPulse App can use:

    ```sh
    npm run download-covid19-data

    # use the development mode (shows more detailed messages to help debugging) on local testing environment 
    npm run download-covid19-data-dev
    ```

 - The previous step should generate five `.JSON` files into the `./public` directory:

    - the `us-counties-paths.json` and `us-states-paths.json` are data that will be used to plot the sparklines in the CovidPulse app. 

    - `latest-numbers.json` is a lookup table (FIPS code as key) the CovidPulse app uses to show the Tooltip

    - the `us-counties.json` and `us-states.json` contains the raw numbers from JHU services to help debug and QA and are not being used by the CovidPulse app.


- Now you can go to the [repository](https://github.com/vannizhang/covid19-trend-map/tree/master/src/static) for the CovidPulse app and replace the `.JSON` files in the [static folder](https://github.com/vannizhang/covid19-trend-map/tree/master/src/static) using the these ones made by yourself.