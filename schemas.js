const mongoose = require("mongoose");

let UserSchema = new mongoose.Schema({
    name: String,
    username: String,
    hashPassword: String,
    joinDate: Number,
    watchList: [{stockTicker: String, DateAdded: Number}]
})

let SessionSchema = new moongoose.Schema({

})

module.exports = {
    User: new moongoose.model("Users", UserSchema),
    Session: new moongoose.model("Sessions", SessionSchema)
}