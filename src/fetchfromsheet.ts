import fs from 'fs'
const { GoogleSpreadsheet } = require('google-spreadsheet')
//import config from '../config.json'
//import serviceAccount from '../serviceAccount.json'

const config = require('../config.json')

const serviceAccount = require('../serviceAccount.json')
// const functions = require("firebase-functions");
// const {google} = require("googleapis");
import {google} from "googleapis";
const sheets = google.sheets("v4");

const cors = require("cors")({origin: true});
// const _ = require("lodash");
// import DatadogWinston from 'datadog-winston'
// import winston = require('winston');
// var DatadogWinston = require('datadog-winston')

// var datadogapikey = "063fdf7b57ca457303f6f7cf84ebd7fd"

 // Initialize the sheet - doc ID is the long id in the sheets URL
 const doc = new GoogleSpreadsheet(config.sheetId)




// const { GoogleSpreadsheet } = require('google-spreadsheet');

// Initialize the sheet - doc ID is the long id in the sheets URL
// const doc = new GoogleSpreadsheet('<the sheet ID from the url>');


async function main() {

 // Initialize Auth - see more available options at https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication
 await doc.useServiceAccountAuth({
   client_email: serviceAccount.client_email,
   private_key: serviceAccount.private_key,
 })

async function fetchSheet() {
  await doc.loadInfo()
  const sheet = doc.sheetsByIndex[0]

  console.log(sheet)
}

setInterval(() => {
  fetchSheet();
}, 1_500)
}

main()