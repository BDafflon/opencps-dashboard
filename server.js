// =================================================================
// get the packages we need ========================================
// =================================================================
var express 	= require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var session = require('express-session')
 var multer = require('multer');
var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User   = require('./app/models/user'); // get our mongoose model
var Cps = require('./app/models/cps');
var path    = require("path");

// =================================================================
// configuration ===================================================
// =================================================================
var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
var sessionUser;

mongoose.connect(config.database); // connect to database
app.set('superSecret', config.secret); // secret variable
app.set('view engine','ejs');

app.use(express.static(path.join(__dirname, '/public')));
app.use(session({secret: "Shh, its a secret!"}));
// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

var Storage = multer.diskStorage({

		destination: function(req, file, callback) {

				callback(null, path.join(__dirname, '/public/dashboard/ihm/images/users'));

		},

		filename: function(req, file, callback) {

				callback(null, req.session._id);

		}

});

var upload = multer({

		storage: Storage

}).array("imgUploader", 3); //Field name and max count


// =================================================================
// routes ==========================================================
// =================================================================
app.get('/setup', function(req, res) {

	// create a sample user
	var me = new User({
		name: 'BDafflon',
		password: 'azerty',
		mail:'',
		admin: true
	});
	me.save(function(err) {
		if (err) throw err;

		console.log('User saved successfully');
		res.json({ success: true });
	});
});

app.get('/setupcps', function(req, res) {

	// create a sample user
	var c = new Cps({
		name: 'Rpi3-002',
		uri: 'http://145.344.122.02/',

	});
	c.save(function(err) {
		if (err) throw err;

		console.log('Cps saved successfully');
		res.json({ success: true });
	});
});

// basic route (http://localhost:8080)
app.get('/', function(req, res) {
	//res.send('Hello! The API is at http://localhost:' + port + '/api');
	res.sendFile(path.join(__dirname+'/public/dashboard/index.html'));
});

app.get('/logout', function(req, res) {
	//res.send('Hello! The API is at http://localhost:' + port + '/api');
	req.session.destroy();
	res.sendFile(path.join(__dirname+'/public/dashboard/index.html'));
});

// ---------------------------------------------------------
// get an instance of the router for api routes
// ---------------------------------------------------------
var apiRoutes = express.Router();

// ---------------------------------------------------------
// authentication (no middleware necessary since this isnt authenticated)
// ---------------------------------------------------------
// http://localhost:8080/api/authenticate

apiRoutes.post("/Upload", function(req, res) {

		upload(req, res, function(err) {

				if (err) {

						res.json({success: false, message:'Update failed'});

				}

					res.json({success: true, message:'Update done'});

		});

});

apiRoutes.post('/updateUser', function(req, res) {
	console.log('mail'+req.body.mail);
	User.findOne({
		name: req.body.name
	}, function(err, user) {
		if(req.session.user){
			console.log(user);
			if(err) throw err;

			if(user){
				if(req.body.password==req.body.passwordConfirmation){
					User.updateOne({name: req.body.name},{name:req.body.name, mail:req.body.mail,password:req.body.password}, function(err,res2){
						if(err) throw err;


						req.session.name =  req.body.name;
						console.log('update ' +res2.name);
						req.session.user.name = req.body.name;
						req.session.user.mail = req.body.mail;

						res.json({success: true, message:'Update done'});

					});
				}
				else{
				res.json({success: false, message:'Update failed : wrong password'});
				}
			}
		}
		else {
			res.json({success: false, message:'Update failed : wrong user'});
		}
	});


});


apiRoutes.post('/authenticate', function(req, res) {
	console.log(req.body);
	// find the user
	User.findOne({
		name: req.body.name
	}, function(err, user) {

		if (err) throw err;

		if (!user) {
			console.log('Authentication failed. User not found.');

			res.json({ success: false, message: 'Authentication failed. Wrong user.' });

		} else if (user) {

			// check if password matches
			if (user.password != req.body.password) {
				console.log('Authentication failed. Password not found.');
				res.json({ success: false, message: 'Authentication failed. Wrong password.' });
			} else {

				// if user is found and password is right
				// create a token
				var payload = {
					admin: user.admin
				}
				var token = jwt.sign(payload, app.get('superSecret'), {
					expiresIn: 86400 // expires in 24 hours
				});

				console.log('Authentication succeed.');
				res.cookie('data-user-name', user.name);
				sessionUser = req.session;
				sessionUser.name = user.name;
				sessionUser.admin = true;
				sessionUser.user = user;

				res.json({
					success: true,
					message: 'Enjoy your token!',
					token: token
				});
			}
			console.log("??");

		}
		console.log("???");
		res.end();

	});
});

