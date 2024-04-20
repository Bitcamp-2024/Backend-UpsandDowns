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
const models = require("./schemas")


moongoose.connect(process.env.MONGODB_URI).then(() => {
        
})

const port = 80;
const options = {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
};

app.use(cors(options));
app.use(express.json())
app.use(helmet());
app.use(morgan('combined'));


app.get('/get', (req, res) => {
    //Send Generated Vue App here
})


app.get('/data', (req, res) => {
    const stock = req.query['q'] || null;
    if (stock === null) {
        res.send('stock not found', 404); // stock not provided
    }
    res.send(`stock found: ${stock}`, 200); // stock was found
});

app.post('/signup', (req, res) => {
    if(Object.keys(req.body) === 0) {
        res.json({
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
        models.User.findOne({username: req.body.username}).exec().then((found) => {
            if(found) {
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
                        hashPassword: req.body.password,
                        joinDate: Date.now(),
                        watchList: []
                    })
                }).then()
            }
        })
    }
});

app.listen(port, () => {
    console.log(`HTTP Server listening on port ${port}`);
});