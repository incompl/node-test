var app = require('http').createServer(server);
var io = require('socket.io').listen(app);
var fs = require('fs');
var _ = require('underscore');

var history = [];
var usedNames = {};

var HISTORY_SIZE = 10;

app.listen(8000);

// Server for static files
function server(req, res) {

  if (req.url.match(/jquery-1.6.4.min.js$/)) {
    serveFile('jquery-1.6.4.min.js', req, res);
  }
  else if (req.url.match(/style.css$/)) {
    serveFile('style.css', req, res);
  }
  else {
    serveFile('index.html', req, res);
  }

}

// How to serve a static file
function serveFile(fileName, req, res) {
  fs.readFile(__dirname + '/' + fileName, function(err, data) {
    if (err) {
      res.writeHead(500);
      res.end('Error loading file');
      return;
    }
    if (fileName.match(/\.js$/)) {
      res.writeHead(200, {'Content-Type': 'application/javascript'});
    }
    else if (fileName.match(/\.css$/)) {
      res.writeHead(200, {'Content-Type': 'text/css'});
    }
    res.end(data);
  });
}

// On connect...
io.sockets.on('connection', function(socket) {
  
  var name;
  
  // Show new user the recent chat history
  _.each(history, function(msg) {
    socket.emit('update', {msg:msg});
  });
  
  // Use the user's provided name, or make them a new one
  var providedName = socket.handshake.query.name;
  if (providedName && !usedNames[providedName]) {
    name = providedName;
  }
  else {
    if (providedName && usedNames[providedName]) {
      socket.emit('update-system', {msg:'The name ' + providedName + ' is already in use'})
    }
    name = 'Guest' + Math.round(Math.random() * 1000000);
  }
  
  usedNames[name] = true;
  
  socket.emit('setName', {name:name});
  
  socket.broadcast.emit('update-system', {msg:name + ' has connected'});
   
  // Someone sent a message to the chat room
  socket.on('create', function(data) {
    var msg = name + ': ' + data.msg;
    io.sockets.emit('update', {msg:msg});
    history.push(msg);
    if (history.length > HISTORY_SIZE) {
      history.shift();
    }
  });
  
  // Someone requested a name change
  socket.on('rename', function(data) {
      
    if (data.name === name) {
      return;
    }

    // Name is taken      
    if (usedNames[data.name]) {
      socket.emit('update-system', {msg:'Name already in use'})
      socket.emit('setName', {name:name});
      return;
    }
      
    // Name is invalid
    if (!data.name.match(/^[\w\d]+$/)) {
      socket.emit('update-system', {msg:'Invalid name: alphanumeric only'});
      socket.emit('setName', {name:name});
      return;
    }
      
    socket.broadcast.emit('update-system', {msg:name + ' is now known as ' + data.name});
    socket.emit('update-system', {msg:'You are now known as ' + data.name});
      
    // Keep track of what names are in use
    usedNames[name] = false;
    name = data.name;
    usedNames[name] = true;
    
  });
  
  // Free up name on disconnect
  socket.on('disconnect', function() {
    io.sockets.emit('update-system', {msg:name + ' has disconnected'});
    usedNames[name] = false;
  });
  
});