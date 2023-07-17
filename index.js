const amqplib = require("amqplib");
const WS = require("ws");

const VERBOSE = true;

const config = require("./config.json");

/**
 * To do simple HTTP fetch polling:
 * * fetch https://redisq.zkillboard.com/listen.php
 * * decode JSON response
 * * killmail = json.package
 * 
 * To do websocket polling:
 * * connect wss://zkillboard.com/websocket/
 * * send {"action":"sub","channel":"killstream"}
 */

const ts = () => { return (new Date()).toISOString(); }
const l = (s) => { console.log(`[${ts()}] ${s}`); }

async function main() {
    const uri = `amqp://${config.rabbit.user}:${config.rabbit.pass}@${config.rabbit.host}:${config.rabbit.port}/${config.rabbit.vhost}`;
    if (VERBOSE) l(`RabbitMQ connection::: ${uri}`);
    const rabbit = await amqplib.connect(uri);
    const killfeed = await rabbit.createChannel();
    const ws = new WS("wss://zkillboard.com/websocket/");

    ws.on("error", (err) => {
        l("WS ERROR:");
        console.dir(err, { depth: null });
    });

    ws.on("open", () => {
        ws.send(JSON.stringify({
            action: "sub",
            channel: "killstream"
        }));
        ws.send(JSON.stringify({
            action: "sub",
            channel: "public"
        }));
    });

    ws.on("message", async (data) => {
        let jsonData;
        try {
            jsonData = JSON.parse( data.toString("utf-8") );
        } catch (exc) {
            l("JSON parse exception");
            console.dir(data, { depth: null });
            return;
        }
        if (jsonData["action"] === "tqStatus") {
            /* jsonData = {
                action: 'tqStatus',
                tqStatus: 'ONLINE',
                tqCount: '18,192',
                kills: '596'
            } */
        };
        if (typeof jsonData["action"] === "undefined") { //
            if (VERBOSE) l(`KILL [${jsonData.killmail_id}]: ${jsonData.killmail_time} for ${jsonData.zkb.totalValue.toLocaleString("en-US")} ISK`);
            killfeed.sendToQueue(config.rabbit.queue, Buffer.from(JSON.stringify(jsonData))); // wants a buffer
        }
    });
}

main().catch((exc) => {
    console.log("UNCAUGHT EXCEPTION:");
    console.dir(exc, { depth: null });
});