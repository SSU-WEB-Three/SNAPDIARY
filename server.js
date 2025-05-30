// ─── 초기 설정 ────────────────────────────────────────────────
const dotenv = require('dotenv'); dotenv.config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const Account = require('./models/account');
const DiaryEntry = require('./models/DiaryEntry');
const Keyword = require('./models/Keyword');
const Block = require('./models/Block');
const BlockMap = require('./models/BlockMap');
const ChatLog = require('./models/ChatLog');
const cron = require('node-cron');
const fs = require('fs');
const axios = require('axios');

connectDB();
const app = express();
const PORT = process.env.PORT || 3000;

// ─── 미들웨어 ────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// ─── EJS 설정 ────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(expressLayouts);
app.set('layout', './layouts/main');

// ─── 페이지 라우팅 ────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.render('pages/index', { title: '메인 화면', user: req.session.user || null });
});
app.get('/login', (req, res) => res.render('pages/login', { layout: false, error: null, user: req.session.user || null }));
app.get('/register', (req, res) => res.render('pages/register', { layout: false, error: null, user: req.session.user || null }));
app.get('/register/success', (req, res) => res.render('pages/register-success', { layout: false, user: req.session.user || null }));
app.get('/mypage', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const user = await Account.findById(req.session.user.user_id);
  res.render('pages/mypage', {
    title: '마이 페이지',
    user: req.session.user,
    userId: req.session.user.user_id,
    profileImage: user.profileImage || '/uploads/default.png'
  });
});
app.get('/blockui/:mapId', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('pages/blockui', {
    title: '블록페이지',
    user: req.session.user,
    mapId: req.params.mapId,
    userId: req.session.user.user_id
  });
});
app.get('/agree', (req, res) => {
  res.render('pages/agree', { layout: false, error: null, user: req.session.user || null });
});


// ─── 회원가입 / 로그인 ────────────────────────────────────────────────
app.post('/register', async (req, res) => {
  const { useremail, userpassword, username, userphone, usernickname, userbirth } = req.body;
  const exists = await Account.findOne({ useremail });
  if (exists) return res.render('pages/register', { layout: false, error: "이미 가입된 이메일입니다." });
  if (typeof userpassword !== 'string' || userpassword.length < 6 || userpassword.length > 20) {
    return res.status(400).send('비밀번호는 6~20자여야 합니다.');
  };
  if (!username || !/^[가-힣]{2,10}$/.test(username)) {
    return res.status(400).send('이름은 한글 2~10자만 가능합니다.');
  };
  if (!userphone || !/^[0-9]{10,11}$/.test(userphone)) {
    return res.status(400).send('전화번호는 숫자만 입력해야 합니다.');
  }


  const hashedpw = await bcrypt.hash(userpassword, 10);
  await Account.create({ useremail, userpassword: hashedpw, username, userphone, usernickname, userbirth });
  res.redirect('/register/success');
});

app.post('/login', async (req, res) => {
  const { useremail, userpassword } = req.body;
  const user = await Account.findOne({ useremail });
  if (!user || !(await bcrypt.compare(userpassword, user.userpassword))) {
    return res.render('pages/login', { layout: false, error: "아이디 또는 비밀번호가 틀렸습니다." });
  }
  req.session.user = {
    user_id: user._id,
    useremail: user.useremail,
    username: user.username,
    usernickname: user.usernickname
  };
  res.redirect('/');
});
app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

// ─── 일기 API ────────────────────────────────────────────────
app.post('/api/diary/save', async (req, res) => {
  const { user_id, date, title, index } = req.body;
  if (!user_id || !date || !title) return res.status(400).send('필수 값 누락');

  if (index !== undefined) {
    const entries = await DiaryEntry.find({ user_id, date });
    if (!entries[index]) return res.status(404).send('수정 대상 없음');
    entries[index].title = title;
    await entries[index].save();
  } else {
    await DiaryEntry.create({ user_id, date, title, views: 0 });
  }
  res.send('저장 완료');
});

