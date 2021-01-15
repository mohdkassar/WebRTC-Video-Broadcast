const peerConnections = {};
var width = 320; // We will scale the photo width to this
var height = 320; // This will be computed based on the input stream
let lastResult;

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
document.getElementById("room ID").innerHTML = roomID;

socket.on("answer", (id, description) => {
  peerConnections[id].setRemoteDescription(description);
});

socket.on('bandwidthUpdate', (id, bandwidth) => {
  const peerConnection = peerConnections[id];
  console.log('Bandwidth: '+bandwidth)
    // In Chrome, use RTCRtpSender.setParameters to change bandwidth without
  // (local) renegotiation. Note that this will be within the envelope of
  // the initial maximum bandwidth negotiated via SDP.
  if ((adapter.browserDetails.browser === 'chrome' ||
       adapter.browserDetails.browser === 'safari' ||
       (adapter.browserDetails.browser === 'firefox' &&
        adapter.browserDetails.version >= 64)) &&
      'RTCRtpSender' in window &&
      'setParameters' in window.RTCRtpSender.prototype) {
    const sender = peerConnection.getSenders()[0];
    const parameters = sender.getParameters();
    if (!parameters.encodings) {
      parameters.encodings = [{}];
    }
    if (bandwidth === 'unlimited') {
      delete parameters.encodings[0].maxBitrate;
    } else {
      parameters.encodings[0].maxBitrate = bandwidth * 1000;
    }
    sender.setParameters(parameters)
        .then(() => {
          console.log('we are here')
          peerConnection.createOffer().then((sdp) => peerConnection.setLocalDescription(sdp))
          .then(() => {
            console.log('.....');
            const desc = {
              type: peerConnection.remoteDescription.type,
              sdp: bandwidth === 'unlimited' ?
              removeBandwidthRestriction(peerConnection.remoteDescription.sdp) :
              updateBandwidthRestriction(peerConnection.remoteDescription.sdp, bandwidth)
            };
            console.log('Applying bandwidth restriction to setRemoteDescription:\n' +
            desc.sdp);
            peerConnection.setRemoteDescription(desc);
          })
        })
        .catch(e => console.error(e));
    return;
  }

})

socket.on("watcher", (id) => {
  const peerConnection = new RTCPeerConnection(config);
  peerConnections[id] = peerConnection;

  let stream = videoElement.srcObject;
  stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };
// query getStats every second
window.setInterval(() => {
  if (!peerConnection) {
    return;
  }
  const sender = peerConnection.getSenders()[0];
  if (!sender) {
    return;
  }
  sender.getStats().then(res => {
    res.forEach(report => {
      let bytes;
      let headerBytes;
      let packets;
      if (report.type === 'outbound-rtp') {
        if (report.isRemote) {
          return;
        }
        const now = report.timestamp;
        bytes = report.bytesSent;
        headerBytes = report.headerBytesSent;

        packets = report.packetsSent;
        if (lastResult && lastResult.has(report.id)) {
          // calculate bitrate
          const bitrate = 8 * (bytes - lastResult.get(report.id).bytesSent) /
            (now - lastResult.get(report.id).timestamp);
          const headerrate = 8 * (headerBytes - lastResult.get(report.id).headerBytesSent) /
            (now - lastResult.get(report.id).timestamp);

          // append to chart
          console.log('Bit Rate: '+ bitrate);
          console.log('Header Rate: '+ headerrate);

          // calculate number of packets and append to chart
          // packetSeries.addPoint(now, packets -
          //   lastResult.get(report.id).packetsSent);
          // packetGraph.setDataSeries([packetSeries]);
          // packetGraph.updateEndDate();
        }
      }
    });
    lastResult = res;
  });
}, 1000);
  peerConnection
    .createOffer()
    .then((sdp) => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit("offer", id, peerConnection.localDescription);
    });
});

socket.on("candidate", (id, candidate) => {
  peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("disconnectPeer", (id) => {
  peerConnections[id].close();
  delete peerConnections[id];
});

window.onunload = window.onbeforeunload = () => {
  socket.close();
};

// Get camera and microphone
const videoElement = document.querySelector("video");
const audioSelect = document.querySelector("select#audioSource");
const videoSelect = document.querySelector("select#videoSource");
const canvas = document.getElementById("canvas");

audioSelect.onchange = getStream;
videoSelect.onchange = getStream;

getStream().then(getDevices).then(gotDevices);

function getDevices() {
  return navigator.mediaDevices.enumerateDevices();
}

function gotDevices(deviceInfos) {
  window.deviceInfos = deviceInfos;
  for (const deviceInfo of deviceInfos) {
    const option = document.createElement("option");
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === "audioinput") {
      option.text = deviceInfo.label || `Microphone ${audioSelect.length + 1}`;
      audioSelect.appendChild(option);
    } else if (deviceInfo.kind === "videoinput") {
      option.text = deviceInfo.label || `Camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    }
  }
  // window.setInterval(function () {
  //   takepicture();
  // }, 5000);
}

function getStream() {
  if (window.stream) {
    window.stream.getTracks().forEach((track) => {
      track.stop();
    });
  }
  const audioSource = audioSelect.value;
  const videoSource = videoSelect.value;
  const constraints = {
    audio: { deviceId: audioSource ? { exact: audioSource } : undefined },
    video: { deviceId: videoSource ? { exact: videoSource } : undefined },
  };
  return navigator.mediaDevices
    .getUserMedia(constraints)
    .then(gotStream)
    .catch(handleError);
}

function gotStream(stream) {
  window.stream = stream;
  audioSelect.selectedIndex = [...audioSelect.options].findIndex(
    (option) => option.text === stream.getAudioTracks()[0].label
  );
  videoSelect.selectedIndex = [...videoSelect.options].findIndex(
    (option) => option.text === stream.getVideoTracks()[0].label
  );
  videoElement.srcObject = stream;
  socket.emit("broadcaster", roomID);
}

function takepicture() {
  console.log("test");
  var context = canvas.getContext("2d");
  if (width && height) {
    console.log("test");

    canvas.width = width;
    canvas.height = height;
    context.drawImage(videoElement, 0, 0, width, height);

    var data = canvas.toDataURL("image/png");
    photo.setAttribute("src", data);
  }
}

function handleError(error) {
  console.error("Error: ", error);
}

function updateBandwidthRestriction(sdp, bandwidth) {
  console.log('Updating Bandwidth');
  let modifier = 'AS';
  if (adapter.browserDetails.browser === 'firefox') {
    bandwidth = (bandwidth >>> 0) * 1000;
    modifier = 'TIAS';
  }
  if (sdp.indexOf('b=' + modifier + ':') === -1) {
    // insert b= after c= line.
    sdp = sdp.replace(/c=IN (.*)\r\n/, 'c=IN $1\r\nb=' + modifier + ':' + bandwidth + '\r\n');
  } else {
    sdp = sdp.replace(new RegExp('b=' + modifier + ':.*\r\n'), 'b=' + modifier + ':' + bandwidth + '\r\n');
  }
  return sdp;
}

function removeBandwidthRestriction(sdp) {
  return sdp.replace(/b=AS:.*\r\n/, '').replace(/b=TIAS:.*\r\n/, '');
}
