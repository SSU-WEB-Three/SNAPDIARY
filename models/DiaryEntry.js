const mongoose = require('mongoose');

const DiaryEntrySchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  date: { type: String, required: true },
  title: { type: String, required: true },
  generated: { type: Boolean, default: false },
  imageUrl: { type: String }
}, { timestamps: true });


module.exports = mongoose.model('DiaryEntry', DiaryEntrySchema);
