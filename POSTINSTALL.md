# How it works

If you've just setup the extension you're going to want to go into the Google Cloud Project associated with this Firebase application and locate the service account that was created for it. After which you're going to want to give access to this service account in Google Secrets Manager to read the secret `RIOT_CLIENT_SECRET_ID` that you specified during setup. You're also going to give the service account the permission "Service Account Token Creator" so the extension is able to issue custom sign in tokens.

Then you're good to go! 
#### Key information
You want to setup the flow to being with opening the window: ${function:constructRiotAuth.url}
And you probably want to set your callback URL to ${function:riotAuthCallback.url}

GLHF!

# Using the extension

Using this extension, you can use the Firebase authentication system with [Riot Sign On](https://www.riotgames.com/en/DevRel/rso) as your identity provider, it uses the PUUID as a user info and sets the cpid as a claim for the user.

# Authentication Flow
Since the purpose of this application is meant to be opened in a new window and get callbacks to the opener window, it's structured as such. The recommended flow begins with opening the function `constructRiotAuth` in a new window. After which they get redirected to [Riot Sign On](https://www.riotgames.com/en/DevRel/rso) to authenticate. After which, the end-user should be redirected to `riotAuthCallback`, which will perform the neccessary API calls to retrieve user-info. The window (which is now currently on `riotAuthCallback`), will send a [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) to the opener window (as long as you've properly setup the `APPLICATION_URL` config option) with this structure: 

| Field    | Description                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `status` | The status of the callback, is either `ok` (completed authentication) or `error` (failed authentication).                            |
| `value`  | The payload of the callback.  If `status` was `ok`, this is the user token. If status was `error`, this is the authentication error. |

Hopefully, `status` should be `ok` and `value` should be the user token. However, sometimes you need to handle errors that occur in the user flow. So if `status` is `error`, refer to this list of errors:
- `INVALID_STATE`: The state paramater has been modified, or is missing. Possible CSRF issue.
- `USER_CANCELLED_AUTH`: The user cancelled the authentication flow.
- `FIREBASE_TOKEN_CREATION`: There was an issue creating the Firebase user token, check that the service account is setup correctly.
- `ACCOUNT_FETCH`: The [Account-V1](https://developer.riotgames.com/apis#account-v1) API call failed. Check your rate limits possibly?
- `ACCESS_TOKEN_FETCH`: There was an issue exchanging for an Access Token.  

From there you can use the token returned with the Firebase Custom Authentication System for your platform. 

# Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
