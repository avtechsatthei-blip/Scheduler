/* Cloud sync settings — points at the scheduler's own dedicated Firebase project (ihotelscheduler),
 * separate from the iHotel messaging app. These are public web keys, not secrets: they identify the
 * project; real access is controlled by sign-in plus the database rules in firebase-rules.json.
 *
 * To point this at a different Firebase project, replace the values below with the ones from
 * Firebase console > Project settings > Your apps > Web app. Leave `root` alone unless you know why. */
(function (root) {
  root.IH = root.IH || {};
  root.IH.CLOUD_CONFIG = {
    firebase: {
      apiKey: 'AIzaSyDgAwh7j4_cmrze-5n6ubosGaICw2d_mJ4',
      authDomain: 'ihotelscheduler.firebaseapp.com',
      databaseURL: 'https://ihotelscheduler-default-rtdb.firebaseio.com',
      projectId: 'ihotelscheduler',
      storageBucket: 'ihotelscheduler.firebasestorage.app',
      messagingSenderId: '806109978959',
      appId: '1:806109978959:web:36d8ef11e0280bfe87653a',
    },
    root: 'avScheduler', // where in the database this app keeps its data
    sdkVersion: '10.12.2',
  };
})(typeof window !== 'undefined' ? window : globalThis);
