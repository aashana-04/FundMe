const mongoose = require("mongoose");
const CommunityPost = require("./models/CommunityPost");

mongoose.connect("mongodb+srv://aashanajuly04_db_user:FundMe123@cluster0.hdqkvm7.mongodb.net/?appName=Cluster0");

const seedPosts = [

{
content: "Is DPIIT recognition actually useful for early-stage founders?",
replies: [
{ content: "Yes, mainly for access to government schemes like SISFS." },
{ content: "It also helps with certain tax benefits later." }
]
},

{
content: "What is the real timeline for Startup India Seed Fund approval?",
replies: [
{ content: "In my case it took around 3–4 months." },
{ content: "The incubation center review stage takes the longest." }
]
},

{
content: "Should student founders incorporate their startup early or wait?",
replies: [
{ content: "Most incubators accept pre-incorporation teams." },
{ content: "Incorporate only once you are serious about funding." }
]
},

{
content: "Should college founders focus on hackathons or building products?",
replies: [
{ content: "Hackathons are good for networking." },
{ content: "But building a real product matters more." }
]
},

{
content: "Which incubators are best for AI startups in India?",
replies: [
{ content: "IIT Madras incubation is very strong in deep tech." },
{ content: "T-Hub Hyderabad is also great." }
]
},

{
content: "How early should founders approach angel investors?",
replies: [
{ content: "Usually after you have a working prototype." },
{ content: "Angels invest in teams more than ideas." }
]
},

{
content: "How should co-founder equity be split in early startups?",
replies: [
{ content: "Equal split works if commitment is similar." },
{ content: "Use a vesting schedule to protect everyone." }
]
},

{
content: "How realistic is getting into Y Combinator for Indian founders?",
replies: [
{ content: "Very competitive but not impossible." },
{ content: "Strong traction helps a lot." }
]
},

{
content: "Are government startup grants worth the effort?",
replies: [
{ content: "Yes for early prototype funding." },
{ content: "But be ready for longer approval timelines." }
]
},

{
content: "How do founders validate product-market fit early?",
replies: [
{ content: "Talk to users before building anything." },
{ content: "Try landing pages or small pilots." }
]
},

{
content: "Do incubators accept startups without incorporation?",
replies: [
{ content: "Yes many do." },
{ content: "They often help you incorporate after selection." }
]
},

{
content: "What traction do accelerators usually expect?",
replies: [
{ content: "Some early users or strong growth signals." },
{ content: "At least a working product." }
]
},

{
content: "Is it possible to raise funding with only an idea?",
replies: [
{ content: "Rare but possible with strong founders." },
{ content: "Usually investors want prototype validation." }
]
},

{
content: "What are the biggest mistakes first-time founders make?",
replies: [
{ content: "Building without talking to users." },
{ content: "Spending too much time on pitch decks." }
]
},

{
content: "How important is domain expertise for founders?",
replies: [
{ content: "It helps build credibility with investors." },
{ content: "But strong learning ability matters too." }
]

}

];

async function seedDatabase() {

try {

await CommunityPost.deleteMany();

await CommunityPost.insertMany(seedPosts);

console.log("Community posts seeded successfully");

mongoose.connection.close();

} catch(error) {

console.log(error);

}

}

seedDatabase();