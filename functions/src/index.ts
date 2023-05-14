/*
 * Copyright 2023 Tristan Farkas
 */

import axios from "axios";
import * as crypto from "crypto"
import * as functions from "firebase-functions";
import * as NodeCache from "node-cache";
import * as firebaseAdmin from "firebase-admin";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";


firebaseAdmin.initializeApp();

const constantCache = new NodeCache();
const riotProvider = new URL("https://auth.riotgames.com");
exports.constructRiotAuth = functions.https.onRequest(
  (req: functions.Request, res: functions.Response) => {
    const randomState = crypto.getRandomValues(new Uint32Array(5)).join("");
    // Set an hours expiry for the CSRF state token.
    res.cookie("state", randomState, {
      expires: new Date(Date.now() + 60 * 60 * 1000),
      httpOnly: true,
    });
    res.redirect(constructAuthUrl(randomState).toString());
  }
);

exports.riotAuthCallback = functions.https.onRequest(
  (req: functions.Request, res: functions.Response) => {
    const requestCookies = (req.headers.cookie ??= "")
      .split(";")
      .map((v: string) => v.split("="))
      .reduce((acc: { [x: string]: string }, v: string[]) => {
        acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
        return acc;
      }, {});
    if (req.query.state != requestCookies.state) {
      replyWithMessage(res, "error", "INVALID_STATE");
    }
    const accessCode = req.query.code;
    // User cancelled sign in, probably.
    if (req.query.error != null || accessCode == null) {
      replyWithMessage(res, "error", "USER_CANCELLED_AUTH");
      return;
    }
    const authForm = new URLSearchParams({
      grant_type: "authorization_code",
      code: accessCode as string,
      redirect_uri: process.env.RIOT_CALLBACK_URL as string,
    });

    retrieveSecret().then((clientSecret) => {
      axios
        .post(riotProvider + "token", authForm, {
          auth: {
            username: (process.env.RIOT_CLIENT_ID ??= ""),
            password: clientSecret,
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })
        .then((response) => {
          if (response.status == 200) {
            const accessToken = response.data.access_token;
            axios
              .get(riotProvider + "userinfo", {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              })
              .then((response) => {
                const leagueRegion = response.data.cpid;
                axios
                  .get(
                    `https://${process.env.RIOT_API_GATEWAY}.api.riotgames.com/riot/account/v1/accounts/me`,
                    {
                      headers: {
                        Authorization: `Bearer ${accessToken}`,
                      },
                    }
                  )
                  .then((accountResponse) => {
                    if (response.status == 200) {
                      firebaseAdmin
                        .auth()
                        .createCustomToken(accountResponse.data.puuid, {
                          cpid: leagueRegion,
                        })
                        .then((token) => {
                          replyWithMessage(res, "ok", token);
                        })
                        .catch((_) => {
                          replyWithMessage(
                            res,
                            "error",
                            "FIREBASE_TOKEN_CREATION"
                          );
                        });
                    } else {
                      replyWithMessage(res, "error", "ACCOUNT_FETCH");
                    }
                  })
                  .catch((_) => {
                    replyWithMessage(res, "error", "ACCOUNT_FETCH");
                  });
              })
              .catch((_) => {
                replyWithMessage(res, "error", "ACCOUNT_FETCH");
              });
          } else {
            replyWithMessage(res, "error", "ACCESS_TOKEN_FETCH");
          }
        })
        .catch((_) => {
          replyWithMessage(res, "error", "ACCESS_TOKEN_FETCH");
        });
    });
  }
);

const cacheKeyRiotSecret = "rsoAuthSecretToken";

function replyWithMessage(
  res: functions.Response,
  status: string,
  value: string
) {
  res.send(`<!doctype html>
    <head>
    </head>
    <body>
    <script>
    window.opener.postMessage('${JSON.stringify({
      status: status,
      value: value,
    })}', "${process.env.APPLICATION_URL}");
    window.close()
    </script>
    </body>
  </html>`);
}

async function retrieveSecret(): Promise<string> {
  if (constantCache.has(cacheKeyRiotSecret)) {
    const cachedSecret = constantCache.get<string>(cacheKeyRiotSecret);
    if (cachedSecret) {
      return cachedSecret;
    }
  }
  const constantSecretManager = new SecretManagerServiceClient();
  const [version] = await constantSecretManager.accessSecretVersion({
    name: process.env.RIOT_CLIENT_SECRET_ID,
  });

  // Extract the payload as a string.
  if (version.payload == null || version.payload.data == null) {
    return "";
  }
  const secret = version.payload.data.toString();
  // Cache secret for five minutes.
  constantCache.set(cacheKeyRiotSecret, secret, 60 * 5);
  return secret;
}

function constructAuthUrl(state: string): URL {
  const authorizeUrl = new URL(riotProvider + "/authorize");
  authorizeUrl.searchParams.set(
    "redirect_uri",
    (process.env.RIOT_CALLBACK_URL ??= "")
  );
  authorizeUrl.searchParams.set(
    "client_id",
    (process.env.RIOT_CLIENT_ID ??= "")
  );
  authorizeUrl.searchParams.set(
    "scope",
    (process.env.RIOT_AUTH_SCOPES ??= "openid")
  );
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);
  return authorizeUrl;
}
