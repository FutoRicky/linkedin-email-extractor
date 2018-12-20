const fs = require('fs');
const csv = require('fast-csv');
// require('.assets/js/jquery.csv.min.js');w
const prompt = require('prompt')
const Nightmare = require('nightmare')
const nightmare = Nightmare({ 
  show: true,
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
     console.log("done");
    //  console.log(connections)
    start();
 });

let prompt_attrs = [
  { name: 'email' },
  { name: 'password', hidden: true }
]

function start() {
  prompt.start()
  
  prompt.get(prompt_attrs, (err, result) => {
    let email = result.email
    let password = result.password

    getEmails(email, password, 0);
  })
}


let result = []

async function getEmails(email, password, index) {
  try {
    await nightmare
    .goto('https://linkedin.com')
    .type('#login-email', email)
    .type('#login-password', password)
    .click('#login-submit')
    .wait('.nav-search-typeahead')
    .run(() => {
      getEmail(email, password, index);
    })
  } catch(e) {
    console.error(e);
  }
}

async function getEmail(email, password, index) {
  if (index < connections.length) {
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
      .wait(3000)

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
    console.log(result)
  }
  try {
    const result = await nightmare
      .evaluate(() => { return document.querySelector('.pv-contact-info__contact-type.ci-email a.pv-contact-info__contact-link').href.replace('mailto:', ''); })
      .run((result) => {
        console.log(result);
        getEmail(email, password, index + 1)
      })
    console.log(result);
  } catch(e) {
    console.error(e);
    return undefined;
  }
}