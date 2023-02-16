import fs from 'fs'
const { GoogleSpreadsheet } = require('google-spreadsheet')
//import config from '../config.json'
//import serviceAccount from '../serviceAccount.json'

const config = require('../config.json')

const serviceAccount = require('../serviceAccount.json')

import {pgclient} from './postgres'
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

function cleannumber(input) {
  if (input == null) {
    return null;
  }
  if (input == "") {
    return null;
  } 
  if (input == " ") {
    return null;
  }
  return input;
}

function cleandate(input) {
  if (input == null) {
    return null;
  }
  if (input == "") {
    return null;
  } 
  if (input == " ") {
    return null;
  }
  const darr = input.split("/");
  return `${darr[2]}-${darr[0]}-${darr[1]}`;
}

async function main() {

  console.log('connecting to postgres...')

  await pgclient.connect()
  console.log('connected to postgres')
 // Initialize Auth - see more available options at https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication
 await doc.useServiceAccountAuth({
   client_email: serviceAccount.client_email,
   private_key: serviceAccount.private_key,
 });

async function fetchSheet() {



  var generatenameoftable = `shelters${Date.now()}`

  const maketable = await pgclient.query(`CREATE TABLE IF NOT EXISTS ${generatenameoftable} (
   lat float8,
   lng float8,
   cd text,
   spa text,
   organization_name text,
   projectname text,
   address text,
   type text,
   total_beds smallint,
   male_available smallint,
   female_available smallint,
   beds_available smallint,
   last_updated date,
   criteria text,
   contact_info text,
   website text
  )`, [])

  console.log(maketable);

  await doc.loadInfo()
  const sheet = doc.sheetsByIndex[0]

 // console.log(sheet)

 // read rows
const rows = await sheet.getRows();

//console.log(rows);

    const arrayOfRowsInsertsToPerform:Array<any> = []

  for (const row of rows) {

    if (row.lat != null && row.lng != null && row.lat != "" && row.lng != "") {

      if (!Number.isNaN(row.lat) && !Number.isNaN(row.lng) && !Number.isNaN(row.total_beds) && !Number.isNaN(row.beds_available)) {
        
    console.log(row);

    console.log(row.lat);

      arrayOfRowsInsertsToPerform.push(pgclient.query(`INSERT INTO ${generatenameoftable} 
      (lat,
        lng,
        cd,
        spa,
        organization_name,
        projectname,
        address,
        type,
        total_beds,
        male_available,
        female_available,
        beds_available,
        last_updated,
        criteria,
        contact_info,
        website) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16
        )`, [
        row.lat,
        row.lng,
        row.cd,
        row.spa,
        row.organization_name,
        row.projectname,
        row.address,
        row.type,
        cleannumber(row.total_beds),
        cleannumber(row.male_available),
        cleannumber(row.female_available),
        cleannumber(row.beds_available),
        cleandate(row.last_updated),
        row.criteria,
        row.contact_info,
        row.website
        ]))    
      }

    }
  }

  await Promise.all(arrayOfRowsInsertsToPerform);

  console.log("done inserting to temp table");

  const dropoldtable = await pgclient.query(`BEGIN; DROP TABLE IF EXISTS shelters; ALTER TABLE ${generatenameoftable} RENAME TO shelters; COMMIT;`, [])

  console.log("done renaming temp table to shelters");

}

fetchSheet();

setInterval(() => {
  fetchSheet();
}, 10_000)
}

main()