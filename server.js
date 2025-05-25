// dotenv를 최상단에서 한 번만 호출
const dotenv = require('dotenv');
dotenv.config();  

const express = require('express');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');
const connectDB = require('./config/db');  
const mongoose = require('mongoose');


const app = express();
const PORT = process.env.PORT || 3000;

//세션
const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
//몽구스 모델 연결
const Account = require('./models/account');

//bcrypt로 비밀번호 암호화
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const DiaryEntry = require('./models/DiaryEntry');
const Keyword = require('./models/Keyword');
const Block = require('./models/Block');
const BlockMap = require('./models/BlockMap');

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
    res.render('pages/index', { title: '메인 화면', user : req.session.user || null });
    console.log('세션:', req.session)
});


//app.get('/blockui', (req, res) => {
  //  res.render('pages/blockui', { title: '블록 페이지' });
//});

app.get('/mypage', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const user = req.session.user;
  const userId = user ? user.user_id : null; 
  res.render('pages/mypage', {
    title: '마이 페이지',
    user,
    userId
  });
});


app.get('/login', (req, res) => {
    res.render('pages/login', { layout: false, error: null, user : req.session.user || null });
});

app.get('/register', (req, res) => {
    res.render('pages/register', { layout: false, error: null, user : req.session.user || null });
});

app.get('/register/success', (req, res) => {
    res.render('pages/register-success', { layout: false, user : req.session.user || null });
});

app.post('/register', async (req, res) => {
  const { useremail, userpassword, username, userphone, usernickname, userbirth } = req.body;

  //아이디 중복 여부 확인
  try {
    const duplication = await Account.findOne({ useremail });
    if(duplication) {
      return res.render('pages/register', {
        layout: false,
        error: "이미 가입된 이메일입니다."
      });
    }

    const hashedpw = await bcrypt.hash(userpassword, 10);

    await Account.create({
      useremail,
      userpassword : hashedpw,
      username,
      userphone,
      usernickname,
      userbirth
    });
    console.log("회원가입 성공");
    res.redirect('/register/success');
  } catch (err) {
    console.log("회원가입 실패", err.message);
    res.status(500).send("회원가입 실패");
  }
});

app.post('/login', async (req, res) => {
  const { useremail, userpassword } = req.body;

  //아이디, 비밀번호 일치 여부 확인
  try {
    const user = await Account.findOne({ useremail });

    if(!user) {
      return res.render('pages/login', {
        layout: false,
        error: "아이디 또는 비밀번호가 틀렸습니다. 정확하게 입력해 주세요."
      });
    }
    
    const match = await bcrypt.compare(userpassword, user.userpassword);
    if(!match){
      return res.render('pages/login', {
        layout: false,
        error: "아이디 또는 비밀번호가 틀렸습니다. 정확하게 입력해 주세요."
      });
    }

    req.session.user = {
      user_id : user._id,
      useremail : user.useremail,
      username : user.username,
      usernickname : user.usernickname
    };
    res.redirect('/');
  } catch (err) {
    console.log("로그인 에러", err.message);
    res.status(500).send("로그인 중 오류 발생");
  }
});


//로그아웃 시 메인페이지로 이동
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.post('/api/diary/save', async (req, res) => {
  const { user_id, date, title, index } = req.body;

  if (!user_id || !date || !title) {
    return res.status(400).send('필수 값 누락');
  }

  try {
    if (index !== undefined) {
      const entries = await DiaryEntry.find({ user_id, date });
      if (!entries[index]) return res.status(404).send('수정 대상 없음');

      entries[index].title = title;
      await entries[index].save();
    } else {
      await DiaryEntry.create({ user_id, date, title, views: 0 });
    }

    res.send('저장 완료');
  } catch (err) {
    console.error(err);
    res.status(500).send('저장 실패');
  }
});

// 3. 날짜별 일기 불러오기
app.get('/api/diary/:user_id/:date', async (req, res) => {
  try {
    const { user_id, date } = req.params;
    const entries = await DiaryEntry.find({ user_id, date });
    res.json(entries);
  } catch (err) {
    res.status(500).send('불러오기 실패');
  }
});

// 4. 전체 일기 불러오기 (잔디차트용)
app.get('/api/diary-all/:user_id', async (req, res) => {
  try {
    const entries = await DiaryEntry.find({ user_id: req.params.user_id });
    res.json(entries);
  } catch (err) {
    res.status(500).send('전체 불러오기 실패');
  }
});

// 5. 일기 삭제
app.delete('/api/diary/delete', async (req, res) => {
  const { user_id, date, index } = req.body;
  try {
    const entries = await DiaryEntry.find({ user_id, date });
    if (!entries[index]) return res.status(404).send('삭제 대상 없음');

    await DiaryEntry.findByIdAndDelete(entries[index]._id);
    res.send('삭제 완료');
  } catch (err) {
    res.status(500).send('삭제 실패');
  }
});

app.post('/api/blocks', async (req, res) => {
  const blockList = req.body;

  if (!Array.isArray(blockList)) {
    return res.status(400).send('블록 배열이 아님');
  }

  try {
    const savedBlocks = await Block.insertMany(blockList);
    res.status(200).json(savedBlocks); // [{ _id: ..., ... }, ...]
  } catch (err) {
    console.error('블록 저장 실패:', err.message);
    res.status(500).send('블록 저장 실패');
  }
});


