const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BlockSchema = new Schema({
  keyword_id: { type: Schema.Types.ObjectId, ref: 'Keyword', required: false },
  shape_type: { type: String, required: true },
  color: { type: String, default: '#FFA500' },
  x_pos: { type: Number, required: true },
  y_pos: { type: Number, required: true },
  rotation_degree: { type: Number, default: 0 },
  scale: { type: Number, default: 1 }, 
  tag: { type: String, default: '' },
  user_id: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Block', BlockSchema);