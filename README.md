# linkedin-email-extractor
### A simple node script to extract you linkedin connection emails

## Problem
LinkedIn allows you to export all of your connections' info into a csv, except for their emails. 
Additionally their API stopped allowing the extraction of emails around 2013-2014.

## Installation
- Clone this repo `git clone https://github.com/FutoRicky/linkedin-email-extractor.git`
- Move into the created dir `cd linkedin-email-extractor`
- Install dependencies `npm install`

## How to Use
- You will need the `Connections.csv` file that LinkedIn provides with the data export. 
  - [Instructions on how to export connections from LinkedIn](https://www.linkedin.com/help/linkedin/answer/66844/exporting-connections-from-linkedin?lang=en)
- Add the `Connections.csv` file into the `linkedin-email-extractor` directory
- Run `node --harmony index.js`
- Enter LinkedIn Credentials when prompted
- Wait for email extraction process to finish
- An `email.txt` file will be generated with all off the emails
