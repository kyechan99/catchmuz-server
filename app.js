var express = require('express');
var app = express();
const port = process.env.PORT || 4000;

const server = require('http').createServer(app);

const ROOM_CODE = 'ROOM_';

const songData = require('./song/song_kr.json');

console.log(songData);

console.log(songData.filter((song, idx) => {
  return (song.tags.includes('TOP100'));
}))

const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});


let roomData = {

  0: {
    songTags: ['임시', '태그', '방'],
    maxSongNum: 30,
    maxUserNum: 10,
    userList: [
      {
        socketId: '',
        nickname: '',
        profile: 1,
        color: 0
      }
    ],
    songList: [],
    isPlaying: false
  }

};

let roomIdx = 0;


io.on('connection', (socket) => {
  console.log("연결된 socketID : ", socket.id);

  // 접속하면 socketId를 저장하게함 io.to(socket.id)
  socket.emit('my socket id', { 
    socketId: socket.id
  });


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
          color: 0
        }
      ],
      songList: [],
      isPlaying: false
    };

    socket.join(ROOM_CODE + roomIdx);
    socket.emit('get room code', { roomCode: roomIdx });
  });

  //================================
  // Room - Join
  socket.on('join room', (data) => {
    console.log('JOIN ROOM', roomData[data.roomCode], data.user.socketId);

    // 존재하는 방인지
    if (roomData[data.roomCode] != undefined) {
      // 해당 방에 내가 이미 들어와 있는지
      if (roomData[data.roomCode].userList.length > 0) {
        if (roomData[data.roomCode].userList.filter(e => e.socketId === data.user.socketId).length > 0) {
          // 방장임
          socket.emit('your manager');
        } else {
          /// 방장이 아님

          /// TODO : 인원수 체크

          // 기존에 있던 유저들에게 내 데이터를 보내줌
          io.to(ROOM_CODE + data.roomCode).emit('someone join', data.user);

          // 나에게 전체 기존 유저 데이터들을 보내줌
          socket.emit('join room', roomData[data.roomCode].userList);

          roomData[data.roomCode].userList.push(data.user);

          socket.join(ROOM_CODE + data.roomCode);
        }
      }
    } else {
      // error : 없는 방
    }
  });

  //================================
  // Room - Exit
  socket.on('exit room', (data) => {
    socket.leave(ROOM_CODE + data.roomCode);

    if (!roomData[data.roomCode])
      return;

    // 인원수가 1이라면 나 혼자였던 방. 이제 내가 나갔으니 방을 삭제
    if (roomData[data.roomCode].userList.length <= 1) {
      delete roomData[data.roomCode];

    } else {
      const idx = roomData[data.roomCode].userList.findIndex((item) => {
        return item.socketId === data.socketId;
      });
      if (idx === -1) return;
      roomData[data.roomCode].userList.splice(idx, 1);

      io.to(ROOM_CODE + data.roomCode).emit('someone exit', data);
    }

    console.log('EXIT ROOM ', roomData);
  });

  //================================
  // Room - Get List
  socket.on('get room list', () => {
    io.emit('get room list', Object.keys(roomData).filter((key) => {
          return !roomData[key].isPlaying;
      }).reduce((obj, key, idx) => {
          obj[idx] = { ...roomData[key] };
          obj[idx].curUserNum = obj[idx].userList.length;
          delete obj[idx].userList;
          return obj;
      }, {}));

  });

  //================================
  // Room - Send Chat
  socket.on('send chat', data => {

    data.isAnswer = false;
    if (roomData[data.roomCode].isPlaying) {
      // Check is Answer
      if (roomData[data.roomCode].songList[0].answer.includes( data.msg.replace(/\s/g, '') )) {
        data.isAnswer = true; 
        roomData[data.roomCode].songList.shift();
      }
    }

    io.to(ROOM_CODE + data.roomCode).emit('receive chat', data);

    // if (data.isAnswer) {
    //   nextSong(data.roomCode);
    // }

  });

  socket.on('request next', data => {
    console.log('REQUEST NEXT SONG');

    if (roomData[data.roomCode] && roomData[data.roomCode].isPlaying) {
      nextSong(data.roomCode);
    }
  })

  function nextSong(roomCode) {
    if (roomData[roomCode].songList.length > 0) {
      io.to(ROOM_CODE + roomCode).emit('next song', roomData[roomCode].songList[0]);
    } else {
      roomData[roomCode].isPlaying = false;
      console.log('ERROR : No song found');
      io.to(ROOM_CODE + roomCode).emit('game end');
    }
  }

  //================================
  // Game - Game Start
  socket.on('game start', (data) => {
    console.log('GAME START !!!!!!!!!');
    roomData[data.roomCode].isPlaying = true;
    console.log(roomData[data.roomCode]);
    roomData[data.roomCode].songList = songData.filter((song, idx) => {
      return (song.tags.includes('TOP100'));
    });

    io.to(ROOM_CODE + data.roomCode).emit('game start', data);
    nextSong(data.roomCode);
  });



});

module.exports = app;