// ---------------------------------------------------------
// route middleware to authenticate and check token
// ---------------------------------------------------------
apiRoutes.use(function(req, res, next) {

	// check header or url parameters or post parameters for token
	var token = req.body.token || req.param('token') || req.headers['x-access-token'];

	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, app.get('superSecret'), function(err, decoded) {
			if (err) {
				res.render(path.join(__dirname+'/public/dashboard/404'),{ token:"", code:'403', success: false, message: 'Failed to authenticate token.' });
			} else {
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				req.session.token = token;
				next();
			}
		});

	} else {

		// if there is no token
		// return an error
		res.render(path.join(__dirname+'/public/dashboard/404'),{ token:"", code:'403', success: false, message: 'Failed to authenticate - No token provided.' });


	}

});

// ---------------------------------------------------------
// authenticated routes
// ---------------------------------------------------------
apiRoutes.get('/', function(req, res) {
	res.json({ message: 'Welcome to the coolest API on earth!' });
});

apiRoutes.get('/users', function(req, res) {
	User.find({}, function(err, users) {
		res.json(users);
	});
});

apiRoutes.get('/profile', function(req,res){
	if(req.session.user){
		User.findOne({
			name: req.session.name
		}, function(err, user) {
			console.log(req.session.user);
			res.render(path.join(__dirname+'/public/dashboard/profile'),{token:req.session.token,  user:req.session.user});

		});
	}
	else
	{
		res.redirect('/');
	}

});

apiRoutes.get('/map', function(req,res){
	if(req.session.user){
		User.findOne({
			name: req.session.name
		}, function(err, user) {
			cpsList=[];
			Cps.find({}, function(err, result) {
				if (err) throw err;

				cpsList=result;
				res.render(path.join(__dirname+'/public/dashboard/map'),{token:req.session.token, user:req.session.user, cps:cpsList});
			});

		});
	}
	else
	{
		res.redirect('/');
	}

});

apiRoutes.get('/alert', function(req,res){
	if(req.session.user){
		User.findOne({
			name: req.session.name
		}, function(err, user) {
			cpsList=[];
			Cps.find({}, function(err, result) {
				if (err) throw err;

				cpsList=result;
				res.render(path.join(__dirname+'/public/dashboard/alert'),{token:req.session.token, user:req.session.user, cps:cpsList});
			});

		});
	}
	else
	{
		res.redirect('/');
	}

});


apiRoutes.get('/network', function(req,res){
	if(req.session.user){
		User.find({}, function(err, users) {
			console.log("sessions data"+req.session.name);
			cpsList=[];
			Cps.find({}, function(err, result) {
				if (err) throw err;

				cpsList=result;
				console.log("CPS : "+cpsList.length);
				res.render(path.join(__dirname+'/public/dashboard/network'),{token:req.session.token, user:req.session.user, cps:cpsList});
			});

		});
	}
	else
	{
		res.redirect('/');
	}
});

apiRoutes.get('/cpsunit', function(req,res){
	if(req.session.user){
		User.find({}, function(err, users) {
			console.log("sessions data"+req.session.name);
			cpsList=[];
			Cps.find({}, function(err, result) {
				if (err) throw err;

				cpsList=result;
				console.log("CPS : "+cpsList.length);
				console.log("cpsID "+req.param('cpsid'))

				res.render(path.join(__dirname+'/public/dashboard/cpsunit'),{token:req.session.token, user:req.session.user, cps:cpsList});
			});

		});
	}
	else
	{
		res.redirect('/');
	}
});


apiRoutes.get('/sensor', function(req,res){
	if(req.session.user){
		User.find({}, function(err, users) {
			console.log("sessions data"+req.session.name);
			cpsList=[];
			Cps.find({}, function(err, result) {
				if (err) throw err;

				cpsList=result;
				console.log("CPS : "+cpsList.length);
				console.log("cpsID "+req.param('sensorid'))
				res.render(path.join(__dirname+'/public/dashboard/sensor'),{token:req.session.token, user:req.session.user, cps:cpsList});
			});

		});
	}
	else
	{
		res.redirect('/');
	}
});


apiRoutes.get('/dashboard',function(req, res) {
	if(req.session.user){
		User.find({}, function(err, users) {
			console.log("sessions data"+req.session.name);
			cpsList=[];
			Cps.find({}, function(err, result) {
				if (err) throw err;

				cpsList=result;
				console.log("CPS : "+cpsList.length);
				res.render(path.join(__dirname+'/public/dashboard/dashboard'),{token:req.session.token, user:req.session.user, cps:cpsList});
			});

		});
	}
	else
	{
		res.redirect('/');
	}
});

apiRoutes.get('/check', function(req, res) {
	res.json(req.decoded);
});

apiRoutes.get('*', function(req, res) {
	res.render(path.join(__dirname+'/public/dashboard/404'),{token:req.session.token,user:req.session.user, code:'404', message:"page not found"});
});

app.use('/api', apiRoutes);

// =================================================================
// start the server ================================================
// =================================================================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);
