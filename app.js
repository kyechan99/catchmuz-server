var express = require('express');
var app = express();
const port = process.env.PORT || 4000;
var _ = require('lodash');

const server = require('http').createServer(app);
const songData = require('./song/song_kr.json');

const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});


const ROOM_CODE = 'ROOM_';
const READY_STATE = 0;
const PLAYING_STATE = 1;
const WAITING_STATE = 2;

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
  console.log("연결된 socketID : ", socket.id);

  // 접속하면 socketId를 저장하게함 io.to(socket.id)
  socket.emit('my socket id', {
    socketId: socket.id,
    server_version: 'v0.1.0'
  });

  function nextSong(roomCode) {
    if (roomData[roomCode].songList.length > 0) {
      io.to(ROOM_CODE + roomCode).emit('next song', roomData[roomCode].songList[0]);
    } else {
      roomData[roomCode].isPlaying = READY_STATE;
      io.to(ROOM_CODE + roomCode).emit('game end');
    }
  }

  function outRoomCheck(roomCode, socketId) {
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
  }

  //================================
  // Room - Create
  socket.on('create room', (data) => {
    roomIdx++;
    
    roomData[roomIdx] = {
      songTags: data.tags,
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
      isPlaying: READY_STATE
    };

    socket.join(ROOM_CODE + roomIdx);
    socket.emit('get room code', { roomCode: roomIdx });
  });

  //================================
  // Room - Join
  socket.on('join room', (data) => {
    // 존재하는 방인지
    if (roomData[data.roomCode] != undefined) {
      
      // 해당 방에 내가 이미 들어와 있는지
      if (roomData[data.roomCode].userList.length > 0) {
        
        // 방장인지 아닌지 확인
        if (roomData[data.roomCode].userList.filter(e => e.socketId === data.user.socketId).length > 0) {
          socket.emit('your manager', roomData[data.roomCode].songTags);
        
        } else {
          
          // 인원수 체크
          if (roomData[data.roomCode].userList.length + 1 > roomData[data.roomCode].maxUserNum ||
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
  });

  //================================
  // Room - Exit
  socket.on('exit room', (data) => {
    socket.leave(ROOM_CODE + data.roomCode);

    outRoomCheck(data.roomCode, data.socketId);
  });

  //================================
  // Room - Get List
  socket.on('get room list', () => {
    io.emit('get room list', Object.keys(roomData).filter((key) => {
          return !roomData[key].isPlaying;
      }).reduce((obj, key, idx) => {
          // console.log('grl', obj, key, idx);

          obj[key] = { ...roomData[key] };
          obj[key].curUserNum = obj[key].userList.length;
          delete obj[key].userList;
          return obj;
      }, {}));
  });

  //================================
  // Room - Send Chat
  socket.on('send chat', data => {
    data.isAnswer = false;
    if (roomData[data.roomCode].isPlaying === PLAYING_STATE) {
      // Check is Answer
      if (roomData[data.roomCode].songList[0].answer.includes( data.msg.replace(/\s/g, '').toLowerCase() )) {
        data.isAnswer = true; 
        roomData[data.roomCode].songList[0].answer = [];    // 더 이상 정답 제출자가 없도록
      }
    }

    io.to(ROOM_CODE + data.roomCode).emit('receive chat', data);
  });

  //================================
  // Room - Request Answer
  socket.on('request answer', data => {
    roomData[data.roomCode].isPlaying = WAITING_STATE;
    io.to(ROOM_CODE + data.roomCode).emit('answer song', roomData[data.roomCode].songList[0]);
  });

  //================================
  // Room - Request Next Song
  socket.on('request next', data => {
    roomData[data.roomCode].isPlaying = PLAYING_STATE;
    roomData[data.roomCode].songList.shift();
    if (roomData[data.roomCode] && roomData[data.roomCode].isPlaying) {
      nextSong(data.roomCode);
    }
  });

  //================================
  // Game - Game Start
  socket.on('game start', (data) => {
    if (roomData[data.roomCode].isPlaying !== READY_STATE)  // 이 상태가 아니라면 이미 게임중이 호출된 상태
      return;
    
    roomData[data.roomCode].isPlaying = PLAYING_STATE;
    
    roomData[data.roomCode].songList = _.cloneDeep(songData.filter((song, idx) => {
      return (song.tags.includes(roomData[data.roomCode].songTags[0]));
    }));
    shuffle(roomData[data.roomCode].songList);
    if (roomData[data.roomCode].songList.length > roomData[data.roomCode].maxSongNum) {
      roomData[data.roomCode].songList = roomData[data.roomCode].songList.slice(0, roomData[data.roomCode].maxSongNum);
    }

    io.to(ROOM_CODE + data.roomCode).emit('game start', { songLength: roomData[data.roomCode].songList.length   });

    nextSong(data.roomCode);
  });


  //================================
  // Disconnecting
  socket.on('disconnecting', function() {
    console.log("disconnect : ", socket.id);

    // 속해있는 방이 있다면 처리함
    socket.rooms.forEach((roomCode) => {
      // 해당 방에는 ROOM_CODE 값이 들어가 있는 방이기 떄문에 그 크기만큼 짤라줌
      outRoomCheck(roomCode.slice(ROOM_CODE.length), socket.id);
    })
  });

});

module.exports = app;
