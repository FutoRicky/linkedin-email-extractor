const fs = require('fs');
const csv = require('fast-csv');
const prompt = require('prompt');
const Nightmare = require('nightmare');
const ora = require('ora');
const spinner = ora('Getting data, this may take a while depending on the amount of connections')

let connections = [];
let extractedData = {
  extracted_data: []
};
let nightmare;

// Get connection names from connections.csv
let stream = fs.createReadStream("Connections.csv");
csv
 .fromStream(stream, {headers : true})
 .on("data", function(data){
     connections.push(`${data['First Name']} ${data['Last Name']}`);
 })
 .on("end", function(){
    //  After connection names are setup, start email extraction process
    extractedDataProcedure();
    console.log("Total connections to extract: ", connections.length)
    start();
  });
  

// Setup prompt attributes
let prompt_attrs = [
  { 
    name: 'email', 
    required: true, 
    message: "LinkedIn email" 
  },
  { 
    name: 'password', 
    hidden: true, 
    required: true, 
    message: "LinkedIn password" 
  },
  { 
    name: 'searchInterval', 
    default: "2000",
    message: "Wait interval between each connection search (in ms)" 
  },
  {
    name: 'showNightmare',
    default: "no",
    message: "Show email extraction process? (yes/no)"
  }
]

// Define variables
let email, password, showNightmare, searchInterval;
let emails = [];
let index = 0;

// This function starts the process by asking user for LinkedIn credentials, as well config options
// - email & password are used to log in to linkedin
function start() {
  if (connections.length <= 0) {
    console.log("No connections to extract or they have all been extracted already.")
  } else {
    prompt.start()
    prompt.get(prompt_attrs, (err, result) => {
      email = result.email
      password = result.password
      showNightmare = result.showNightmare === "yes"
      searchInterval = parseInt(result.searchInterval)
      nightmare = Nightmare({
        show: showNightmare,
        waitTimeout: 20000
      })
      spinner.start()
      getEmails(index);
    })
  }
}


// Emails are stored in this array to be written to email.txt later.
let result = []

// Initial email extraction procedure
// Logs in to linked in and runs the getEmail async function to actually extract the emails
async function getEmails(index) {
  try {
    await nightmare
    .goto('https://www.linkedin.com/login')
    .insert('#username', email)
    .insert('#password', password)
    .click('.btn__primary--large.from__button--floating')
    .wait('.nav-item--mynetwork')
    .run(() => {
      getEmail(index);
    })
  } catch(e) {
    spinner.fail("An error occured while attempting to login to linkedin.")
    spinner.stop()
    // console.error("An error occured while attempting to login to linkedin.")
  }
}

// Actual email extraction procedure
// Crawler looks for seach input box, writes connection name, clicks on first result, and copies connection's email
async function getEmail(index, count) {
  count = count || 0;

  // Condition is here to make sure no more than the limit of emails is extracted on each interval
  if (count < connections.length) {
    try {
      await nightmare
      .wait('.nav-item--mynetwork')
      .click('.nav-item--mynetwork a')
      .wait('.mn-community-summary__link')
      .click('.mn-community-summary__link')
      .wait('.mn-connections__search-input')
      .wait(searchInterval)
      .insert('.mn-connections__search-input', connections[index])
      .wait(2000)
      .click('.mn-connection-card__link')
      .wait('[data-control-name=contact_see_more]')
      .click('[data-control-name=contact_see_more]')
      .wait('.pv-contact-info')

      result.push(
        await nightmare

        // here we get the email from the connections linkedin page.
        .evaluate(() => {
          try {
            return document.querySelector('.pv-contact-info__contact-type.ci-email a.pv-contact-info__contact-link').href.replace('mailto:', ''); 
          } catch(e) {
            spinner.fail("An email could not be extracted.")
            // spinner.stop()
            // console.error("An email could not be extracted.")
          }
        })
      )

    } catch(e) {
      // console.error("Unable to extract email from connection # ", count + 1);
      connections.splice(index, 1)
      index--
      count--
    }
  } else {
    // When all emails have been extracted, end nightmare crawler and add emails to email.txt
    await nightmare
    .end();
    addEmailsToFile(result)
    return
  }

  try {
    const result = await nightmare
      .evaluate(() => {
        try {
          return document.querySelector('.pv-contact-info__contact-type.ci-email a.pv-contact-info__contact-link').href.replace('mailto:', ''); 
        } catch(e) {
          // console.log("An email could not be extracted.");
          return undefined
        }
      })
      .run((result) => {
        count++;
        // console.log("#", count)
        getEmail(index + 1, count)
      })
    
    emails.push(result);

  } catch(e) {
    // console.error('An email could not be extracted.');
    return undefined;
  }
}

function extractedDataProcedure() {
  let extractedConnections;

  // Verify if there is past extracted_data
  if (fs.existsSync('stored_data/extracted_data.json')) {

    // get extracted data and assign to extractedData variable
    extractedData = JSON.parse(fs.readFileSync('stored_data/extracted_data.json', 'utf8'));
    extractedConnections = extractedData.extracted_data.map((data) => {
      return data.name;
    })
  } else if (!fs.existsSync('stored_data')) {
    fs.mkdirSync('stored_data');
  }

  // Filter connections that where already extracted
  if (extractedConnections) {
    connections = connections.filter((name) => {
      return !extractedConnections.includes(name)
    })
  }

}

// Function to add emails to email.txt file.
function addEmailsToFile(data) {

  setExtractedData(data);

  if (fs.existsSync('stored_data/emails.txt')) {
    fs.appendFile('stored_data/emails.txt', `\r\n\r\n${data}`, function(err) { 
      if (err) throw err;
      // if no error
      spinner.succeed(`${result.length} email(s) extracted.`)
      spinner.stop()
    });
  } else {
    fs.writeFile('stored_data/emails.txt', data, function(err) { 
      if (err) throw err;
      // if no error
      spinner.succeed(`${result.length} email(s) extracted.`)
      spinner.stop()
      // console.log(`${result.length} email(s) extracted.`)
    });
  }
}

function setExtractedData(data) {
  data.forEach((email, index) => {
    let extractedConnection = {"name":connections[index],"email": email}
    if (email && !extractedData.extracted_data.includes(extractedConnection)) {
      extractedData.extracted_data.push(extractedConnection)
    }
  })

  fs.writeFile('stored_data/extracted_data.json', JSON.stringify(extractedData), function(err) { 
    if (err) throw err;
  });

}