var mongoose = require('mongoose')
var db = mongoose.connection

db.on('error', console.error)
mongoose.connect(config.get('db'))

module.exports = mongoose
