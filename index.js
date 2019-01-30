const fs = require('fs');
const csv = require('fast-csv');
const prompt = require('prompt');
const Nightmare = require('nightmare');

let output_data_dir = "stored_data/";

let connections = [];
let extractedData = {
  extracted_data: []
};
let nightmare;

// 30 extracts by session worked fine for exporting 3000 contacts' emails & phones
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
  /*{ 
    name: 'email', 
    required: true, 
    message: "LinkedIn email" 
  },
  { 
    name: 'password', 
    hidden: true, 
    required: true, 
    message: "LinkedIn password" 
  },*/
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
  },
  {
    name: 'getUsersSummary',
    default: "yes",
    message: "Get users' summary? (yes/no)"
  },
  {
    name: 'getUsersLocation',
    default: "yes",
    message: "Get users' location? (yes/no)"
  },
  {
    name: 'getLinkedinProfile',
    default: "yes",
    message: "Get users' Linkedin profile URL? (yes/no)"
  }
]

// Define variables
let email, password, showNightmare, searchInterval, getUsersPhone, getUsersSummary, getUsersLocation, getLinkedinProfile;
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
	email = "papontaveugle.6.dd12@dfgh.net"
      password = result.password
	password = "SaintAveugle"
      showNightmare = result.showNightmare === "yes"
      getUsersPhone = result.getUsersPhone === "yes"
      getUsersSummary = result.getUsersSummary == "yes"
      getUsersLocation = result.getUsersLocation == "yes"
      getLinkedinProfile = result.getLinkedinProfile == "yes"
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
let summaries = []
let locations = []
let profiles = []
let sub_result = []
let sub_phones = []
let sub_summaries = []
let sub_locations = []
let sub_profiles = []

