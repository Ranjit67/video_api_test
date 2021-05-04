const express = require("express");
const socket = require("socket.io");

const app = express();
const http = require("http");
const server = http.createServer(app);
const io = socket(server, {
  cors: {
    origin: "https://exposium-live-2021.web.app",
  },
});
const requestList = {};
const stallId = {};
const userId = {};
const userWantToConnect = {};
const stallSoIdToId = {};
const userSoIdToId = {};
const stallToConnect = {};
const userToConnect = {};

io.on("connection", (socket) => {
  socket.on("send request to stall", (payload) => {
    // console.log(payload);
    userWantToConnect[payload.user] = payload.stall;
    if (!requestList[payload.stall]) {
      requestList[payload.stall] = [];
    }
    if (userId[payload.user]) {
      userId[payload.user] = socket.id;

      userSoIdToId[socket.id] = payload.user;
    } else {
      userId[payload.user] = socket.id;
      userSoIdToId[socket.id] = payload.user;
      requestList[payload.stall].push(payload.user);
      if (stallId[payload.stall]) {
        io.to(stallId[payload.stall]).emit("already exited stall owner", {
          user: payload.user,
        });
      }
    }
  });
  //for stall
  socket.on("requested list", (payload) => {
    stallId[payload.stall] = socket.id;
    stallSoIdToId[socket.id] = payload.stall;
    if (requestList[payload?.stall]) {
      socket.emit("list of the request", { list: requestList[payload.stall] });
    }
  });
  socket.on("sending signal", (payload) => {
    const { userToSignal, callerID, signal, stall } = payload;
    // update stallSoIdToId

    delete stallSoIdToId[stallId[stall]];
    delete userWantToConnect[userToSignal];
    stallSoIdToId[socket.id] = stall;
    stallId[stall] = socket.id;
    stallToConnect[stall] = userToSignal;
    userToConnect[userToSignal] = stall;
    io.to(userId[userToSignal]).emit("signal to user", { callerID, signal });
  });
  socket.on("returning signal", (payload) => {
    const { signal, callerId } = payload;

    io.to(callerId).emit("send signal to stall", { signal });
  });

  socket.on("call reject", (payload) => {
    const { stallId, rejectedId } = payload;
    const afterReject = requestList[stallId].filter((id) => id !== rejectedId);
    requestList[stallId] = afterReject;
    io.to(userId[rejectedId]).emit("stall reject to user", "data");
  });
  //mic status
  socket.on("micro phone status", (payload) => {
    const { selfId, micStatus } = payload;
    if (stallToConnect[selfId]) {
      io.to(userId[stallToConnect[selfId]]).emit("send mic status to user", {
        micStatus,
      });
    } else if (userToConnect[selfId]) {
      io.to(stallId[userToConnect[selfId]]).emit("send mic status to stall", {
        micStatus,
      });
    } else {
      socket.emit("wait for connection", "audio");
    }
  });
  //mic end
  // video status
  socket.on("video status send", (payload) => {
    const { selfId, videoStatus } = payload;
    if (stallToConnect[selfId]) {
      io.to(userId[stallToConnect[selfId]]).emit("send video status to user", {
        videoStatus,
      });
    }
    if (userToConnect[selfId]) {
      io.to(stallId[userToConnect[selfId]]).emit("send video status to stall", {
        videoStatus,
      });
    }
  });
  socket.on("End call", (payload) => {
    const { selfId } = payload;
    if (stallToConnect[selfId]) {
      //stall
      const stillHave = requestList[selfId].filter(
        (id) => id !== stallToConnect[selfId]
      );
      requestList[selfId] = stillHave;
      const tempUserId = userId[stallToConnect[selfId]];
      delete userSoIdToId[userId[stallToConnect[selfId]]];
      delete userId[stallToConnect[selfId]];
      delete userToConnect[stallToConnect[selfId]];
      delete stallToConnect[selfId];
      io.to(tempUserId).emit("Disconnect call", "to user");
      socket.emit("you are disconnected", "self disconnected");
    }
    if (userId[selfId]) {
      if (userToConnect[selfId]) {
        const tempStallId = stallId[userToConnect[selfId]];
        const haveData = requestList[userToConnect[selfId]].filter(
          (id) => id !== selfId
        );
        requestList[userToConnect[selfId]] = haveData;
        delete userSoIdToId[userId[selfId]];
        delete userId[selfId];
        delete userToConnect[selfId];
        delete stallToConnect[userToConnect[selfId]];
        io.to(tempStallId).emit("Disconnect call", "to stall");
        socket.emit("you are disconnected", "self disconnected");
      }
    }
  });
  socket.on("no one connected disconnect", (payload) => {
    const { selfId } = payload;
    delete userId[selfId];
    delete userSoIdToId[socket.id];
    console.log(userWantToConnect[selfId]);
    const exitUser = requestList[userWantToConnect[selfId]].filter(
      (id) => id !== selfId
    );
    requestList[userWantToConnect[selfId]] = exitUser;
    delete userWantToConnect[selfId];
    socket.emit("you are disconnected", "self disconnected");
  });

  //video status end
  //chat section
  socket.on("send message user", (payload) => {
    const { message, userSelf } = payload;

    io.to(stallId[userToConnect[userSelf]]).emit("receive message", {
      senderId: userSelf,
      message,
    });
  });
  socket.on("send message stall", (payload) => {
    const { message, stallSelf } = payload;
    io.to(userId[stallToConnect[stallSelf]]).emit("receive message", {
      senderId: stallSelf,
      message,
    });
  });
  //chat section end

  socket.on("disconnect", () => {
    // console.log(socket.id);
    //stall disconnected
    if (stallSoIdToId[socket.id]) {
      // console.log("This the stall");
      delete stallId[stallSoIdToId[socket.id]];
      // stallToConnect[stallSoIdToId[socket.id]] = userToSignal;
      if (stallToConnect[stallSoIdToId[socket.id]]) {
        io.to(userId[stallToConnect[stallSoIdToId[socket.id]]]).emit(
          "stall owner disconnect call",
          "data"
        );
      }
      // delete userSoIdToId[userId[stallToConnect[stallSoIdToId[socket.id]]]];
      // delete userId[stallToConnect[stallSoIdToId[socket.id]]];
      // delete userToConnect[stallToConnect[stallSoIdToId[socket.id]]];
      delete stallToConnect[stallSoIdToId[socket.id]];
      delete stallSoIdToId[socket.id];
    }
    //user Disconnected
    if (userSoIdToId[socket.id]) {
      if (userToConnect[userSoIdToId[socket.id]]) {
        const withdrawUser = requestList[
          userToConnect[userSoIdToId[socket.id]]
        ].filter((id) => id !== userSoIdToId[socket.id]);
        requestList[userToConnect[userSoIdToId[socket.id]]] = withdrawUser;
        //request lit remove end
        // console.log(stallId[userToConnect[userSoIdToId[socket.id]]]);
        io.to(stallId[userToConnect[userSoIdToId[socket.id]]]).emit(
          "User is disconnected",
          "data"
        );
        delete stallToConnect[userToConnect[userSoIdToId[socket.id]]];
        delete userToConnect[userSoIdToId[socket.id]];
        delete userId[userSoIdToId[socket.id]];
        delete userSoIdToId[socket.id];
      } else {
        delete userId[userSoIdToId[socket.id]];
        // console.log(userWantToConnect[userSoIdToId[socket.id]]);
        if (userWantToConnect[userSoIdToId[socket.id]]) {
          const exitRequest = requestList[
            userWantToConnect[userSoIdToId[socket.id]]
          ].filter((id) => id !== userSoIdToId[socket.id]);
          requestList[userWantToConnect[userSoIdToId[socket.id]]] = exitRequest;
          io.to(
            stallId[userWantToConnect[userSoIdToId[socket.id]]]
          ).emit("remove user", { newRequestList: exitRequest });

          delete userWantToConnect[userSoIdToId[socket.id]];
          delete userSoIdToId[socket.id];
        }
      }

      // console.log("User disconnect..");
    }
  });
});

server.listen(process.env.PORT || 5000, () => {
  console.log("The port 5000 is ready to start");
});
