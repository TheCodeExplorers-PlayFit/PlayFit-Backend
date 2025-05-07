const Injury = require('../models/injury.model');

exports.createInjury = async (req, res) => {
  try {
    const injury = await Injury.create(req.body);
    res.status(201).json({ success: true, data: injury });
  } catch (err) {
    console.error('Create injury failed:', err);
    res.status(500).json({ success: false, message: 'Failed to create injury' });
  }
};