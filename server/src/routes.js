const express = require('express');
const axios = require('axios');
const Transaction = require('./models'); // Ensure this points to your actual model
const router = express.Router();

const monthMap = {
    january: 0, february: 1, march: 2, april: 3,
    may: 4, june: 5, july: 6, august: 7,
    september: 8, october: 9, november: 10, december: 11,
};

// Helper function to get start and end dates for the month
const getStartEndDate = (month) => {
    const monthIndex = monthMap[month];
    const startDate = new Date(new Date().getFullYear(), monthIndex, 1);
    const endDate = new Date(new Date().getFullYear(), monthIndex + 1, 0);
    return { startDate, endDate };
};

router.get('/', async (req, res) => {
    res.send("Homepage");
});

// Initialize database with seed data
router.get('/initialize', async (req, res) => {
    try {
        const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
        const transactions = response.data.map(item => ({
            title: item.title,
            description: item.description,
            price: item.price,
            dateOfSale: new Date(item.dateOfSale),
            category: item.category,
        }));
        await Transaction.insertMany(transactions);
        res.status(200).json({ message: 'Database initialized successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to initialize database', error: error.message });
    }
});

// List transactions with search and pagination
router.get('/transactions', async (req, res) => {
    const { page = 1, perPage = 10, search = '' } = req.query;
    const query = {
        $or: [
            { title: new RegExp(search, 'i') },
            { description: new RegExp(search, 'i') },
            { price: search ? parseFloat(search) : { $exists: true } },
        ],
    };

    try {
        const transactions = await Transaction.find(query)
            .skip((page - 1) * perPage)
            .limit(perPage);
        const total = await Transaction.countDocuments(query);
        res.json({ transactions, total });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve transactions', error: error.message });
    }
});

// Get statistics for a specific month
router.get('/statistics/:month', async (req, res) => {
    const month = req.params.month.toLowerCase();
    if (!monthMap[month]) return res.status(400).json({ message: 'Invalid month' });

    const { startDate, endDate } = getStartEndDate(month);

    try {
        const soldItems = await Transaction.countDocuments({ dateOfSale: { $gte: startDate, $lte: endDate } });
        const totalSales = await Transaction.aggregate([
            { $match: { dateOfSale: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: null, total: { $sum: "$price" } } },
        ]);
        const notSoldItems = await Transaction.countDocuments({ dateOfSale: { $lt: startDate } });

        res.json({
            totalSales: totalSales[0]?.total || 0,
            soldItems,
            notSoldItems,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve statistics', error: error.message });
    }
});

// Bar Chart Data
router.get('/bar-chart/:month', async (req, res) => {
    const month = req.params.month.toLowerCase();
    if (!monthMap[month]) return res.status(400).json({ message: 'Invalid month' });

    const { startDate, endDate } = getStartEndDate(month);
    const priceRanges = [
        { range: '0-100', count: 0 },
        { range: '101-200', count: 0 },
        { range: '201-300', count: 0 },
        { range: '301-400', count: 0 },
        { range: '401-500', count: 0 },
        { range: '501-600', count: 0 },
        { range: '601-700', count: 0 },
        { range: '701-800', count: 0 },
        { range: '801-900', count: 0 },
        { range: '901-above', count: 0 },
    ];

    try {
        const transactions = await Transaction.find({ dateOfSale: { $gte: startDate, $lte: endDate } });

        transactions.forEach(transaction => {
            const price = transaction.price;
            if (price <= 100) priceRanges[0].count++;
            else if (price <= 200) priceRanges[1].count++;
            else if (price <= 300) priceRanges[2].count++;
            else if (price <= 400) priceRanges[3].count++;
            else if (price <= 500) priceRanges[4].count++;
            else if (price <= 600) priceRanges[5].count++;
            else if (price <= 700) priceRanges[6].count++;
            else if (price <= 800) priceRanges[7].count++;
            else if (price <= 900) priceRanges[8].count++;
            else priceRanges[9].count++;
        });

        res.json(priceRanges);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve bar chart data', error: error.message });
    }
});

// Pie Chart Data
router.get('/pie-chart/:month', async (req, res) => {
    const month = req.params.month.toLowerCase();
    if (!monthMap[month]) return res.status(400).json({ message: 'Invalid month' });

    const { startDate, endDate } = getStartEndDate(month);

    try {
        const categories = await Transaction.aggregate([
            { $match: { dateOfSale: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
        ]);

        res.json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve pie chart data', error: error.message });
    }
});

// Combined Data
router.get('/combined/:month', async (req, res) => {
    const month = req.params.month.toLowerCase();
    if (!monthMap[month]) return res.status(400).json({ message: 'Invalid month' });

    try {
        const statistics = await getStatistics(month);
        const barChart = await getBarChart(month);
        const pieChart = await getPieChart(month);

        res.json({
            statistics,
            barChart,
            pieChart,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve combined data', error: error.message });
    }
});

// Helper functions for the combined route
const getStatistics = async (month) => {
    const { startDate, endDate } = getStartEndDate(month);
    const soldItems = await Transaction.countDocuments({ dateOfSale: { $gte: startDate, $lte: endDate } });
    const totalSales = await Transaction.aggregate([
        { $match: { dateOfSale: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: "$price" } } },
    ]);
    const notSoldItems = await Transaction.countDocuments({ dateOfSale: { $lt: startDate } });

    return {
        totalSales: totalSales[0]?.total || 0,
        soldItems,
        notSoldItems,
    };
};

const getBarChart = async (month) => {
    const { startDate, endDate } = getStartEndDate(month);
    const priceRanges = [
        { range: '0-100', count: 0 },
        { range: '101-200', count: 0 },
        { range: '201-300', count: 0 },
        { range: '301-400', count: 0 },
        { range: '401-500', count: 0 },
        { range: '501-600', count: 0 },
        { range: '601-700', count: 0 },
        { range: '701-800', count: 0 },
        { range: '801-900', count: 0 },
        { range: '901-above', count: 0 },
    ];

    const transactions = await Transaction.find({ dateOfSale: { $gte: startDate, $lte: endDate } });

    transactions.forEach(transaction => {
        const price = transaction.price;
        if (price <= 100) priceRanges[0].count++;
        else if (price <= 200) priceRanges[1].count++;
        else if (price <= 300) priceRanges[2].count++;
        else if (price <= 400) priceRanges[3].count++;
        else if (price <= 500) priceRanges[4].count++;
        else if (price <= 600) priceRanges[5].count++;
        else if (price <= 700) priceRanges[6].count++;
        else if (price <= 800) priceRanges[7].count++;
        else if (price <= 900) priceRanges[8].count++;
        else priceRanges[9].count++;
    });

    return priceRanges;
};

const getPieChart = async (month) => {
    const { startDate, endDate } = getStartEndDate(month);
    return await Transaction.aggregate([
        { $match: { dateOfSale: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
};

module.exports = router;
