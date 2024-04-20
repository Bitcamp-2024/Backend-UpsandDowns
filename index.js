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
    const stock = req.query['q'] || null;
    if (stock === null) {
        res.send('stock not found', 404); // stock not provided
    }
    res.send(`stock found: ${stock}`, 200); // stock was found
});

app.listen(port, () => {
    console.log(`API listening on port ${port}`);
});