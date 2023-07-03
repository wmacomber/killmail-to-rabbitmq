const amqplib = require("amqplib");
const fetch = require("node-fetch");
const NodeCache = require("node-cache");
const WS = require("ws");

const VERBOSE = false;

const config = require("./config.json");
const cacheChar = new NodeCache({
    stdTTL: 600
});

async function getCharacter(id) {
    if (parseInt(id) !== id) throw new Error("ID isn't an integer");
    const cache = cacheChar.get(id);
    if (typeof cache !== "undefined") return cache;
    const url = `https://esi.evetech.net/latest/characters/${id}/?datasource=tranquility`;
    const res = await fetch(url);
    const r = await res.json();
    cacheChar.set(id, r);
    return r;
}

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

async function main() {
    const uri = `amqp://${config.rabbit.user}:${config.rabbit.pass}@${config.rabbit.host}:${config.rabbit.port}/${config.rabbit.vhost}`;
    if (VERBOSE) console.log(`RabbitMQ connection::: ${uri}`);
    const rabbit = await amqplib.connect(uri);
    const killfeed = await rabbit.createChannel();
    const ws = new WS("wss://zkillboard.com/websocket/");

    ws.on("error", (err) => {
        console.log("WS ERROR:");
        console.dir(err, { depth: null });
    });

    ws.on("open", () => {
        ws.send(JSON.stringify({
            action: "sub",
            channel: "killstream"
        }));
    });

    ws.on("message", async (data) => {
        let jsonData = JSON.parse( data.toString("utf-8") );
        if (VERBOSE) console.log(`KILL: ${jsonData.killmail_time} for ${jsonData.zkb.totalValue.toLocaleString("en-US")} ISK`);
        jsonData["victim"]["character_data"] = await getCharacter(jsonData["victim"]["character_id"]);
        for (const k of jsonData["attackers"].keys()) {
            if (typeof jsonData["attackers"][k]["character_id"] !== "undefined") {
                const c = await getCharacter(jsonData["attackers"][k]["character_id"]);
                jsonData["attackers"][k]["character_data"] = c;
            }
        }
        killfeed.sendToQueue(config.rabbit.queue, Buffer.from(JSON.stringify(jsonData))); // wants a buffer
    });
}

main().catch((exc) => {
    console.log("UNCAUGHT EXCEPTION:");
    console.dir(exc, { depth: null });
});