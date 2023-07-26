const amqplib = require("amqplib");
const WS = require("ws");

const VERBOSE = true;
const POLLING_TYPE = "http"; // "http" or "ws"

const config = require("./config.json");
let meantToCloseRabbit = false;

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

async function main_http(killfeed) {
    let polling = true;
    while(polling) {
        try {
            const r = await fetch("https://redisq.zkillboard.com/listen.php");
            const j = (await r.json()).package;
            if (j !== null && typeof j !== "undefined") {
            // the HTTP endpoint has a different data format than the websocket one -
            // massage this to make it like the websocket format (since I already wrote other
            // stuff that expects it to be formatted this way).
            const o = {
                "attackers": j.attackers,
                "killmail_id": j.killmail.killmail_id,
                "killmail_time": j.killmail.killmail_time,
                "solar_system_id": j.killmail.solar_system_id,
                "victim": j.killmail.victim,
                "zkb": j.zkb
            };
            if (VERBOSE) l(`KILL [${o.killmail_id}]: ${o.killmail_time} for ${o.zkb.totalValue.toLocaleString("en-US")} ISK`);
                killfeed.sendToQueue(config.rabbit.queue, Buffer.from(JSON.stringify(o))); // wants a buffer
            }
        } catch (exc) {
            l(`main_http() EXCEPTION<${typeof exc}>: ${exc}`);
            polling = false;
        }
    }
}

async function main_ws(killfeed) {
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

async function createRabbitFeed() { // haha
    const uri = `amqp://${config.rabbit.user}:${config.rabbit.pass}@${config.rabbit.host}:${config.rabbit.port}/${config.rabbit.vhost}`;
    if (VERBOSE) l(`RabbitMQ connection::: ${uri}`);
    const rabbit = await amqplib.connect(uri);
    if (VERBOSE) l("Connected, now creating channel...");
    const killfeed = await rabbit.createChannel();
    if (VERBOSE) l("Created channel, building error handler");
    killfeed.on("error", (err) => {
        l("killfeed had an error, recreating...");
        createRabbitFeed();
    });
    if (VERBOSE) l("Created error handler, building close handler");
    killfeed.on("close", () => {
        if (!meantToCloseRabbit) {
            l("rabbit close fired when we didn't mean to, recreating...");
            createRabbitFeed();
        }
    });
    if (VERBOSE) l("Created close handler, setting up consumer thread");
    killfeed.consume(config.rabbit.queue, async (msg) => {
        if (msg !== null) {
            let data = JSON.parse(msg.content.toString("utf-8"));
            killfeed.ack(msg); // do I need to ack?
            try {
                feedBroadcast(data);
            } catch (exc) {
                l(`KILLFEED CONSUME EXCEPTION<${typeof exc}>: ${exc}`);
            }
        }
    });
    return killfeed;
}

async function main() {
    // this can't be right, the first time the object recreates itself this reference should be broken
    let killfeed = await createRabbitFeed();
    if (VERBOSE) l("Created channel, now starting loop...");
    if (POLLING_TYPE === "http") main_http(killfeed);
    if (POLLING_TYPE === "ws") main_ws(killfeed);
}

main().catch((exc) => {
    console.log("UNCAUGHT EXCEPTION:");
    console.dir(exc, { depth: null });
});