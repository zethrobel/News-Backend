//using node modulles installed using npm

require('dotenv').config()
const express = require("express")
const mongoose = require("mongoose")
const bodyParser = require("body-parser")
const cors = require("cors")
const session= require("express-session")
const passport= require("passport")
const passportLocalMongoose=require("passport-local-mongoose")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const FacebookStrategy = require("passport-facebook").Strategy
const GitHubStrategy = require("passport-github2").Strategy
const findOrCreate=require("mongoose-findorcreate")
const _=require("lodash")
const NewsAPI = require("newsapi")
const newsapi = new NewsAPI(process.env.API_KEY)
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: ["https://news-robel.vercel.app"], // Update with your frontend URL
    credentials: true // Allow credentials to be shared
}));

app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.use(bodyParser.urlencoded({extended: true}))

 
app.use(session({
    secret: process.env.MY_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure flag in production
        maxAge: 30 * 60 * 1000 // Session expiry time
    }
}));
const options = {
httpOnly: true ,
secure: true,
sameSite: 'none',
domain: 'news-backend-sj97.onrender.com',

}
 

app.use(passport.initialize())        //passport
app.use(passport.session())           //passport 
 
 
 function handleError(err) { 
       console.error("Database connection error:", err); 
       // You can add more logic here, like logging to a file or sending an error email. 
} 

//Database initialliazation
mongoose
    .set("strictQuery", false)
    .connect(`${process.env.MY_DB}/newsUsersDB`)
   // .set("useCreateIndex",true)  //to avoid deprecation warnings
    .then(console.log("Database connected successfully"))
    .catch(err => handleError(err))


   //Headlines Schema     
const headlinesSchema = new mongoose.Schema({
        headlineCatagory: String,
        headlinesTitle: String,
        headlinesContent: String,
        headlinesDescription: String,
        headlinesUrl: String,
        headlinesUrlToImage: String,
        headlinesAuthor: String,
        headlinesPublishedAt: String,
        headlinesSource: Object
        }) 

   //Everything Schema
const everythingSchema = new mongoose.Schema({
        everythingCatagory:String,
        everythingContent:String,
        everythingTitle:String,
        everythingDescription:String,
        everythingUrl: String,
        everythingUrlToImage: String,
        everythingAuthor: String,
        everythingPublishedAt:String,
        everythingSource: Object
        })


    //news users schema
const newsusersSchema = new mongoose.Schema({
        username: String, 
        password: String, 
        googleId: String, 
        facebookId: String, 
        githubId: String,
        headlines: [headlinesSchema],
        everything: [everythingSchema]
        })

newsusersSchema.plugin(passportLocalMongoose)  //pluging in passport-local-mongoose
newsusersSchema.plugin(findOrCreate)  //pluging findOrCreate   

//  Models
const HeadlinesModel = mongoose.model("Headline",headlinesSchema)
const EverythingModel = mongoose.model("Everything",everythingSchema) 
const NewsUser = mongoose.model("News User", newsusersSchema)

passport.use(NewsUser.createStrategy())
// passport.serializeUser(NewsUser.serializeUser())        // create cookies
// passport.deserializeUser(NewsUser.deserializeUser())    //Destruct cookies

passport.serializeUser(function(user, cb) {   // Serialize user for session globally
  process.nextTick(function() {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture
    });
  });
});

passport.deserializeUser(function(user, cb) {   // Deserialize user for session globally
  process.nextTick(function() {
    return cb(null, user);
  });
});




//Google strategy

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://news-backend-sj97.onrender.com/auth/google/home",
    userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo"   //for deprecation warning
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile.id, profile.displayName)
    NewsUser.findOrCreate({ googleId: profile.id, username:profile.displayName }, function (err, user) {
         return cb(err, user);
    });
  }
));

//Facebook strategy

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:5000/auth/facebook/home",
   
  },
  function(accessToken, refreshToken, profile, cb) {
     console.log(profile.id, profile.displayName)
    NewsUser.findOrCreate({ facebookId: profile.id, username:profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));


// Github Strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://127.0.0.1:5000/auth/github/home"
  },
  function(accessToken, refreshToken, profile, done) {
     console.log(profile.id, profile.displayName)
    NewsUser.findOrCreate({ githubId: profile.id, username: profile.displayName }, function (err, user) {
      return done(err, user);
    });
  }
));



//REST api for GET and POST for Signup route

app
    .route("/signup")
    .get(function (req, res) { //to Read information
    
        NewsUser
            .find()
            .then(function (foundUser) {
                res.json(foundUser)
            })
            .catch(err => console.log(err))
        })
    .post(function (req, res) { // to write information
        
        

        NewsUser.register({username:req.body.username},req.body.password,function(err,user){
            if(err){
                console.log(err)
                 // Instead of redirecting, send back an error response
                  return res.status(400).json({ error: "User registration failed" });
            }
            else{
               
                passport.authenticate("local")(req,res,function(){
                   // Send back user data or a success message
                   return res.status(201).json({ message: "User registered successfully", user })
                })
            }
        })
    })

