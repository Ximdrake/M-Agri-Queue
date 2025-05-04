# Queue Management System

A real-time queueing system with dynamic windows and audio announcements. This system allows cashiers at different computers to call the next customer, with announcements played on a central display screen.

## Features

- Multiple cashier windows that can be dynamically registered
- Real-time queue updates using WebSockets
- Audio announcements when a customer is called
- Display screen showing current queue status and call history
- Works across different computers on the same network

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone this repository or download the files
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

4. Start the server:

```bash
npm start
```

The server will start on port 8080 by default. You can change this by setting the PORT environment variable:

```bash
# On Windows
set PORT=5000 && npm start

# On macOS/Linux
PORT=5000 npm start
```

## Usage

### Cashier Interface

1. Open a web browser on each cashier's computer
2. Navigate to `http://[server-ip]:8080/cashier`
3. Enter the window number and click "Register"
4. Use the "Call Next Customer" button to call the next customer in the queue
5. Use "Close Window" when the cashier is no longer available

### Display Screen

1. Open a web browser on the display computer
2. Navigate to `http://[server-ip]:8080/display`
3. The display will automatically show queue updates and play audio announcements

## Network Configuration

For the system to work across different computers:

1. Make sure all computers are on the same network
2. Use the server's IP address instead of localhost when accessing from other computers
3. Ensure that port 8080 (or your custom port) is not blocked by firewalls

## Customization

- Edit the HTML/CSS in the `public` folder to customize the appearance
- Modify the server.js file to change queue behavior or add features
- To change the port permanently, edit the PORT variable in server.js

## Troubleshooting

- If audio doesn't play, make sure the browser has permission to play audio
- For Chrome, the user must interact with the page before audio can play
- If connections fail, check network settings and firewall configurations
- If port 8080 is already in use, set a different port using the PORT environment variable
# M-Agri-Queue
