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

const simpleHash = (str:string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash; // Convert to 32bit integer
  }
  return new Uint32Array([hash])[0].toString(36);
};

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

  const number = parseInt(input);

  if (!Number.isNaN(number)) {
    return number;
  } else {
    return null;
  }
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

  if (darr.length > 2) {
    
  return `${darr[2]}-${darr[0]}-${darr[1]}`;
  } else {
    return null;
  }
}

function cleanbool(input) {
  var condensedstring = input.toLowerCase().replace(/\s/g, '').trim();
  if (condensedstring == "yes" || condensedstring == "true" || condensedstring == true) {
    return true;
  } else {
    return false;
  }

  
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
   website text,
   waiting_list smallint,
   iswaitlist boolean,
   isnodata boolean
  )`, [])

  console.log(maketable);

  await doc.loadInfo()
  const sheet = doc.sheetsByIndex[0]

 // console.log(sheet)

 // read rows
const rows = await sheet.getRows();

const hashofrows = simpleHash(JSON.stringify(rows));

let letthrough = true;

const checkiftableexistsreq = `SELECT EXISTS (
  SELECT FROM 
      information_schema.tables 
  WHERE 
      table_schema LIKE 'public' AND 
      table_type LIKE 'BASE TABLE' AND
      table_name = 'shelterhashinfo'
  )`

  const checkiftableexists = await pgclient.query(checkiftableexistsreq, [])

  console.log(checkiftableexists.rows[0].exists);

if (checkiftableexists?.rows[0]?.exists) {
  const checkhash = await pgclient.query(`SELECT * FROM shelterhashinfo WHERE name = 'main'`, [])

  if (checkhash?.rows[0]?.hash === hashofrows) {
    console.log('hashes match, not updating')
    letthrough = false;
  }
}

if (letthrough === true) {
  
//console.log(rows);
console.log('rows', rows.length)

const arrayOfRowsInsertsToPerform:Array<any> = []

for (const row of rows) {

if (row.lat != null && row.lng != null && row.lat != "" && row.lng != "") {

  if (!Number.isNaN(row.lat) && !Number.isNaN(row.lng)) {
    
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
    website,
    waiting_list,
    iswaitlist,
    isnodata
    ) VALUES (
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
      $16,
      $17,
      $18,
      $19
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
    row.website,
    cleannumber(row.waiting_list),
    cleanbool(row.iswaitlist),
    cleanbool(row.isnodata)
    ]))    
  } else {
    console.log("skipped row because lat or lng is not a number", row.lat, row.lng)
  }

} else {
  console.log("skipped row because lat or lng is not a number outer loop", row.lat, row.lng)
}
}

await Promise.all(arrayOfRowsInsertsToPerform);

console.log("done inserting to temp table");

const dropoldtable = await pgclient.query(`BEGIN; DROP TABLE IF EXISTS shelters; ALTER TABLE ${generatenameoftable} RENAME TO shelters; COMMIT;`, [])

//make table if not exists
const maketable = await pgclient.query(`CREATE TABLE IF NOT EXISTS shelterhashinfo (
  name text PRIMARY KEY,
  hash text,
  timeofwrite timestamp
)`, [])

//write hash to db
const writehash = await pgclient.query(`INSERT INTO shelterhashinfo (name, hash, timeofwrite) VALUES ('main', $1, $2) ON CONFLICT (name) DO UPDATE SET hash = $1`, [hashofrows, Date.now()])

console.log("done renaming temp table to shelters");
}


}

fetchSheet();

setInterval(() => {
  fetchSheet();
}, 10_000)
}

main()