app.post('/api/check-abuse', async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: '입력된 문장이 없습니다.' });
  }

  try {
    const prompt = `
너는 욕설 필터링 시스템이야. 아래 문장이 다음 조건 중 하나라도 해당되면 "부적절함"이라고 대답해줘:

1. 욕설 또는 공격적인 표현이 포함되어 있음
2. 비하, 차별, 모욕적 표현이 포함되어 있음
3. 무의미하거나 랜덤한 글자 나열임 (예: asdads, qweqwe, fffds)
4. 대화로 보기 어려운 이상한 형태임

그 외에는 "적절함"이라고 대답해.

문장: "${text}"

반드시 "적절함" 또는 "부적절함" 중 하나로만 대답해.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
      temperature: 0.2,
    });

    const result = completion.choices[0].message.content.trim();
    res.json({ result });
  } catch (err) {
    console.error('입력 검증 실패:', err.message);
    res.status(500).json({ error: 'OpenAI 오류' });
  }
});

app.post('/api/generate-diary', async (req, res) => {
  const { messages } = req.body;

  if (!messages) return res.status(400).json({ error: '대화 내용 누락' });

  try {
    const prompt = `
아래는 사용자의 하루 대화 기록입니다. 이를 바탕으로 하루 일기를 작성해 주세요.

${messages}

일기 형식으로, 하루를 정리하는 부드럽고 따뜻한 문장으로 작성해주세요.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    const diary = completion.choices[0].message.content.trim();
    res.json({ diary });
  } catch (err) {
    console.error('일기 생성 실패:', err.message);
    res.status(500).json({ error: 'OpenAI 오류' });
  }
});


app.get('/api/diary/:user_id/:date', async (req, res) => {
  const entries = await DiaryEntry.find({ user_id: req.params.user_id, date: req.params.date });
  res.json(entries);
});
app.get('/api/diary-all/:user_id', async (req, res) => {
  const entries = await DiaryEntry.find({ user_id: req.params.user_id });
  res.json(entries);
});
app.delete('/api/diary/delete', async (req, res) => {
  const { user_id, date, index } = req.body;
  const entries = await DiaryEntry.find({ user_id, date });
  if (!entries[index]) return res.status(404).send('삭제 대상 없음');
  await DiaryEntry.findByIdAndDelete(entries[index]._id);
  res.send('삭제 완료');
});

// ─── 블록 저장 및 조회 ────────────────────────────────────────────────
app.post('/save-blocks', async (req, res) => {
  const { blockDataList, map_id, user_id } = req.body;
  if (!Array.isArray(blockDataList) || !map_id || !user_id) return res.status(400).send('필수 값 누락');

  try {
    const existing = await BlockMap.findOne({ map_id });
    if (existing) await Block.deleteMany({ _id: { $in: existing.block_id } });

    const savedBlockIds = [];
    for (const block of blockDataList) {
      const newBlock = new Block({
        keyword_id: block.keyword_id || null,
        shape_type: block.shape_type,
        color: block.color || '#FFA500',
        x_pos: block.x_pos,
        y_pos: block.y_pos,
        rotation_degree: block.rotation_degree,
        scale: block.scale || 1,
        tag: block.tag || '',
        user_id
      });
      const saved = await newBlock.save();
      savedBlockIds.push(saved._id);
    }

    await BlockMap.updateOne(
      { map_id },
      { $set: { block_id: savedBlockIds, user_id, created_at: new Date() } },
      { upsert: true }
    );
    res.send('블록 및 매핑 저장 완료');
  } catch (err) {
    console.error("저장 실패:", err.message);
    res.status(500).send("저장 실패");
  }
});

//블록 삭제 코드 (수정가능)
app.post("/delete-block", async (req, res) => {
  const { block_id } = req.body;
  if (!block_id) {
    return res.status(400).send('block_id 누락');
  }
  try {
    await Block.findByIdAndDelete(block_id);
    await BlockMap.updateMany(
      {block_id: block_id},
      { $pull: {block_id: block_id} }
    );
  } catch (err) {
    console.error("삭제 실패: ",err.message);
    res.status(500).send("삭제실패");
  }
});

app.get('/api/blockmap/:mapId', async (req, res) => {
  try {
    const map = await BlockMap.findOne({ map_id: req.params.mapId }).populate('block_id');
    if (!map) return res.status(404).send('맵을 찾을 수 없음');
    res.json(map);
  } catch (err) {
    res.status(500).send("서버 오류");
  }
});

