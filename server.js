const express = require("express");
const app = express();
const { v4: uuidV4 } = require("uuid");

let broadcasters = new Map();
let watchers = new Map();
const port = 4000;

const http = require("http");
const server = http.createServer(app);

const io = require("socket.io")(server);
app.engine("html", require("ejs").renderFile);

app.use(express.static(__dirname + "/public"));

app.use("/broadcaster", (req, res) => {
  res.redirect(`/broadcast/${uuidV4()}`);
});

app.use("/broadcast/:roomID", (req, res) => {
  res.render(__dirname + "/public/broadcast.html", {
    roomID: req.params.roomID,
  });
});

app.use("/watcher/:roomID", (req, res) => {
  res.render(__dirname + "/public/index.html", {
    roomID: req.params.roomID,
  });
});

io.sockets.on("error", (e) => console.log(e));
io.sockets.on("connection", (socket) => {
  console.log("NEW CONNECTION");

  socket.on("broadcaster", (roomID) => {
    console.log("NEW BROADCASTER: " + roomID);
    broadcasters.set(socket.id,roomID);
    socket.join(roomID);

    console.log(broadcasters);
    socket.broadcast.emit("broadcaster", roomID);
  });

  socket.on("watcher", (roomID) => {
    console.log("NEW WATCHER: " + socket.id);
    socket.join(roomID);
    socket.to(roomID).emit("watcher", socket.id);
  });

  socket.on("offer", (id, message) => {
    console.log("OFFER: " + id);
    socket.to(id).emit("offer", socket.id, message);
  });

  socket.on("answer", (id, message) => {
    console.log("ANSWER: " + id);
    socket.to(id).emit("answer", socket.id, message);
  });

  socket.on("candidate", (id, message) => {
    console.log("CANDIDATE: " + id);
    socket.to(id).emit("candidate", socket.id, message);
  });

  socket.on("bandwidthChange", (id, bandwidth, roomID) => {
    socket.to(roomID).emit('bandwidthUpdate', socket.id, bandwidth);
  })

  socket.on("disconnect", () => {
    console.log("DISCONNECT");
    console.log("Room ID: "+ broadcasters.get(socket.id));
    socket.to(broadcasters.get(socket.id)).emit("disconnectPeer", socket.id);
  });
});
server.listen(port, () => console.log(`Server is running on port ${port}`));
