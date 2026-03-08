const mongoose = require("mongoose");
const Opportunity = require("./models/Opportunity");

mongoose.connect("mongodb+srv://aashanajuly04_db_user:FundMe123@cluster0.hdqkvm7.mongodb.net/?appName=Cluster0");

const opportunities = [

{
name: "Startup India Seed Fund",
description: "Government funding for proof of concept and prototype development",
amount: "₹20L - ₹50L",
stage: "Prototype",
type: "Government",
geography: "India",
size: "medium",
eligibility: "DPIIT recognized startups"
},

{
name: "Smart India Hackathon",
description: "India's largest open innovation challenge",
amount: "₹1L - ₹5L",
stage: "Idea",
type: "Competition",
geography: "India",
size: "small",
eligibility: "Students and innovators"
},

{
name: "NIDHI Prayas",
description: "Grant for innovators to build prototypes",
amount: "₹10L",
stage: "Prototype",
type: "Grant",
geography: "India",
size: "small",
eligibility: "Students and early startups"
},

{
name: "Atal Incubation Mission",
description: "Government incubator network providing funding and mentorship",
amount: "₹10L - ₹30L",
stage: "Prototype",
type: "Government",
geography: "India",
size: "medium",
eligibility: "Technology startups"
},

{
name: "Y Combinator",
description: "World famous startup accelerator providing $500K investment",
amount: "₹4Cr - ₹5Cr",
stage: "Revenue",
type: "Accelerator",
geography: "Global",
size: "xlarge",
eligibility: "High growth startups"
},

{
name: "Sequoia Surge",
description: "Scale up program for startups in India and Southeast Asia",
amount: "₹1.5Cr - ₹3Cr",
stage: "Revenue",
type: "Accelerator",
geography: "India",
size: "xlarge",
eligibility: "Product market fit startups"
},

{
name: "Techstars",
description: "Global accelerator program with mentorship and funding",
amount: "$120K",
stage: "Prototype",
type: "Accelerator",
geography: "Global",
size: "large",
eligibility: "Early stage startups"
},

{
name: "Antler",
description: "Global day zero investor helping founders build companies",
amount: "$100K - $200K",
stage: "Idea",
type: "Accelerator",
geography: "Global",
size: "large",
eligibility: "Aspiring founders"
},

{
name: "NSRCEL IIM Bangalore",
description: "Startup incubation with mentorship and funding",
amount: "₹15L - ₹30L",
stage: "Registered",
type: "Incubator",
geography: "India",
size: "medium",
eligibility: "Scalable startups"
},

{
name: "T-Hub Hyderabad",
description: "India's largest startup incubator",
amount: "₹25L - ₹50L",
stage: "Registered",
type: "Incubator",
geography: "India",
size: "medium",
eligibility: "Technology startups"
},

{
name: "IIT Madras Incubation Cell",
description: "Deep tech incubation with funding",
amount: "₹10L - ₹30L",
stage: "Prototype",
type: "Incubator",
geography: "India",
size: "medium",
eligibility: "Technology innovators"
},

{
name: "SINE IIT Bombay",
description: "Incubation center supporting tech startups",
amount: "₹15L - ₹35L",
stage: "Registered",
type: "Incubator",
geography: "India",
size: "medium",
eligibility: "Technology startups"
},

{
name: "Microsoft for Startups",
description: "Cloud credits and mentorship for startups",
amount: "Up to ₹1Cr credits",
stage: "Registered",
type: "Grant",
geography: "Global",
size: "medium",
eligibility: "Technology startups"
},

{
name: "Google for Startups",
description: "Cloud support and mentorship",
amount: "Up to $100K credits",
stage: "Prototype",
type: "Grant",
geography: "Global",
size: "medium",
eligibility: "Technology startups"
},

{
name: "AWS Activate",
description: "AWS cloud credits and startup support",
amount: "$100K credits",
stage: "Prototype",
type: "Grant",
geography: "Global",
size: "medium",
eligibility: "Startups using AWS"
},

{
name: "Nvidia Inception",
description: "Support for AI and deep tech startups",
amount: "Infrastructure + mentorship",
stage: "Prototype",
type: "Grant",
geography: "Global",
size: "medium",
eligibility: "AI startups"
}

];

async function seedDB() {

await Opportunity.deleteMany();

await Opportunity.insertMany(opportunities);

console.log("Opportunities inserted successfully");

mongoose.connection.close();

}

seedDB();