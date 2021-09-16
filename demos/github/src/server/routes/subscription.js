const { decodeJwt } = require('../lib/jwt');
const { generate } = require('shortid');
const constants = require('../lib/constants');
const { User } = require('../models/userModel');
const { Subscription } = require('../models/subscriptionModel');
const { Octokit } = require('@octokit/rest');



async function subscribe(req, res) {
    // validate jwt
    const jwtToken = req.body.token;
    if (!jwtToken) {
        res.status(403);
        res.send('Params invalid.');
        return;
    }
    const decodedToken = decodeJwt(jwtToken);
    if (!decodedToken) {
        res.status(401);
        res.send('Token invalid');
        return;
    }

    // check for rcWebhookUri
    const rcWebhookUri = req.body.rcWebhookUri;
    if (!rcWebhookUri) {
        res.status(400);
        res.send('Missing rcWebhookUri');
        return;
    }

    // get existing user
    const userId = decodedToken.id;
    const user = await User.findByPk(userId);
    if (!user) {
        res.status(401);
        res.send('Unknown user');
        return;
    }

    // create webhook notification subscription
    try {
    
        // Generate an unique id
        // Note: notificationCallbackUrl here would contain our subscriptionId so that incoming notifications can be identified
        const subscriptionId = generate();
        const notificationCallbackUrl = `${process.env.APP_SERVER}${constants.route.forThirdParty.NOTIFICATION}?subscriptionId=${subscriptionId}`;
        
        // Step.1: [INSERT]Create a new webhook subscription on 3rd party platform with their API. For most cases, you would want to define what resources/events you want to subscribe to as well.
        const octokit = new Octokit({
            auth: user.accessToken
          });
        const webhookResponse = await octokit.repos.createWebhook({
            owner: user.name,
            repo: process.env.GITHUB_REPO_NAME,
            events: ['issues'],
            config: {
              url: notificationCallbackUrl,
              content_type: "json"
            }
          });
          console.log(`Github repo webhook id: ${webhookResponse.data.id}`);
        // Step.2: Get response from webhook creation.
        const webhookData = webhookResponse.data;   // [REPLACE] this with actual API call to 3rd party platform to create a webhook subscription

        // Step.3: Create new subscription in DB
        await Subscription.create({
            id: subscriptionId,
            userId: userId, 
            rcWebhookUri: req.body.rcWebhookUri,
            thirdPartyWebhookId: webhookData.id// [REPLACE] this with webhook subscription id from 3rd party platform response
        });
    
        res.status(200);
        res.json({
            result: 'ok'
        });
    }
    catch (e) {
        console.error(e);
        if (e.response && e.response.status === 401) {
            res.status(401);
            res.send('Unauthorized');
            return;
        }
        console.error(e);
        res.status(500);
        res.send('Internal server error');
        return;
    }
}


exports.subscribe = subscribe;