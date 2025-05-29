const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  useremail: { type: String, required: true, unique: true },
  userpassword: { type: String, required: true },
  username: { type: String, required: true },
  userphone: { type: String, required: true },
  usernickname: { type: String, required: true },
  userbirth: { type: String, required: true },
  profileImage: { type: String, default: '/uploads/default.png' }
});

module.exports = mongoose.model('account', accountSchema);