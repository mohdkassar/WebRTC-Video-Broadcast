const express = require("express");
const { v4: uuidV4 } = require("uuid");

//Keep a list of the broadcasters that are connected to the websocket
let broadcasters = new Map();
//Keep a list of the watchers that are connected to the websocket
let watchers = {};

const port = 4000;

const https = require("https");
const fs = require("fs");

var key = fs.readFileSync(__dirname + "/selfsigned.key");
var cert = fs.readFileSync(__dirname + "/selfsigned.crt");
var options = {
  key: key,
  cert: cert,
};
const app = express();
const server = https.createServer(options, app);

const io = require("socket.io")(server);
app.engine("html", require("ejs").renderFile);

app.use(express.static(__dirname + "/public"));

//Broadcaster URL
app.use("/broadcaster", (req, res) => {
  res.redirect(`/broadcast/${uuidV4()}`);
});

//Broadcaster URL with Room ID. Redirected from Broadcaster URL
app.use("/broadcast/:roomID", (req, res) => {
  res.render(__dirname + "/public/broadcast.html", {
    roomID: req.params.roomID,
  });
});

//Watcher URL with Room ID
app.use("/watcher/:roomID", (req, res) => {
  res.render(__dirname + "/public/index.html", {
    roomID: req.params.roomID,
  });
});

//WebSockets
io.sockets.on("error", (e) => console.log(e));
io.sockets.on("connection", (socket) => {
  console.log("NEW CONNECTION");

  //Event triggered when a new broadcaster enters
  socket.on("broadcaster", (roomID) => {
    console.log("NEW BROADCASTER: " + roomID);
    //Add to HashMap
    broadcasters.set(socket.id, roomID);
    //Joining Room
    socket.join(roomID);
    console.log(broadcasters);
    socket.broadcast.emit("broadcaster", roomID);
  });

  //Event triggered when a new broadcaster enters
  socket.on("watcher", (roomID) => {
    console.log("NEW WATCHER: " + socket.id);
    //Joining Room
    socket.join(roomID);
    //Add to HashMap
    watchers[socket.id] = roomID;
    socket.to(roomID).emit("watcher", socket.id);
  });

  //Triggered when Broadcaster offers, after a new watcher joins the room
  socket.on("offer", (id, message) => {
    console.log("OFFER: " + id);
    socket.to(id).emit("offer", socket.id, message);
  });

  //Triggered when watcher answers an offer by the broadcaster
  socket.on("answer", (id, message) => {
    console.log("ANSWER: " + id);
    socket.to(id).emit("answer", socket.id, message);
  });

  //ICE Candidate exchanged by both the broadcaster and the watchers
  socket.on("candidate", (id, message) => {
    console.log("CANDIDATE: " + id);
    socket.to(id).emit("candidate", socket.id, message);
  });

  //Triggered when watcher requests to change the bandwidth
  socket.on("bandwidthChange", (id, bandwidth, roomID) => {
    socket.to(roomID).emit("bandwidthUpdate", socket.id, bandwidth);
  });

  //Triggered whn a broadcaster or a watchers disconnects from the websocket
  socket.on("disconnect", () => {
    console.log("DISCONNECT");
    //Check if a broadcaster disconnected
    if (broadcasters.get(socket.id)) {
      console.log("Room ID: " + broadcasters.get(socket.id));
      //Inform watchers that the broadcaster disconnected from the websocket
      socket.to(broadcasters.get(socket.id)).emit("disconnectPeer", socket.id);
    }
    //If a watcher disconnected
    else {
      const roomID = watchers[socket.id];
      console.log("Watcher Room ID: " + roomID);
      //Inform broadcaster that a watcher disconnected
      socket.to(roomID).emit("watcherDisconnect", socket.id);
    }
  });
});
server.listen(port, () => console.log(`Server is running on port ${port}`));
