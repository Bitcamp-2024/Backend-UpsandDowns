require('dotenv').config()
const express = require('express');
const app = express();
const moongoose = require("mongoose")
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require("bcrypt")
const saltRounds = 10
const session = require("cookie-session")
const models = require("./schemas");
const cookieSession = require('cookie-session');
const uniqid = require("uniqid")


moongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log("Connected to MongoDB Database")

    const port = 80;
    const options = {
        origin: '*',
        methods: ['GET', 'POST', 'DELETE']
    };
    
    app.use(cors(options));
    app.use(express.json())
    app.use(cookieSession({
        name: "session",
        secret: "verysecretpassword",
        maxAge: 24 * 60 * 60 * 60000
    }))
    app.use(helmet());
    app.use(morgan('combined'));
    
    
    app.get('/get', (req, res) => {
        //Send Generated Vue App here
    })
    
    
    app.get('/data', (req, res) => {
        const stock = req.query['q'] || null;
        if (stock === null) {
            res.send('stock not found', 404); // stock not provided
            return;
        }
        res.send(`stock found: ${stock}`, 200); // stock was found
    });
    
    //Signup Endpoint
    app.post('/signup', (req, res) => {
        console.log(req.body)
        if(Object.keys(req.body).length === 0) {
            res.json({
                errorCode: 2,
                error: "No Username or Password Provided"
            })
        } else if(!req.body.username) {
            res.json({
                errorCode: 1,
                error: "No Username provided"
            })
        } else if(!req.body.password) {
            res.json({
                errorCode: 1,
                error: "No Password provided"
            })
        } else if(!req.body.name) {
            res.json({
                errorCode: 1,
                error: "No Name provided"
            })
        } else {
            //Check if Username has been taken
            models.User.findOne({username: req.body.username}).exec().then((err, user) => {
                if(err || user) {
                    if(err) {
                        res.json({
                            errorCode: 2,
                            error: "This username may have been taken I have no clue"
                        })
                    }

                    res.json({
                        errorCode: 1,
                        error: "Username already taken"
                    })
                } else {
                    //Set up User in Database
                    bcrypt.genSalt(saltRounds).then((salt) => {
                        return bcrypt.hash(req.body.password, saltRounds)
                    }).then((hashed) => {
                        return models.User.create({
                            name: req.body.name,
                            username: req.body.username,
                            hashPassword: hashed,
                            joinDate: Date.now(),
                            watchList: []
                        })
                    }).then((user) => {
                        res.json({
                            success: `Created user @${req.body.username}`,
                            redirect: "/login",
                        })
                    }).catch((error) => {
                        console.log(error)
                        res.json({
                            errorCode: 1,
                            error: "Something Horrible Happened Along the Lines idk"
                        })
                    })
                }
            })
        }
    });


    //Login Endpoint
    app.post('/login', (req, res) => {
        if(Object.keys(req.body).length === 0) {
            res.json({
                errorCode: 2,
                error: "No Username or Password Provided"
            })
        } else if(!req.body.username) {
            res.json({
                errorCode: 2,
                error: "No Username provided"
            })
        } else if(!req.body.password) {
            res.json({
                errorCode: 2,
                error: "No Password provided"
            })
        } else {
            //Check if User Already has a session
            console.log(req.body)
            models.User.findOne({username: req.body.username}).exec().then((user) => {
                console.log(user)

                if(!user) {
                    if(!user) {
                        res.json({
                            errorCode: 2,
                            error: "This is not username related"
                        })
                    }

                    res.json({
                        errorCode: 2,
                        error: "Username not Found"
                    })
                } else {
                    bcrypt.compare(req.body.password, user.hashPassword).then((isCorrect) => {

                        if(!isCorrect) {
                            res.json({
                                errorCode: 2,
                                error: "Password is incorrect"
                            })
                            return;
                        }


                        //Look for session for a User
                        models.Session.findOne({username: user.username}).exec().then((err, session) => {
                            if(err) {
                                    res.json({
                                        errorCode: 2,
                                        error: "Something bad happened RAA"
                                    })
                            } else {
                                if(session) {
                                    //If user already has session
                                    res.json({
                                        success: `session already found for user @${req.body.username}`,
                                        redirect: "/",
                                    })
                                } else {
                                    let sessionID = uniqid();

                                    //Create session
                                    req.session.profile = {
                                        name: user.name,
                                        username: user.username,
                                        joinDate: user.joinDate,
                                        sessionID: sessionID
                                    }

                                    models.Session.create({
                                        username: user.username,
                                        sessionID: sessionID,
                                        createDate: Date.now()
                                    }).then((session) => {
                                        res.json({
                                            success: `Login succesful user @${req.body.username}`,
                                            redirect: "/",
                                        })
                                    }).catch((error) => {
                                        res.json({
                                            erroCode: 2,
                                            error: "Something bad happened while trying to create a session"
                                        })
                                    })
                                }
                            }
                        })
                    })
                }
            })
        }
    })

    app.post("/logout", (req, res) => {
        //Implement log out here
    })
    
    app.listen(port, () => {
        console.log(`HTTP Server listening on port ${port}`);
    });
}).catch((error) => {
    console.log(error)
})