const express = require('express');
const router = express.Router();
const db = require('../models');
const { isLoggedIn } = require('./middlewares');

//메인화면에서 리마인더 불러오기
router.get('/getreminders', isLoggedIn, async (req, res, next) => {
  try {
      // 데이터베이스에서 모든 리마인더 데이터를 가져옵니다.
      const reminders = await db.Reminder.findAll({
        where: {userId: req.user.id},
        order: [
            ['date', 'ASC'], //날짜 순 정렬
            ['time', 'ASC'], //시간 순 정렬
        ],
      });
      res.json(reminders);
  } catch (error) {
      console.error(error);
      return next(error);
  }
});

//새로운 리마인더 저장 라우터
router.post('/', isLoggedIn, async (req, res, next) => {
    try {
      const reminder = await db.Reminder.create({
        content: req.body.content,
        date: req.body.date,
        time: req.body.time,
        completed: '미완료',
        userId: req.user.id,
      });
      await reminder.save();
  
      res.redirect('/');
    } catch (error) {
      console.error(error);
      next(error);
    }
  });

//리마인더 수정 라우터
router.put('/modify', isLoggedIn, async (req, res, next) => {
  try {
    const reminder = await db.Reminder.findAll({where: {id:req.body.id}});
    let alert;
    if (reminder[0].completed == '완료') {
      alert = 1;
    }
    //미완료 상태 리마인더 수정시 알림 활성화
    else {
    alert = null;
    };
    await db.Reminder.update({
      content: req.body.content,
      date: req.body.date,
      time: req.body.time,
      alert: alert,
    }, {
      where: {
        id:req.body.id,
        userId: req.user.id,
      }
    });
    res.redirect('/');
  } catch (error) {
    console.error(error);
    next(error);
  }
});

//리마인더 완료상태 변경 라우터
router.put('/complete', isLoggedIn, async (req, res, next)=> {
  try {
    const reminder = await db.Reminder.findAll({where: {id:req.body.reminder.id}});
    let value;
    let alert;
    //기존에 완료상태일 때 미완료로 변경, 알림 활성화
    if (reminder[0].completed == '완료') {
      value = '미완료';
      alert = null;
    }
    //기존에 미완료상태일 때 완료로 변경, 알림 비활성화
    else {
    value = '완료';
    alert = 1;
    };
    await db.Reminder.update({
      completed: value,
      alert: alert,
    }, {
      where: {
        id:reminder[0].id,
        userId: req.user.id
      },
    });
    res.redirect('/');
  } catch (error) {
    console.error(error);
    next(error);
  }
});

//리마인더 삭제 라우터
router.delete('/delete', isLoggedIn, async (req, res, next)=> {
  try {
    const reminder = req.body.reminder;
    await db.Reminder.destroy({ 
      where: {
        id:reminder.id,
        userId: req.user.id
      },
    });
    res.redirect('/');
  } catch (error) {
    console.error(error);
    next(error);
  }
});



module.exports = router;