//블록 저장
app.post('/save-blocks', async (req, res) => {
  const { blockDataList, map_id, user_id } = req.body;

  if (!Array.isArray(blockDataList) || !map_id || !user_id) {
    return res.status(400).send('필수 값 누락');
  }

  try {
    // 기존 블록 삭제
    await Block.deleteMany({ _id: { $in: (await BlockMap.findOne({ map_id }))?.block_id || [] } });

    // 블록 재생성
    const savedBlockIds = [];
    for (const block of blockDataList) {
      const newBlock = new Block({
        keyword_id: block.keyword_id || null,
        shape_type: block.shape_type,
        color: block.color || '#FFA500',
        x_pos: block.x_pos,
        y_pos: block.y_pos,
        rotation_degree: block.rotation_degree,
        user_id: user_id
      });
      const saved = await newBlock.save();
      savedBlockIds.push(saved._id);
    }

    // BlockMap upsert
    await BlockMap.updateOne(
      { map_id },
      {
        $set: {
          block_id: savedBlockIds,
          user_id,
          created_at: new Date()
        }
      },
      { upsert: true }
    );

    res.status(200).send('블록 및 매핑 저장 완료');
  } catch (err) {
    console.error('저장 실패:', err.message);
    res.status(500).send('저장 실패');
  }
});


// 특정 유저의 오늘 날짜 맵 조회
app.get('/api/blockmap-by-date/:user_id/:date', async (req, res) => {

  const { user_id, date } = req.params;
  try {
    const map = await BlockMap.findOne({
      user_id,
      created_at: {
        $gte: new Date(date + "T00:00:00.000Z"),
        $lte: new Date(date + "T23:59:59.999Z")
      }
    }).populate('block_id');

    if (!map) return res.status(404).send('해당 날짜 맵 없음');
    res.json(map);
  } catch (err) {
    console.error('날짜 기반 BlockMap 조회 오류:', err);
    res.status(500).send('서버 오류');
  }
});

app.get('/api/blockmap/:mapId', async (req, res) => {
  try {
    const map = await BlockMap.findOne({ map_id: req.params.mapId }).populate('block_id');
    if (!map) return res.status(404).send('맵을 찾을 수 없음');
    res.json(map);
  } catch (err) {
    console.error("BlockMap 조회 오류:", err);
    res.status(500).send('서버 오류');
  }
});

app.get('/blockui/:mapId', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  const mapId = req.params.mapId;
  const user = req.session.user;
  const userId = user ? user.user_id : null;

  res.render('pages/blockui', {
    title: '블록페이지',
    user,
    mapId,     
    userId    
  });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

//open Ai Api
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get('/api/keywords/:user_id', async (req, res) => {
  const userId = req.params.user_id;
  try {
    const keywords = await Keyword.find({ user_id: userId });
    res.json(keywords);
  } catch (err) {
    console.error('키워드 조회 오류:', err);
    res.status(500).json({ error: '조회 실패' });
  }
});


app.post("/api/keyword-extract", async (req, res) => {
    const userText = req.body.text;
    const userId = req.body.user_id;

    if (!userText || !userId) {
        return res.status(400).json({ error: "텍스트 또는 사용자 ID 누락" });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        // 오늘 날짜 기준 키워드 개수 확인
        const keywordCount = await Keyword.countDocuments({
            user_id: userId,
            date: today
        });

        if (keywordCount >= 8) {
            return res.status(200).json({ keyword: null, message: "오늘은 키워드를 8개까지 저장할 수 있어요." });
        }

        // 키워드 생성 프롬프트
        const prompt = `
        "${userText}"
        위 문장에서 가장 핵심적인 하나의 키워드만 한국어로 정확히 추출해서 출력해 주세요.
        오직 키워드 한 단어만 출력해주세요. 부가 설명, 문장 없이 단어 하나만 반환하세요.
        `.trim();

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "user", content: prompt }
            ],
            max_tokens: 10,
            temperature: 0.3
        });

        const keyword = completion.choices[0].message.content.trim();

        // 키워드 저장
        await Keyword.create({
            user_id: userId,
            keyword,
            date: today
        });

        res.json({ keyword });

    } catch (err) {
        console.error("키워드 처리 오류:", err.message);
        res.status(500).json({ error: "키워드 처리 실패" });
    }
});


const ChatLog = require('./models/ChatLog');

app.post('/api/chatlog', async (req, res) => {
  const { user_id, message, sender } = req.body;

  if (!user_id || !message || !sender) {
    return res.status(400).json({ error: '필수 항목 누락' });
  }

  try {
    const newLog = await ChatLog.create({
      user_id,
      message,
      sender
    });

    res.status(200).json({ success: true, data: newLog });
  } catch (err) {
    console.error('ChatLog 저장 오류:', err.message);
    res.status(500).json({ error: '저장 실패' });
  }
});



app.get('/api/keywords/count/:user_id', async (req, res) => {
  const userId = req.params.user_id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "올바르지 않은 사용자 ID입니다." });
  }

  try {
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const count = await Keyword.countDocuments({
      user_id: userId,
      date: today
    });
    console.log("count : " + count)
    res.json({ count });
  } catch (err) {
    console.error("키워드 수 조회 오류:", err);
    res.status(500).json({ error: "조회 실패" });
  }
});