//for Home page

app.get("/home", function (req, res) {
    if (req.isAuthenticated()) {
          
        return res
            .status(200)
            .json({message: "Authenticated" }); //user containes the user information
        } else {
        return res
            .status(401)
            .json({error: "Not authenticated"});
    }
});


//Endpoint to get authenticated user profile 

app.get("/profile", function (req, res) {
    if (req.isAuthenticated()) {
        // Send back the user data that you want to share with the frontend
        const userData = {
            username:req.user.username,
            id: req.user.id
            };
        console.log(userData)
        return res.status(200).json(userData);
    } else {
        return res.status(401).json({ error: "Not authenticated" });
    }
});


//google routes

app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));
app.get("/auth/google/home", 
    passport.authenticate("google", { failureRedirect: "/signin" }), 
    function(req, res) {
        // If authentication succeeded, we will reach here; redirect to the home page
        res.redirect("https://news-fo5v.onrender.com/home"); 
     }
);

//facebook routes

app.get("/auth/facebook",
  passport.authenticate("facebook"));

app.get("/auth/facebook/home",
  passport.authenticate("facebook", { failureRedirect: "/signin" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("http://localhost:3000/home");
  });


//Github routes 

app.get("/auth/github",
  passport.authenticate("github", { scope: [ "user:email" ] }));

app.get("/auth/github/home", 
  passport.authenticate("github", { failureRedirect: "/signin" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("http://localhost:3000/home");
  });

// Log Out

app.get("/logout", function (req, res) {
    req.logOut(
        function (err) { //the logout function deauthenticate the user, then the cockie disappear
            if (err) {
                console.log(err)
            } else {
                res.redirect("http://localhost:3000")
                
            }
        }
    )

})

//   Post Routes


app.post("/signin", function(req, res) {
    const user = new NewsUser({  // define the user
        username: req.body.username,
        password: req.body.password
    });

    // Try to authenticate with the given user
    passport.authenticate("local", function(err, user, info) {
        if (err) {
           
            return res.status(500).json({ error: "Internal server error" }) // Handle server error
        }
        if (!user) {
            
            return res.status(401).json({ error: "Invalid credentials" }) // Invalid login
        }
        req.logIn(user, function(err) {
            if (err) {
                return res.status(500).json({ error: "Internal server error" });
            }
            return res.status(200).json({ message: "User logged in successfully", user })
        });
    })(req, res);

})

// for the headlines


app.get("/headlines", function(req, res) {
    
    newsapi.v2.topHeadlines({ language: 'en' }) // Add required params
        .then(response => {
            return res.status(200).json(response);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" });
        });
});

app.post("/headlines", function(req, res) {
     if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" }); // Handle unauthenticated access
    }
    newsapi.v2.topHeadlines({ category: req.body.searchHeadlines, language: 'en' })
           
         .then((response) => {
            console.log(req.body.searchHeadlines)
            console.log(response)

            const userId = req.user.id; // identifying current user's id 

            const saveHeadlinesPromises = response.articles.map(async article => {
                let newHeadline = new HeadlinesModel({
                    headlineCatagory: _.capitalize(req.body.searchHeadlines),
                    headlinesTitle: article.title,
                    headlinesContent: article.content,
                    headlinesDescription: article.description,
                    headlinesUrl: article.url,
                    headlinesUrlToImage: article.urlToImage,
                    headlinesAuthor: article.author,
                    headlinesPublishedAt: article.publishedAt,
                    headlinesSource: article.source
                });

                const savedHeadline = await newHeadline.save()
                return await NewsUser.findByIdAndUpdate(userId, { $push: { headlines: savedHeadline } }, { new: true })
            });

            // Wait for all save and update operations to complete
            Promise.all(saveHeadlinesPromises)
                .then(() => res.status(200).json(response))
                .catch(err => {
                    console.error("Error saving headlines or updating user:", err);
                    return res.status(500).json({ error: "Internal server error" });
                });

        })
        .catch((err) => {
            console.error(err);
            return res.status(500).json({ error: "Internal server error" }); // Handle server error
        });
});



// for the everything

app.get("/everything",function(req,res){

   newsapi.v2.everything({
          language: 'en',
          
          page: 1
          })      
            .then(response => {
            return res.status(200).json(response);
               })
            .catch(err => {
            console.error(err)
            return res.status(500).json({ error: "Internal server error" })
             })
})

app.post("/everything", function(req, res) {
     if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" }); // Handle unauthenticated access
    }
    const date = new Date();
    const month = date.getMonth(); 
    const day = date.getDate(); 
    const year = date.getFullYear();
    
    const formattedDate = `${year}-${month}-${day}`;

      newsapi.v2.everything({
        q: req.body.searchEverything,
        to: formattedDate,
        language: 'en',
        sortBy: 'relevancy, popularity, publishedAt', // Select a single sort method
        page: 1 // You might want to confirm the page number, starting at 1
    })
    .then(response => {
        console.log("Fetched everything response:", response);

        const userId = req.user.id; // identifying current user's id 

        const saveEverythingPromises = response.articles.map(async article => {
            let newEverything = new EverythingModel({
                everythingCatagory: _.capitalize(req.body.searchEverything),
                everythingTitle: article.title,
                everythingContent: article.content,
                everythingDescription: article.description,
                everythingUrl: article.url,
                everythingUrlToImage: article.urlToImage,
                everythingAuthor: article.author,
                everythingPublishedAt: article.publishedAt,
                everythingSource: article.source   
            });

            const savedEverything = await newEverything.save()
            return await NewsUser.findByIdAndUpdate(userId, { $push: { everything: savedEverything } }, { new: true })
        });

        // Wait for all save and update operations to complete
        Promise.all(saveEverythingPromises)
            .then(() => res.status(200).json(response))
            .catch(err => {
                console.error("Error saving everything or updating user:", err);
                return res.status(500).json({ error: "Internal server error" });
            });

    })
    .catch(err => {
        console.error("Error fetching everything with query:", err);
        return res.status(500).json({ error: "Internal server error", message: err.message });
    });
});

