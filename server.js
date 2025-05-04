const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/cashier', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cashier.html'));
});

app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

// Add route for encoder page
app.get('/encoder', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'encoder.html'));
});

// Queue state - reset to 0 on server start
let currentNumber = 0;
const activeWindows = new Set();

// Queue data storage
let queueData = [];

// Function to calculate queue statistics
function calculateQueueStats() {
  const total = queueData.length;
  const waiting = queueData.filter(item => item.status === 'waiting').length;
  const called = queueData.filter(item => item.status === 'called').length;
  
  return {
    total,
    waiting,
    called
  };
}

// Generate a unique ID for queue items
function generateUniqueId() {
  return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Function to broadcast queue statistics to all clients
function broadcastQueueStats() {
  const stats = calculateQueueStats();
  io.emit('queueStats', stats);
}

// Reset function to clear all state
function resetAllState() {
  currentNumber = 0;
  activeWindows.clear();
  queueData = [];
  console.log('Queue state reset to 0 and window array cleared');
}

// Reset state on server start
resetAllState();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Send current state to new connections
  socket.emit('queueUpdate', { currentNumber });
  socket.emit('windowsUpdate', Array.from(activeWindows));
  socket.emit('queueStats', calculateQueueStats());
  
  // Register a new window
  socket.on('registerWindow', (windowId) => {
    activeWindows.add(windowId);
    socket.windowId = windowId;
    io.emit('windowsUpdate', Array.from(activeWindows));
    socket.emit('windowRegistered');
    console.log(`Window ${windowId} registered`);
  });
  
  // Handle request for queue statistics
  socket.on('requestQueueStats', () => {
    socket.emit('queueStats', calculateQueueStats());
  });
  
  // Handle next customer call
  socket.on('callNext', (data) => {
    const { windowId } = data;
    
    // Find the first waiting item in the queue
    const waitingItem = queueData.find(item => item.status === 'waiting');
    
    if (waitingItem) {
      // Update its status
      waitingItem.status = 'called';
      
      // Broadcast to all clients
      io.emit('customerCalled', {
        number: waitingItem.number,
        windowId: windowId,
        id: waitingItem.id,
        timestamp: waitingItem.timestamp
      });
      
      // Update current number
      currentNumber = waitingItem.number;
      
      // Update queue display with more information
      io.emit('queueUpdate', { 
        currentNumber,
        queueData: queueData
      });
      
      // Broadcast updated queue stats
      broadcastQueueStats();
      
      console.log(`Window ${windowId} called number ${waitingItem.number} (ID: ${waitingItem.id}) from queue`);
    } else {
      // No waiting numbers in queue
      socket.emit('noWaitingCustomers');
      
      console.log(`Window ${windowId} attempted to call next but no waiting customers`);
    }
  });
  
  // Handle call again (current number)
  socket.on('callAgain', (data) => {
    const { windowId, number } = data;
    console.log(`Window ${windowId} called number ${number} again`);
    // Broadcast to all clients
    io.emit('customerCalledAgain', {
      number: number,
      windowId: windowId
    });
  });
  
  // Handle queue reset
  socket.on('resetQueue', (data) => {
    const { newNumber, windowId } = data;
    currentNumber = parseInt(newNumber) || 0;
    console.log(`Window ${windowId} reset queue to number ${currentNumber}`);
    
    // Broadcast to all clients
    io.emit('queueReset', {
      newNumber: currentNumber,
      windowId: windowId
    });
    
    // Update queue display
    io.emit('queueUpdate', { currentNumber });
    
    // Broadcast updated queue stats
    broadcastQueueStats();
  });

  // Handle call specific number
  socket.on('callSpecific', (data) => {
    const { windowId, number, id, timestamp } = data;
    console.log(`Window ${windowId} called specific number ${number}`);
    
    // Update the number in the queue if it exists
    let index;
    if (id) {
      // If ID is provided, find by ID (most precise)
      index = queueData.findIndex(item => item.id === id);
    } else if (timestamp) {
      // If timestamp is provided, find by number and timestamp (precise)
      index = queueData.findIndex(item => 
        item.number.toString() === number.toString() && 
        item.timestamp.toString() === timestamp.toString() && 
        item.status === 'waiting'
      );
    } else {
      // Otherwise find first matching number that's waiting
      index = queueData.findIndex(item => item.number === number && item.status === 'waiting');
    }
    
    if (index !== -1) {
      queueData[index].status = 'called';
    }
    
    // Update current number
    currentNumber = number;
    
    // Broadcast to all clients
    io.emit('customerCalledSpecific', {
      number: number,
      windowId: windowId
    });
    
    // Update queue display
    io.emit('queueUpdate', { currentNumber });
    
    // Broadcast updated queue stats
    broadcastQueueStats();
  });
  
  // Handle reset all windows
  socket.on('resetAllWindows', (data) => {
    const { windowId } = data;
    
    // Reset the current number to 0
    currentNumber = 0;
    
    // Mark all queue items as completed
    queueData.forEach(item => {
      item.status = 'completed';
    });
    
    // Clear all active windows
    activeWindows.clear();
    // Re-add the current window
    if (windowId) {
      activeWindows.add(windowId);
    }
    
    console.log(`Window ${windowId} reset ALL windows and set queue to 0`);
    
    // Broadcast to all clients
    io.emit('allWindowsReset', {
      newNumber: 0,
      windowId: windowId
    });
    
    // Update windows and queue display
    io.emit('windowsUpdate', Array.from(activeWindows));
    io.emit('queueUpdate', { currentNumber });
    
    // Broadcast updated queue stats
    broadcastQueueStats();
  });
  
  // Handle window closing
  socket.on('closeWindow', (windowId) => {
    activeWindows.delete(windowId);
    io.emit('windowsUpdate', Array.from(activeWindows));
    console.log(`Window ${windowId} closed`);
    
    // Broadcast updated queue stats
    broadcastQueueStats();
  });
  
  // Queue management events
  
  // Request queue data
  socket.on('requestQueueData', () => {
    socket.emit('queueData', queueData);
  });
  
  // Add to queue
  socket.on('addToQueue', (item) => {
    // Create a queue item with a unique ID
    const queueItem = {
      id: generateUniqueId(),
      number: item.number,
      customerName: item.customerName || '',
      status: 'waiting',
      timestamp: Date.now()
    };
    
    // Add to queue regardless of whether the number already exists
    queueData.push(queueItem);
    
    // Sort by number and then by timestamp for same numbers
    queueData.sort((a, b) => {
      if (a.number === b.number) {
        return a.timestamp - b.timestamp; // Sort by timestamp if numbers are the same
      }
      return a.number - b.number;
    });
    
    // Broadcast updated queue to all clients
    io.emit('queueData', queueData);
    
    // Broadcast updated queue stats
    broadcastQueueStats();
    
    console.log(`Number ${queueItem.number} added to queue with ID ${queueItem.id}`);
  });
  
  // Remove from queue
  socket.on('removeFromQueue', (data) => {
    let index;
    
    if (data.id) {
      // If ID is provided, find by ID (most precise)
      index = queueData.findIndex(item => item.id === data.id);
    } else if (data.timestamp) {
      // If timestamp is provided, find by number and timestamp (precise)
      index = queueData.findIndex(item => 
        item.number.toString() === data.number.toString() && 
        item.timestamp.toString() === data.timestamp.toString()
      );
    } else {
      // Otherwise find by number (first occurrence)
      index = queueData.findIndex(item => item.number === data.number);
    }
    
    if (index !== -1) {
      const removedItem = queueData[index];
      queueData.splice(index, 1);
      
      // Broadcast updated queue to all clients
      io.emit('queueData', queueData);
      
      // Broadcast updated queue stats
      broadcastQueueStats();
      
      console.log(`Number ${removedItem.number} with ID ${removedItem.id} removed from queue`);
    }
  });
  
  // Update queue item
  socket.on('updateQueueItem', (data) => {
    let item;
    
    if (data.id) {
      // If ID is provided, find by ID (most precise)
      item = queueData.find(item => item.id === data.id);
    } else if (data.timestamp) {
      // If timestamp is provided, find by number and timestamp (precise)
      item = queueData.find(item => 
        item.number.toString() === data.number.toString() && 
        item.timestamp.toString() === data.timestamp.toString()
      );
    } else {
      // Otherwise find by number (first occurrence)
      item = queueData.find(item => item.number === data.number);
    }
    
    if (item) {
      // Update the item properties
      if (data.status) item.status = data.status;
      if (data.customerName) item.customerName = data.customerName;
      
      // Broadcast updated queue to all clients
      io.emit('queueData', queueData);
      
      // Broadcast updated queue stats
      broadcastQueueStats();
      
      console.log(`Queue item ${item.number} with ID ${item.id} updated`);
    }
  });
  
  // Clear queue
  socket.on('clearQueue', () => {
    queueData = [];
    
    // Broadcast updated queue to all clients
    io.emit('queueData', queueData);
    
    // Broadcast updated queue stats
    broadcastQueueStats();
    
    console.log('Queue cleared');
  });
  
  // Handle new customer encoded notification
  socket.on('newCustomerEncoded', (data) => {
    // Broadcast to all cashier clients
    io.emit('newCustomerEncoded', {
      number: data.number,
      customerName: data.customerName || '',
      timestamp: data.timestamp || Date.now()
    });
    
    console.log(`Notification: Customer (Number ${data.number}) encoded and cashiers notified`);
  });

  // Handle batch customers encoded notification
  socket.on('batchCustomersEncoded', (data) => {
    // Broadcast to all cashier clients
    io.emit('batchCustomersEncoded', data);
    
    console.log(`Notification: Batch of ${data.count} numbers encoded and cashiers notified`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    if (socket.windowId) {
      activeWindows.delete(socket.windowId);
      io.emit('windowsUpdate', Array.from(activeWindows));
    }
  });
});

// Changed default port from 3000 to 8080
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Cashier interface: http://localhost:${PORT}/cashier`);
  console.log(`Display interface: http://localhost:${PORT}/display`);
  console.log(`Encoder interface: http://localhost:${PORT}/encoder`);
});