// Initial email extraction procedure
// Logs in to linked in and runs the getEmail async function to actually extract the emails
async function getEmails(index,count,reset=false) {
	sub_result = []
	sub_phones = []
	sub_summaries = []
	sub_locations = []
	sub_profiles = []
	if(reset){
		await nightmare.end()
		nightmare = Nightmare({
			show: showNightmare,
			waitTimeout: 20000
		})
	}
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
	console.log(profiles);


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

				// Add for getting description
				/*.evaluate(() => {
					try {
						let me = document.querySelector('.pv-top-card-section__headline').innerHTML;
						summaries.push(me);
					} catch(e) {
						console.error('Error with description');
					}
				})*/

				.click('.pv-top-card-v2-section__link--contact-info')
				.wait('.pv-contact-info.artdeco-container-card')

			// Get emails
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

			// Get phone
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

			// Get Linkedin profile
			if(getLinkedinProfile){
				r = (
					await nightmare
						// here we get the phone from the connections linkedin page.
						.evaluate(() => {
							try {
								return document.querySelector('.pv-contact-info__contact-type.ci-vanity-url div a').href;
							} catch(e) {
								console.error("A phone could not be extracted.")
								return "";
							}
						})
				)
				// Save profiles
				profiles.push(r)
				sub_profiles.push(r)
			}

			// Get summaries
			if(getUsersSummary){
				r = (
					await nightmare
						// here we get the phone from the connections linkedin page.
						.evaluate(() => {
							try {
								return document.querySelector('.pv-top-card-section__headline').innerHTML.replace(/\n/g,'').trim(); 
							} catch(e) {
								console.error("A summary could not be extracted.")
								return "";
							}
						})
				)
				// Save phone in global phones array & partial phones array
				summaries.push(r)
				sub_summaries.push(r)
			}

			// Get location
			if(getUsersLocation){
				r = (
					await nightmare
						// here we get the phone from the connections linkedin page.
						.evaluate(() => {
							try {
								return document.querySelector('.pv-top-card-section__location').innerHTML.replace(/\n/g,'').trim(); 
							} catch(e) {
								console.error("A location could not be extracted.")
								return "";
							}
						})
				)
				// Save location in global locations array & partial locations array
				locations.push(r)
				sub_locations.push(r)
			}

		} catch(e) {
			console.log(e);
			console.error("Unable to extract email, description, phone or location from connection # ", count);
			r = ""
			result.push(r);
			sub_result.push(r);
			if(getUsersPhone){
				phones.push(r);
				sub_phones.push(r);
			}
			if(getUsersSummary){
				summaries.push(r);
				sub_summaries.push(r);
			}
			if(getUsersLocation){
				locations.push(r);
				sub_locations.push(r);
			}
		}
	} else {
		// When all emails have been extracted, end nightmare crawler and add emails to email.txt
		await nightmare.end();
		// addEmailsToFile(result)
		global_addDataToFile(result, "email")
		if(getUsersPhone)
			// addPhonesToFile(phones);
			global_addDataToFile(phones, "phone");
		if(getUsersSummary)
			// addSummariesToFile(summaries);
			global_addDataToFile(summaries, "summary");
		if(getUsersLocation)
			// addLocationsToFile(locations);
			global_addDataToFile(locations, "location");
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
				sub_global_addDataToFile(sub_result, "email")
				// sub_addEmailsToFile(sub_result)
				if(getUsersPhone)
					sub_global_addDataToFile(sub_phones, "phone");
					// sub_addPhonesToFile(sub_phones);
				if(getUsersSummary)
					sub_global_addDataToFile(sub_summaries, "summary");
					// sub_addSummariesToFile(sub_summaries);
				if(getUsersLocation)
					sub_global_addDataToFile(sub_locations, "location");
					// sub_addLocationsToFile(sub_locations);
				subloop_count += 1;
				getEmails(index + 1, count, true);
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








// Function to add locations to locations.txt file.
function global_addDataToFile(data, type="email") {

	let file;
	let display_name;

	switch(type){
		case "email":
			file = "emails.txt";
			display_name = "email(s)";
			break;
		case "location":
			file = "locations.txt";
			display_name = "location(s)";
			break;
		case "phone":
			file = "phones.txt";
			display_name = "phone(s)";
			break;
		case "summary":
			file = "summaries.txt";
			display_name = "summaries";
			break;
		default:
			file = "null";
			display_name = "";
			break;
	}

	filename = output_data_dir + file;

	setExtractedData(data,type);

	let h_data = "";
	if(type == "summary" || type == "location"){
		data.forEach(function(item){
			h_data += item + "%%%";
		});
	}else{
		// h_data = `\r\n\r\n${data}`;
		h_data = `${data}`;
	}

	if (fs.existsSync(filename)) {
		fs.appendFile(filename, h_data, function(err) { 
			if (err) throw err;
			// if no error
			console.log(`${summaries.length} ${display_name} extracted.`)
		});
	} else {
		fs.writeFile(filename, h_data, function(err) { 
			if (err) throw err;
			// if no error
			console.log(`${summaries.length} ${display_name} extracted.`)
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



// Function to add data to [data]_x.txt file.
function sub_global_addDataToFile(data,type="email") {

	let file;
	let display_name;

	switch(type){
		case "email":
			file = "emails_" + subloop_count + ".txt";
			display_name = "email(s)";
			break;
		case "location":
			file = "locations_" + subloop_count + ".txt";
			display_name = "location(s)";
			break;
		case "phone":
			file = "phones_" + subloop_count + ".txt";
			display_name = "phone(s)";
			break;
		case "summary":
			file = "summaries_" + subloop_count + ".txt";
			display_name = "summaries";
			break;
		default:
			file = "";
	}

	filename = output_data_dir + file;

	let h_data = "";
	if(type == "summary" || type == "location"){
		data.forEach(function(item){
			h_data += item + "%%%";
		});
	}else{
		// h_data = `\r\n\r\n${data}`;
		h_data = `${data}`;
	}

  if (fs.existsSync(filename)) {
    fs.appendFile(filename, h_data, function(err) { 
      if (err) throw err;
      // if no error
      console.log(`Sub process - ${data.length} ${display_name} extracted.`)
    });
  } else {
    fs.writeFile(filename, h_data, function(err) { 
      if (err) throw err;
      // if no error
      console.log(`Sub process - ${data.length} ${display_name} extracted.`)
    });
  }
}