// gothic.js
// 
// gothic wraps google authentication and authorization api's to make the easy
// things easy. it's quite unnecessary: the google apis are more than adequate
// on their own. i created this because i found the documentation unhelpful in 
// solving basic obvious problems.
// 
// with this library, it should be easy to trigger sign-in/sign-up events when
// those are required, but to leverage the auto-signin mechanisms when that is
// a better option.
// 
// most importantly, this offers a clean integration between ui

import jwt_decode from "jwt-decode";

/**
 * The library methods:
 */

export default {
  load,      // Load all required google libraries from google
  recognize, // test to see if the user is one we recognize
  button,    // construct sign-in/sign-up button
  onetap,    // institute onetap sign-in flow
  observe,   // observe gothic for events
  unobserve, // stop observing gothic for events
  signout,   // sign out of google for this app.
  revoke,    // revoke the users credentials (presumably upon their request)
  user       // return the user details.
};

let google;
let gapi;

const state = {
  prev:   false,
  loaded: false,
  cid:    null, 
  user:   null
};
const obs = [];

function load(clientId, apiKey, scope, discovery) {
  state.cid       = clientId;
  state.key       = apiKey;
  state.scope     = scope;
  state.discovery = discovery;
  state.prev = window.localStorage.getItem(`gothic-id`) ? true : false;
  _load_libaries();
}

function recognize() {
  return state.prev;
}

function observe(cb) {
  obs.push(cb);
}

function user() {
  return state.user;
}

function unobserve(cb) {
  for(let i=0; i < obs.length; i++) {
    if (obs[i] == cb) {
      obs.splice(i,1);
      break;
    }
  }
}

function button(parent_id, params = {}) {

  let remove = false;
  const ctr = document.getElementById(parent_id);
  if (!ctr) {
    throw(new Error(`No container for signin button: '${parent_id}' `));
  }

  const options = {
    type:  'standard',
    theme: 'outline',
    size:  'medium',
    shape: 'pill',
    ...params,
  };

  function _render_btn() {

    google.accounts.id.initialize({
      client_id: state.cid,
      callback: _on_response
    });

    if (remove) unobserve(_render_btn);
    google.accounts.id.renderButton(
      ctr,
      options
    ); 
  }
  
  if (google) _render_btn();
  else {
    remove = true;
    obs.push(_render_btn);
  }
}

function onetap() {
  let remove = false;

  function _set_autoflow() {
    if (remove) unobserve(_set_autoflow);
    google.accounts.id.initialize({
      client_id:   state.cid,
      auto_select: true,
      scope:       state.scope,
      callback:    _on_response
    });
    google.accounts.id.prompt(_handle_prompt_events); // also display the One Tap dialog */
  }
  if (google) _set_autoflow();
  else {
    remove = true;
    obs.push(_set_autoflow);
  }
}

function _disable() {
  state.user = null;
  window.localStorage.removeItem(`gothic-id`);
  google.accounts.id.disableAutoSelect();
}

function signout() {
  _disable();
  _notify('signout');
}

function revoke() {
  google.accounts.id.revoke(state.user.email, done => {
    _disable();
    _notify('revoke');
  });
}

async function _api_init() {
  return new Promise((res,rej) => {
    gapi.load('client', async () => {
      await gapi.client.init({
        apiKey: state.key,
        discoveryDocs: [ state.discovery ],
      });
      res();
    });
  });
}

async function _goog_setup() {
  state.tok_client = google.accounts.oauth2.initTokenClient({
    client_id: state.cid,
    scope: state.scope,
    hint: state.user.email,
    callback: (response) => {
      _notify('signin');
    }
  });
  state.tok_client.requestAccessToken({prompt: ''});
  return await _api_init();
}

function _load_libaries() {
  
  let goog_ready = false;
  let gapi_ready = false;

  let pass;
  let fail;

  let ready = new Promise((res, rej) => {
    pass = res;
    fail = rej;
  });

  function _all_ready() {
    if (goog_ready && gapi_ready) {
      pass();
      _notify('loaded');
    }
  }

  function _gapi_setup() {
    gapi = window.gapi;
    gapi_ready = true;
    _all_ready();
  }

  function _goog_ready() {
    google = window.google;
    goog_ready = true;
    _all_ready();
  }

  // Identity Library
  const googscr = document.createElement('script');
  googscr.type = 'text/javascript';
  googscr.src = 'https://accounts.google.com/gsi/client';
  googscr.defer = true;
  googscr.onload = _goog_ready;
  googscr.onerror = fail;
  document.getElementsByTagName('head')[0].appendChild(googscr);
  
  const gapiscr = document.createElement('script');
  gapiscr.type = 'text/javascript';
  gapiscr.src = 'https://apis.google.com/js/api.js';
  gapiscr.defer = true;
  gapiscr.onload = _gapi_setup;
  gapiscr.onerror = fail;
  document.getElementsByTagName('head')[0].appendChild(gapiscr);

  return ready;
}

function _handle_prompt_events(event) {
  if (event.isNotDisplayed()) {
    if (event.getNotDisplayedReason() === 'suppressed_by_user') {
      _disable();
      window.localStorage.removeItem('gothic-id');
      _notify('onetap_suppressed');
    }
  }
  if (event.isSkippedMoment()) {
    _notify('onetap_suppressed');
  }
}

function _notify(type, user = null) {
  obs.forEach((fn) => { fn(type,user); });
} 

async function _on_response(r) {

  state.user = null;
  let event_type = 'unknown';
  if (r && r.credential) {
    try {
      let rawdata = jwt_decode(r.credential);
      state.user = (({ email, family_name, given_name, picture, name }) => ({ email, family_name, given_name, picture, name}))(rawdata);
      await _goog_setup();
      window.localStorage.setItem('gothic-id', 'loaded');
      event_type = 'auth';
    } catch (err) {
      event_type = 'error';
      console.log(err);
    }
  }
  
  if (event_type === 'signin') {
    _notify(event_type, state.user);
  }
}

