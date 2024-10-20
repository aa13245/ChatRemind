const express = require('express');
const router = express.Router();
const db = require('../models');
const crypto = require('crypto');
const OpenAI = require('openai');
const { isLoggedIn } = require('./middlewares');
require('dotenv').config();

//db에서 대화기록 불러오기
router.get('/getlogs', isLoggedIn, async (req, res, next) => {
    try {
        const logs = await db.Chatlog.findAll({
            where: {userId: req.user.id},
        });
        res.json(logs);
    } catch (error) {
        console.error(error);
        return next(error);
    }
});

//클라이언트가 채팅을 전송하면 gpt요청 후 리턴, 기록 저장
router.post('/send-message', isLoggedIn, async (req, res, next) => {
    //db에서 채팅기록 최신 n개 불러옴
    const conversationHistory = [];
    const logs = await db.Chatlog.findAll({
        where: { userId: req.user.id },
        order: [['createdAt', 'DESC']],
        limit: req.user.GptMemory,
    }); 
    logs.forEach(log => {
        if (log.role == 'ai')
        conversationHistory.push({role: 'assistant', content: log.content.slice(1)});
        if (log.role == 'user')
        conversationHistory.push({role: 'user', content: log.content});
    });
    // gpt에게 제공할 대화기록
    const chatbotmemory = [];
    while(conversationHistory.length){
        chatbotmemory.push(conversationHistory.pop());
    }
    
    //유저채팅 db에 저장
    const userMessage = req.body.message;
    const chatlog = await db.Chatlog.create({
        content: req.body.message,
        role: 'user',
        userId: req.user.id,
      });
    await chatlog.save();

    //유저의 gpt api-key db에서 불러오기, 복호화
    const decipher = crypto.createDecipheriv('aes-256-cbc', process.env.CIPHER_SECRET, req.user.GptApiIv);
    let result = decipher.update(req.user.GptApiKey,'base64','utf8');
    result += decipher.final('utf8');
    // OpenAI API 키
    const GptApiKey = result;
    // OpenAI 클라이언트 설정
    const openai = new OpenAI({
        apiKey: GptApiKey,
    });

    //대화 타입 추출    1: 리마인더 확인하기, 2: 리마인더 생성, 3: 리마인더 삭제, 4: 리마인더 수정, 5: 시간,날짜 정보 제공, 0: 일상 대화
    let type;
    try {
        const response = await openai.chat.completions.create({
            model: req.user.GptModel,
            messages: [
                {   //프롬프트 설정
                    role: 'system',
                    content: '유저의 말을 숫자 한글자로 요약한다. 1:일정확인,2:일정create,3:일정delete,4:일정update,5:달력,시간확인(일정은1),그 외에는 0'
                },
                {   //유저 채팅 제공
                    role: 'user',
                    content: userMessage,
                },
            ],
            temperature: 0,
            max_tokens: 1,
            top_p: 0,
            frequency_penalty: 0,
            presence_penalty: 0,
        });
        type = response.choices[0].message.content;
        console.log(type);
    }catch (error) {
        console.error(error);
        next(error);
    }
    
    //type = 1,3,4일 때(확인, 삭제, 수정) 리마인더 데이터 불러오기
    const reminderdata = [];
    if (type == 1 || type == 3 || type == 4) {
            try {
            const reminders = await db.Reminder.findAll({
                order: [
                    ['date', 'ASC'],
                    ['time', 'ASC'],
                ],
                where: { userId: req.user.id },
            });
            reminders.forEach(reminder => {
                reminderdata.push('(id:'+reminder.id+',content:'+reminder.content+',date:20'+reminder.date+',time:'+reminder.time+',완료여부:'+reminder.completed+')');
            });
        } catch (error) {
            console.error(error);
            return next(error);
        }
    };

    //날짜,시간,요일 불러오기
    const currentDate = new Date();
    const year = currentDate.getFullYear().toString().slice(-2);
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const currentTime = new Date();
    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');
    const time = hours + minutes;
    const dayOfWeek = currentDate.getDay();
    let dayOfWeekString;
    switch (dayOfWeek) {
        case 0:dayOfWeekString = "일요일";break;
        case 1:dayOfWeekString = "월요일";break;
        case 2:dayOfWeekString = "화요일";break;
        case 3:dayOfWeekString = "수요일";break;
        case 4:dayOfWeekString = "목요일";break;
        case 5:dayOfWeekString = "금요일";break;
        case 6:dayOfWeekString = "토요일";break;
    }

    //type이 0,1,5(일상 대화, 리마인더 확인, 날짜, 시간)일경우 대화 요청
    if (type !=2 && type != 3 && type != 4){ 
        try {
            const messages = [
                //프롬프트 설정, 유저 이름, 챗봇 이름 제공
                {
                    role: 'system',
                    content: '챗봇은 user의 친구 '+req.user.chatbotname+'이고,user는 '+req.user.username+'이다. 유저에게 인공지능 챗봇이라는 사실을 밝히지 않는다. 친근하게 반말로 말한다. 200토큰 제한'
                },
                //이전 대화 기록 제공
                ...chatbotmemory,
            ];
            // 시간 정보 제공
            if (type != 0){
                messages.push(
                    {
                        role: 'system',
                        content: 'today:20'+year + month + day +','+dayOfWeekString +',time:'+time
                    },
                );
            }
            // 리마인더 정보 제공
            if (type ==1){
                messages.push(
                    {
                        role: 'user',
                        content: JSON.stringify(reminderdata)+'나의 최신 리마인더야. 반말해' // 높임말 방지
                    },
                );
            }
            //유저 채팅 제공
            messages.push(
                {
                    role: 'user',
                    content: userMessage,
                },
            );
            const response = await openai.chat.completions.create({
                model: req.user.GptModel,
                messages: messages,
                temperature: 0,
                max_tokens: 200,
                top_p: 0.5,
                frequency_penalty: 0.5,
                presence_penalty: 0.5,
            });

            //챗봇의 대답채팅 db에 저장
            const aiReply = response.choices[0].message.content;
            const ailog = await db.Chatlog.create({
                content: type+aiReply,  //type+채팅 으로 저장
                role: 'ai',
                userId: req.user.id,
            });
            await ailog.save();
            //클라이언트로 대답 전달
            res.json({ reply: type+aiReply });
        } catch (error) {
            console.error(error);
            next(error);
        }
    };

    //type = 2일 경우 저장할 리마인더 규격으로 정리 요청
    if (type ==2){
        try {
            const response = await openai.chat.completions.create({
                model: req.user.GptModel,
                messages: [
                    {   //프롬프트 설정
                        role: 'system',
                        content: '규격에 따라 일정을 만든다:(day:YYYYMMDD,time:TTMM,content:일정내용)'
                    },
                    {   //시간정보 제공
                        role: 'system',
                        content: 'today:20'+year + month + day +','+dayOfWeekString +',time:'+time 
                    },
                    {   //유저 채팅 제공
                        role: 'user',
                        content: userMessage,
                    },
                ],
                temperature: 0,
                max_tokens: 300,
                top_p: 0,
                frequency_penalty: 0,
                presence_penalty: 0,
            });
            console.log(response.choices[0].message.content);

            //규격화된 응답 내용을 각 변수로 추출
            const regex = /day:\s*(\d+),\s*time:\s*(\d+),\s*content:\s*([^]+?)(?=\nday:|\n*$)/g;
            const reminders = [];
            let match;
            while ((match = regex.exec(response.choices[0].message.content))) {
                const date = match[1].slice(2);
                const time = match[2];
                const content = match[3].trim();
                reminders.push({ date, time, content });
            }

            //db에 리마인더, 챗봇 채팅기록 추가
            let message;
            try {
                for (const reminderData of reminders) {
                    const reminder = await db.Reminder.create({
                        content: reminderData.content,
                        date: reminderData.date,
                        time: reminderData.time,
                        completed: '미완료',
                        userId: req.user.id,
                      });
                      await reminder.save();
                }
                if (reminders.length != 0) message = '리마인더에 저장했어!';
                else message = '다시 정확히 얘기해줘!';
                const ailog = await db.Chatlog.create({
                    content: type+message,
                    role: 'ai',
                    userId: req.user.id,
                });
                await ailog.save();
            } catch (error) {
                console.error(error);
                next(error);
            }
            res.json({ reply: type+message });
        }catch (error) {
            console.error(error);
            next(error);
        }
    };

    //type=3일 경우 삭제할 리마인더의 id 출력 요청
    if (type ==3){
        try {
            const response = await openai.chat.completions.create({
                model: req.user.GptModel,
                messages: [
                    {   //프롬프트 설정
                        role: 'system',
                        content: '규격에 따라 출력한다:(id:삭제할 리마인더의id/삭제)'
                    },
                    {   //시간정보, 리마인더 데이터 제공
                        role: 'system',
                        content: 'today:20'+year + month + day +','+dayOfWeekString +',time:'+time+'/리마인더:'+JSON.stringify(reminderdata),
                    },
                    {   //유저 채팅 제공
                        role: 'user',
                        content: userMessage,
                    },
                ],
                temperature: 0,
                max_tokens: 200,
                top_p: 0,
                frequency_penalty: 0,
                presence_penalty: 0,
            });
            
            //gpt의 대답에서 id를 추출
            const input = response.choices[0].message.content;
            console.log(input);
            const regex = /id:(\d+)/g;
            const matches = [...input.matchAll(regex)];
            const ids = matches.map(match => match[1]);

            //db에 리마인더 삭제, 챗봇 채팅기록 추가
            for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                await db.Reminder.destroy({ where: {id:id}});
            }
            let message;
            if (ids.length != 0) message = '리마인더에서 삭제했어!';
            else message = '다시 정확히 얘기해줘!';
            const ailog = await db.Chatlog.create({
                content: type+message,
                role: 'ai',
                userId: req.user.id,
            });
            await ailog.save();
            res.json({ reply: type+message });
        }catch (error) {
            console.error(error);
            next(error);
        }
    };

    //type=4일 경우 수정할 리마인더의 내용 규격으로 정리 요청
    if (type ==4){
        try {
            const response = await openai.chat.completions.create({
                model: req.user.GptModel,
                messages: [
                    {   //프롬프트 설정
                        role: 'system',
                        content: '규격에 따라 출력한다:(id:수정할 리마인더의id,content:일정내용,date:YYYYMMDD,time:TTMM,완료여부:완료/미완료), 규격 외의 대화를 출력하지 않는다, 변경사항이 없는 일정은 출력하지 않는다'
                    },
                    {   //시간정보, 리마인더 데이터 제공
                        role: 'user',
                        content: 'today:20'+year + month + day +','+dayOfWeekString +',time:'+time+'/리마인더:'+JSON.stringify(reminderdata),
                    },
                    {   //유저 채팅 제공
                        role: 'user',
                        content: userMessage,
                    },
                ],
                temperature: 0,
                max_tokens: 300,
                top_p: 0,
                frequency_penalty: 0,
                presence_penalty: 0,
            });
            console.log(response.choices[0].message.content);

            //규격화된 응답 내용을 각 변수로 추출
            const regex = /\(id:(\d+),content:([^]+?),date:(\d+),time:(\d+),완료여부:([^\n]+)\)/g;
            const reminders = [];
            let match;
            while ((match = regex.exec(response.choices[0].message.content))) {
                const id = match[1].trim();
                const content = match[2].trim();
                const date = match[3].trim().slice(2);
                const time = match[4].trim();
                const completed = match[5].trim();
                reminders.push({ id, date, time, content, completed });
            }

            //db에 수정된 리마인더, 챗봇 채팅기록 저장
            let message;
            try {
                for (const reminderData of reminders) {
                    console.log(reminders);
                    let alert;
                    //리마인더가 완료 상태라면 알림을 비활성화 상태로 변경
                    if (reminderData.completed == '완료') {
                        alert = 1;
                    }
                    //리마인더가 미완료 상태라면 알림을 활성화 상태로 변경
                    else {  
                        alert = null;
                    };
                    await db.Reminder.update({
                        content: reminderData.content,
                        date: reminderData.date,
                        time: reminderData.time,
                        completed: reminderData.completed,
                        alert: alert,
                      }, {
                        where: {
                          id:reminderData.id,
                          userId: req.user.id,
                        }
                      });
                }
                if (reminders.length != 0) message = '리마인더를 수정했어!';
                else message = '다시 정확히 얘기해줘!';
                const ailog = await db.Chatlog.create({
                    content: type+message,
                    role: 'ai',
                    userId: req.user.id,
                });
                await ailog.save();
            } catch (error) {
                console.error(error);
                next(error);
            }
            res.json({ reply: type+message });
        }catch (error) {
            console.error(error);
            next(error);
        }
    };
});

