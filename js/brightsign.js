/* iHotel AV Scheduler — BrightSign export (.bpfx).
 *
 * A .bpfx is BrightAuthor:connected's project-file format: plain JSON describing the player's zones,
 * hardware settings, and one "media state" pointing at an image FILE ON DISK — it does not embed the
 * image's bytes. This module clones a real, working single-image presentation (exported from a live
 * XT1144 player, captured 2026-09-22) and swaps in the new sign's own name, size and file location,
 * so opening the result in BrightAuthor shows a normal one-image presentation ready to publish.
 * Because the image is only referenced, the PNG has to travel alongside the .bpfx — see BS.exportZip.
 */
(function (root) {
  const IH = root.IH, U = IH.U;
  const BS = (IH.BrightSign = {});

  const TEMPLATE_JSON = "{\"meta\":{\"brightAuthorVersion\":\"1.85.0\",\"buildType\":\"Standard\"},\"bsdm\":{\"sign\":{\"properties\":{\"id\":\"68f3e02a-9fd7-4000-a207-d8c80a993000\",\"version\":\"1.3.10\",\"name\":\"HH36_MMLIA\",\"videoMode\":\"1920x1080x60p\",\"model\":\"XT1144\",\"monitorOrientation\":\"Landscape\",\"monitorOverscan\":\"NoOverscan\",\"videoConnector\":\"HDMI\",\"deviceWebPageDisplay\":\"Standard\",\"backgroundScreenColor\":{\"a\":255,\"r\":0,\"g\":0,\"b\":0},\"forceResolution\":false,\"tenBitColorEnabled\":false,\"dolbyVisionEnabled\":false,\"fullResGraphicsEnabled\":false,\"audioConfiguration\":\"MixedAudioPCMOnly\",\"audioAutoLevel\":false,\"htmlEnableJavascriptConsole\":false,\"alphabetizeVariableNames\":false,\"autoCreateMediaCounterVariables\":false,\"resetVariablesOnPresentationStart\":false,\"networkedVariablesUpdateInterval\":300,\"delayScheduleChangeUntilMediaEndEvent\":false,\"language\":\"English\",\"languageKey\":\"eng\",\"flipCoordinates\":false,\"inactivityTimeout\":false,\"inactivityTime\":30,\"touchCursorDisplayMode\":\"Auto\",\"udpDestinationAddressType\":\"IPAddress\",\"udpDestinationAddress\":\"255.255.255.255\",\"udpDestinationPort\":5000,\"udpReceiverPort\":5000,\"enableEnhancedSynchronization\":null,\"isMosaic\":false,\"graphicsZOrder\":\"Back\",\"disableSettingsHandler\":false,\"gpsConfiguration\":\"None\",\"size\":{\"width\":1920,\"height\":1080},\"htmlEnableChromiumVideoPlayback\":false},\"serialPortConfigurations\":[{\"gps\":false,\"port\":\"0\",\"baudRate\":115200,\"dataBits\":8,\"stopBits\":1,\"parity\":\"N\",\"protocol\":\"ASCII\",\"sendEol\":\"CR\",\"receiveEol\":\"CR\",\"invertSignals\":false,\"connectedDevice\":\"None\"},{\"gps\":false,\"port\":\"1\",\"baudRate\":115200,\"dataBits\":8,\"stopBits\":1,\"parity\":\"N\",\"protocol\":\"ASCII\",\"sendEol\":\"CR\",\"receiveEol\":\"CR\",\"invertSignals\":false,\"connectedDevice\":\"None\"},{\"gps\":false,\"port\":\"2\",\"baudRate\":115200,\"dataBits\":8,\"stopBits\":1,\"parity\":\"N\",\"protocol\":\"ASCII\",\"sendEol\":\"CR\",\"receiveEol\":\"CR\",\"invertSignals\":false,\"connectedDevice\":\"None\"},{\"gps\":false,\"port\":\"3\",\"baudRate\":115200,\"dataBits\":8,\"stopBits\":1,\"parity\":\"N\",\"protocol\":\"ASCII\",\"sendEol\":\"CR\",\"receiveEol\":\"CR\",\"invertSignals\":false,\"connectedDevice\":\"None\"},{\"gps\":false,\"port\":\"4\",\"baudRate\":115200,\"dataBits\":8,\"stopBits\":1,\"parity\":\"N\",\"protocol\":\"ASCII\",\"sendEol\":\"CR\",\"receiveEol\":\"CR\",\"invertSignals\":false,\"connectedDevice\":\"None\"},{\"gps\":false,\"port\":\"5\",\"baudRate\":115200,\"dataBits\":8,\"stopBits\":1,\"parity\":\"N\",\"protocol\":\"ASCII\",\"sendEol\":\"CR\",\"receiveEol\":\"CR\",\"invertSignals\":false,\"connectedDevice\":\"None\"},{\"gps\":false,\"port\":\"6\",\"baudRate\":115200,\"dataBits\":8,\"stopBits\":1,\"parity\":\"N\",\"protocol\":\"ASCII\",\"sendEol\":\"CR\",\"receiveEol\":\"CR\",\"invertSignals\":false,\"connectedDevice\":\"None\"},{\"gps\":false,\"port\":\"7\",\"baudRate\":115200,\"dataBits\":8,\"stopBits\":1,\"parity\":\"N\",\"protocol\":\"ASCII\",\"sendEol\":\"CR\",\"receiveEol\":\"CR\",\"invertSignals\":false,\"connectedDevice\":\"None\"}],\"gpio\":[\"input\",\"input\",\"input\",\"input\",\"input\",\"input\",\"input\",\"input\"],\"buttonPanels\":{\"bp900a\":{\"configureAutomatically\":true,\"configuration\":0},\"bp900b\":{\"configureAutomatically\":true,\"configuration\":0},\"bp900c\":{\"configureAutomatically\":true,\"configuration\":0},\"bp900d\":{\"configureAutomatically\":true,\"configuration\":0},\"bp200a\":{\"configureAutomatically\":true,\"configuration\":0},\"bp200b\":{\"configureAutomatically\":true,\"configuration\":0},\"bp200c\":{\"configureAutomatically\":true,\"configuration\":0},\"bp200d\":{\"configureAutomatically\":true,\"configuration\":0}},\"irRemote\":{\"irInConfiguration\":{\"source\":\"Ir-in\"},\"irOutConfiguration\":{\"destination\":\"Iguana\"},\"irRemoteControl\":{\"id\":\"RC-1002\",\"encoding\":\"NEC\",\"manufacturerCode\":28560,\"buttons\":{\"0\":{\"buttonCode\":0,\"buttonDescription\":\"Option\"},\"1\":{\"buttonCode\":1,\"buttonDescription\":\"1\"},\"2\":{\"buttonCode\":2,\"buttonDescription\":\"2\"},\"3\":{\"buttonCode\":3,\"buttonDescription\":\"3\"},\"4\":{\"buttonCode\":4,\"buttonDescription\":\"4\"},\"5\":{\"buttonCode\":5,\"buttonDescription\":\"5\"},\"6\":{\"buttonCode\":6,\"buttonDescription\":\"6\"},\"7\":{\"buttonCode\":7,\"buttonDescription\":\"7\"},\"8\":{\"buttonCode\":8,\"buttonDescription\":\"8\"},\"9\":{\"buttonCode\":9,\"buttonDescription\":\"9\"},\"10\":{\"buttonCode\":10,\"buttonDescription\":\"Exit\"},\"11\":{\"buttonCode\":11,\"buttonDescription\":\"Channel Up\"},\"12\":{\"buttonCode\":12,\"buttonDescription\":\"Period \\\".\\\"\"},\"13\":{\"buttonCode\":13,\"buttonDescription\":\"Channel Down\"},\"14\":{\"buttonCode\":14,\"buttonDescription\":\"Source\"},\"15\":{\"buttonCode\":15,\"buttonDescription\":\"Mute\"},\"16\":{\"buttonCode\":16,\"buttonDescription\":\"Left\"},\"17\":{\"buttonCode\":17,\"buttonDescription\":\"Right\"},\"18\":{\"buttonCode\":18,\"buttonDescription\":\"Up\"},\"19\":{\"buttonCode\":19,\"buttonDescription\":\"Down\"},\"20\":{\"buttonCode\":20,\"buttonDescription\":\"Ok\"},\"21\":{\"buttonCode\":21,\"buttonDescription\":\"Back\"},\"22\":{\"buttonCode\":22,\"buttonDescription\":\"Power\"},\"23\":{\"buttonCode\":23,\"buttonDescription\":\"Home\"},\"24\":{\"buttonCode\":24,\"buttonDescription\":\"Search\"},\"25\":{\"buttonCode\":25,\"buttonDescription\":\"Play\"},\"26\":{\"buttonCode\":26,\"buttonDescription\":\"Fast Forward\"},\"27\":{\"buttonCode\":27,\"buttonDescription\":\"Rewind\"},\"28\":{\"buttonCode\":28,\"buttonDescription\":\"Pause\"},\"29\":{\"buttonCode\":29,\"buttonDescription\":\"Add\"},\"30\":{\"buttonCode\":30,\"buttonDescription\":\"Shuffle\"},\"31\":{\"buttonCode\":31,\"buttonDescription\":\"Repeat\"},\"64\":{\"buttonCode\":64,\"buttonDescription\":\"Volume Up\"},\"65\":{\"buttonCode\":65,\"buttonDescription\":\"Volume Down\"},\"66\":{\"buttonCode\":66,\"buttonDescription\":\"Brightness\"},\"67\":{\"buttonCode\":67,\"buttonDescription\":\"Info\"},\"68\":{\"buttonCode\":68,\"buttonDescription\":\"Green\"},\"69\":{\"buttonCode\":69,\"buttonDescription\":\"0\"},\"70\":{\"buttonCode\":70,\"buttonDescription\":\"Stop\"},\"71\":{\"buttonCode\":71,\"buttonDescription\":\"Last\"},\"83\":{\"buttonCode\":83,\"buttonDescription\":\"Red\"},\"84\":{\"buttonCode\":84,\"buttonDescription\":\"Blue\"},\"87\":{\"buttonCode\":87,\"buttonDescription\":\"Yellow\"}}}},\"audioSignPropertyMap\":{\"analog1\":{\"min\":0,\"max\":100},\"analog2\":{\"min\":0,\"max\":100},\"analog3\":{\"min\":0,\"max\":100},\"hdmi\":{\"min\":0,\"max\":100},\"hdmi1\":{\"min\":0,\"max\":100},\"hdmi2\":{\"min\":0,\"max\":100},\"hdmi3\":{\"min\":0,\"max\":100},\"hdmi4\":{\"min\":0,\"max\":100},\"spdif\":{\"min\":0,\"max\":100},\"usbA\":{\"min\":0,\"max\":100},\"usbB\":{\"min\":0,\"max\":100},\"usbC\":{\"min\":0,\"max\":100},\"usbD\":{\"min\":0,\"max\":100},\"usbTypeA\":{\"min\":0,\"max\":100},\"usbTypeC\":{\"min\":0,\"max\":100},\"usb700_1\":{\"min\":0,\"max\":100},\"usb700_2\":{\"min\":0,\"max\":100},\"usb700_3\":{\"min\":0,\"max\":100},\"usb700_4\":{\"min\":0,\"max\":100},\"usb700_5\":{\"min\":0,\"max\":100},\"usb700_6\":{\"min\":0,\"max\":100},\"usb700_7\":{\"min\":0,\"max\":100},\"usb_1\":{\"min\":0,\"max\":100},\"usb_2\":{\"min\":0,\"max\":100},\"usb_3\":{\"min\":0,\"max\":100},\"usb_4\":{\"min\":0,\"max\":100},\"usb_5\":{\"min\":0,\"max\":100},\"usb_6\":{\"min\":0,\"max\":100}},\"wssDeviceSpec\":{},\"lastModifiedTime\":\"2026-09-21T20:08:36.719Z\"},\"zones\":{\"zonesById\":{\"a8260d71-9bda-4000-afd0-f95292fcd000\":{\"id\":\"a8260d71-9bda-4000-afd0-f95292fcd000\",\"name\":\"Zone 1\",\"type\":\"VideoOrImages\",\"tag\":\"VI1\",\"nonInteractive\":true,\"initialMediaStateId\":\"9c4fa5ad-22b0-4000-a0f0-d21154632000\",\"position\":{\"x\":0,\"y\":0,\"width\":1920,\"height\":1080,\"pct\":false},\"properties\":{\"viewMode\":\"Letterboxed and Centered\",\"videoVolume\":100,\"maxContentResolution\":\"HD\",\"brightness\":128,\"contrast\":64,\"saturation\":64,\"hue\":0,\"zOrderFront\":true,\"mosaic\":false,\"audioOutput\":\"Analog\",\"audioMode\":\"Stereo\",\"audioMapping\":\"Audio1\",\"audioOutputAssignments\":{\"analog1\":\"Pcm\",\"analog2\":\"None\",\"analog3\":\"None\",\"usbA\":\"None\",\"usbB\":\"None\",\"usbC\":\"None\",\"usbD\":\"None\",\"usbTypeA\":\"None\",\"usbTypeC\":\"None\",\"usb700_1\":\"None\",\"usb700_2\":\"None\",\"usb700_3\":\"None\",\"usb700_4\":\"None\",\"usb700_5\":\"None\",\"usb700_6\":\"None\",\"usb700_7\":\"None\",\"usb_1\":\"None\",\"usb_2\":\"None\",\"usb_3\":\"None\",\"usb_4\":\"None\",\"usb_5\":\"None\",\"usb_6\":\"None\",\"spdif\":\"Pcm\",\"hdmi\":\"Pcm\",\"hdmi1\":\"Pcm\",\"hdmi2\":\"None\",\"hdmi3\":\"None\",\"hdmi4\":\"None\"},\"audioMixMode\":\"Stereo\",\"audioVolume\":100,\"minimumVolume\":0,\"maximumVolume\":100,\"imageMode\":\"Scale to Fit\"}}},\"allZones\":[\"a8260d71-9bda-4000-afd0-f95292fcd000\"],\"zoneLayersById\":{\"b8202b2f-aa47-4000-acc2-1984390c9000\":{\"id\":\"b8202b2f-aa47-4000-acc2-1984390c9000\",\"type\":\"Graphics\",\"zoneSequence\":[\"a8260d71-9bda-4000-afd0-f95292fcd000\"]},\"8fb76b16-aab7-4000-aabc-593392647000\":{\"id\":\"8fb76b16-aab7-4000-aabc-593392647000\",\"type\":\"Audio\",\"zoneSequence\":[]},\"5e65a0f6-dd00-4000-a404-6a61bbd3b000\":{\"id\":\"5e65a0f6-dd00-4000-a404-6a61bbd3b000\",\"type\":\"Invisible\",\"zoneSequence\":[]},\"f21306d0-e502-4000-a8e5-1e5de4d3b000\":{\"id\":\"f21306d0-e502-4000-a8e5-1e5de4d3b000\",\"type\":\"Video\",\"zoneSequence\":[\"a8260d71-9bda-4000-afd0-f95292fcd000\"],\"zoneLayerSpecificProperties\":{\"type\":\"FourK\",\"index\":0,\"sharedDecoder\":false,\"enableMosaicDeinterlacer\":false}},\"b800daa5-ed6e-4000-a792-b84eee59d000\":{\"id\":\"b800daa5-ed6e-4000-a792-b84eee59d000\",\"type\":\"Video\",\"zoneSequence\":[],\"zoneLayerSpecificProperties\":{\"type\":\"FourK\",\"index\":1,\"sharedDecoder\":false,\"enableMosaicDeinterlacer\":false}}},\"zoneLayerSequence\":[\"b8202b2f-aa47-4000-acc2-1984390c9000\",\"f21306d0-e502-4000-a8e5-1e5de4d3b000\",\"b800daa5-ed6e-4000-a792-b84eee59d000\"],\"zoneTagIndices\":{\"a8260d71-9bda-4000-afd0-f95292fcd000\":6}},\"screens\":{\"screensById\":{},\"allScreens\":[]},\"mediaStates\":{\"mediaStatesById\":{\"9c4fa5ad-22b0-4000-a0f0-d21154632000\":{\"id\":\"9c4fa5ad-22b0-4000-a0f0-d21154632000\",\"name\":\"HH36_MMLIAnnualRetreat.PNG\",\"tag\":\"5\",\"container\":{\"id\":\"a8260d71-9bda-4000-afd0-f95292fcd000\",\"type\":0},\"contentItem\":{\"name\":\"HH36_MMLIAnnualRetreat.PNG\",\"type\":\"Image\",\"assetId\":\"2ecbe2dc-4bc2-4000-a415-3a20c579c000\",\"useImageBuffer\":false,\"videoPlayerRequired\":false,\"defaultTransition\":\"No effect\",\"transitionDuration\":1}}},\"sequencesByParentId\":{}},\"events\":{\"879d05d6-4488-4000-ad86-ad75d6824000\":{\"id\":\"879d05d6-4488-4000-ad86-ad75d6824000\",\"name\":\"HH36_MMLIAnnualRetreat.PNG_ev\",\"type\":\"Timer\",\"mediaStateId\":\"9c4fa5ad-22b0-4000-a0f0-d21154632000\",\"disabled\":true,\"data\":{\"interval\":6}}},\"transitions\":{\"transitionsById\":{\"634d7a52-adef-4000-aef1-4f60759e7000\":{\"id\":\"634d7a52-adef-4000-aef1-4f60759e7000\",\"name\":\"HH36_MMLIAnnualRetreat.PNG_tr\",\"eventId\":\"879d05d6-4488-4000-ad86-ad75d6824000\",\"targetMediaStateId\":\"9c4fa5ad-22b0-4000-a0f0-d21154632000\",\"type\":\"No effect\",\"duration\":0}},\"sequencesByEventId\":{}},\"commands\":{\"commandsById\":{},\"sequencesById\":{}},\"userDefinedEvents\":{\"userDefinedEventsById\":{},\"sequence\":[]},\"htmlSites\":{},\"nodeApps\":{},\"dataFeeds\":{\"feedsById\":{},\"sourcesById\":{}},\"userVariables\":{\"variablesById\":{},\"sequence\":[]},\"liveText\":{\"itemsById\":{},\"layersByCanvasId\":{},\"dataFeedsByGroupId\":{},\"canvasesById\":{}},\"deviceWebPages\":{},\"scriptPlugins\":{},\"parserPlugins\":{},\"videoModePlugins\":{},\"auxiliaryFiles\":{},\"linkedPresentations\":{},\"partnerProducts\":{},\"customAutorun\":\"0\",\"bmapSpec\":\"0\",\"assetMap\":{\"2ecbe2dc-4bc2-4000-a415-3a20c579c000\":{\"id\":\"2ecbe2dc-4bc2-4000-a415-3a20c579c000\",\"name\":\"HH36_MMLIAnnualRetreat.PNG\",\"path\":\"\\\\\\\\172.16.10.153\\\\AV_Techs\\\\Digital Signage Materials\\\\2026\\\\09 September\\\\22\\\\9.22\\\\\",\"networkId\":0,\"location\":\"Local\",\"assetType\":\"Content\",\"scope\":\"45a04354e5150ede\",\"locator\":\"file://\\\\\\\\172.16.10.153\\\\AV_Techs\\\\Digital Signage Materials\\\\2026\\\\09 September\\\\22\\\\9.22\\\\HH36_MMLIAnnualRetreat.PNG\",\"mediaType\":\"Image\",\"fileSize\":39484,\"lastModifiedDate\":\"2026-09-21T19:56:55.225Z\",\"refCount\":1}},\"thumbnail\":{\"type\":\"image/jpeg\",\"data\":\"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\",\"size\":{\"width\":200,\"height\":112},\"hash\":\"6a857ee29564654bb88235aaff1272ad4149d0a2\"}},\"selection\":{\"hovered\":null,\"selectionContainer\":{\"id\":\"a8260d71-9bda-4000-afd0-f95292fcd000\",\"type\":\"ZONE\",\"selectableType\":\"ZONE\"},\"selectionEntities\":{},\"prevSelectionEntities\":{\"dc1e76fc-7525-4000-a3be-f7d4c7eb4000\":{\"id\":\"dc1e76fc-7525-4000-a3be-f7d4c7eb4000\",\"type\":\"Image\",\"selectableType\":\"STATE\",\"selectableData\":null}},\"isEventAdvancedEnabled\":false,\"activeAssetMenuTab\":\"ASSETS\"},\"interactiveCanvas\":{\"statePositionById\":{},\"eventDataById\":{},\"viewTransformByZoneId\":{},\"isLoaderEnabled\":false},\"eventMenu\":{\"isOpen\":true,\"showTitles\":true},\"liveText\":{},\"screenLayoutSettings\":{\"selectedLayoutId\":null,\"screenCount\":null,\"isLayoutBoundaryToggled\":false,\"selectedBezel\":null,\"isSnapToCanvasToggled\":false}}";
  const TEMPLATE = JSON.parse(TEMPLATE_JSON);

  BS.DEFAULT_FOLDER = '\\\\172.16.10.153\\AV_Techs\\Digital Signage Materials\\';
  // Matches the dated subfolder pattern your own reference file was saved under: 2026\09 September\22\9.22\
  BS.DEFAULT_DATE_FOLDER = '{YYYY}\\{MM} {Month}\\{DD}\\{M}.{DD}';

  // Fills {YYYY} {MM} {M} {DD} {D} {Month} from a date (an event's date if you have one, else today) so
  // each export can drop into a dated folder the way BrightAuthor found it in your working setup —
  // this is very likely why a plain export "loses" the file: it wasn't saved in a dated subfolder at all.
  BS.expandDateFolder = (template, dateISO) => {
    template = String(template || '').trim();
    if (!template) return '';
    const d = dateISO ? U.parseDate(dateISO) : new Date();
    const vals = { YYYY: d.getFullYear(), MM: String(d.getMonth() + 1).padStart(2, '0'), M: String(d.getMonth() + 1), DD: String(d.getDate()).padStart(2, '0'), D: String(d.getDate()), Month: U.MONL[d.getMonth()] };
    return template.replace(/\{(YYYY|MM|M|DD|D|Month)\}/g, (_, k) => vals[k]);
  };
  // The full folder an export will use: the base folder from Settings, plus the expanded dated
  // subfolder (if a template is set), always ending in exactly one backslash.
  BS.resolveFolder = (baseFolder, dateFolderTemplate, dateISO) => {
    const dated = BS.expandDateFolder(dateFolderTemplate, dateISO);
    return BS.normFolder(BS.normFolder(baseFolder) + dated);
  };

  // Match the ID shape BrightAuthor itself generates (8-4-4-4-12, a fixed "4000" group, "a" + 3 hex,
  // and a "000"-padded tail) so a generated file looks exactly like one it made itself.
  const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('');
  const bsId = () => `${hex(8)}-${hex(4)}-4000-a${hex(3)}-${hex(9)}000`;

  // A trailing single backslash, Windows-style, no matter what was typed in Settings.
  BS.normFolder = (p) => {
    p = String(p || BS.DEFAULT_FOLDER).trim().replace(/[\\/]+$/, '');
    return p + '\\';
  };

  async function sha1Hex(bytes) {
    const buf = await crypto.subtle.digest('SHA-1', bytes);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  function b64FromDataURL(durl) {
    return durl.slice(durl.indexOf(',') + 1);
  }

  // canvas: the rendered 1920x1080 sign. name: base file name WITHOUT extension (BrightSign convention
  // in the reference file is an uppercase .PNG). folder: where the PNG will live, e.g. from Settings.
  BS.build = async (canvas, name, folder, opts) => {
    opts = opts || {};
    const pngBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const filename = `${name}.PNG`;
    folder = BS.normFolder(folder);

    const doc = JSON.parse(JSON.stringify(TEMPLATE)); // deep clone; only touch content-specific fields below
    const zoneId = Object.keys(doc.bsdm.zones.zonesById)[0];
    const mediaStateId = bsId(), eventId = bsId(), transitionId = bsId(), assetId = bsId();
    const oldMsId = doc.bsdm.zones.zonesById[zoneId].initialMediaStateId;
    const oldMediaState = doc.bsdm.mediaStates.mediaStatesById[oldMsId];

    doc.bsdm.sign.properties.id = bsId();
    doc.bsdm.sign.properties.name = name.slice(0, 32);
    doc.bsdm.sign.lastModifiedTime = new Date().toISOString();

    doc.bsdm.zones.zonesById[zoneId].initialMediaStateId = mediaStateId;

    delete doc.bsdm.mediaStates.mediaStatesById[oldMsId];
    doc.bsdm.mediaStates.mediaStatesById[mediaStateId] = Object.assign({}, oldMediaState, {
      id: mediaStateId, name: filename, container: { id: zoneId, type: 0 },
      contentItem: Object.assign({}, oldMediaState.contentItem, { name: filename, assetId }),
    });

    const oldEvId = Object.keys(doc.bsdm.events)[0];
    const oldEvent = doc.bsdm.events[oldEvId];
    delete doc.bsdm.events[oldEvId];
    doc.bsdm.events[eventId] = Object.assign({}, oldEvent, { id: eventId, name: `${filename}_ev`, mediaStateId });

    const oldTrId = Object.keys(doc.bsdm.transitions.transitionsById)[0];
    const oldTr = doc.bsdm.transitions.transitionsById[oldTrId];
    delete doc.bsdm.transitions.transitionsById[oldTrId];
    doc.bsdm.transitions.transitionsById[transitionId] = Object.assign({}, oldTr, { id: transitionId, name: `${filename}_tr`, eventId, targetMediaStateId: mediaStateId });

    const oldAssetId = Object.keys(doc.bsdm.assetMap)[0];
    const oldAsset = doc.bsdm.assetMap[oldAssetId];
    delete doc.bsdm.assetMap[oldAssetId];
    doc.bsdm.assetMap[assetId] = Object.assign({}, oldAsset, {
      id: assetId, name: filename, path: folder, locator: `file://${folder}${filename}`,
      fileSize: pngBytes.length, lastModifiedDate: new Date().toISOString(), refCount: 1,
    });

    // Thumbnail: a real small JPEG of this sign (the template's was a generic offline-asset icon).
    const tw = 200, th = 112;
    const tcanvas = opts.createCanvas ? opts.createCanvas(tw, th) : Object.assign(document.createElement('canvas'), { width: tw, height: th });
    tcanvas.getContext('2d').drawImage(canvas, 0, 0, tw, th);
    const jpegURL = tcanvas.toDataURL('image/jpeg', 0.85);
    const jpegB64 = b64FromDataURL(jpegURL);
    const jpegBytes = Uint8Array.from(atob(jpegB64), (c) => c.charCodeAt(0));
    doc.bsdm.thumbnail = { type: 'image/jpeg', data: jpegB64, size: { width: tw, height: th }, hash: await sha1Hex(jpegBytes) };
    doc.selection.prevSelectionEntities = {};

    return { json: JSON.stringify(doc), filename: `${name}.bpfx`, pngFilename: filename, pngBlob };
  };

  // Bundles the .bpfx and its .PNG together, since BrightAuthor needs both. Requires JSZip to already
  // be loaded (IH.Imp.loadScript(...jszip...)) — callers already do this for the signs ZIP feature.
  BS.exportZip = async (built) => {
    const zip = new root.JSZip();
    zip.file(built.filename, built.json);
    zip.file(built.pngFilename, built.pngBlob);
    return zip.generateAsync({ type: 'blob' });
  };
})(typeof window !== 'undefined' ? window : globalThis);
