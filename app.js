var express = require('express');
// var createError = require('http-errors');
// var path = require('path');
// var cookieParser = require('cookie-parser');
// var logger = require('morgan');


var app = express();
const port = process.env.PORT || 4000;
// app.set('port', port);

const server = require('http').createServer(app);

// var indexRouter = require('./routes/index');
// var usersRouter = require('./routes/users');


// // view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');

// app.use(logger('dev'));
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(express.static(path.join(__dirname, 'public')));

// app.use('/', indexRouter);
// app.use('/users', usersRouter);


// const io = require("socket.io")(server);
const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});




io.on('connection', (socket) => {
  console.log("연결된 socketID : ", socket.id);

  io.to(socket.id).emit('my socket id', { socketId: socket.id });

  socket.on('enter chatroom', () => {
    console.log('채팅방에 입장함');
    socket.broadcast.emit('receive chat', {
      type: 'alert',
      chat: '입장했습니다',
      regData: Date.now()
    });
  });

  socket.on('send chat', data => {
    console.log(`${socket.id} : ${data.chat}`);
    io.emit('receive chat', data);
  });

  socket.on('leave chatroom', data => {
    console.log('leave chatroom', data);
    socket.broadcast.emit('receive chat', {
      type: 'alert',
      chat: '퇴장했습니다',
      regData: Date.now()
    });
  });


});




// // catch 404 and forward to error handler
// app.use(function(req, res, next) {
//   next(createError(404));
// });

// // error handler
// app.use(function(err, req, res, next) {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};

//   // render the error page
//   res.status(err.status || 500);
//   res.render('error');
// });

module.exports = app;
