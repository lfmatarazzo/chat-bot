const request = require('request');
const bodyParser = require('body-parser');

var options = {};

//Initiates the Get Started button.
exports.initiateGetStarted = function(){
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messenger_profile',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
            json: {
                "get_started":{
                    "payload":"GET_STARTED_PAYLOAD"
                }
            }

  }, function (error, response, body) {
    options.statusCode = response.statusCode;

    if (!error && response.statusCode == 200) {
      options.recipientId = body.recipient_id;
      options.messageId = body.message_id;

      //callback(null, options);  
      console.log("Successfully sent generic message with id %s to recipient %s", options.messageId, options.recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
      //callback(error, response.statusCode)
    }
  });      
};


// Incoming events handling
exports.receivedMessage = function(event) {
  options.senderID = event.sender.id;
  options.recipientID = event.recipient.id;
  options.timeOfMessage = event.timestamp;
  options.message = event.message;

  //Find out what kind of message we've got.
  if (options.message.text && !options.message.quick_reply) {
    // If we receive a text message, check to see if it matches a keyword
    // and send back the template example. Otherwise, just echo the text we received.
    switch (options.message.text) {
      case 'generic':
        sendGenericMessage(options.senderID);
        break;

      default:
        sendTextMessage(options.senderID, 'Desculpe, não entendi, pode repetir?');
    }
  } else if (options.message.attachments) { //if the message has attachments
    sendTextMessage(options.senderID, "Message with attachment received");
  } else if(options.message.quick_reply){ //if the message is a quick reply callback
        //Reads models/payloads.json file
        var payloads = require('../models/payloads.json');

        //Checks if the received payload is in the payloads.js file. (it should be)
        // var callback = (typeof options.message.quick_reply.payload.callback !== 'undefined' ? options.message.quick_reply.payload.callback : options.message.quick_reply.payload);
        var payload = payloads.findIndex(i => i.payload === options.message.quick_reply.payload);
        //var payload = payloads.findIndex(i => i.payload === options.message.quick_reply.payload);
        
        // console.log('loguei o payload: ' +payload);
        // console.log('loguei o callback: ' +callback);
        // console.log('loguei o callback dentro do payload: '+options.message.quick_reply.payload.callback);
        // console.log('loguei o objeto quick reply: '+ JSON.stringify(options.message.quick_reply) )

        //Get the steps the user went thru so far. 
        // var steps = (typeof options.message.quick_reply.payload.steps !== 'undefined' ? options.message.quick_reply.payload.steps + ' - ' +  options.message.quick_reply.payload: options.message.quick_reply.payload);
        // console.log('loguei o step: '+ steps);

        //Failsafe just in case the payload isn't there
        if(payload >= 0){
            payload = payloads[payload];

            //Find the type of message we should reply with.
            switch(payload.type){
                case 'quick':
                    var quick_replies = require('../models/quickreplies.json');
                
                    var quick_reply = quick_replies.findIndex(i => i.idx === payload.reply);
                    quick_reply = quick_replies[quick_reply];

                    // quick_reply.quick_steps.forEach(function(element){
                    //     element.payload = {callback : element.payload, steps : steps };
                    // });
                    
                    console.log('quick_reply: '+ JSON.stringify(quick_reply.quick_steps));
                    
                    sendQuickReplyMessage(options.senderID, quick_reply.messageText, quick_reply.quick_steps);
                    break;
                case 'text':
                    var text_replies = require('../models/textreplies.json');
                
                    var text_reply = text_replies.findIndex(i => i.idx === payload.reply);
                    text_reply = text_replies[text_reply];

                    sendTextMessage(options.senderID, text_reply.messageText)
                    break;
                default: 
                    console.log('Algo errado aconteceu, recebi o payload: '+ options.message.quick_reply.payload + ', porém ele não existe.');
                    break;
            }
        }
  }
};

exports.receivedPostback = function(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 

  var payload = event.postback.payload;
  if(typeof event.postback.quick_reply !== 'undefined')
    payload = event.postback.quick_reply.payload

  //console.log("Received postback for user %d and page %d with payload '%s' " + 
    //"at %d", senderID, recipientID, payload, timeOfPostback);
    var messageText = 'Recebido o payload: '+payload;

    switch (payload) {
      case 'GET_STARTED_PAYLOAD':
        getUserData(senderID, function(err, userData){
            if(!err){
                
                var quick = [];
                quick.push({
                    content_type:"text",
                    title:"Praias",
                    payload:"BEACH_SUGGESTION_MENU"
                },
                {
                    content_type:"text",
                    title:"Hospedagens",
                    payload:"HOTEL_SUGGESTION_MENU"
                });
                // messageText = 'Olá, '+userData[0].first_name+' '+userData[0].last_name;
                // sendTextMessage(senderID, messageText);
                messageText = 'Olá, '+userData[0].first_name+' '+userData[0].last_name+'!\u000A\u000APosso te ajudar com indicações de praias ou hospedagens. \u000ACom o que posso te ajudar?';
                sendQuickReplyMessage(senderID, messageText, quick);
            }
        });

        break;
       

      default:
        sendTextMessage(senderID, messageText);
    }
  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful
  //sendTextMessage(senderID, "Postback called");
}


//////////////////////////
// Sending helpers
//////////////////////////
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

function sendQuickReplyMessage(recipientId, messageText, quickReplies) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      quick_replies:quickReplies
    }
  };
  console.log(JSON.stringify(messageData.message.quick_replies.payload));
  callSendAPI(messageData);
}


function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",               
            image_url: "http://messengerdemo.parseapp.com/img/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",               
            image_url: "http://messengerdemo.parseapp.com/img/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

function getUserData(userID, callback){
  var uData = [];
  request({
    uri: 'https://graph.facebook.com/v2.6/'+userID,
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN,
    fields: 'first_name,last_name,profile_pic,locale,timezone,gender' },
    method: 'GET'
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {

      uData.push(JSON.parse(body));
      console.log(uData[0].first_name);
      callback(null,uData);   
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  }); 
  
}