var crypto = require('crypto');
var hash = function(secret) {
	var sha1 = crypto.createHash('sha1');
	return sha1.update(secret.toString()).digest('hex');
};
module.exports = function (socket) {
  socket.on('join', function(room) {
    socket.join(room);
  });
  socket.on('leave', function(room) {
    socket.leave(room);
  });
  socket.on('slidechanged', function(data) {
    if(!data.secret || !data.socketId) return;
    if(hash(data.secret) === data.socketId) {
      data.secret = null;
      socket.broadcast.to(data.socketId).emit(data.socketId, data);
    }
  });
  socket.on('slidesaved', function(data) {
    if(!data.multiplex.secret || !data.multiplex.id) return;
    if(hash(data.multiplex.secret) === data.multiplex.id) {
			data.multiplex.secret = null;
	    socket.broadcast.to(data.multiplex.id).emit('slideupdated', data);
		}
  });
};