app.get('/api/blockmap-by-date/:user_id/:date', async (req, res) => {
  const { user_id, date } = req.params;

  try {
    const start = new Date(`${date}T00:00:00.000+09:00`);
    const end = new Date(`${date}T23:59:59.999+09:00`);

    const map = await BlockMap.findOne({
      user_id, // 반드시 ObjectId로 저장된 값이어야 함
      created_at: { $gte: start, $lte: end }
    }).populate('block_id');

    if (!map) {
      console.log("해당 날짜에 블록맵 없음");
      return res.status(404).send('해당 날짜 맵 없음');
    }

    console.log("기존 블록맵 있음 → map_id:", map.map_id);
    res.json(map); // map.map_id 포함된 전체 블록맵 응답
  } catch (err) {
    console.error('블록맵 조회 실패:', err);
    res.status(500).send('서버 오류');
  }
});

// ─── 키워드 관련 ────────────────────────────────────────────────
app.get('/api/keywords/:user_id', async (req, res) => {
  const keywords = await Keyword.find({ user_id: req.params.user_id });
  res.json(keywords);
});

app.get('/api/keywords/count/:user_id', async (req, res) => {
  const userId = req.params.user_id;
  if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ error: "잘못된 ID" });

  const today = new Date(); today.setHours(today.getHours() + 9);
  const localDate = today.toISOString().slice(0, 10);
  const count = await Keyword.countDocuments({ user_id: userId, date: localDate });
  res.json({ count });
});

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/keyword-extract", async (req, res) => {
  const { text, user_id } = req.body;
  if (!text || !user_id) return res.status(400).json({ error: "입력 누락" });

  const today = new Date(); today.setHours(today.getHours() + 9);
  const localDate = today.toISOString().slice(0, 10);

  const count = await Keyword.countDocuments({ user_id, date: localDate });
  if (count >= 8) return res.status(200).json({ keyword: null, message: "8개 초과 저장 불가" });

  const prompt = `"${text}" 문장에서 핵심 키워드 1개만 한국어로 출력하세요.`;
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 10,
    temperature: 0.3
  });
  const keyword = completion.choices[0].message.content.trim();
  await Keyword.create({ user_id, keyword, date: localDate });
  res.json({ keyword });
});

// ─── 챗로그 저장 ────────────────────────────────────────────────
app.post('/api/chatlog', async (req, res) => {
  const { user_id, message, sender } = req.body;
  if (!user_id || !message || !sender) return res.status(400).json({ error: "입력 누락" });

  const log = await ChatLog.create({ user_id, message, sender });
  res.json({ success: true, data: log });
});

app.get('/api/chatlog/:user_id/:date', async (req, res) => {
  const { user_id, date } = req.params;

  try {
    const start = new Date(`${date}T00:00:00+09:00`);
    const end = new Date(`${date}T23:59:59.999+09:00`);

    const logs = await ChatLog.find({
      user_id: new mongoose.Types.ObjectId(user_id),
      timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: 1 });

    res.json(logs);
  } catch (err) {
    console.error('ChatLog 조회 실패:', err.message);
    res.status(500).send('조회 실패');
  }
});



// ─── 서버 실행 ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});



app.get('/api/community/recent', async (req, res) => {
  try {
    const recentMaps = await BlockMap.find()
      .sort({ created_at: -1 })
      .limit(5)
      .populate('user_id');

    res.json(recentMaps);
  } catch (err) {
    console.error("최근 커뮤니티 조회 오류:", err);
    res.status(500).json({ error: "서버 오류" });
  }
});


app.get('/blockview/:mapId', async (req, res) => {
  try {
    const map = await BlockMap.findOne({ map_id: req.params.mapId })
      .populate('block_id')
      .populate('user_id');

    if (!map) return res.status(404).send('맵이 존재하지 않음');

    // 오늘 날짜 추출 (블록맵 생성일 기준)
    const dateStr = new Date(map.created_at).toISOString().slice(0, 10);

    // 해당 날짜의 일기 조회
    const diary = await DiaryEntry.findOne({
      user_id: map.user_id._id,
      date: dateStr
    });

    res.render('pages/blockview', {
      title: '블록맵 조회',
      user: req.session.user || null,
      map: {
        ...map.toObject(),
        diary
      }
    });
  } catch (err) {
    console.error('블록맵 조회 오류:', err);
    res.status(500).send('서버 오류');
  }
});


// 커뮤니티 페이지 (6개씩 페이징)

