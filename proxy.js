const fs = require("fs");
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const path = require('path')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const app = express();

WEBSOCKET_PORT = process.argv[2]
NEW_PORT = process.argv[3]
CHROME_PID = process.argv[4]
LOG_PATH = path.join(path.dirname(process.argv[1]), "logs", CHROME_PID+"_proxy.log")

METHODS = {
    "Input.dispatchMouseEvent":{
    "description": "Bot triggered the following mouse activity : ",
    "data_collection": "params"
    },
    "Input.dispatchKeyEvent":{
    "description": "Bot triggered the following keyboard activity : ",
    "data_collection": "params"
    },
    "Input.dispatchTouchEvent":{
    "description": "Bot emulates a touch event : ",
    "data_collection": "params"
    },
    "Page.navigate":{
    "description": "Bot navigated to the following URL :",
    "data_collection": "params/url"
    },
    "Runtime.evaluate":{
    "description": "Bot evaluated the following JavaScript expression :",
    "data_collection": "params/expression"
    },
    "Runtime.callFunctionOn":{
    "description": "Bot called the following JavaScript function :",
    "data_collection": "params/functionDeclaration"
    },
    "Page.addScriptToEvaluateOnNewDocument":{
    "description": "Bot executed the following JavaScript code for every new document :",
    "data_collection": "params/source"
    },
    "Page.captureScreenshot":{
    "description": "Bot Captures a screenshot :",
    "data_collection": ""
    },


}

fs.writeFileSync(LOG_PATH, "")

const logMessage = (origin, message) => {
    parsed_message = JSON.parse(message)

    method = parsed_message["method"]
    if ((method == "Target.sendMessageToTarget") || (method == "Target.receivedMessageFromTarget")){
        parsed_message = JSON.parse(parsed_message["params"]["message"])
        method = parsed_message["method"]
    }

    if (method != undefined && Object.keys(METHODS).includes(method)){
        var message_to_log = METHODS[parsed_message["method"]]["description"]
        var data_collection = METHODS[parsed_message["method"]]["data_collection"].split("/")
        if (data_collection.join("") == ''){
            fs.appendFileSync(LOG_PATH,`[${new Date().toISOString()}] - ` + message_to_log +'\n')
        }
        else{

             var collected_data = parsed_message
             for (step of data_collection){
                 collected_data = collected_data[step]
             }
             collected_data = JSON.stringify(collected_data)
             console.log(`[${new Date().toISOString()}] - ` + message_to_log + " - " + collected_data + '\n')

            fs.appendFileSync(LOG_PATH,`[${new Date().toISOString()}] - ` +  message_to_log + " - " + collected_data + '\n')
        }

    }

}

const targetUrl = 'http://localhost:'+NEW_PORT;

const logRequest = (req) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
};

const proxyOptions = {
  target: targetUrl,
  changeOrigin: true,
  logLevel: 'debug',
  selfHandleResponse:true,
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('Host', 'localhost:'+NEW_PORT);
    logRequest(req);
  },
  onProxyRes:(proxyRes, req, res) => {

      let responseBody = '';

      proxyRes.on('data', (chunk) => {
        console.log(chunk.toString('utf-8'))
        chunk_str = chunk.toString('utf-8').replace(/localhost:\d+/g, "localhost:"+ WEBSOCKET_PORT)
        responseBody += Buffer.from(chunk_str, 'utf-8');
      });

      proxyRes.on('end', () => {
        res.end(responseBody)
      });

      proxyRes.destroy();

      }
};

app.use('/', createProxyMiddleware(proxyOptions));

const server = http.createServer(app);

const wsProxy = (clientSocket, req) => {

    // Queue to store messages sent from the client before the target server is ready
    const clientMessageQueue = [];

    // Establish a connection to the target server (e.g. Chrome DevTools)
    const targetSocket = new WebSocket(`ws://localhost:${NEW_PORT}${req.url}`);

    function handleClientMessage(message) {

        logMessage("client", message.toString("utf-8"));
        targetSocket.send(message.toString("utf-8"));
    }

    clientSocket.on('message', (message) => {
        // If the target server is ready, and there are no messages in the queue, forward the message
        if (targetSocket.readyState === WebSocket.OPEN && clientMessageQueue.length === 0) {
            return handleClientMessage(message);
        }

        // Otherwise, add the message to the queue
        clientMessageQueue.push(message);
    });

    targetSocket.on('open', async () => {
        console.log("target connected");
        for (let i = 0; i < clientMessageQueue.length; i++) {
            handleClientMessage(clientMessageQueue.shift());
            await sleep(100);
        }
    });

    // Forward messages from the target server to the client
    targetSocket.on('message', (message) => {
        logMessage("server", message.toString("utf-8"));
        clientSocket.send(message.toString("utf-8"));
    });

    // Handle socket closures
    clientSocket.on('close', () => {
        targetSocket.close();
    });

    targetSocket.on('close', () => {
        clientSocket.close();
    });

    // Handle errors
    clientSocket.on('error', (error) => {
        console.error('Client error:', error);
        targetSocket.close();
    });

    targetSocket.on('error', (error) => {
        console.error('Target error:', error);
        clientSocket.close();
    });


};

const wsServer = new WebSocket.Server({ server });
wsServer.on('connection', wsProxy);

wsServer.on('upgrade', (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, (clientSocket) => {
        wsServer.emit('connection', clientSocket, request);
    });
})

server.listen(WEBSOCKET_PORT, () => {
  console.log(`HTTP and WebSocket proxy server running on http://localhost:${WEBSOCKET_PORT}`);
});