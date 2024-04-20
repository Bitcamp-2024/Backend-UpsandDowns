const express = require('express');
const app = express();
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const port = 80;
const options = {
    origin: '*',
    methods: ['GET', 'POST']
};

app.use(cors(options));
app.use(helmet());
app.use(morgan('combined'));


app.get('/data', (req, res) => {
    res.send('hello there!');
});

app.listen(port, () => {
    console.log(`API listening on port ${port}`);
});