var express = require('express');
var app = express();
const port = process.env.PORT || 4000;
var _ = require('lodash');

const server = require('http').createServer(app);
const songData = require('./song/song_kr.json');
const songDataJP = require('./song/song_jp.json');
const songDataEN = require('./song/song_en.json');

// const io = require("socket.io")(server, {
//   cors: {
//     origin: "http://localhost:3000",
//     methods: ["GET", "POST"],
//   },
// });
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});


const ROOM_CODE = 'ROOM_';
const SERVER_VERSION = 'v1.0.2';
const READY_STATE = 0;      // 대기 방 상태
const STARTING_STATE = 1;   // 게임 시작 중인 상태
const PLAYING_STATE = 2;    // 게임 중 상태
const WAITING_STATE = 3;    // 게임 중에 다음 노래 대기중 상태 (게임 중엔 PLAYING_STATE 와 번갈아 감)

let roomData = {};
let roomIdx = 0;


function shuffle(a) {
  var j, x, i;
  for (i = a.length; i; i -= 1) {
    j = Math.floor(Math.random() * i);
    x = a[i - 1];
    a[i - 1] = a[j];
    a[j] = x;
  }
}

io.on('connection', (socket) => {
  // console.log('SERVER VERSION ', SERVER_VERSION);
  // console.log("연결된 socketID : ", socket.id);
  // console.log('현재 ', io.engine.clientsCount);

  // 접속하면 socketId를 저장하게함 io.to(socket.id)
  socket.emit('my socket id', {
    socketId: socket.id,
    server_version: SERVER_VERSION
  });

  function nextSong(roomCode) {
    try {
      if (roomData[roomCode].songList.length > 0) {
        roomData[roomCode].skipCount.clear();
        io.to(ROOM_CODE + roomCode).emit('next song', roomData[roomCode].songList[0]);
      } else {
        roomData[roomCode].isPlaying = READY_STATE;
        io.to(ROOM_CODE + roomCode).emit('game end');
      }
    } catch (e) {
      console.log('nextSong', e);
    }
  }

  function outRoomCheck(roomCode, socketId) {
    try {
      if (!roomData[roomCode])
        return;

      // 방에 나 혼자 였다면 방만 삭제
      if (roomData[roomCode].userList.length <= 1) {
        delete roomData[roomCode];
      }
      // 방의 일원이라면 다른 사람들에게 나갔다고 알림
      else {
        const idx = roomData[roomCode].userList.findIndex((item) => {
          return item.socketId === socketId;
        });

        if (idx === -1) return;
        roomData[roomCode].userList.splice(idx, 1);

        io.to(ROOM_CODE + roomCode).emit('someone exit', { socketId: socketId });


        // 만약 사라진 유저가 방장이라면(방장은 항상 0번) 다음 사람에게 방장 넘겨주기
        console.log('EXIT USER : ', idx);
        if (idx === 0) {
          console.log(roomData[roomCode].userList[0].socketId);

          io.to(roomData[roomCode].userList[0].socketId).emit('your manager', roomData[roomCode].songTags);
        }
      }
    } catch (e) {
      console.log('outRoomCheck', e);
    }
  }

  //================================
  // Room - Create
  socket.on('create room', (data) => {
    roomIdx++;
    
    roomData[roomIdx] = {
      language: data.language,
      songTags: data.tags,
      unWanted: data.unTags,
      maxSongNum: data.maxSongNum,
      maxUserNum: data.maxUserNum,
      userList: [
        {
          socketId: data.user.socketId,
          nickname: data.user.nickname,
          profile: data.user.profile,
          color: data.user.color
        }
      ],
      songList: [],
      skipCount: new Set(),
      isPlaying: READY_STATE
    };

    socket.join(ROOM_CODE + roomIdx);
    socket.emit('get room code', { roomCode: roomIdx });
  });

  //================================
  // Room - Join
  socket.on('join room', (data) => {
    try {
      // 존재하는 방인지
      if (roomData[data.roomCode] != undefined) {
        
        // 해당 방에 내가 이미 들어와 있는지
        if (roomData[data.roomCode].userList.length > 0) {
          
          // 방장인지 아닌지 확인
          if (roomData[data.roomCode].userList.filter(e => e.socketId === data.user.socketId).length > 0) {
            socket.emit('your manager', roomData[data.roomCode].songTags);
          
          } else {
            
            // 인원수 체크
            if (roomData[data.roomCode].userList.length + 1 >= roomData[data.roomCode].maxUserNum ||
                roomData[data.roomCode].isPlaying) {
              // 내가 들어가면 인원수가 넘치거나 게임중인 방에 강제로 접속했음
              socket.emit('forced exit');
              return;
            }

            // 기존에 있던 유저들에게 내 데이터를 보내줌
            io.to(ROOM_CODE + data.roomCode).emit('someone join', data.user);

            // 나에게 전체 기존 유저 데이터들을 보내줌
            socket.emit('join room', roomData[data.roomCode].userList, roomData[data.roomCode].songTags);

            roomData[data.roomCode].userList.push(data.user);

            socket.join(ROOM_CODE + data.roomCode);
          }
        }
      } else {
        // error : 없는 방
        socket.emit('forced exit');
      }
    } catch (e) {
      console.log('join room', e);
    }
  });

  //================================
  // Room - Exit
  socket.on('exit room', (data) => {
    socket.leave(ROOM_CODE + data.roomCode);

    outRoomCheck(data.roomCode, data.socketId);
  });

  //================================
  // Room - Forced Exit
  socket.on('forced exit', (data) => {
    io.to(data.target).emit('forced exit');
  });


  //================================
  // Room - Get List
  socket.on('get room list', () => {
    try {
      io.emit('get room list',  { roomList: Object.keys(roomData).filter((key) => {
            return !roomData[key].isPlaying;
        }).reduce((obj, key, idx) => {
            obj[key] = { ...roomData[key] };
            obj[key].curUserNum = obj[key].userList.length;
            delete obj[key].userList;

            return obj;
        }, {}), clientsCount: io.engine.clientsCount });
    } catch (e) {
      console.log('get room list', e);
    }
  });

  //================================
  // Room - Send Chat
  socket.on('send chat', data => {
    try {
      data.isAnswer = false;

      if (roomData[data.roomCode].isPlaying === PLAYING_STATE) {

        // 스킵 희망 채팅인지
        if (data.msg === '!스킵' || data.msg === '!skip') {
          // 이미 내가 스킵 투표를 했는지 확인
          if (!roomData[data.roomCode].skipCount.has(data.socketId)) {
            roomData[data.roomCode].skipCount.add(data.socketId);
            data.wantSkip = true;   // 스킵을 희망하는, 정상적으로 저장됨을 알림

            // 참가 인원수 반절보다 스킵 희망이 많으면 스킵 진행
            if (roomData[data.roomCode].skipCount.size >= Math.ceil((roomData[data.roomCode].userList.length + 1) / 2)) {
              roomData[data.roomCode].isPlaying = WAITING_STATE;
              io.to(ROOM_CODE + data.roomCode).emit('answer song', roomData[data.roomCode].songList[0]);
              roomData[data.roomCode].songList[0].answer = [];    // 더 이상 정답 제출자가 없도록
              roomData[data.roomCode].skipCount.clear();
            }
          }
        }


        // 정답 제출한 채팅인지
        if (roomData[data.roomCode].songList[0].answer.includes( data.msg.replace(/\s/g, '').toLowerCase() )) {
          data.isAnswer = true; 
          roomData[data.roomCode].songList[0].answer = [];    // 더 이상 정답 제출자가 없도록
        }
      }

      io.to(ROOM_CODE + data.roomCode).emit('receive chat', data);
    } catch (e) {
      console.log('send chat', e);
    }
  });

  //================================
  // Room - Request Answer
  socket.on('request answer', data => {
    if (!roomData[data.roomCode])
      return;

    try {
      roomData[data.roomCode].isPlaying = WAITING_STATE;
      io.to(ROOM_CODE + data.roomCode).emit('answer song', roomData[data.roomCode].songList[0]);
    } catch (e) {
      console.log('request answer', e);
    }
  });

  //================================
  // Room - Request Next Song
  socket.on('request next', data => {
    if (!roomData[data.roomCode])
      return;
      
    try {
      if (roomData[data.roomCode].isPlaying !== STARTING_STATE) {
        roomData[data.roomCode].songList.shift();
      }
      roomData[data.roomCode].isPlaying = PLAYING_STATE;
      if (roomData[data.roomCode] && roomData[data.roomCode].isPlaying) {
        nextSong(data.roomCode);
      }
    } catch (e) {
      console.log('request next', e);
    }
  });

  function checkLanguage(lang) {
    if (lang === 'en')
      return songDataEN;
    else if (lang === 'jp')
      return songDataJP;
    return songData;
  }

  //================================
  // Game - Game Start
  socket.on('game start', (data) => {
    if (roomData[data.roomCode].isPlaying !== READY_STATE)  // 이 상태가 아니라면 이미 게임중이 호출된 상태
      return;
    
    roomData[data.roomCode].isPlaying = STARTING_STATE;
    
    try {
      roomData[data.roomCode].songList = _.cloneDeep(checkLanguage(roomData[data.roomCode].language).filter((song, idx) => {
        let isHave = false;

        // 원하지 않는 태그가 있는지 확인
        roomData[data.roomCode].unWanted.forEach(unWantTag => {
          if (song.tags.includes(unWantTag)) {
            isHave = true;
            return false;
          }
        });
        
        // 원하지 않는 태그가 있었기 때문에 해당 곡은 버림
        if (isHave) {
          return false;
        }

        // 원하는 태그가 있는지 확인 있다면 해당 곡을 추가
        roomData[data.roomCode].songTags.forEach(wantTag => {
          if (song.tags.includes(wantTag)) {
            isHave = true;
            return false;
          }
        });
        return isHave;
      }));
      shuffle(roomData[data.roomCode].songList);
      if (roomData[data.roomCode].songList.length > roomData[data.roomCode].maxSongNum) {
        roomData[data.roomCode].songList = roomData[data.roomCode].songList.slice(0, roomData[data.roomCode].maxSongNum);
      }

      io.to(ROOM_CODE + data.roomCode).emit('game start', { songLength: roomData[data.roomCode].songList.length   });

      // 클라에서 5초후 게임 시작 할 수 있게 변경됨
      // nextSong(data.roomCode);
    } catch (e) {
      console.log('game start', e);
    }
  });


  //================================
  // Disconnecting
  socket.on('disconnecting', function() {
    console.log("disconnect : ", socket.id);

    try {
      // 속해있는 방이 있다면 처리함
      socket.rooms.forEach((roomCode) => {
        // 해당 방에는 ROOM_CODE 값이 들어가 있는 방이기 떄문에 그 크기만큼 짤라줌
        outRoomCheck(roomCode.slice(ROOM_CODE.length), socket.id);
      })
    } catch (e) {
      console.log('disconnect', e);
    }
  });

});

module.exports = app;
