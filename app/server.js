// Node Module Requirements
var path = require('path')
var nconf = require('nconf')
var passport = require('passport')
var passportTwitter = require('passport-twitter')
var Sequelize = require('sequelize')
GLOBAL.async = require('async')
var express = require('express')
var exphbs = require('express3-handlebars')
var RedisStore = require('connect-redis')(express)
var sessionStore = new RedisStore
GLOBAL.languages = require('languages')

// Config
GLOBAL.config = nconf.argv()
					 .env()
					 .file({ file: path.join(__dirname, 'config.json') })
var twitterConfig = config.get('twitter')
var dbConfig = config.get('db')

if (!dbConfig || !dbConfig.name || !dbConfig.user) {
	console.log('FATAL ERROR: You must specify database information in the configuration to run the server.')
	process.exit(1)
}

// Lodash
GLOBAL._ = require('lodash')

// DB
GLOBAL.sequelize = new Sequelize(dbConfig.name, dbConfig.user, dbConfig.password, {
	logging: config.get('logging:sequelize') || false
})
// Models
GLOBAL.models = require('./models')
GLOBAL.Episode = models.episode
GLOBAL.Shownotes = models.shownotes
GLOBAL.User = models.user
GLOBAL.Transcription = models.transcriptions
GLOBAL.Tag = models.tag

// Controllers
var adminController = require('./controllers/admin.js')
var episodeController = require('./controllers/episode.js')
var userController = require('./controllers/user.js')
var screencasterController = require('./controllers/screencaster.js')
var searchController = require('./controllers/search.js')

// Passport
var TwitterStrategy = passportTwitter.Strategy
passport.serializeUser(function(user, done) {
	done(null, user.id)
})
passport.deserializeUser(function(obj, done) {
	User.find(obj).success(function(user) {
		done(null, user)
	}).failure(function(error) {
		done(error, null)
	})
})

if (!twitterConfig || !twitterConfig.key || !twitterConfig.secret) {
	console.log('FATAL ERROR: You must specify a twitter consumer key and consumer secret in the configuration to run the server.')
	process.exit(1)
}

passport.use(new TwitterStrategy({
	consumerKey: twitterConfig.key,
	consumerSecret: twitterConfig.secret,
	callbackURL: 'http://localhost:'+ (config.get('port') || 3000) +'/auth/twitter/callback'
}, function(token, tokenSecret, profile, done) {
	User.findOrCreate({
		twitter_id: profile.id
	}, {
		name: profile.displayName,
		role: 4,
		twitter_id: profile.id,
		twitter_username: profile.username,
		twitter_access_token: token,
		twitter_access_secret: tokenSecret
	}).success(function(user, created) {
		if (!created) {
			user.updateAttributes({
				name: profile.displayName,
				twitter_id: profile.id,
				twitter_username: profile.username,
				twitter_access_token: token,
				twitter_access_secret: tokenSecret
			}).success(function(user) {
				return done(null, user)
			})
		}
		else {
			return done(null, user)
		}
	}).failure(function(error) {
		return done(error, null)
	})
}))

// Express
var app = express()
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'handlebars')
app.engine('handlebars', exphbs({
	partialsDir: path.join(__dirname, 'views', 'partials'),
	defaultLayout: path.join(__dirname, 'views', 'layouts', 'main.handlebars'),
	helpers: require("./views/helpers.js")
}))
app.use(express.cookieParser())
app.use(express.json())
app.use(express.urlencoded())
app.use(express.methodOverride())
app.use(express.session({ secret: 'CodePilot', store: sessionStore }))
app.use(express.static(path.join(__dirname, 'public')))
app.use(passport.initialize())
app.use(passport.session())

app.use(function(req, res, next) {
	res.locals.user = req.user
	res.locals.showNav = true // TODO: Hide if it needs to be hidden
	next()
})

app.get('/', function(req, res){
	res.render('home', {
		user: req.user
	})
})

app.get('/auth/twitter', passport.authenticate('twitter'))

app.get('/auth/twitter/callback', passport.authenticate('twitter', {failureRedirect: '/fail'}), function(req, res) {
	res.redirect('/')
})

app.get('/logout', function(req, res) {
	req.logout()
	res.redirect('/')
})

/*
	Screencast submission
*/

app.get('/screencaster', screencasterController.getPending)

app.get('/heyDanielYouShouldImplementThis', screencasterController.heyDanielYouShouldImplementThis)

app.get('/screencaster/approved', screencasterController.getApproved)

app.get('/:id(\\d+)', episodeController.getEpisodeById)

app.get('/settings', userController.getSettings)

app.post('/settings', userController.postSettings)

app.get('/transcription/:id', episodeController.getTranscription)

app.post('/transcription/:id', episodeController.postTranscription)

app.get('/transcript/:id', episodeController.getTranscript)

/*
	Admin routing
*/

app.get('/admin', requireAdmin, adminController.get)

app.get('/admin/episodes', requireAdmin, adminController.getEpisodes)

app.get('/admin/episodes/pending', requireAdmin, adminController.getPendingEpisodes)

app.get('/admin/episodes/pending/:id(\\d+)', requireAdmin, adminController.getEpisodeById)

app.get('/admin/episodes/:id(\\d+)', requireAdmin, adminController.getEpisodeById)

app.get('/admin/users', requireAdmin, adminController.getUsers)

app.get('/admin/users/:id(\\d+)', requireAdmin, adminController.getUserById)

// Admin APIs

app.post('/api/admin/episode/approve', requireAdmin, adminController.approveScreencast)

app.post('/api/admin/episode/remove', requireAdmin, adminController.removeScreencast)

app.post('/api/admin/episode/tags/add', requireAdmin, adminController.addTag)

app.post('/api/admin/episode/tags/remove', requireAdmin, adminController.removeTag)

app.post('/api/admin/episode/transcript/edit', requireAdmin, adminController.editTranscription)

app.post('/api/admin/episode/transcript/add', requireAdmin, adminController.addTranscription)

app.post('/api/admin/episode/transcript/remove', requireAdmin, adminController.removeTranscription)

app.post('/api/admin/episode/transcript/activate', requireAdmin, adminController.activateTranscription)

app.post('/api/admin/episode/transcript/deactivate', requireAdmin, adminController.deactivateTranscription)

app.post('/api/admin/user/add', requireAdmin, adminController.addUser)

app.post('/api/admin/user/deactivate', requireAdmin, adminController.deactivateUser)

app.post('/api/admin/user/activate', requireAdmin, adminController.activateUser)

app.post('/api/admin/user/role', adminController.changeRole)

// Screencaster APIs

app.post('/api/approvedEpisodes', userController.postApprovedEpisodes)

app.post('/api/pendingEpisodes', userController.postPendingEpisodes)

// Search

app.get('/search', searchController.getSearch)

app.listen(config.get('port') || 3000)

module.exports.app = app

function requireViewer(req, res, next) {
	if (req.user && req.user.role === 4) {
		next()
	} else {
		res.redirect('/')
	}
}

function requireModerator(req, res, next) {
	if (req.user && (req.user.role === 3 || req.user.role === 1)) {
		next()
	} else {
		res.redirect('/')
	}
}

function requireScreencaster(req, res, next) {
	if (req.user && (req.user.role === 2 || req.user.role === 1)) {
		next()
	} else {
		res.redirect('/')
	}
}

function requireAdmin(req, res, next) {
	if (req.user && req.user.role === 1) {
		next()
	} else {
		res.redirect('/')
	}
}
