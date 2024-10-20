const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const passport = require('passport');
const session = require('express-session');
const flash = require('express-flash');
require('dotenv').config();

const chatRouter = require('./routes/chat');
const reminderRouter = require('./routes/reminder');
const authRouter = require('./routes/auth');
const mypageRouter = require('./routes/mypage');
const { sequelize } = require('./models');
const { isLoggedIn, isNotLoggedIn } = require('./routes/middlewares');
const passportConfig = require('./passport');

const app = express();
sequelize.sync();
passportConfig(passport);

app.use(flash());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: process.env.COOKIE_SECRET,
  cookie: {
    httpOnly: true,
    secure: false,
  },
}));
app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('port', process.env.PORT || 8000);

// 각 경로별 렌더링 파일 제공
app.get('/', (req, res) => {
    if (req.user) res.sendFile(__dirname + '/views/main.html');
    else res.render('login');
});
app.get('/join', isNotLoggedIn, (req, res) => {
    res.render('join');
});
app.get('/mypage', isLoggedIn, (req, res) => {
    res.sendFile(__dirname + '/views/mypage.html');
});
app.get('/changepw', isLoggedIn, (req, res) => {
    res.render('changepw');
});
app.get('/withdrawal', isLoggedIn, (req, res) => {
    res.render('withdrawal');
});
app.use(express.static(__dirname));

app.use('/chat', chatRouter);
app.use('/reminder', reminderRouter);
app.use('/auth', authRouter);
app.use('/mypage', mypageRouter);

//에러처리
app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
  });
app.use((err, req, res, next) => {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') ==='development' ? err : {};
    res.status(err.status || 500);
    next();
});
//서버실행
app.listen(app.get('port'), () => {
    console.log(app.get('port'),'번 포트에서 대기 중');
});
