const amqplib = require("amqplib");
const killmail = require("./killmail");
const mongoose = require("mongoose");

const config = require("./config.json");

const ts = () => { return (new Date()).toISOString(); }
const l = (s) => { console.log(`[${ts()}] ${s}`); }

async function main() {
    const mongoUri = `mongodb://${config.mongo.host}:${config.mongo.port}/${config.mongo.name}`;
    l(`MongoDB connection::: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    l("Connected to MongoDB server");
    const uri = `amqp://${config.rabbit.user}:${config.rabbit.pass}@${config.rabbit.host}:${config.rabbit.port}/${config.rabbit.vhost}`;
    l(`RabbitMQ connection::: ${uri}`);
    const rabbit = await amqplib.connect(uri);
    l("Connected to RabbitMQ server, creating channel");
    const killfeed = await rabbit.createChannel();
    l("Created channel, setting prefetch");
    killfeed.prefetch(1);
    l("Set prefetch, setting up consumer thread");
    killfeed.consume(config.rabbit.queue, async (msg) => {
        if (msg !== null) {
            killfeed.ack(msg);
            try {
                let data = JSON.parse(msg.content.toString("utf-8"));
                let mail = new killmail.model(data);
                await mail.save();
                l(`Saved killmail [${data.killmail_id}]`);
            } catch (exc) {
                if (exc.code !== 11000) { // duplicate record
                    l(`EXCEPTION<${typeof exc}>: ${exc}`);
                    console.dir(exc, { depth: null });
                }
            }
        }
    });
    l("Set up consumer thread, which should now be running.");

    l("Setting up heartbeat thread");
    const intHeartbeat = setInterval(() => {
        l("===== 10 MINUTE HEARTBEAT =====");
    }, 10 * 60 * 1000);
}

main().catch((exc) => {
    console.log("UNCAUGHT EXCEPTION:");
    console.dir(exc, { depth: null });
});
