require('dotenv').config({ silent: true });
const express = require('express');
const simpleOauthModule = require('simple-oauth2');
const randomstring = require('randomstring');
const port = process.env.PORT || 3000;
const oauthProvider = process.env.OAUTH_PROVIDER || 'github';
const loginAuthTarget = process.env.AUTH_TARGET || '_self';
const originPattern = process.env.ORIGIN || '';
if (('').match(originPattern)) {
  console.warn('Insecure ORIGIN pattern used. This can give unauthorized users access to your repository.')
  if (process.env.NODE_ENV === 'production') {
    console.error('Will not run without a safe ORIGIN pattern in production.')
    process.exit()
  }
};


const credentials = {
  client: {
    id: process.env.OAUTH_CLIENT_ID,
    secret: process.env.OAUTH_CLIENT_SECRET
  },
  auth: {
    // Supply GIT_HOSTNAME for enterprise github installs.
    tokenHost: process.env.GIT_HOSTNAME || 'https://github.com',
    tokenPath: process.env.OAUTH_TOKEN_PATH || '/login/oauth/access_token',
    authorizePath: process.env.OAUTH_AUTHORIZE_PATH || '/login/oauth/authorize'
  }
};

const oauth2 = simpleOauthModule.create(credentials);
const authOptions = {
  redirect_uri: process.env.REDIRECT_URL || "http://localhost:3000/callback",
  scope: process.env.SCOPES || 'repo,user',
  state: randomstring.generate(32)
};

const authorizationUri = oauth2.authorizationCode.authorizeURL(authOptions);

const app = express();

// Initial page redirecting to Github
app.get('/auth', (req, res) => {
  res.redirect(authorizationUri)
});

// Callback service parsing the authorization token and asking for the access token
app.get('/callback', async (req, res) => {
  const tokenConfig = {
    code: req.query.code,
    scope: authOptions.scope,
    redirect_uri: authOptions.redirect_uri
  }

  if (oauthProvider === 'gitlab') {
    tokenConfig.client_id = process.env.OAUTH_CLIENT_ID
    tokenConfig.client_secret = process.env.OAUTH_CLIENT_SECRET
    tokenConfig.grant_type = 'authorization_code'
  }

  let mess, content;
  try {
    const result = await oauth2.authorizationCode.getToken(tokenConfig);
    const token = oauth2.accessToken.create(result);
    content = {
      token: token.token.access_token,
      provider: oauthProvider
    }
    mess = 'success';
  } catch (error) {
    console.log('Access Token Error', error.message);
    mess = 'error';
    content = JSON.stringify(error);
  }
  const script = `
    <script>
    (function() {
      function recieveMessage(e) {
        console.log("recieveMessage %o", e)
        if (!e.origin.match(${JSON.stringify(originPattern)})) {
          console.log('Invalid origin: %s', e.origin);
          return;
        }
        // send message to main window with da app
        window.opener.postMessage(
          'authorization:${oauthProvider}:${mess}:${JSON.stringify(content)}',
          e.origin
        )
      }
      window.addEventListener("message", recieveMessage, false)
      // Start handshare with parent
      console.log("Sending message: %o", "${oauthProvider}")
      window.opener.postMessage("authorizing:${oauthProvider}", "*")
    })()
    </script>`
  return res.send(script)

});

app.get('/success', (req, res) => {
  res.send('')
})

app.get('/', (req, res) => {
  res.send(`Hello<br>
    <a href="/auth" target="${loginAuthTarget}">
      Log in with ${oauthProvider.toUpperCase()}
    </a>`)
})

app.listen(port, () => {
  console.log("gandalf is walkin' on port " + port)
})
