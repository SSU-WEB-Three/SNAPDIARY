// dotenv를 최상단에서 한 번만 호출
const dotenv = require('dotenv');
dotenv.config();  

const express = require('express');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');
const connectDB = require('./config/db');  
const bodyParser = require('body-parser');

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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true }));

// 기본 라우터
app.get('/', (req, res) => {
    res.render('pages/index', { title: '메인 화면' });
});


app.get('/blockui', (req, res) => {
    res.render('pages/blockui', { title: '블록 페이지' });
});

app.get('/mypage', (req, res) => {
    res.render('pages/mypage', { title: '마이 페이지' });
});

app.get('/login', (req, res) => {
    res.render('pages/login', { layout: false });
});

app.get('/register', (req, res) => {
    res.render('pages/register', { layout: false });
});

app.get('/register/success', (req, res) => {
    res.render('pages/register-success', { layout: false });
});

app.post('/register', (req, res) => {
    res.redirect('/register/success');
});

app.post('/login', (req, res) => {
    res.redirect('/');
});

app.post('/save-blocks',(req, res) => {
    const blockList = req.body;

    if(!Array.isArray(blockList)) {
        return res.status(400).send('데이터 형식 오류:배열이 아닙니다.');
    }

    mydb.collection('blocks').insertMany(blockList)
     .then(result => {
        console.log('블록 저장 완료: ', result.insertedCount, '개');
        res.status(200).send('블록 저장 성공!');
     })
     .catch(err => {
        console.error('블록 저장 오류: ', err);
        res.status(500).send('블록 저장 실패');
     });
});


// 서버 시작
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});

//open Ai Api
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/api/keyword-extract", async (req, res) => {
    const userText = req.body.text;

    const prompt = `
"${userText}"

위 문장에서 가장 핵심적인 하나의 키워드만 한국어로 정확히 추출해서 출력해 주세요.
오직 키워드 한 단어만 출력해주세요. 부가 설명, 문장 없이 단어 하나만 반환하세요.
    `.trim();

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "user", content: prompt }
            ],
            max_tokens: 10,
            temperature: 0.3
        });

        const keyword = completion.choices[0].message.content.trim();
        res.json({ keyword });
    } catch (err) {
        console.error("OpenAI 오류:", err.message);
        res.status(500).json({ error: "OpenAI 처리 실패" });
    }
});

