const fs = require('fs');
const csv = require('fast-csv');
const prompt = require('prompt')
const Nightmare = require('nightmare')
let nightmare = Nightmare({ 
  waitTimeout: 20000
})

let connections = [];

// Get connection names from connections.csv
let stream = fs.createReadStream("connections.csv");
csv
 .fromStream(stream, {headers : true})
 .on("data", function(data){
     connections.push(`${data['First Name']} ${data['Last Name']}`);
 })
 .on("end", function(){
    //  After connection names are setup, start email extraction process
    start();
 });

// Setup prompt attributes
let prompt_attrs = [
  { 
    name: 'email', 
    required: true, 
    message:"LinkedIn email" 
  },
  { 
    name: 'password', 
    hidden: true, 
    required: true, 
    message:"LinkedIn password" 
  },
  { 
    name: 'interval', 
    message: 'How frequent should we get emails? (In milliseconds, 1 hour = 3600000)',
    default: '3600000'   
  },
  { 
    name: 'limit', 
    message: 'How many emails per interval?',
    default: '25'
  }
]

// Define variables
let email, password, interval, limit;
let emails = [];
let index = 0;
let intervalSet = false;

// This function starts the process by asking user for LinkedIn credentials, as well config options
// - email & password are used to log in to linkedin
// - interval establishes how often will emails be extracted
// - limit is the amount of emails to extract on every interval
function start() {
  prompt.start()
  
  prompt.get(prompt_attrs, (err, result) => {
    email = result.email
    password = result.password
    interval = parseInt(result.interval)
    limit = parseInt(result['emails per interval'])
  })

  getEmails(index);
}

// Emails are stored in this array to be written to email.txt later.
let result = []

// Initial email extraction procedure
// Logs in to linked in and runs the getEmail async function to actually extract the emails
async function getEmails(index) {
  try {
    await nightmare
    .goto('https://linkedin.com')
    .type('#login-email', email)
    .type('#login-password', password)
    .click('#login-submit')
    .wait('.nav-search-typeahead')
    .run(() => {
      getEmail(index);
    })
  } catch(e) {
    console.error(e);
  }
}

// Actual email extraction procedure
// Crawler looks for seach input box, writes connection name, clicks on first result, and copies connection's email
async function getEmail(index, count) {
  count = count || 0;

  // Condition is here to make sure no more than the limit of emails is extracted on each interval
  if (count < limit) {
    try {
      await nightmare
      .wait('.nav-search-typeahead')
      .click('.nav-search-typeahead')
      .type('.nav-search-typeahead input', "")
      .type('.nav-search-typeahead input', connections[index])
      .type('.nav-search-typeahead input', '\u000d')
      .wait('.search-results__list')
      .click('.search-result__result-link')
      .wait('.pv-top-card-v2-section__link--contact-info')
      .click('.pv-top-card-v2-section__link--contact-info')
      .wait('.pv-contact-info.artdeco-container-card')
      .wait(2000)

      result.push(
        await nightmare
        // here we get the email from the connections linkedin page.
        .evaluate(() => { return document.querySelector('.pv-contact-info__contact-type.ci-email a.pv-contact-info__contact-link').href.replace('mailto:', ''); })
      )

    } catch(e) {
      console.error(e);
    }
  } else {
    // If interval email limit is reached, end the crawler session and add emails to emails.txt
    // Then start the interval if it has not been set already
    await nightmare
    .end();
    addEmailsToFile(result)

    if (!intervalSet) {
      intervalSet = true;
      setInterval(function() {

        // If result.length is equal to connections.length then email extraction is completed.
        // Let user know the process has ended.
        // If process has not ended, continue with procedure interval.
        if (result.length >= connections.length) {
          console.log("Email extraction complete. You can end this program pressing Ctrl+C");
        } else {
          nightmare = Nightmare({ 
            waitTimeout: 20000
          })
          getEmails(result.length);
        }
      }, interval)
    }
  }
  try {
    const result = await nightmare
      .evaluate(() => { return document.querySelector('.pv-contact-info__contact-type.ci-email a.pv-contact-info__contact-link').href.replace('mailto:', ''); })
      .run((result) => {
        count++;
        getEmail(index + 1, count)
      })
    
    emails.push(result);

  } catch(e) {
    console.error(e);
    return undefined;
  }
}

// Function to add emails to email.txt file.
function addEmailsToFile(data) {
  fs.writeFile('emails.txt', data, function(err) { 
    if (err) throw err;
    // if no error
    console.log(`${limit} new email(s) added. ${result.length} email(s) in file.`)
  });
}