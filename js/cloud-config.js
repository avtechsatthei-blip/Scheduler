/* Cloud sync settings. These are the same kind of public web keys your iHotel messaging app already uses:
 * they identify the Firebase project, they are not passwords. Access is controlled by sign-in plus the
 * database rules in firebase-rules.json.
 *
 * To use a different Firebase project, replace the values below with the ones from
 * Firebase console > Project settings > Your apps > Web app. Leave `root` alone unless you know why. */
(function (root) {
  root.IH = root.IH || {};
  root.IH.CLOUD_CONFIG = {
    firebase: {
      apiKey: 'AIzaSyDbI9Df4w5j9ty_csir3uYSEonfuw6RzME',
      authDomain: 'ihotel-messaging.firebaseapp.com',
      databaseURL: 'https://ihotel-messaging-default-rtdb.firebaseio.com',
      projectId: 'ihotel-messaging',
      messagingSenderId: '1059243069823',
      appId: '1:1059243069823:web:54167267cd515c8a7a8a4a',
    },
    root: 'avScheduler', // where in the database this app keeps its data
    sdkVersion: '10.12.2',
  };
})(typeof window !== 'undefined' ? window : globalThis);
