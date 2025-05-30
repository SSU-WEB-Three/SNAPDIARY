const mongoose = require('mongoose');

const DiaryEntrySchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  date: { type: String, required: true }, // yyyy-mm-dd
  title: { type: String, required: true },
  generated: { type: Boolean, default: false } 
}, { timestamps: true });

module.exports = mongoose.model('DiaryEntry', DiaryEntrySchema);
