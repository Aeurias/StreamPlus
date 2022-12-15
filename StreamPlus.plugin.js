/**
 * @name StreamPlus
 * @author Aeurias
 * @version 1.1.0
 * @source https://github.com/Aeurias/StreamPlus
 * @updateUrl https://raw.githubusercontent.com/Aeurias/StreamPlus/main/StreamPlus.plugin.js
 */
/*@cc_on
@if(@_jscript)

	// Offer to self-install for clueless users that try to run this directly.
	var shell = WScript.CreateObject("WScript.Shell");
	var fs = new ActiveXObject("Scripting.FileSystemObject");
	var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
	var pathSelf = WScript.ScriptFullName;
	// Put the user at ease by addressing them in the first person
	shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
	if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
		shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
	} else if(!fs.FolderExists(pathPlugins)) {
		shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
	} else if(shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
		fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
		// Show the user where to put plugins in the future
		shell.Exec("explorer " + pathPlugins);
		shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
	}
	WScript.Quit();

@else@*/

module.exports = (() => {
	const config = {
		"info": {
			"name": "StreamPlus",
			"authors": [{
				"name": "Aeurias"
			}],
			"version": "1.1.0",
			"description": "Custom bitrate, FPS and resolution!",
			"github": "https://github.com/Aeurias/StreamPlus",
			"github_raw": "https://raw.githubusercontent.com/Aeurias/StreamPlus/main/StreamPlus.plugin.js"
		},
		"main": "StreamPlus.plugin.js"
	};

	return !global.ZeresPluginLibrary ? class {
		constructor() {
			this._config = config;
		}
		getName() {
			return config.info.name;
		}
		getAuthor() {
			return config.info.authors.map(a => a.name).join(", ");
		}
		getDescription() {
			return config.info.description;
		}
		getVersion() {
			return config.info.version;
		}
		load() {
			BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
				confirmText: "Download Now",
				cancelText: "Cancel",
				onConfirm: () => {
					require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
						if(error) return require("electron").shell.openExternal("https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js");
						await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
					});
				}
			});
		}
		start() { }
		stop() { }
	} : (([Plugin, Api]) => {
		const plugin = (Plugin, Api) => {
			const {
				Patcher,
				DiscordModules,
				Settings,
				Toasts,
				Utilities
			} = Api;
			return class StreamPlus extends Plugin {
				defaultSettings = {
					"CustomSS": true,
					"CustomSSFPSEnabled": true,
					"CustomSSFPS": 90,
					"CustomSSCustomSSResolutionEnabled": false,
					"CustomSSResolution": 1080,
					"CustomSSBitrateEnabled": true,
					"SSminBitrate": 12000,
					"SSmaxBitrate": 24000,
					"SStargetBitrate": 15000,
					"voiceBitrate": 384,
					"audioSourcePID": 0,
					"CameraSettingsEnabled": false,
					"CameraWidth": 1920,
					"CameraHeight": 1080,
					"SettingDebugButton": false
				};
				settings = Utilities.loadSettings(this.getName(), this.defaultSettings);
				getSettingsPanel() {
					return Settings.SettingPanel.build(_ => this.saveAndUpdate(), ...[
						new Settings.SettingGroup("Custom Screen Share Settings").append(...[
							new Settings.Switch("High Quality Screensharing", "Nitro Source screensharing. No reason to disable this setting. 'H264 Hardware Acceleration' Recommended in Discord's Voice & Video setting panel.", this.settings.CustomSS, value => this.settings.CustomSS = value),
							new Settings.Switch("Custom Screen Share - Bitrate", "Enables custom bitrate for your streams for better banding, grain and texture details and remove horrible blockiness of Discord streams.", this.settings.CustomSSBitrateEnabled, value => this.settings.CustomSSBitrateEnabled = value),
							new Settings.Switch("Custom Screen Share - FPS", "Enables beyond 60FPS custom framerates, upto 360FPS or limits of encoder/PC.", this.settings.CustomSSFPSEnabled, value => this.settings.CustomSSFPSEnabled = value),
							new Settings.Textbox("FPS", "Values between 24-120 Recommended. 24 for anime/film, 72-90 for VR content to reduce encoder usage, 75-120 for everything else or sync with ingame FPS limit for fluidity.", this.settings.CustomSSFPS,
								value => {
									value = parseInt(value);
									this.settings.CustomSSFPS = value;
								}),
								new Settings.Textbox("Minimum Bitrate", "The minimum constant bitrate (in kbps). 10-15,000 is recommended, lower for viewers with bad network.", this.settings.SSminBitrate,
								value => {
									value = parseFloat(value);
									this.settings.SSminBitrate = value;
								}),
								new Settings.Textbox("Maximum Bitrate", "The maximum peak bitrate (in kbps). 24,000 Recommended or set to 0.75x of your network upload speed or encoder capability", this.settings.SSmaxBitrate,
								value => {
									value = parseFloat(value);
									this.settings.SSmaxBitrate = value;
								}),
								new Settings.Textbox("Target Bitrate", "The target constant/average bitrate (in kbps). Recommended to set 0.75x of Maximum Bitrate value", this.settings.SStargetBitrate,
								value => {
									value = parseFloat(value);
									this.settings.SStargetBitrate = value;
								})
						]),
						new Settings.SettingGroup("Custom Camera Share Settings").append(
						new Settings.Switch("Custom Camera Share", this.settings.CameraSettingsEnabled, value => this.settings.CameraSettingsEnabled = value),
						new Settings.Textbox("Camera Resolution Width", "Camera Resolution Width in pixels. (Set to -1 to disable)", this.settings.CameraWidth,
								value => {
									value = parseInt(value);
									this.settings.CameraWidth = value;
								}),
						new Settings.Textbox("Camera Resolution Height", "Camera Resolution Height in pixels. (Set to -1 to disable)", this.settings.CameraHeight,
							value => {
								value = parseInt(value);
								this.settings.CameraHeight = value;
							})
						),
						new Settings.SettingGroup("Extra Settings").append(
							new Settings.Switch("Stream Settings Debug Button", "Adds a button to switch your resolution/fps quickly for testing", this.settings.SettingDebugButton, value => this.settings.SettingDebugButton = value),
							new Settings.Switch("Custom Camera Share - Resolution",  "Enables custom resolution for screensharing - Recommended OFF, Use Source instead!", this.settings.CustomSSResolutionEnabled, value => this.settings.CustomSSResolutionEnabled = value),
							new Settings.Textbox("Resolution", "The custom resolution in pixels height. 16:9 scales recommended: 720, 1080, 1440, 2160 etc.", this.settings.CustomSSResolution,
							value => {
								value = parseInt(value, 10);
								this.settings.CustomSSResolution = value;
							}),
							new Settings.Textbox("Screen Share Audio Source", "Set this number to the PID of an application to stream that application's audio! Applies upon updating the screen share quality/window. (Set to 0 to disable)", this.settings.audioSourcePID,
							value => {
								value = parseInt(value);
								this.settings.audioSourcePID = value;
							}),
								new Settings.Textbox("Voice Audio Bitrate", "Allows you to change the bitrate to whatever you want. Does not allow you to go over the voice channel's set bitrate, but it does allow you to go much lower if on bad network or data saving.", this.settings.voiceBitrate,
								value => {
									value = parseFloat(value);
									this.settings.voiceBitrate = value;
							})
						)
					])
				}

				saveAndUpdate(){
					Utilities.saveSettings(this.getName(), this.settings);
					BdApi.Patcher.unpatchAll("StreamPlus");
					Patcher.unpatchAll();
					if(this.settings.CustomSSFPS == 15) this.settings.CustomSSFPS = 16;
					if(this.settings.CustomSSFPS == 30) this.settings.CustomSSFPS = 31;
					if(this.settings.CustomSSFPS == 5) this.settings.CustomSSFPS = 6;
					this.videoQualityModule();
					this.audioShare();
					if(document.getElementById("qualityButton")) document.getElementById("qualityButton").remove();
					if(document.getElementById("qualityMenu")) document.getElementById("qualityMenu").remove();
					if(document.getElementById("qualityInput")) document.getElementById("qualityInput").remove();
					this.buttonCreate();
					document.getElementById("qualityInput").addEventListener("input", this.updateQuick);
					document.getElementById("qualityInputFPS").addEventListener("input", this.updateQuick);
					if(!this.settings.SettingDebugButton){
						if(document.getElementById("qualityButton") != undefined) document.getElementById("qualityButton").style.display = 'none'
						if(document.getElementById("qualityMenu") != undefined) document.getElementById("qualityMenu").style.display = 'none'
					}
					if(this.settings.CustomSS){
						if(this.settings.CustomSSResolutionEnabled || this.settings.CustomSSFPSEnabled){
							this.customVideoSettings();
						}
						BdApi.Patcher.instead("StreamPlus", permissions, "canStreamMidQuality", () => {
							return true;
						});
						BdApi.Patcher.instead("StreamPlus", permissions, "canStreamMedQuality", () => {
							return true;
						});
						BdApi.Patcher.instead("StreamPlus", permissions, "canStreamHighQuality", () => {
							return true;
						});
					}

				} //End of saveAndUpdate

				async customVideoSettings() {
					const StreamButtons = ZLibrary.WebpackModules.getByIndex(664637);
					if(this.settings.CustomSSResolutionEnabled){
						if(this.settings.CustomSSResolution != 0){
							StreamButtons.LY.RESOLUTION_SOURCE = this.settings.CustomSSResolution;
							StreamButtons.ND[0].resolution = this.settings.CustomSSResolution;
							StreamButtons.ND[1].resolution = this.settings.CustomSSResolution;
							StreamButtons.ND[2].resolution = this.settings.CustomSSResolution;
							StreamButtons.ND[3].resolution = this.settings.CustomSSResolution;
							StreamButtons.WC[2].value = this.settings.CustomSSResolution;
							delete StreamButtons.WC[2].label;
							StreamButtons.WC[2].label = this.settings.CustomSSResolution.toString();
							StreamButtons.km[3].value = this.settings.CustomSSResolution;
							delete StreamButtons.km[3].label;
							StreamButtons.km[3].label = this.settings.CustomSSResolution + "p";
						}
					}
					if(!this.settings.CustomSSResolutionEnabled || (this.settings.CustomSSResolution == 0)){
						StreamButtons.LY.RESOLUTION_SOURCE = 0;
						StreamButtons.ND[0].resolution = 0;
						StreamButtons.ND[1].resolution = 0;
						StreamButtons.ND[2].resolution = 0;
						StreamButtons.ND[3].resolution = 0;
						StreamButtons.WC[2].value = 0;
						delete StreamButtons.WC[2].label;
						StreamButtons.WC[2].label = "Source";
						StreamButtons.km[3].value = 0;
						delete StreamButtons.km[3].label;
						StreamButtons.km[3].label = "Source";
					}
					function replace60FPSRequirements(x) {
						if(x.fps != 30 && x.fps != 15 && x.fps != 5) x.fps = BdApi.getData("StreamPlus","settings").CustomSSFPS;
					}
					function restore60FPSRequirements(x) {
						if(x.fps != 30 && x.fps != 15 && x.fps != 5) x.fps = 60;
					}
					if(this.settings.CustomSSFPSEnabled){
						if(this.CustomSSFPS != 60){
							StreamButtons.ND.forEach(replace60FPSRequirements);
							StreamButtons.af[2].value = this.settings.CustomSSFPS;
							delete StreamButtons.af[2].label;
							StreamButtons.af[2].label = this.settings.CustomSSFPS + " FPS";
							StreamButtons.k0[2].value = this.settings.CustomSSFPS;
							delete StreamButtons.k0[2].label;
							StreamButtons.k0[2].label = this.settings.CustomSSFPS;
							StreamButtons.ws.FPS_60 = this.settings.CustomSSFPS;
						}
					}
					if(!this.settings.CustomSSFPSEnabled || this.CustomSSFPS == 60){
						StreamButtons.ND.forEach(restore60FPSRequirements);
						StreamButtons.af[2].value = 60;
						delete StreamButtons.af[2].label;
						StreamButtons.af[2].label = 60 + " FPS";
						StreamButtons.k0[2].value = 60;
						delete StreamButtons.k0[2].label;
						StreamButtons.k0[2].label = 60;
						StreamButtons.ws.FPS_60 = 60;
					}
					if(BdApi.Webpack.getModule(BdApi.Webpack.Filters.byStrings("updateRemoteWantsFramerate"))){
						let L = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byStrings("updateRemoteWantsFramerate")).prototype;
						if(L){
							BdApi.Patcher.instead("StreamPlus", L, "updateRemoteWantsFramerate", () => {
							return
						});
						}
						return
					}else{
						let R = await BdApi.Webpack.waitForModule(BdApi.Webpack.Filters.byStrings("updateRemoteWantsFramerate"));
						if(R){
							BdApi.Patcher.instead("StreamPlus", R, "updateRemoteWantsFramerate", () => {
							return
						});
						}
					}
				}

				updateQuick(){
					parseInt(document.getElementById("qualityInput").value);
					BdApi.getData("StreamPlus", "settings").CustomSSResolution = parseInt(document.getElementById("qualityInput").value);
					parseInt(document.getElementById("qualityInputFPS").value);
					BdApi.getData("StreamPlus", "settings").CustomSSFPS = parseInt(document.getElementById("qualityInputFPS").value);
					if(parseInt(document.getElementById("qualityInputFPS").value) == 15) BdApi.getData("StreamPlus", "settings").CustomSSFPS = 16;
					if(parseInt(document.getElementById("qualityInputFPS").value) == 30) BdApi.getData("StreamPlus", "settings").CustomSSFPS = 31;
					if(parseInt(document.getElementById("qualityInputFPS").value) == 5) BdApi.getData("StreamPlus", "settings").CustomSSFPS = 6;
					const StreamButtons = ZLibrary.WebpackModules.getByIndex(664637);
					if(BdApi.getData("StreamPlus", "settings").CustomSSResolutionEnabled){
						if(BdApi.getData("StreamPlus", "settings").CustomSSResolution != 0){
							StreamButtons.LY.RESOLUTION_SOURCE = BdApi.getData("StreamPlus", "settings").CustomSSResolution;
							StreamButtons.ND[0].resolution = BdApi.getData("StreamPlus", "settings").CustomSSResolution;
							StreamButtons.ND[1].resolution = BdApi.getData("StreamPlus", "settings").CustomSSResolution;
							StreamButtons.ND[2].resolution = BdApi.getData("StreamPlus", "settings").CustomSSResolution;
							StreamButtons.ND[3].resolution = BdApi.getData("StreamPlus", "settings").CustomSSResolution;
							StreamButtons.WC[2].value = BdApi.getData("StreamPlus", "settings").CustomSSResolution;
							delete StreamButtons.WC[2].label;
							StreamButtons.WC[2].label = BdApi.getData("StreamPlus", "settings").CustomSSResolution.toString();
							StreamButtons.km[3].value = BdApi.getData("StreamPlus", "settings").CustomSSResolution;
							delete StreamButtons.km[3].label;
							StreamButtons.km[3].label = BdApi.getData("StreamPlus", "settings").CustomSSResolution + "p";
						}
					}
					if(!BdApi.getData("StreamPlus", "settings").CustomSSResolutionEnabled || (BdApi.getData("StreamPlus", "settings").CustomSSResolution == 0)){
						StreamButtons.LY.RESOLUTION_SOURCE = 0;
						StreamButtons.ND[0].resolution = 0;
						StreamButtons.ND[1].resolution = 0;
						StreamButtons.ND[2].resolution = 0;
						StreamButtons.ND[3].resolution = 0;
						StreamButtons.WC[2].value = 0;
						delete StreamButtons.WC[2].label;
						StreamButtons.WC[2].label = "Source";
						StreamButtons.km[3].value = 0;
						delete StreamButtons.km[3].label;
						StreamButtons.km[3].label = "Source";
					}
					function replace60FPSRequirements(x) {
						if(x.fps != 30 && x.fps != 15 && x.fps != 5) x.fps = BdApi.getData("StreamPlus", "settings").CustomSSFPS;
					}
					function restore60FPSRequirements(x) {
						if(x.fps != 30 && x.fps != 15 && x.fps != 5) x.fps = 60;
					}

					if(BdApi.getData("StreamPlus", "settings").CustomSSFPSEnabled){
						if(this.CustomSSFPS != 60){
							StreamButtons.ND.forEach(replace60FPSRequirements);
							StreamButtons.af[2].value = BdApi.getData("StreamPlus", "settings").CustomSSFPS;
							delete StreamButtons.af[2].label;
							StreamButtons.af[2].label = BdApi.getData("StreamPlus", "settings").CustomSSFPS + " FPS";
							StreamButtons.k0[2].value = BdApi.getData("StreamPlus", "settings").CustomSSFPS;
							delete StreamButtons.k0[2].label;
							StreamButtons.k0[2].label = BdApi.getData("StreamPlus", "settings").CustomSSFPS;
							StreamButtons.ws.FPS_60 = BdApi.getData("StreamPlus", "settings").CustomSSFPS;
						}
					}
					if(!(BdApi.getData("StreamPlus", "settings").CustomSSFPSEnabled)){
						StreamButtons.ND.forEach(restore60FPSRequirements);
						StreamButtons.af[2].value = 60;
						delete StreamButtons.af[2].label;
						StreamButtons.af[2].label = 60 + " FPS";
						StreamButtons.k0[2].value = 60;
						delete StreamButtons.k0[2].label;
						StreamButtons.k0[2].label = 60;
						StreamButtons.ws.FPS_60 = 60;
					}
				}

				audioShare(){
					let shareModule = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byPrototypeFields("setSoundshareSource")).prototype;
					if(this.settings.audioSourcePID != 0){
					BdApi.Patcher.before("StreamPlus", shareModule, "setSoundshareSource", (a,b) => {
						if(this.settings.audioSourcePID == 0){
							return
						}
						b[0] = this.settings.audioSourcePID;
					});
					}
				}

				videoQualityModule(){
					let b = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byStrings("audioSSRC"));
					let videoOptionFunctions = b.prototype;
					if(this.settings.CustomSSBitrateEnabled){
						BdApi.Patcher.before("StreamPlus", videoOptionFunctions, "updateVideoQuality", (e) => {
							e.framerateReducer.sinkWants.qualityOverwrite.bitrateMin = (this.settings.SSminBitrate * 1000);
							e.videoQualityManager.qualityOverwrite.bitrateMin = (this.settings.SSminBitrate * 1000);
							e.framerateReducer.sinkWants.qualityOverwrite.bitrateMax = (this.settings.SSmaxBitrate * 1000);
							e.videoQualityManager.qualityOverwrite.bitrateMax = (this.settings.SSmaxBitrate * 1000);
							e.framerateReducer.sinkWants.qualityOverwrite.bitrateTarget = (this.settings.SStargetBitrate * 1000);
							e.videoQualityManager.qualityOverwrite.bitrateTarget = (this.settings.SStargetBitrate * 1000);
							e.voiceBitrate = (this.settings.voiceBitrate * 1000);
						});
					}
					if(this.settings.CustomSSFPSEnabled){
						BdApi.Patcher.before("StreamPlus", videoOptionFunctions, "updateVideoQuality", (e) => {
							e.videoQualityManager.options.videoBudget.framerate = this.settings.CustomSSFPS;
							e.videoQualityManager.options.videoCapture.framerate = this.settings.CustomSSFPS;
						});
					}
					if(this.settings.CameraSettingsEnabled){ 
						BdApi.Patcher.after("StreamPlus", videoOptionFunctions, "updateVideoQuality", (e) => {
							if(e.stats !== undefined){ 
								if(e.stats.camera !== undefined){
									if(e.videoStreamParameters[0] !== undefined){
										e.videoStreamParameters[0].maxPixelCount = (this.settings.CameraHeight * this.settings.CameraWidth);
										if(e.videoStreamParameters[0].maxResolution.height){
										if(this.settings.CameraHeight >= 0){ //Height in pixels
											e.videoStreamParameters[0].maxResolution.height = this.settings.CameraHeight;
										}}
										if(e.videoStreamParameters[0].maxResolution.width){
										if(this.settings.CameraWidth >= 0){ //Width in pixels
											e.videoStreamParameters[0].maxResolution.width = this.settings.CameraWidth;
										}}
									}
									if(e.videoStreamParameters[1] !== undefined){
										if(this.settings.CameraHeight >= 0){ //Height in pixels
											e.videoStreamParameters[1].maxResolution.height = this.settings.CameraHeight;
										}
										if(this.settings.CameraWidth >= 0){ //Width in pixels
											e.videoStreamParameters[1].maxResolution.width = this.settings.CameraWidth;
										}
									e.videoStreamParameters[1].maxPixelCount = (this.settings.CameraHeight * this.settings.CameraWidth);
									}
									if(this.settings.CameraWidth >= 0){
										e.videoQualityManager.options.videoCapture.width = this.settings.CameraWidth;
										e.videoQualityManager.options.videoBudget.width = this.settings.CameraWidth;
									}
									if(this.settings.CameraHeight >= 0){
										e.videoQualityManager.options.videoCapture.height = this.settings.CameraHeight;
										e.videoQualityManager.options.videoBudget.height = this.settings.CameraHeight;
									}
									e.videoQualityManager.ladder.pixelBudget = (this.settings.CameraHeight * this.settings.CameraWidth);
								}
							}
						});
					}
				}

				buttonCreate(){
					var qualityButton = document.createElement('button');
					qualityButton.id = 'qualityButton';
					qualityButton.innerHTML = 'Quality';
					qualityButton.style.zIndex = "2";
					qualityButton.style.bottom = "-30%";
					qualityButton.style.left = "-60%";
					qualityButton.style.height = "14px";
					qualityButton.style.width = "50px";
					qualityButton.className = "buttonColor-3bP3fX button-f2h6uQ lookFilled-yCfaCM colorBrand-I6CyqQ"
					try{
						document.getElementsByClassName("container-YkUktl")[0].appendChild(qualityButton)
						}catch(err){
						console.warn("StreamPlus: What the fuck happened? During buttonCreate()");
						console.log(err);
					};

					var qualityMenu = document.createElement('div');
					qualityMenu.id = 'qualityMenu';
					qualityMenu.style.display = 'none';
					qualityMenu.style.position = "absolute";
					qualityMenu.style.zIndex = "1";
					qualityMenu.style.bottom = "140%";
					qualityMenu.style.left = "-45%";
					qualityMenu.style.height = "20px";
					qualityMenu.style.width = "100px";
					qualityMenu.onclick = function(event){
						event.stopPropagation();
					}
					document.getElementById("qualityButton").appendChild(qualityMenu);

					var qualityInput = document.createElement('input');
					qualityInput.id = 'qualityInput';
					qualityInput.type = 'text';
					qualityInput.placeholder = 'Resolution';
					qualityInput.style.width = "33%";
					qualityInput.style.zIndex = "1";
					qualityInput.value = this.settings.CustomSSResolution;
					qualityMenu.appendChild(qualityInput);

					var qualityInputFPS = document.createElement('input');
					qualityInputFPS.id = 'qualityInputFPS';
					qualityInputFPS.type = 'text';
					qualityInputFPS.placeholder = 'FPS';
					qualityInputFPS.style.width = "33%";
					qualityInputFPS.style.zIndex = "1";
					qualityInputFPS.value = this.settings.CustomSSFPS;
					qualityMenu.appendChild(qualityInputFPS);

					qualityButton.onclick = function() {
					  if(qualityMenu.style.display === 'none') {
						qualityMenu.style.display = 'block';
					  } else {
						qualityMenu.style.display = 'none';
					  }
					}
				}

				onStart() {
					this.saveAndUpdate();
				}

				onStop() {
					Patcher.unpatchAll();
					BdApi.Patcher.unpatchAll("StreamPlus");
					if(document.getElementById("qualityButton")) document.getElementById("qualityButton").remove();
					if(document.getElementById("qualityMenu")) document.getElementById("qualityMenu").remove();
					if(document.getElementById("qualityInput")) document.getElementById("qualityInput").remove();
				}
			};
		};
		return plugin(Plugin, Api);
	})(global.ZeresPluginLibrary.buildPlugin(config));
})();
/*@end@*/