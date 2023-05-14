Use this extension to use [Riot Sign On](https://www.riotgames.com/en/DevRel/rso) together with Firebase authentication.
The extension creates two cloud functions, one which assembles an authorization URL and one which handles the callback.

Using this extension on an end-users browser, a window can be opened and and be navigated to the function which assembles the auth URL.
The end-user can then choose to authorize with RSO and they'll be redirected to the second cloud function that handles the auth callback.
The function will retrieve the end-users PUUID, as well as add their cpid (if in scope) to the users claims and compose a Firebase token using the Custom Authentication System. Tokens which can be consumed in [web](https://firebase.google.com/docs/auth/web/custom-auth), [iOS](https://firebase.google.com/docs/auth/ios/custom-auth) and [android](https://firebase.google.com/docs/auth/android/custom-auth). The Custom Authentication System Token is sent from this final view, to the opener window through [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage). 

# Recommended Usage
Using this extension, you can use the Firebase authentication system with [Riot Sign On](https://www.riotgames.com/en/DevRel/rso) as your identity provider, it uses the PUUID as a user info and sets the cpid as a claim for the user.

# Handling callbacks
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

# Billing
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)
This extension uses other Firebase or Google Cloud Platform services which may have associated charges:
- Cloud Functions [See FAQs](https://firebase.google.com/support/faq#extensions-pricing)
- Cloud Secret Manager

Usage of this extension also requires you to have a [registered app with Riot](https://developer.riotgames.com/).