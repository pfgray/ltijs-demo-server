require('dotenv').config()
const path = require('path')
const routes = require('./src/routes')
const fs = require('fs')

const lti = require('ltijs').Provider

// Setup
lti.setup('LTIKEY', // Key used to sign cookies
  {
    url: process.env.MONGO_URI, // Connection url for the database
    connection: { user: process.env.DB_USER, pass: process.env.DB_PASS }
  }, {
    staticPath: path.join(__dirname, './public'), // Path to static files
    dynRegRoute: '/register',
    cookies: {
      secure: false, // Set secure to true if the testing platform is in a different domain and https is being used
      sameSite: '' // Set sameSite to 'None' if the testing platform is in a different domain and https is being used
    },
    devMode: true, // Set DevMode to true if the testing platform is in a different domain and https is not being used
    dynReg: {
      url: process.env.URL, // Tool Provider URL. Required field.
      name: 'Tool Provider', // Tool Provider name. Required field.
      logo: `${process.env.URL}/assets/logo.svg`, // Tool Provider logo URL.
      description: 'Tool Description', // Tool Provider description.
      redirectUris: [`${process.env.URL}/launch`], // Additional redirection URLs. The main URL is added by default.
      customParameters: { key: 'value' }, // Custom parameters.
      autoActivate: true // Whether or not dynamically registered Platforms should be automatically activated. Defaults to false.
    }
  })

// When receiving successful LTI launch redirects to app
lti.onConnect(async (token, req, res) => {
  return res.sendFile(path.join(__dirname, './public/index.html'))
})

// When receiving deep linking request redirects to deep screen
lti.onDeepLinking(async (token, req, res) => {
  return lti.redirect(res, '/deeplink', { newResource: true })
})

lti.onDynamicRegistration(async (req, res, next) => {
  try {
    if (req.method === 'GET' && req.query.openid_configuration) {
      res.setHeader('Content-type', 'text/html')
      const html = fs.readFileSync('src/dynamic-registration.html', 'utf8')
        .replace('OPENID_CONFIGURATION', req.query.openid_configuration)
        .replace('REGISTRATION_TOKEN', req.query.registration_token)
      res.setHeader('Content-type', 'text/html')
      res.send(html)
    } else if(req.method === 'POST') {
      const message = await lti.DynamicRegistration.register(req.query.openid_configuration, req.query.registration_token, {
        'https://purl.imsglobal.org/spec/lti-tool-configuration': {
          custom_parameters: req.body.customParameters
        }
      })
      res.json({status: 'success', message})
    } else {
      return res.status(400).send({ status: 400, error: 'Bad Request', details: { message: 'Missing parameter: "openid_configuration".' } })
    }
  } catch (err) {
    if (err.message === 'PLATFORM_ALREADY_REGISTERED') return res.status(403).send({ status: 403, error: 'Forbidden', details: { message: 'Platform already registered.' } })
    return res.status(500).send({ status: 500, error: 'Internal Server Error', details: { message: err.message } })
  }
})

// Setting up routes
lti.app.use(routes)

// Setup function
const setup = async () => {
  await lti.deploy({ port: process.env.PORT })

  /**
   * Register platform
   */
  /* await lti.registerPlatform({
    url: 'http://localhost/moodle',
    name: 'Platform',
    clientId: 'CLIENTID',
    authenticationEndpoint: 'http://localhost/moodle/mod/lti/auth.php',
    accesstokenEndpoint: 'http://localhost/moodle/mod/lti/token.php',
    authConfig: { method: 'JWK_SET', key: 'http://localhost/moodle/mod/lti/certs.php' }
  }) */
}

setup()