app.get('/community', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 6;
  const skip = (page - 1) * limit;

  const total = await BlockMap.countDocuments();
  const maps = await BlockMap.find()
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user_id'); // 사용자 닉네임 포함되게

  // 각 map에 대해 키워드와 일기 추가
  const entries = await Promise.all(
    maps.map(async (map) => {
      const date = map.date || map.created_at.toISOString().slice(0, 10);

      const keywords = await Keyword.find({ user_id: map.user_id._id, date });
      const diary = await DiaryEntry.findOne({ user_id: map.user_id._id.toString(), date });

      return {
        ...map.toObject(),  // map의 기본 정보
        keywords: keywords.map(k => k.keyword),
        diary: diary ? diary.title : null,
        imageUrl: diary?.imageUrl || null 
      };
    })
  );

  res.render('pages/community', {
    title: '커뮤니티',
     user: req.user || null,
    entries,
    currentPage: page,
    totalPages: Math.ceil(total / limit)
  });
});

const path = require('path');
const multer = require('multer');

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/profile'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const uploadProfile = multer({ storage: profileStorage });


app.post('/api/generate-image', async (req, res) => {
  const { user_id, date } = req.body;

  if (!user_id || !date) {
    return res.status(400).json({ error: "user_id 또는 date 누락" });
  }

  try {
    // 1. 프롬프트 구성
    const prompt = `
감성적이고 평화로운 하루를 일러스트 스타일로 그려주세요.
배경은 따뜻하고 편안한 분위기면 좋겠습니다.
(사용자의 대화 내용이나 키워드를 기반으로 구체화해도 됩니다.)
`;

    // 2. OpenAI 이미지 생성
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
      n: 1,
    });

    const imageUrl = imageResponse.data[0].url;
    const fileName = `${user_id}_${date}.png`;
    const dirPath = path.join(__dirname, 'public', 'uploads', 'generated');
    const savePath = path.join(dirPath, fileName);

    // 3. 디렉토리 없으면 생성
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // 4. 이미지 다운로드 및 저장
    const response = await axios.get(imageUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(savePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // 5. DB 업데이트
    const localPath = `/uploads/generated/${fileName}`;
    await DiaryEntry.updateOne(
      { user_id, date },
      { $set: { imageUrl: localPath } },
      { upsert: true }
    );

    console.log("이미지 생성 완료:", localPath);
    return res.json({ imageUrl: localPath });
  } catch (err) {
    console.error("이미지 생성 실패:", err.message);
    return res.status(500).json({ error: "이미지 생성 실패" });
  }
});

// 매일 밤 11시에 실행
cron.schedule('00 23 * * *', async () => {
  console.log("23:00 자동 일기 생성 시작");

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // 오늘 대화한 사용자 ID 목록 조회
    const users = await ChatLog.distinct('user_id', {
      timestamp: {
        $gte: new Date(`${today}T00:00:00Z`),
        $lte: new Date(`${today}T23:59:59Z`)
      }
    });

    console.log(`오늘 대화한 사용자 수: ${users.length}명`);

    for (const userId of users) {
      const existingDiary = await DiaryEntry.findOne({ user_id: userId, date: today });

      // title이 있으면 건너뜀
      if (existingDiary && existingDiary.title) {
        console.log(`${userId}님: 이미 제목 있는 일기 있음 → 건너뜀`);
        continue;
      }

      // 해당 유저의 오늘 대화 로그 조회
      const logs = await ChatLog.find({
        user_id: userId,
        timestamp: {
          $gte: new Date(`${today}T00:00:00Z`),
          $lte: new Date(`${today}T23:59:59Z`)
        }
      });

      if (!logs.length) {
        console.log(`${userId}님: 오늘 대화 없음 → 건너뜀`);
        continue;
      }

      const combinedMessages = logs.map(log => `${log.sender === 'user' ? '사용자' : 'GPT'}: ${log.message}`).join('\n');

      const prompt = `
아래는 사용자의 하루 대화 기록입니다. 이를 바탕으로 하루 일기를 작성해 주세요.

${combinedMessages}

일기 형식으로, 하루를 정리하는 부드럽고 따뜻한 문장으로 작성해주세요.
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7
      });

      const diaryText = completion.choices[0].message.content.trim();

      if (existingDiary) {
  existingDiary.title = diaryText;
  existingDiary.generated = true;
  await existingDiary.save();
  console.log(`${userId}님: 기존 일기 title 채움`);
  await generateImage(userId, today);
} else {
  await DiaryEntry.create({
    user_id: userId,
    date: today,
    title: diaryText,
    generated: true
  });
  console.log(`${userId}님: 새 일기 생성`);
  await generateImage(userId, today); 
}

    }

    console.log("자동 일기 처리 완료");
  } catch (err) {
    console.error("자동 일기 생성 오류:", err.message);
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));