var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model
module.exports = mongoose.model('Cps', new Schema({ 
	name: String, 
	uri: String, 
	sensors:[{
	name: String,
	type : String,
	uri: String,
	statut: String
	}]
}));
