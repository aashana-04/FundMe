const mongoose = require("mongoose");
const Resource = require("./models/Resource");

mongoose.connect("mongodb+srv://aashanajuly04_db_user:FundMe123@cluster0.hdqkvm7.mongodb.net/?appName=Cluster0");

const resources = [

{
title: "Y Combinator Startup School",
description: "Free online course covering validation, product development, and fundraising fundamentals",
category: "Startup Fundamentals",
link: "https://www.startupschool.org"
},

{
title: "Paul Graham Essays",
description: "Foundational reading on startups, product-market fit and founder dynamics",
category: "Startup Fundamentals",
link: "http://paulgraham.com/articles.html"
},

{
title: "The Lean Startup (Eric Ries)",
description: "Systematic approach to hypothesis testing and validated learning",
category: "Startup Fundamentals",
link: "https://theleanstartup.com"
},

{
title: "How to Start a Startup (Stanford)",
description: "Stanford lecture series on building scalable ventures",
category: "Startup Fundamentals",
link: "https://startupclass.samaltman.com"
},

{
title: "The Mom Test",
description: "How to conduct effective customer interviews",
category: "Product Validation",
link: "http://momtestbook.com"
},

{
title: "Continuous Discovery Habits",
description: "Framework for ongoing product discovery",
category: "Product Validation",
link: "https://www.producttalk.org"
},

{
title: "Jobs To Be Done Framework",
description: "Understanding customer motivations and product usage",
category: "Product Validation",
link: "https://jobs-to-be-done.com"
},

{
title: "First Round Review",
description: "Tactical articles on validation, hiring, and early-stage execution",
category: "Product Validation",
link: "https://review.firstround.com"
},

{
title: "Startup India Portal",
description: "Official documentation on DPIIT recognition and tax exemptions",
category: "Grants & Policy Literacy",
link: "https://startupindia.gov.in"
},

{
title: "DPIIT Annual Reports",
description: "Policy updates and program statistics",
category: "Grants & Policy Literacy",
link: "https://dpiit.gov.in"
},

{
title: "DST Innovation Programs",
description: "NIDHI, Prayas and other grant programs",
category: "Grants & Policy Literacy",
link: "https://dst.gov.in"
},

{
title: "State Startup Policies",
description: "Startup programs from Karnataka, Maharashtra and Telangana",
category: "Grants & Policy Literacy",
link: "https://startup.karnataka.gov.in"
},

{
title: "Venture Deals (Brad Feld)",
description: "Understanding term sheets and venture capital mechanics",
category: "Fundraising",
link: "https://www.venturedeals.com"
},

{
title: "Sequoia Capital Pitch Deck Guide",
description: "Pitch deck templates and financial modeling",
category: "Fundraising",
link: "https://www.sequoiacap.com/article/writing-a-business-plan"
},

{
title: "India Angel Network Resources",
description: "Angel investment documentation and guidance",
category: "Fundraising",
link: "https://www.indiaangelnetwork.com"
},

{
title: "SAFE Financing Documents",
description: "Alternative funding structure used by YC startups",
category: "Fundraising",
link: "https://www.ycombinator.com/documents"
},

{
title: "MCA Portal",
description: "Official company incorporation documentation",
category: "Legal & Compliance",
link: "https://www.mca.gov.in"
},

{
title: "Companies Act 2013",
description: "Statutory framework for private limited companies",
category: "Legal & Compliance",
link: "https://www.mca.gov.in/content/mca/global/en/acts-rules/companies-act.html"
},

{
title: "FEMA Regulations",
description: "Foreign investment compliance guidelines",
category: "Legal & Compliance",
link: "https://www.rbi.org.in"
},

{
title: "Startup Tax Planning",
description: "Section 80-IAC and ESOP taxation frameworks",
category: "Legal & Compliance",
link: "https://www.incometax.gov.in"
}

];

async function seed(){

 await Resource.deleteMany();

 await Resource.insertMany(resources);

 console.log("Resources seeded");

 mongoose.connection.close();

}

seed();