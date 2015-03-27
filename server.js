var express = require('express');
var app = express();
var server = app.listen(process.env.PORT || 5000);
var io = require('socket.io')(server);
var socket = require('./routes/socket.js');
var bodyParser = require('body-parser');
var jsforce = require('jsforce');
var passport = require('passport');
var GoogleStrategy = require('passport-google').Strategy;
var mongoose = require('mongoose');
var User = require('./models/user');
var SlideShow = require('./models/slideShow');
var viewRouter = require('./routes/view').Router(SlideShow);
var accountRouter = require('./routes/account').Router(SlideShow);
var session = require('express-session');
var cookieParser = require('cookie-parser');

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.locals.pretty = true;
app.locals.basedir = __dirname;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
   secret: 'foobar',
   resave: false,
   saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

/*
* MongoDB Connect
*/
mongoose.connect(process.env.MONGOLAB_URI || 'mongodb://localhost/data-driven');

/*
* Setup Authentication
*/
passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    returnURL: 'http://localhost:5000/auth/google/return',
    realm: 'http://localhost:5000'
  },
  function(token, profile, done) {
    User.findOne({ openId: token }, function(err, user) {
      if (err) {
          return done(err);
      }
      if (!user && profile) {
        var u = new User({ openId: token, profile: profile });
        u.save(function(err, u) {
          return done(err, u);
        });
      } else {
        return done(err, user);
      }
    });
  }
));

app.get('/auth/google', passport.authenticate('google'));
app.get('/auth/google/return',
  passport.authenticate('google', {
    successRedirect: '/account',
    failureRedirect: '/'
  })
);

function isAuth(req, res, next) {
  if(req.isAuthenticated()){
    return next();
  }
  res.redirect('/#login');
}

/*
* Routes
*/
app.get('/', function(req, res, next) {
  res.render('index');
});
app.get('/account', isAuth, function(req, res, next) {
  res.render('account', { user: req.user.profile });
});
app.get('/partials/:id', function(req, res, next) {
  res.render('partials/' + req.params.id);
});

var js = require('./jsConnect.json');
app.post('/report/:id', function(req, res, next) {
  var conn = new jsforce.Connection({
    oauth2: {
      clientId: js.clientId,
      clientSecret: js.clientSecret,
      redirectUri: js.redirectUri
    }
  });
  conn.login(js.username, js.password, function(err, user) {
    if(err) return res.status(500).send(err);
    conn.analytics.reports(function(err, reports) {
      if(err) return res.status(501).send(err);
      var id = req.params.id;
      conn.analytics.report(id).execute({ details: true }, function(err, result) {
        res.json(result);
      });
    });
  });
});

app.post('/report/:id/desc', function(req, res, next) {
  var conn = new jsforce.Connection({
    oauth2: {
      clientId: js.clientId,
      clientSecret: js.clientSecret,
      redirectUri: js.redirectUri
    }
  });
  conn.login(js.username, js.password, function(err, user) {
    if(err) return res.status(500).send(err);
    conn.analytics.reports(function(err, reports) {
      var id = req.params.id;
      conn.analytics.report(id).describe(function(err, result) {
        if(err) return res.status(501).send(err);
        var details = result.reportExtendedMetadata.detailColumnInfo;
        var ret = {
          cols: [],
          name: result.reportMetadata.name
        };
        for(var o in details) {
          ret.cols.push(details[o]);
        }
        res.json(ret);
      });
    });
  });
});

/*
* Retrieve Token
**/
var oauth2 = new jsforce.OAuth2({
    clientId: js.clientId,
    clientSecret: js.clientSecret,
    redirectUri: js.redirectUri
});
app.get('/oauth2/auth', isAuth, function(req, res) {
  res.redirect(oauth2.getAuthorizationUrl({ scope : 'api id web refresh_token' }));
});

app.get('/oauth2/callback', function(req, res) {
  var conn = new jsforce.Connection({ oauth2 : oauth2 });
  var code = req.query.code;
  conn.authorize(code, function(err, userInfo) {
    if (err) { return console.error('err:'+err); }
    User.findOne({ openId: req.user.openId }, function(err, user) {
      if(err) { return; }
      if(user) {
        var tokens = user.tokens || [];
        tokens.push({
          accessToken: conn.accessToken,
          refreshToken: conn.refreshToken
        });
        user.tokens = tokens;
        user.save();
        res.redirect('/account');
      }
    });
  });
});

app.use('/app', express.static(__dirname + '/app'));
app.use('/bower', express.static(__dirname + '/bower_components'));
app.use('/api/view', viewRouter);
app.use('/api/account', accountRouter);
io.sockets.on('connection', socket);