// 알림할 리마인더를 확인하기 위해 클라이언트에 리마인더 데이터 전송
router.get('/alert', isLoggedIn, async (req, res) => {
    const reminders = await db.Reminder.findAll({
        where: {userId: req.user.id},
    });
    res.json({ reminders });
});

// 클라이언트에서 알림 요청시 gpt에 알림말 요청 후 클라이언트로 알림채팅 전송
router.post('/getalertmessage', isLoggedIn, async (req, res, next) => {
    //유저의 gpt api-key 불러오기, 복호화
    const decipher = crypto.createDecipheriv('aes-256-cbc', process.env.CIPHER_SECRET, req.user.GptApiIv);
    let result = decipher.update(req.user.GptApiKey,'base64','utf8');
    result += decipher.final('utf8');
    // OpenAI API 키
    const GptApiKey = result;
    // OpenAI 클라이언트 설정
    const openai = new OpenAI({
        apiKey: GptApiKey,
    });
    const reminderdata = req.body.reminderdataform; //클라이언트에서 전송받은 리마인더
    try {
        const messages = [
            {   //프롬프트 설정
                role: 'system',
                content: '챗봇은 리마인더를 알려준다. 친구같은 말투로 반말로 말한다. 150토큰 제한'
            },
            {   //리마인더 데이터 제공
                role: 'system',
                content: JSON.stringify(reminderdata),
            },
        ];
        const response = await openai.chat.completions.create({
            model: req.user.GptModel,
            messages: messages,
            temperature: 0,
            max_tokens: 150,
            top_p: 0.5,
            frequency_penalty: 0.5,
            presence_penalty: 0.5,
        });
        //챗봇의 채팅기록 db에 저장
        const aiReply = response.choices[0].message.content;
        const ailog = await db.Chatlog.create({
            content: '6'+aiReply,
            role: 'ai',
            userId: req.user.id,
        });
        await ailog.save();
        res.json( aiReply );

        // 알림할 대상인 리마인더들의 alert를 1(알림완료)로 변경
        const regex = /id:(\d+)/g;
        const matches = [...reminderdata.matchAll(regex)];
        const ids = matches.map(match => match[1]);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const reminder = await db.Reminder.findByPk(id);
            reminder.alert = 1;
            await reminder.save();
        }
    } catch (error) {
        console.error(error);
        next(error);
    }
});

module.exports = router;