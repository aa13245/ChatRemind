const express = require('express');
const router = express.Router();
const db = require('../models');
const { isLoggedIn } = require('./middlewares');
const crypto = require('crypto');
require('dotenv').config();

//프로필 정보 불러오기
router.get('/getprofile', isLoggedIn, async (req,res) => {
  const id = req.user.email;
  const username = req.user.username;
  const chatbotname = req.user.chatbotname;
  const gptmodel = req.user.GptModel;
  const memory = req.user.GptMemory;

  res.json({id, username, chatbotname, gptmodel, memory});
})

//유저 이름 저장 라우터
router.put('/usernamesave/:username', isLoggedIn, async (req, res, next) => {
    try {
      await db.User.update({
        username: req.params.username
      }, {
        where: {
          Id: req.user.id,
        }
      });
      res.redirect('/');
    } catch (error) {
      console.error(error);
      next(error);
    }
  });

//챗봇 이름 저장 라우터
router.put('/chatbotnamesave/:chatbotname', isLoggedIn, async (req, res, next) => {
    try {
      await db.User.update({
        chatbotname: req.params.chatbotname
      }, {
        where: {
          Id: req.user.id,
        }
      });
      res.redirect('/');
    } catch (error) {
      console.error(error);
      next(error);
    }
  });

//gpt 기억용량 저장 라우터
router.put('/memorysave/:memory', isLoggedIn, async (req, res, next) => {
    let value =req.params.memory;
    if (value < 0 ) value = 0; 
    try {
      await db.User.update({
        GptMemory: value,
      }, {
        where: {
          Id: req.user.id,
        }
      });
      res.redirect('/');
    } catch (error) {
      console.error(error);
      next(error);
    }
  });

//GptApiKey 저장 라우터
router.put('/gptapisave/:api', isLoggedIn, async (req, res, next) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', process.env.CIPHER_SECRET, iv);
  let result = cipher.update(req.params.api,'utf8','base64');
  result += cipher.final('base64');
  try {
    await db.User.update({
      GptApiKey: result,
      GptApiIv: iv
    }, {
      where: {
        Id: req.user.id,
      }
    });
    res.redirect('/');
  } catch (error) {
    console.error(error);
    next(error);
  }
});

//선택 모델 저장하기
router.put('/choosemodel/:model', isLoggedIn, async (req, res, next) => {
    try {
      await db.User.update({
        GptModel: req.params.model
      }, {
        where: {
          Id: req.user.id,
        }
      });
      res.redirect('/');
    } catch (error) {
      console.error(error);
      next(error);
    }
  });

//채팅기록 삭제 라우터
router.delete('/deletelog', isLoggedIn, async (req, res, next)=> {
  try {
    await db.Chatlog.destroy({ 
      where: {
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