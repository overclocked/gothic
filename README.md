# Gothic

#### Making the Easy things Easy

## Introduction

When Google announced the planned migration to it's new Identity Service for
api authorization and user authentication functionality, I had a devil of a
time figuring out how to make it work. The documentation promised
a streamlined user experience and a simplified developer process. But for the 
life of me, I could not figure out how to achieve either of these
blissful results.

As a result, through extremely close attention to some of the more cryptic
corners of the documentation, enormous trial and error, and some timely help
from stack overflow, I wrote this library.

Gothic is intended to make the easy things easy.

You may find it doesn't serve your needs, but it may still serve as a reference
point in writing your own implementation against Google's APIs.

## Dependencies

Google now uses JWT's to encode user information. Gothic leverages the simple `jwt-decode` 
library to handle this. There are no other dependencies.

## Characteristics

Gothic is designed to support single-page web apps. 

Gothic is completely self contained. You don't need to add any tags or scripts
to your html. 

Gothic strives to keep the console fairly clean of extraneous messages, and 
to communicate with the host app only on actionable events.

### Use Cases

- Recognize whether the user is likely to be a return visitor
- Sign-in/Sign-up with a fully configurable google button
- Sign-in/Sign-up with the Google one-tap flow
- Authorize access to Google APIs
- Maintain that authorization with the least possible friction across return visits and page loads
- Ordinary sign out 
- Revoke authorization

## Example:

This sample app will demonstrate sign-in by two methods, button for unrecognized
users, or onetap for recognized users. It will demonstrate signout and revoke.
It demonstrates the observer pattern. It demonstrates authentication of and access
to Google API's (in this case, drive). It demonstrates low-friction (no-clicks) 
re-authentication for return visitors (page refresh).

What you would need to test this out would be your client-id and API-key, with
the correct domain configuration to function as a legitimate google API client.

##### Barebones HTML

```
<!DOCTYPE html>
<html>
  <head>
    <title>Gothic API Quickstart</title>
    <meta charset="utf-8" />
    <script src="./app.js" type="module"></script>
  </head>
  <body>
    <p>Gothic API Quickstart</p>
    <div id="signin"></div>
    <div id="signout">
      <button id="signout_button">Sign Out</button>
      <button id="revoke_button">Sign Out</button>
    </div>
    <pre id="content" style="white-space: pre-wrap;"></pre>
  </body>
</html>
```

##### Skeleton App 

Note that how you include gothic may vary in your implementation. 

```
import Goth from 'gothic';

const CLI_ID = '992279172814-gmqt9g152hjab4rojlbt8niq1sn299vk.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBSeLzjE2r3dt9yER5l9gNIJpLWr5vOTy8';
const SCOPES = 'https://www.googleapis.com/auth/drive.metadata'; // Space delimited if more than one
const DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

/**
 * The google libraries are loaded, and ready for action!
 */
function proceedAsLoaded() {
  if (Goth.recognize()) {
    Goth.onetap();
  } else {
    forceSignin();
  }
}

/**
 * They have to correctly get through the button click / sign up flow to proceed.
 */
function forceSignin() {
  Goth.button('signin', {type: 'standard', size: 'large', text: 'signup_with'});
}

function signoutEvent() {
  document.getElementById('content').innerHTML = '';
  document.getElementById('signout').style.display = 'none';
  document.getElementById('signin').style.display = 'block';
  forceSignin();
}

function proceedAsSignedIn() {
  document.getElementById('signin').style.display = 'none';
  document.getElementById('signout').style.display = 'block';
  list_files();
}
/**
 * Just to demonstrate that the APIs *can* successfully be called.
 */
async function list_files() {
  let response;
  try {
    response = await window.gapi.client.drive.files.list({
      'pageSize': 10,
      'fields': 'files(id, name)',
    });
  } catch (err) {
    document.getElementById('content').innerText = err.message;
    return;
  }
  const files = response.result.files;
  if (!files || files.length == 0) {
    document.getElementById('content').innerText = 'No files found.';
    return;
  }
  // Flatten to string to display
  const output = files.reduce(
      (str, file) => `${str}${file.name} (${file.id}\n`,
      'Files:\n');
  document.getElementById('content').innerText = output;
}

/**
 * Handle the lifecycle of authenticated status
 */
function gothWatch(event) {
  switch (event) {
    case 'signin':
      proceedAsSignedIn();
      break;
    case 'revoke':
    case 'signout': 
      signoutEvent();
      break;
    case 'loaded':
      proceedAsLoaded();
      break;
    case 'onetap_suppressed':
      forceSignin();  // If a user bypasses onetap flows, we land them with a button.
      break;
    default: 
      console.log("Well, this is a surprise!");
      console.log(event);
  }
}

/**
 * Wire up the main ux machinery.
 */
function main() {
  Goth.observe(gothWatch);
  Goth.load(CLI_ID, API_KEY, SCOPES, DISCOVERY);
  const signout = document.getElementById('signout');
  signout.style.display = 'none';
  const signout_btn = document.getElementById('signout_button');
  const revoke_btn = document.getElementById('revoke_button');
  signout_btn.onclick = Goth.signout;
  revoke_btn.onclick = Goth.revoke;
}

main();
```

## Method Reference:


- `load(clientId, apiKey, scopes, discovery)` 
  - Loads all Google libraries, and prepares Goth to take action on your behalf. It will notify when everything is loaded. (TODO: if someone only needs authentication and does not plan on using google API's, we could take the absence of parameters beyond `clientId` as signal and drop execution of authorization flows.)
- `recognize()`
  - Tests to see if we expect to recognize the incoming user. This is useful for deciding whether to display introductory text and a login button, or cut straight to one-tap.
- `button(parentId, parameters)`
  - Fills the dom element named by `parentId` with a google button, configured by the provided parameter object, if any. These parameters are a direct pass through to google api's and documentation can be [found here](https://developers.google.com/identity/gsi/web/reference/js-reference#google.accounts.id.renderButton) 
- `onetap()`
  - Initiates Google's one-tap flow, which should pass recognized users on to the app.
- `observe(cb)`
  - Adds the provided callback function to Goth's list of observers, to be called when there is a sign-in or sign-out event, or if onetap is suppressed or bypassed.
- `unobserve(cb)` 
  - Removes the specified observer 
- `signout()`
  - Signals the user's intention to sign out *of your app* -- but it's on the app to honor that during the current session. A visitor who signs out will be prompted on return to sign in again, but will not have to re-authorize api access. 
- `revoke()`
  - Revokes authorization credentials, presumably on the user's request. On return visit, the user will have to sign in *and* re-authorize api access.
- `user()`
  - This returns a lightweight user object with: `email`, `family_name`, `given_name`, `picture`, `name` properties. 
  




