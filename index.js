const fs = require('fs');
const csv = require('fast-csv');
const prompt = require('prompt');
const Nightmare = require('nightmare');

let connections = [];
let extractedData = {
  extracted_data: []
};
let nightmare;

let max_extracts_by_session = 3;
let subloop_count = 0;

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
  },
  {
    name: 'getUsersPhone',
    default: "yes",
    message: "Get users' phone? (yes/no)"
  }
]

// Define variables
let email, password, showNightmare, searchInterval, getUsersPhone;
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
      getUsersPhone = result.getUsersPhone === "yes"
      searchInterval = parseInt(result.searchInterval)
      nightmare = Nightmare({
        show: showNightmare,
        waitTimeout: 20000
      })
      getEmails(index);
    })
  }
}


// Emails are stored in this array to be written to email.txt later.
let result = []
let phones = []
let sub_result = []
let sub_phones = []

// Initial email extraction procedure
// Logs in to linked in and runs the getEmail async function to actually extract the emails
async function getEmails(index,count) {
	sub_result = []
	sub_phones = []
  try {
   await nightmare
    .goto('https://linkedin.com')
    .insert('#login-email', email)
    .insert('#login-password', password)
    .click('#login-submit')
    .wait('.nav-item--mynetwork').run(() => {
      getEmail(index,count);
    })
  } catch(e) {
    console.error("An error occured while attempting to login to linkedin.")
  }
}





// Actual email extraction procedure
// Crawler looks for seach input box, writes connection name, clicks on first result, and copies connection's email
async function getEmail(index, count) {
  count = count || 0;


  // Condition is here to make sure no more than the limit of mails is extracted on each interval
  if (count < connections.length) {
    try {
	console.log("Processing #" + index + ": "+ connections[index]);
      await nightmare
      .wait('.nav-item--mynetwork')
      .click('.nav-item--mynetwork a')
      .wait('.js-mn-origami-rail-card__connection-count')
      // .wait('.mn-community-summary__link')
      .click('.js-mn-origami-rail-card__connection-count')
      // .click('.mn-community-summary__link')
      .wait('.mn-connections__search-input')
      .wait(searchInterval)
      .insert('.mn-connections__search-input', connections[index])
      .wait(2000)
//      .wait(1000)
      .click('.mn-connection-card__link')
      .wait('.pv-top-card-v2-section__link--contact-info')
      .click('.pv-top-card-v2-section__link--contact-info')
      .wait('.pv-contact-info.artdeco-container-card')

      r = (
        await nightmare

        // here we get the email from the connections linkedin page.
        .evaluate(() => {
          try {
            let me = document.querySelector('.pv-contact-info__contact-type.ci-email a.pv-contact-info__contact-link').href.replace('mailto:', ''); 
	return me;
          } catch(e) {
            console.error("An email could not be extracted.")
		return "";
          }
        })
      )
	// Save email in global array & partial array
	result.push(r)
	sub_result.push(r)
	if(getUsersPhone){
		r = (
			await nightmare

			// here we get the phone from the connections linkedin page.
			.evaluate(() => {
				try {
					return document.querySelector('.pv-contact-info__contact-type.ci-phone ul li span').innerHTML; 
				} catch(e) {
					console.error("A phone could not be extracted.")
					return "";
				}
			})
		)
		// Save phone in global phones array & partial phones array
		phones.push(r)
		sub_phones.push(r)
	}

    } catch(e) {
	console.log(e);
      console.error("Unable to extract email or phone from connection # ", count);
	r = ""
	result.push(r);
	sub_result.push(r);
	if(getUsersPhone){
		phones.push(r);
		sub_phones.push(r);
	}
    }
  } else {
    // When all emails have been extracted, end nightmare crawler and add emails to email.txt
    await nightmare
    .end();
    addEmailsToFile(result)
    if(getUsersPhone)
        addPhonesToFile(phones);
    return
  }
  try {
    const result = await nightmare
      .evaluate(() => {
        try {
          return document.querySelector('.pv-contact-info__contact-type.ci-email a.pv-contact-info__contact-link').href.replace('mailto:', ''); 
        } catch(e) {
          console.log("An email could not be extracted.");
          return undefined
        }
      })
      .run((result) => {
        count++;
        console.log("#", count)
	if( ((index + 1) % max_extracts_by_session ) == 0 && index + 1 < connections.length){
		sub_addEmailsToFile(sub_result)
		if(getUsersPhone)
			sub_addPhonesToFile(sub_phones)
		subloop_count += 1;
		getEmails(index + 1, count);
	}else{
	        getEmail(index + 1, count)
	}
      })
    

  } catch(e) {
    console.error('An email could not be extracted.');
    return undefined;
  }
}




/* Extract data from CSV (json file is a cache) */

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







// Function to add emails to emails.txt file.
function addEmailsToFile(data) {

  setExtractedData(data);

  if (fs.existsSync('stored_data/emails.txt')) {
    fs.appendFile('stored_data/emails.txt', `\r\n\r\n${data}`, function(err) { 
      if (err) throw err;
      // if no error
      console.log(`${result.length} email(s) extracted.`)
    });
  } else {
    fs.writeFile('stored_data/emails.txt', data, function(err) { 
      if (err) throw err;
      // if no error
      console.log(`${result.length} email(s) extracted.`)
    });
  }
}

// Function to add phones to phones.txt file.
function addPhonesToFile(data) {

  setExtractedData(data,"phone");

  if (fs.existsSync('stored_data/phones.txt')) {
    fs.appendFile('stored_data/phones.txt', `\r\n\r\n${data}`, function(err) { 
      if (err) throw err;
      // if no error
      console.log(`${phones.length} phone(s) extracted.`)
    });
  } else {
    fs.writeFile('stored_data/phones.txt', data, function(err) { 
      if (err) throw err;
      // if no error
      console.log(`${phones.length} phone(s) extracted.`)
    });
  }
}

function setExtractedData(data,type="email") {
  data.forEach((email, index) => {
    let extractedConnection = {"name":connections[index],type: email}
    if (email && !extractedData.extracted_data.includes(extractedConnection)) {
      extractedData.extracted_data.push(extractedConnection)
    }
  })

  fs.writeFile('stored_data/extracted_data.json', JSON.stringify(extractedData), function(err) { 
    if (err) throw err;
  });

}




// Function to add emails to emails.txt file.
function sub_addEmailsToFile(data) {

	filename = 'stored_data/emails_' + subloop_count + '.txt';

  if (fs.existsSync(filename)) {
    fs.appendFile(filename, `\r\n\r\n${data}`, function(err) { 
      if (err) throw err;
      // if no error
      console.log(`Sub process - ${data.length} email(s) extracted.`)
    });
  } else {
    fs.writeFile(filename, data, function(err) { 
      if (err) throw err;
      // if no error
      console.log(`Sub process - ${data.length} email(s) extracted.`)
    });
  }
}

// Function to add phones to phones.txt file.
function sub_addPhonesToFile(data) {

	filename = 'stored_data/phones_' + subloop_count + '.txt';

  if (fs.existsSync(filename)) {
    fs.appendFile(filename, `\r\n\r\n${data}`, function(err) { 
      if (err) throw err;
      // if no error
      console.log(`Sub process - ${data.length} phone(s) extracted.`)
    });
  } else {
    fs.writeFile(filename, data, function(err) { 
      if (err) throw err;
      // if no error
      console.log(`Sub process - ${data.length} phone(s) extracted.`)
    });
  }
}
