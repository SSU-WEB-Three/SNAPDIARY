const mongoose = require('mongoose');

const KeywordSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  keyword: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD 형태
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Keyword', KeywordSchema);
