const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BlockMapSchema = new mongoose.Schema({
  map_id: { type: String, required: true },
  block_id: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Block' }],
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'account' },
  created_at: { type: Date, default: Date.now }
});


module.exports = mongoose.model('BlockMap', BlockMapSchema);
