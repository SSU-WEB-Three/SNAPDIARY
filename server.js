// dotenv를 최상단에서 한 번만 호출
const dotenv = require('dotenv');
dotenv.config();  

const express = require('express');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');
const connectDB = require('./config/db');  

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB 연결
connectDB();

// EJS 설정
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(expressLayouts);
app.set('layout', './layouts/main');

// 미들웨어 설정
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 기본 라우터
app.get('/', (req, res) => {
    res.render('pages/index', { title: '메인 화면' });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
