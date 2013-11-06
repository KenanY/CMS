var languages = require('languages')

module.exports.postApprovedEpisodes = function(req, res) {
	if(req.xhr) {
		sequelize.query('SELECT * FROM Episodes WHERE `UserId` = ' + req.body.id + ' AND `approved` = 1').success(function(results) {
			res.send(results)
		})
	}
}

module.exports.postPendingEpisodes = function(req, res) {
	if (req.xhr) {
		sequelize.query('SELECT * FROM Episodes WHERE `UserId` = ' + req.body.id + ' AND `approved` = 0').success(function(results) {
			res.send(results)
		})
	}
}

module.exports.getSettings = function(req, res) {
	if(req.user) {
		res.render('admin/settings', {
			user: req.user,
			languages: languages.getAllLanguageCode().map(function(languageCode) {
				return {
					 code: languageCode,
					 selected: languageCode == req.user.language
				}
			})
		})
	}
	else {
		res.redirect('/')
	}
}

module.exports.authError = function(req, res) {
	res.render('status/403')
}

module.exports.postSettings = function (req, res) {
	if (req.xhr) {	
		sequelize.query('UPDATE Users SET language = :language WHERE id = :id', null, { raw: true }, {
			language: req.body.language,
			id: req.user.id
		}).success(function() {
			res.send(JSON.stringify({
				status: 'ok',
				rowsModified: 1
			}))
		}).error(function() {
			res.send(JSON.stringify({
				status: 'error',
				rowsModified: null,
				error: 'sequelize'
			}))
		})
	}
}
