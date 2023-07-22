const mongoose = require("mongoose");

const AttackerSchema = new mongoose.Schema({
    "alliance_id": { type: Number },
    "character_id": { type: Number },
    "corporation_id": { type: Number },
    "damage_done": { type: Number },
    "final_blow": { type: Boolean },
    "security_status": { type: Number },
    "ship_type_id": { type: Number },
    "weapon_type_id": { type: Number }
});

const ItemSchema = new mongoose.Schema({
    "flag": { type: Number },
    "item_type_id": { type: Number },
    "quantity_dropped": { type: Number },
    "singleton": { type: Number }
});

const VictimSchema = new mongoose.Schema({
    "alliance_id": { type: Number },
    "character_id": { type: Number },
    "corporation_id": { type: Number },
    "damage_taken": { type: Number },
    "items": { type: [ ItemSchema ] },
    "position": {
        "x": { type: Number },
        "y": { type: Number },
        "z": { type: Number }
    },
    "ship_type_id": { type: Number }
});

const KillmailSchema = new mongoose.Schema({
    "attackers": { type: [ AttackerSchema ] },
    "killmail_id": {
        type: Number,
        index: {
            unique: true,
            dropDups: true
        }
    },
    "killmail_time": {
        type: Date,
        index: { expires: "28 days" }
    },
    "solar_system_id": { type: Number },
    "victim": { type: VictimSchema },
    "war_id": { type: Number },
    "zkb": {
        "locationID": { type: Number },
        "hash": { type: String },
        "fittedValue": { type: Number },
        "droppedValue": { type: Number },
        "destroyedValue": { type: Number },
        "totalValue": { type: Number },
        "points": { type: Number },
        "npc": { type: Boolean },
        "solo": { type: Boolean },
        "awox": { type: Boolean },
        "esi": { type: String },
        "url": { type: String }
    }
});

const KillmailModel = new mongoose.model("killmail", KillmailSchema);

module.exports = {
    schema: KillmailSchema,
    model: KillmailModel
};