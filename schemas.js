const mongoose = require("mongoose");

let UserSchema = new mongoose.Schema({
    name: String,
    username: String,
    HashPassword: String,
    JoinDate: Number,
    watchList: [{stockTicker: String, DateAdded: Number}]
})

let SessionSchema = new moongoose.Schema({

})

module.exports = {
    User: new moongoose.model("Users", UserSchema),
    Session: new moongoose.model("Sessions", SessionSchema)
}