app.get("/headlines/history",function(req,res){
    if(!req.isAuthenticated()){
      return res.status(401).json({ error: "Not authenticated" }); // Handle unauthenticated access  
    }

    const userID= req.user.id  //store the user's id
    NewsUser.findById(userID)
            .then(function(data){
             if(!data){
               return res.status(404).json({ error: "User not found" }); 
              }
              
             return res.status(200).json(data.headlines);
             
              }) 
            .catch(function(err) {
                return res.status(500).json({ error: "Internal server error", message: err.message });
             });
             
   })
app.get("/everything/history",function(req,res){
    if(!req.isAuthenticated()){
      return res.status(401).json({ error: "Not authenticated" }); // Handle unauthenticated access    
    }
     const userID= req.user.id  //store the user's id
    NewsUser.findById(userID)
            .then(function(data){
             if(!data){
               return res.status(404).json({ error: "User not found" }); 
              }
              
             return res.status(200).json(data.everything);
             
              }) 
            .catch(function(err) {
                return res.status(500).json({ error: "Internal server error", message: err.message });
             });
})

app.delete("/headlines/history/delete/:id", async function (req, res) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.user.id;
    const headlineId = req.params.id;
    console.log(headlineId);

    try {
        
        const user = await NewsUser.findById(userId);
        
        if (user && user.headlines) {
            // Filter out the headline with the matching headlineId by stringifying the headline._id
            user.headlines = user.headlines.filter(headline => headline._id.toString() !== headlineId);

            await user.save();
            return res.status(200).json({ success: true, message: "Headline deleted successfully" });
        } 
        
        else {
            console.log("User not found or headlines undefined");
            return res.status(404).json({ error: "User or headlines not found" });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });  // Handle database error
    }
});

app.delete("/headlines/history/deleteAll", async function(req, res) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.user.id;
    try {
        // Find the user and get their headlines
        const user = await NewsUser.findById(userId);
        
        if (user) {
            // Clear the headlines array
            user.headlines = []; // or user.headlines.length = 0;
            await user.save();   
            console.log("Success")
            return res.status(200).json({ success: true });
        } else {
            console.log("User not found");
            return res.status(404).json({ error: "User not found" });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});

app.delete("/everything/history/delete/:id", async function (req, res) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.user.id;
    const everythingId = req.params.id;
    console.log(everythingId);

    try {
        
        const user = await NewsUser.findById(userId);
        
        if (user && user.everything) {
            // Filter out the headline with the matching headlineId by stringifying the headline._id
            user.everything = user.everything.filter(evthing => evthing._id.toString() !== everythingId);

            await user.save();
            return res.status(200).json({ success: true, message: "everything deleted successfully" });
        } 
        
        else {
            console.log("User not found or everything undefined");
            return res.status(404).json({ error: "User or everything not found" });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });  // Handle database error
    }
});

 app.delete("/everything/history/deleteAll", async function(req, res) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.user.id;
    try {
        // Find the user and get their headlines
        const user = await NewsUser.findById(userId);
        
        if (user) {
            // Clear the headlines array
            user.everything = []; // or user.headlines.length = 0;
            await user.save();   
            console.log("Success")
            return res.status(200).json({ success: true });
        } else {
            console.log("User not found");
            return res.status(404).json({ error: "User not found" });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});  
 

  
//backend port

app.listen(PORT, function () {
    console.log(`Working on port ${PORT}`)
})