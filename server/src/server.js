const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const routes = require('./routes');
const cors = require('cors');


const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use('/api', routes); // Ensure all routes are prefixed with /api

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/product_transactions', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Database connection error:', err);
});
