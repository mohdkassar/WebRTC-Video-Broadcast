let peerConnection;
let maxBandwidth = 0;

//STUN adn TURN Server configuration

const config = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
    // {
    //   "urls": "turn:TURN_IP?transport=tcp",
    //   "username": "TURN_USERNAME",
    //   "credential": "TURN_CREDENTIALS"
    // }
  ],
};

const socket = io.connect(window.location.origin);
const video = document.querySelector("video");
const enableAudioButton = document.querySelector("#enable-audio");
const bandwidthSelector = document.getElementById("bandwidth");
const disconnectedBroadcaster = document.getElementById("disconnected");

enableAudioButton.addEventListener("click", enableAudio);

//Triggered after the Broadcaster sends an Offer
socket.on("offer", (id, description) => {
  if (!peerConnection) {
    peerConnection = new RTCPeerConnection(config);
  }
  peerConnection
    .setRemoteDescription(description)
    .then(() => peerConnection.createAnswer())
    .then((sdp) => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit("answer", id, peerConnection.localDescription);
    });
  //Stream video when track is available
  peerConnection.ontrack = (event) => {
    video.srcObject = event.streams[0];
    bandwidthSelector.disabled = false;
    disconnectedBroadcaster.style.display = "none";
  };
  //Triggered when the peer connection sends ICE Candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };
});

//Triggered when the peer connection sends ICE Candidates
socket.on("candidate", (id, candidate) => {
  peerConnection
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch((e) => console.error(e));
});

//Triggered when the broadcaster is disconnected
socket.on("disconnectPeer", (id) => {
  console.log("disconnedtedd");
  //Inform watcher that the broadcaster is disconnected
  disconnectedBroadcaster.style.display = "block";
  bandwidthSelector.disabled = true;
});

//Triggered when the socket connection is established
socket.on("connect", () => {
  //Start the Peer-to-Peer Connection Establishment Phase
  socket.emit("watcher", roomID);
});

//Triggered when the broadcaster joins the room after disconnecting
socket.on("broadcaster", () => {
  socket.emit("watcher");
});

window.onunload = window.onbeforeunload = () => {
  socket.close();
  peerConnection.close();
};

function enableAudio() {
  console.log("Enabling audio");
  video.muted = false;
}

//Bandwidth Selector
bandwidthSelector.onchange = () => {
  bandwidthSelector.disabled = true;
  const bandwidth =
    bandwidthSelector.options[bandwidthSelector.selectedIndex].value;
  console.log(bandwidth);
  //Inform Broadcaster about updated bandwidth
  socket.emit("bandwidthChange", socket.id, bandwidth, roomID);
  bandwidthSelector.disabled = false;
};
