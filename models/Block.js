const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
    user_id : {type: String, required:true },
    page_id : {type: String, required:true },
    shape_type : {type: String, required:true },
    position : {
        x: { type: Number, required: true},
        y: { type: Number, required: true}
     },
     rotation: {type: Number, required: true },
     created_at: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Block', blockSchema);