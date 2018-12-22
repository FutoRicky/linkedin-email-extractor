const fs = require('fs');
const csv = require('fast-csv');
const prompt = require('prompt')
const Nightmare = require('nightmare')
let nightmare = Nightmare({ 
  waitTimeout: 20000
})

let connections = [];

var stream = fs.createReadStream("connections.csv");
csv
 .fromStream(stream, {headers : true})
 .on("data", function(data){
     connections.push(`${data['First Name']} ${data['Last Name']}`);
 })
 .on("end", function(){
    start();
 });

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

let email, password, interval, limit;
let emails = [];
let index = 0;
let intervalSet = false;

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


let result = []

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

async function getEmail(index, count) {
  count = count || 0;

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
        .evaluate(() => { return document.querySelector('.pv-contact-info__contact-type.ci-email a.pv-contact-info__contact-link').href.replace('mailto:', ''); })
      )

    } catch(e) {
      console.error(e);
    }
  } else {
    await nightmare
    .end();
    addEmailsToFile(result)

    if (!intervalSet) {
      intervalSet = true;
      setInterval(function() {
        if (result.length >= 4) {
        // if (result.length >= connections.length) {
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

function addEmailsToFile(data) {
  fs.writeFile('emails.txt', data, function(err) { 
    if (err) throw err;
    // if no error
    console.log(`${limit} new email(s) added. ${result.length} email(s) in file.`)
  });
}