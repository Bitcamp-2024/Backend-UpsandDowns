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
const yahooFinance = require('yahoo-finance2').default;
const path = require('path');
const spawn = require("child_process").spawn;

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
    app.use('/assets', express.static('assets'));
    
    
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    })
    
    
    app.get('/data', (req, res) => {
        const stock = req.query['q'] || null;
        if (stock === null) {
            res.send('stock not found', 404); // stock not provided
            return;
        }
        res.send(`stock found: ${stock}`, 200); // stock was found
    });

    // Stock fetch endpoint
    app.get("/stock/:id", (req, res) => {
        const query = req.params['id'];
        const date = new Date();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        if (month < 10) {
            month = '0' + month;
        } else {
            month = '' + month;
        }
        if (day < 10) {
            day = '0' + day;
        } else {
            day = '' + day;
        }
        const queryOptions = { period1: `${date.getFullYear() - 5}-${month}-${day}` };
        Promise.resolve(yahooFinance.chart(query, queryOptions))
        .then(response => res.json({
            message: 'Sending data back',
            data: response
        }))
        .catch(_e => {
            res.json({
                message: 'Invalid stock symbol',
                error: true,
                data: null
            })
        });
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
                            error: "Username already taken"
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
                                        sessionID: sessionID,
                                        watchList: [],
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
                                            errorCode: 2,
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

    //Logout endpoint
    app.post("/logout", (req, res) => {
        if(Object.keys(req.session).length === 0) { 
            res.json({
                message: "Not logged in",
                redirect: "/login"
            })
        } else {
            models.Session.deleteOne({sessionID: req.session.profile.sessionID}).then(function(err) {
                req.session = null
                res.json({
                    message: "Logged out goodbye",
                    redirect: "/"
                })
            })
        }
    })

    //User endpoint
    app.get("/user", (req, res) => {
        if(req.session.profile) {
            res.json({
                success: `User found for ${req.session.profile.username}`,
                body: req.session.profile
            })
        } else {
            res.json({
                errorCode: 3,
                error: "User not found"
            })
        }
    })


    //User watchlist update endpoint
    app.post("/userupdate", async (req, res) => {
        if(Object.keys(req.session.profile).length > 0) {
            if(req.body.ticker) {
                try {
                    let watchListObject = {stockTicker: req.body.ticker, DateAdded: Date.now()}
                    const user = await models.User.findOne({ username: req.session.profile.username });
                    if (!user) {
                        res.json({
                            errorCode: 4,
                            error: "User not found"
                        })
                        return;
                    }
                    if (user.watchList.some(item => item.stockTicker === watchListObject.stockTicker)) {
                        res.json({
                            errorCode: 5,
                            error: "Item with this ticker symbol already in watch list"
                        });
                        return;
                    }
                    const updatedUser = await models.User.findOneAndUpdate(
                        { username: req.session.profile.username },
                        { $addToSet: { watchList: watchListObject } },
                        { new: true } // This option returns the updated document
                    );
                    let old = req.session.profile
                    req.session.profile = {
                        name: updatedUser.name,
                        username: updatedUser.username,
                        joinDate: updatedUser.joinDate,
                        sessionID: old.sessionID,
                        watchList: updatedUser.watchList,
                    }
                    res.json({
                        success: `Succesfully updated for ${req.session.profile.username}`,
                        redirect: "/"
                    });
                } catch (e) {
                    res.json({
                        errorCode: 4,
                        error: "Error while trying to add to watchlist"
                    })
                    return;
                }
            } else {
                res.json({
                    errorCode: 3,
                    error: "Ticker not found"
                })
            }
        } else {
            res.json({
                errorCode: 3,
                error: "User not found"
            })
        }
    })

    //ML Endpoint
    app.post("/runmodel", (req, res) => {
        if(!req.body.ticker /* ||  !req.session.profile */) {
            res.json({
                errorCode: 5,
                error: "No ticker found or user"
            })
            return;
        }

        try {

            let ticker = req.body.ticker;
            let pythonProcess = spawn("python", ["./UporDown.py", ticker])

            let ListnerStdout = (data) => {
                res.json({
                    success: "Model runned succesfully",
                    body: data.toString(),
                })
            }
            pythonProcess.stdout.once("data", ListnerStdout)

        } catch (e) {
            res.json({
                errorCode: 100,
                message : 'Model failed. Please try again later.'
            });
        }

        // pythonProcess.stderr.once("data", (data) => {
        //     res.json({
        //         errorCode: 100,
        //         error: "Idk python messed up"
        //     })
        //     pythonProcess.removeAllListeners('data');
        // })
    })
    
    app.listen(port, () => {
        console.log(`HTTP Server listening on port ${port}`);
    });
}).catch((error) => {
    console.log(error)
})