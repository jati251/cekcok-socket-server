require("dotenv").config();
const { createServer } = require("http");
const express = require("express");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Message = require("./models/message");
const Notification = require("./models/notification");
const connectToDB = require("./utils/database");

const app = express();
const server = createServer(app);
const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const port = process.env.PORT || 3000;

app.use(express.json());

// Route for basic health check
app.get("/", (req, res) => {
  res.send("Socket.IO and MongoDB server running");
});

// Initialize Socket.IO
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on(
    "privateMessage",
    async ({ roomId, recipientId, message, senderId }) => {
      try {
        const newMessage = new Message({ message, senderId, recipientId });
        await newMessage.save();

        const newNotification = new Notification({
          data: { message },
          sender: senderId,
          recipient: recipientId,
          type: "message",
        });
        await newNotification.save();

        io.to(roomId).emit("receivePrivateMessage", {
          message,
          senderId,
          recipientId,
          createdAt: newMessage.createdAt,
        });

        socket.emit("messageSent", {
          message,
          senderId,
          recipientId,
          createdAt: newMessage.createdAt,
        });
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  );

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// Connect to MongoDB and start the server
connectToDB().then(() => {
  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});
