const prompt = require('prompt')
const Nightmare = require('nightmare')
const vo = require('vo')
const nightmare = Nightmare({ 
  show: true,
  waitTimeout: 10000
})

let connections = ['Gerardo Cedeno'];
let count = 0;

let prompt_attrs = [
  { name: 'email' },
  { name: 'password', hidden: true }
]

let run = function * () {
  prompt.start()
  
  prompt.get(prompt_attrs, (err, result) => {
    let email = result.email
    let password = result.password
    
    
    nightmare
      .goto('https://linkedin.com')
      .type('#login-email', email)
      .type('#login-password', password)
      .click('#login-submit')
      .wait('#mynetwork-tab-icon')
    connections.forEach((name, index) => {
      getEmail(email, password, index);
    })
  })
}

function getEmail(email, password, index) {
  nightmare
    // .wait('#mynetwork-tab-icon')
    .click('#mynetwork-tab-icon')
    .wait('.mn-connections-summary__see-all')
    .click('.mn-connections-summary__see-all')
    .wait('.mn-connections__search-input')
    .type('.mn-connections__search-input', connections[index])
    .wait(3000)
    .click('.mn-connection-card__link')
    .wait('.pv-top-card-v2-section__link--contact-info')
    .click('.pv-top-card-v2-section__link--contact-info')
    .wait('.pv-contact-info.artdeco-container-card')
    .wait(3000)
    .evaluate(() => document.querySelector('.pv-contact-info__contact-type.ci-email a.pv-contact-info__contact-link').href.replace('mailto:', ''))
    .end()
    .then(console.log)
}

vo(run)(function(err, titles) {
  console.dir(titles);
});