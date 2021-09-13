const { User } = require('../model/userModel');
const { Subscription } = require('../model/subscriptionModel');
const { decodeJwt, generateJwt } = require('../lib/jwt');
const { <%if (useRefreshToken) {%> checkAndRefreshAccessToken,<%}%> getOAuthApp } = require('../lib/oauth');

async function openAuthPage(req, res) {
    try {
        const oauthApp = getOAuthApp();
        const url = oauthApp.code.getUri();
        console.log(`Opening auth page: ${url}`);
        res.redirect(url);
    } catch (e) {
        console.error(e);
    }
}

async function getUserInfo(req, res) {
    if (req.query.token) {
        const jwtToken = req.query.token;
        if (!jwtToken) {
            res.status(403);
            res.send('Error params');
            return;
        }
        const decodedToken = decodeJwt(jwtToken);
        if (!decodedToken) {
            res.status(401);
            res.send('Token invalid.');
            return;
        }
        const userId = decodedToken.id;
        const user = await User.findByPk(userId);

        <%if (useRefreshToken) {%>// check token refresh condition
            await checkAndRefreshAccessToken(user);<%}%>

                res.json(user);
    }
}

<%if (useRefreshToken) {%>
async function generateToken(req, res) {
    const oauthApp = getOAuthApp();
    const { accessToken, refreshToken, expires } = await oauthApp.code.getToken(req.body.callbackUri);
    if (!accessToken || !refreshToken) {
        res.status(403);
        res.send('Params error');
        return;
    }
    console.log(`Receiving accessToken: ${accessToken} and refreshToken: ${refreshToken}`);
    try {
        // Step1: Get user info from 3rd party API call
        const userInfoResponse = { id: "id", email: "email", name: "name" }   // [REPLACE] this line with actual call
        // Step2: Find if it's existing user in our database
        const user = await User.findByPk(userInfoResponse.id);  // [REPLACE] this line with user id from actual response
        // Step3: If user doesn't exist, we want to create a new one
        if (!user) {
            await User.create({
                id: userInfoResponse.id,    // [REPLACE] this with actual user id in response
                accessToken: accessToken,
                refreshToken: refreshToken,
                tokenExpiredAt: expires,
                email: userInfoResponse.email, // [REPLACE] this with actual user email in response, [DELETE] this line if user info doesn't contain email
                name: userInfoResponse.name, // [REPLACE] this with actual user name in response, [DELETE] this line if user info doesn't contain name
            });
        }
        // If user exists but logged out, we want to fill in token info
        else if(!user.accessToken){
            user.accessToken = accessToken;
            user.refreshToken = refreshToken;
            user.tokenExpiredAt = expires;
            await user.save();
        }
        // Step4: Return jwt to client for future client-server communication
        const jwtToken = generateJwt({ id: userInfoResponse.id });   // [REPLACE] this with actual user id in response
        res.status(200);
        res.json({
            authorize: true,
            token: jwtToken,
        });
    } catch (e) {
        console.error(e);
        res.status(500);
        res.send('Internal error.');
    }
}
<%} else {%>
async function generateToken(req, res) {
    const oauthApp = getOAuthApp();
    const { accessToken } = await oauthApp.code.getToken(req.body.callbackUri);
    if (!accessToken) {
        res.status(403);
        res.send('Params error');
        return;
    }
    console.log(`Receiving accessToken: ${accessToken}`);
    try {
        // Step1: Get user info from 3rd party API call
        const userInfoResponse = { id: "id", email: "email", name: "name" }   // [REPLACE] this line with actual call
        // Step2: Find if it's existing user in our database
        const user = await User.findByPk(userInfoResponse.id);  // [REPLACE] this line with user id from actual response
        // Step3: If user doesn't exist, we want to create a new one
        if (!user) {
            await User.create({
                id: userInfoResponse.id,    // [REPLACE] this with actual user id in response
                accessToken: accessToken,
                email: userInfoResponse.email, // [REPLACE] this with actual user email in response, [DELETE] this line if user info doesn't contain email
                name: userInfoResponse.name, // [REPLACE] this with actual user name in response, [DELETE] this line if user info doesn't contain name
            });
        }
        // Step4: Return jwt to client for future client-server communication
        const jwtToken = generateJwt({ id: userInfoResponse.id });   // [REPLACE] this with actual user id in response
        res.status(200);
        res.json({
            authorize: true,
            token: jwtToken,
        });
    } catch (e) {
        console.error(e);
        res.status(500);
        res.send('Internal error.');
    }
}
<%}%>
async function revokeToken(req, res) {
    const jwtToken = req.body.token;
    if (!jwtToken) {
        res.status(403);
        res.send('Error params');
        return;
    }
    const decodedToken = decodeJwt(jwtToken);
    if (!decodedToken) {
        res.status(401);
        res.send('Token invalid.');
        return;
    }
    const userId = decodedToken.id;
    try {
        const user = await User.findByPk(userId);
        if (user) {
            // Step.1: Clear token
            user.accessToken = '';
<%if (useRefreshToken) {%> user.refreshToken = '';<%}%>
// Step.2: Unsubscribe all webhook and clear subscriptions in db
        const subscriptions = await Subscription.findAll({
                where: {
                    userId: userId
                }
            });
            for (const subscription of subscriptions) {
                const sub = await Subscription.findByPk(subscription.id);
                // [INSERT] call to delete webhook subscription from 3rd party platform
                await sub.destroy();
            }
            await user.save();
        }
        res.status(200);
        res.json({
            result: 'ok',
            authorized: false,
        });
    } catch (e) {
        console.error(e);
        res.status(500);
        res.send('internal error');
    }
}

function oauthCallback(req, res) {
    res.render('oauth-callback');
};

exports.openAuthPage = openAuthPage;
exports.getUserInfo = getUserInfo;
exports.generateToken = generateToken;
exports.revokeToken = revokeToken;
exports.oauthCallback = oauthCallback;