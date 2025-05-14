const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log("MongoDB 연결 시도 중...");
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error('MONGO_URI 환경 변수가 설정되지 않았습니다.');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('MongoDB 연결 성공');
  } catch (err) {
    console.error('MongoDB 연결 실패:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
