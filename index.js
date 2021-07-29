const mqtt = require("mqtt");
const log = require('npmlog')
var websocket = require('websocket-stream');

log.info('facebook messenger bot', 'started')

var unsentMessageId = 'mid.$gAA_GUHDKpcGBIgluJ168MVbHuBk9'; //put the unsent message ID
var cookies = 'sb=T82mYG80LYxsZkWNfWafbEjq; datr=UM2mYOZk10Abr9ZYTuaWfhEQ; c_user=100009985927020; dpr=1.25; spin=r.1004169522_b.trunk_t.1627461617_s.1_v.2_; m_pixel_ratio=1.25; xs=19%3AIXrdh_rMg9l8VA%3A2%3A1624877736%3A-1%3A6232%3A%3AAcUHmIoJa_tN3-73ZRZwEVFFE5MhEIK-FU-kHeGGcIj_; fr=144l8XE1Vfpdmms0r.AWWuBx6rYEHDqVYOfa9xwlHpI7g.BhAj0M.Wn.AAA.0.0.BhAj0M.AWVaOAwvhpQ; x-referer=eyJyIjoiL21lc3NhZ2VzL3JlYWQvP3RpZD1jaWQuZy40NDQwMTczNDQyNjcyMDY1JmVudHJ5cG9pbnQ9amV3ZWwmc3VyZmFjZV9oaWVyYXJjaHk9dW5rbm93biIsImgiOiIvbWVzc2FnZXMvcmVhZC8%2FdGlkPWNpZC5nLjQ0NDAxNzM0NDI2NzIwNjUmZW50cnlwb2ludD1qZXdlbCZzdXJmYWNlX2hpZXJhcmNoeT11bmtub3duIiwicyI6Im0ifQ%3D%3D; wd=1009x722'; //put your cookies
var lastSequenceId = 2259907; //put last sequence id
var yourUserId = "100009985927020";
var topics = [
    "/t_ms",
    "/thread_typing",
    "/orca_typing_notifications",
    "/orca_presence",
    "/legacy_web",
    "/br_sr",
    "/sr_res",
    "/webrtc",
    "/onevc",
    "/notify_disconnect",
    "/inbox",
    "/mercury",
    "/messaging_events",
    "/orca_message_notifications",
    "/pp",
    "/webrtc_response",
];

var sessionID = Math.floor(Math.random() * 9007199254740991) + 1;
var username = { "u": yourUserId, "s": sessionID, "cp": 3, "ecp": 10, "chat_on": true, "fg": false, "d": "507dbbfd-533a-4306-9cd8-1e733581ab1d", "ct": "websocket", "mqtt_sid": "", "aid": 219994525426954, "st": topics, "pm": [], "dc": "", "no_auto_fg": true, "gas": null, "pack": [], "php_override": "" }
var host = 'wss://edge-chat.messenger.com/chat?region=atn&sid=' + sessionID;

var options = {
    clientId: "mqttwsclient",
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    username: JSON.stringify(username),
    clean: true,
    wsOptions: {
        headers: {
            'Cookie': cookies,
            'Origin': 'https://www.facebook.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36',
            'Referer': 'https://www.facebook.com',
            'Host': 'edge-chat.facebook.com'
        },
        origin: 'https://www.facebook.com',
        protocolVersion: 13
    }
};

var mqttClient = new mqtt.Client(_ => websocket(host, options.wsOptions), options);

mqttClient.on('error', function(err) {
    log.error(err);
    mqttClient.end();
    globalCallback("Connection refused: Server unavailable", null);
});


var queue = {
    "sync_api_version": 10,
    "max_deltas_able_to_process": 300,
    "delta_batch_size": 500,
    "encoding": "JSON",
    "entity_fbid": "100009985927020",
    "initial_titan_sequence_id": lastSequenceId, //sequence  = the order of message.
    "device_params": null
};

mqttClient.on('connect', function() {
    log.info('connected');
    mqttClient.publish('/messenger_sync_create_queue', JSON.stringify(queue), { qos: 1, retain: false });
});

mqttClient.on('message', function(topic, message, packet) {
    // log.info('package', packet)
    var jsonMessage = JSON.parse(message);
    log.info('topic', topic);
    if (topic == '/ls_resp') {
        log.info('ls_resp', jsonMessage)
    } else if (topic == '/t_ms') {
        console.log(jsonMessage);
        if (jsonMessage.errorCode == 'ERROR_QUEUE_EXCEEDS_MAX_DELTAS') {
            queue["max_deltas_able_to_process"] += 100;
            mqttClient.publish('/messenger_sync_create_queue', JSON.stringify(queue), { qos: 1, retain: false });
        } else
        if (jsonMessage.errorCode == 'ERROR_QUEUE_OVERFLOW') {
            queue["delta_batch_size"] += 100;
            mqttClient.publish('/messenger_sync_create_queue', JSON.stringify(queue), { qos: 1, retain: false });
        } else
        if (jsonMessage.deltas != undefined) {

            var foundIt = false;

            for (var i = 0; i < jsonMessage.deltas.length; i++) {
                //check actorFbId to see who we talking to
                //&& jsonMessage.deltas[i].messageMetadata.actorFbId == 100006482257728
                if (jsonMessage.deltas[i].body != undefined) {
                    log.info('message received', jsonMessage.deltas[i].body + ' from ' + jsonMessage.deltas[i].messageMetadata.actorFbId);

                    if (jsonMessage.deltas[i].messageMetadata.messageId == unsentMessageId) {
                        log.info('FOUND IT: ' + jsonMessage.deltas[i].body);
                        foundIt = true;
                        break;
                    }
                    //log.info('detail', jsonMessage.deltas[i]);
                }
            }

            if (!foundIt) {
                queue["initial_titan_sequence_id"] -= 100;
                mqttClient.publish('/messenger_sync_create_queue', JSON.stringify(queue), { qos: 1, retain: false });
            }
        }



    } else if (topic == '/orca_presence') {
        //log.info('orca', jsonMessage);
        var chatUsers = jsonMessage.list;
        //u = username, l = timestampe, c = ??

    }
    //log.info('message', jsonMessage);
});

mqttClient.on('close', function() {
    log.error('closed');
});