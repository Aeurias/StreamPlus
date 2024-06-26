/**
 * @name StreamPlus
 * @author Aeurias
 * @version 26.04.2024
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
	if(fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
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
			"version": "26.04.2024",
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
			BdApi.UI.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
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
				Utilities,
				WebpackModules,
				DiscordClassModules,
				PluginUpdater,
				Logger
			} = Api;
			return class StreamPlus extends Plugin {
				defaultSettings = {
					"CustomScreenSharingMain": true,
					"CustomSSFPSEnabled": true,
					"CustomSSFPS": 90,
					"CustomSSResolutionEnabled": false,
					"CustomSSResolution": 0,
					"CustomSSBitrateEnabled": true,
					"SSminBitrate": 8000,
					"SSmaxBitrate": 19000,
					"SStargetBitrate": 11000,
					"voiceBitrate": 256,
					"SettingDebugButton": false,
					"StreamCodec": 0,
					"removeScreenshareUpsell": true
				};
				settings = Utilities.loadSettings(this.getName(), this.defaultSettings);
				getSettingsPanel() {
					return Settings.SettingPanel.build(_ => this.saveAndUpdate(), ...[
						new Settings.SettingGroup("Custom Screen Share Settings").append(...[
							new Settings.Switch("High Quality Custom Screensharing", "'OpenH264' and 'Hardware Accelerated Encode': Enabled, with 'AV1 Video Codec': Disabled recommended in Discord's 'Voice & Video' setting panel.", this.settings.CustomScreenSharingMain, value => this.settings.CustomScreenSharingMain = value),
							new Settings.Switch("Custom High Frame Rate Screenshare", "Enables beyond 60 FPS framerate for screenshare, up to 360 FPS or to limits of your encoder/PC.", this.settings.CustomSSFPSEnabled, value => this.settings.CustomSSFPSEnabled = value),
							new Settings.Textbox("Custom FPS", "Values between 24-120 Recommended. 24 for anime/film, 72-90 for VR content, 72-120 for everything else. Try to sync with in game FPS for fluidity, and set a FPS limit in game so you can free up some GPU resources for encoding to work properly.", this.settings.CustomSSFPS,
								value => {
									value = parseInt(value);
									this.settings.CustomSSFPS = value;
								}),
								new Settings.Switch("Custom Screensharing Encode Bitrates", "Enables custom bitrate for your streams for better banding, grain and texture details and remove horrible blockiness of Discord streams.", this.settings.CustomSSBitrateEnabled, value => this.settings.CustomSSBitrateEnabled = value),
								new Settings.Textbox("Target Average Bitrate", "The target average bitrate (in kbps). Recommended to set 0.75x of Maximum Bitrate value, or at the desired CQ bitrate you would like the stream to be. 12-18000 recommended for 1440p/90 or 1080p/120, 18-28000 for 4K/60, 24-58000 for 4K/120", this.settings.SStargetBitrate,
								value => {
									value = parseFloat(value);
									this.settings.SStargetBitrate = value;
								}),
								new Settings.Textbox("Maximum Peak Bitrate", "The maximum peak bitrate the encoder will use (in kbps). Between 20-60000 Recommended for for all res/fps or set to 0.75x of your network's upload speed. For 4K/HFR set to target bitrate or 1.1x of target rate.", this.settings.SSmaxBitrate,
								value => {
									value = parseFloat(value);
									this.settings.SSmaxBitrate = value;
								}),
								new Settings.Textbox("Minimum Constant Bitrate", "The minimum constant bitrate (in kbps). 10-15000 is recommended, lower to 5-10000 for viewers with bad network.", this.settings.SSminBitrate,
								value => {
									value = parseFloat(value);
									this.settings.SSminBitrate = value;
								}),
							]),
							new Settings.SettingGroup("Extra Settings").append(...[
								new Settings.Dropdown("Preferred Stream Codec", "Forces the stream encode codec to the preferred selection.", this.settings.StreamCodec, [
									{label: "Default/Disabled", value: 0},
									{label: "H.265", value: 1},
									{label: "H.264", value: 2},
									{label: "AV1", value: 3},
									{label: "VP8", value: 4},
									{label: "VP9", value: 5}], value => this.settings.StreamCodec = value, {searchable: true}
								),
								new Settings.Switch("Custom Screenshare Resolution", "Force stream to run non standard or non source capture resolutions.", this.settings.CustomSSResolutionEnabled, value => this.settings.CustomSSResolutionEnabled = value),
								new Settings.Textbox("Resolution", "The custom resolution you want (in pixels height)", this.settings.CustomSSResolution,
									value => {
										value = parseInt(value, 10);
										this.settings.CustomSSResolution = value;
									}),
								new Settings.Switch("Stream Settings Debug Button", "Adds a button to switch your resolution/fps quickly for testing", this.settings.SettingDebugButton, value => this.settings.SettingDebugButton = value),
								new Settings.Switch("Remove Screen Share Nitro Upsell", "Removes the Nitro upsell in the Screen Share quality option menu.", this.settings.removeScreenshareUpsell, value => this.settings.removeScreenshareUpsell = value),
								new Settings.Textbox("Voice Audio Bitrate", "Allows you to change the bitrate to whatever you want. Does not allow you to go over the voice channel's set bitrate but it does allow you to go much lower. (bitrate in kbps).", this.settings.voiceBitrate,
								value => {
									value = parseFloat(value);
									this.settings.voiceBitrate = value;
								})
						])
					])
				}
				saveAndUpdate(){
					Utilities.saveSettings(this.getName(), this.settings);
					BdApi.Patcher.unpatchAll("StreamPlus");
					Patcher.unpatchAll();
					if(this.settings.CustomSSFPS == 15) this.settings.CustomSSFPS = 16;
					if(this.settings.CustomSSFPS == 30) this.settings.CustomSSFPS = 31;
					if(this.settings.CustomSSFPS == 5) this.settings.CustomSSFPS = 6;
					if(document.getElementById("qualityButton")) document.getElementById("qualityButton").remove();
					if(document.getElementById("qualityMenu")) document.getElementById("qualityMenu").remove();
					if(document.getElementById("qualityInput")) document.getElementById("qualityInput").remove();
					if(this.settings.SettingDebugButton){
						try{
							this.buttonCreate(); //Debug Quality Button
						}catch(err){
							console.error(err);
						}
						try{
							document.getElementById("qualityInput").addEventListener("input", this.updateQuick);
							document.getElementById("qualityInputFPS").addEventListener("input", this.updateQuick);
							if(!this.settings.SettingDebugButton){
								if(document.getElementById("qualityButton") != undefined) document.getElementById("qualityButton").style.display = 'none';
								if(document.getElementById("qualityMenu") != undefined) document.getElementById("qualityMenu").style.display = 'none';
							}
						}catch(err){
							console.error(err);
						}
					}
					if(this.settings.CustomScreenSharingMain){
						try{
							this.customVideoSettings();
						}catch(err){
							Logger.err(this.getName(), "Error occurred during customVideoSettings() " + err);
						}
						try{
							this.videoQualityModule();
						}catch(err){
							Logger.err(this.getName(), "Error occurred during videoQualityModule() " + err);
						}
					}
					if(this.hasAddedScreenshareUpsellStyle && !this.settings.removeScreenshareUpsell){
						try{
							BdApi.DOM.removeStyle("StreamPlus")
						}catch(err){
							Logger.warn(this.getName(), err);
						}
					}
					if(this.settings.removeScreenshareUpsell && !this.hasAddedScreenshareUpsellStyle){
						try{
							BdApi.DOM.addStyle("StreamPlus",`
							[class*="upsellBanner"] {
							  display: none;
							  visibility: hidden;
							}`);
							this.hasAddedScreenshareUpsellStyle = true;
						}catch(err){
							Logger.err(this.getName(), err);
						}
					}
					if(this.accountPanelRenderer == undefined) this.accountPanelRenderer = WebpackModules.getAllByProps("default").filter(obj => obj.default.toString().includes("useIsHomeSelected"))[0];
					BdApi.Patcher.after("StreamPlus", this.accountPanelRenderer, "default", (_,args,ret) => {
						if(this.settings.SettingDebugButton && (document.getElementById("qualityButton") == undefined || document.getElementById("qualityInputFPS") == undefined)){
							this.buttonCreate();
							document.getElementById("qualityInput").addEventListener("input", this.updateQuick);
							document.getElementById("qualityInputFPS").addEventListener("input", this.updateQuick);
							if(!this.settings.SettingDebugButton){
								if(document.getElementById("qualityButton") != undefined) document.getElementById("qualityButton").style.display = 'none';
								if(document.getElementById("qualityMenu") != undefined) document.getElementById("qualityMenu").style.display = 'none';
							}
						}
					});
				}
				customVideoSettings() {
					if(this.StreamButtons == undefined) this.StreamButtons = WebpackModules.getByProps("ApplicationStreamFPSButtons", "ApplicationStreamResolutionButtons");
					//If you're trying to figure this shit out yourself, I recommend uncommenting the line below.
					//console.log(this.StreamButtons);
					//If custom resolution is enabled and the resolution is not set to 0,
					if(this.settings.CustomSSResolutionEnabled && this.settings.CustomSSResolution != 0){
						//some of these properties are marked as read only, but they still allow you to delete them
						//so any time you see "delete", what we're doing is bypassing the read-only thing by deleting it and immediately remaking it.
						delete this.StreamButtons.ApplicationStreamResolutions.RESOLUTION_1440
						//Change 1440p resolution internally to custom resolution
						this.StreamButtons.ApplicationStreamResolutions.RESOLUTION_1440 = this.settings.CustomSSResolution;
						this.StreamButtons.ApplicationStreamSettingRequirements[4].resolution = this.settings.CustomSSResolution;
						this.StreamButtons.ApplicationStreamSettingRequirements[5].resolution = this.settings.CustomSSResolution;
						this.StreamButtons.ApplicationStreamSettingRequirements[6].resolution = this.settings.CustomSSResolution;
						//Set resolution button value to custom resolution
						this.StreamButtons.ApplicationStreamResolutionButtons[2].value = this.settings.CustomSSResolution;
						delete this.StreamButtons.ApplicationStreamResolutionButtons[2].label;
						//Set label of resolution button to custom resolution. This one is used in the popup window that appears before you start streaming.
						this.StreamButtons.ApplicationStreamResolutionButtons[2].label = this.settings.CustomSSResolution.toString();

						//Set value of button with suffix label to custom resolution
						this.StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].value = this.settings.CustomSSResolution;
						delete this.StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].label;
						//Set label of button with suffix label to custom resolution with "p" after it, ex: "1440p"
						//This one is used in the dropdown kind of menu after you've started streaming
						this.StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].label = this.settings.CustomSSResolution + "p";
					}
					//If custom resolution tick is disabled or custom resolution is set to 0,
					if(!this.settings.CustomSSResolutionEnabled || this.settings.CustomSSResolution == 0){
						//Reset all values to defaults.
						delete this.StreamButtons.ApplicationStreamResolutions.RESOLUTION_1440
						this.StreamButtons.ApplicationStreamResolutions.RESOLUTION_1440 = 1440;
						this.StreamButtons.ApplicationStreamSettingRequirements[4].resolution = 1440;
						this.StreamButtons.ApplicationStreamSettingRequirements[5].resolution = 1440;
						this.StreamButtons.ApplicationStreamSettingRequirements[6].resolution = 1440;
						this.StreamButtons.ApplicationStreamResolutionButtons[2].value = 1440;
						delete this.StreamButtons.ApplicationStreamResolutionButtons[2].label;
						this.StreamButtons.ApplicationStreamResolutionButtons[2].label = "1440";
						this.StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].value = 1440;
						delete this.StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].label;
						this.StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].label = "1440p";
					}
					//Removes stream setting requirements
					function removeQualityParameters(x){
						try{
							delete x.quality
						}catch(err){	
						}
						try{
							delete x.guildPremiumTier
						}catch(err){	
						}
					}
					/*Remove each of the stream setting requirements 
					(which basically just tell your client what premiumType / guildPremiumTier you need to access that resolution)
					removing the setting requirements makes it default to thinking that every premiumType can use it.*/
					this.StreamButtons.ApplicationStreamSettingRequirements.forEach(removeQualityParameters);
					function replace60FPSRequirements(x) {
						if(x.fps != 30 && x.fps != 15 && x.fps != 5) x.fps = BdApi.getData("StreamPlus","settings").CustomSSFPS;
					}
					function restore60FPSRequirements(x) {
						if(x.fps != 30 && x.fps != 15 && x.fps != 5) x.fps = 60;
					}
					//If Custom FPS is enabled and does not equal 60,
					if(this.settings.CustomSSFPSEnabled && this.CustomSSFPS != 60){
						//remove FPS nitro requirements
							this.StreamButtons.ApplicationStreamSettingRequirements.forEach(replace60FPSRequirements);
							//set suffix label button value to the custom number
							this.StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].value = this.settings.CustomSSFPS;
							delete this.StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].label;
							//set button suffix label with the correct number with " FPS" after it. ex: "75 FPS". This one is used in the dropdown kind of menu
							this.StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].label = this.settings.CustomSSFPS + " FPS";
							//set fps button value to the correct number.
							this.StreamButtons.ApplicationStreamFPSButtons[2].value = this.settings.CustomSSFPS;
							delete this.StreamButtons.ApplicationStreamFPSButtons[2].label;
							//set fps button label to the correct number. This one is used in the popup window that appears before you start streaming.
							this.StreamButtons.ApplicationStreamFPSButtons[2].label = this.settings.CustomSSFPS;
							this.StreamButtons.ApplicationStreamFPS.FPS_60 = this.settings.CustomSSFPS;
					}
					//If custom FPS toggle is disabled, or custom fps is set to the default of 60,
					if(!this.settings.CustomSSFPSEnabled || this.CustomSSFPS == 60){
						//Reset all values to defaults.
						this.StreamButtons.ApplicationStreamSettingRequirements.forEach(restore60FPSRequirements);
						this.StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].value = 60;
						delete this.StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].label;
						this.StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].label = "60 FPS";
						this.StreamButtons.ApplicationStreamFPSButtons[2].value = 60;
						delete this.StreamButtons.ApplicationStreamFPSButtons[2].label;
						this.StreamButtons.ApplicationStreamFPSButtons[2].label = 60;
						this.StreamButtons.ApplicationStreamFPS.FPS_60 = 60;
					}
				} //End of customVideoSettings()
				updateQuick(){//Function that runs when the resolution/fps quick menu is changed.
					//Refer to customVideoSettings function for comments on what this all does, since this code is just a copy-paste from there.
					const settings = BdApi.getData("StreamPlus","settings");
					parseInt(document.getElementById("qualityInput").value);
					settings.CustomSSResolution = parseInt(document.getElementById("qualityInput").value);
					parseInt(document.getElementById("qualityInputFPS").value);
					settings.CustomSSFPS = parseInt(document.getElementById("qualityInputFPS").value);
					if(parseInt(document.getElementById("qualityInputFPS").value) == 15) settings.CustomSSFPS = 16;
					if(parseInt(document.getElementById("qualityInputFPS").value) == 30) settings.CustomSSFPS = 31;
					if(parseInt(document.getElementById("qualityInputFPS").value) == 5) settings.CustomSSFPS = 6;
					const StreamButtons = WebpackModules.getByProps("ApplicationStreamFPSButtons", "ApplicationStreamResolutionButtons");
					if(settings.CustomSSResolutionEnabled && settings.CustomSSResolution != 0){
						delete StreamButtons.ApplicationStreamResolutions.RESOLUTION_1440
						StreamButtons.ApplicationStreamResolutions.RESOLUTION_1440 = settings.CustomSSResolution;
						StreamButtons.ApplicationStreamSettingRequirements[4].resolution = settings.CustomSSResolution;
						StreamButtons.ApplicationStreamSettingRequirements[5].resolution = settings.CustomSSResolution;
						StreamButtons.ApplicationStreamSettingRequirements[6].resolution = settings.CustomSSResolution;
						StreamButtons.ApplicationStreamResolutionButtons[2].value = settings.CustomSSResolution;
						delete StreamButtons.ApplicationStreamResolutionButtons[2].label;
						StreamButtons.ApplicationStreamResolutionButtons[2].label = settings.CustomSSResolution.toString();
						StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].value = settings.CustomSSResolution;
						delete StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].label;
						StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].label = settings.CustomSSResolution + "p";
					}
					if(!settings.CustomSSResolutionEnabled || (settings.CustomSSResolution == 0)){
						delete StreamButtons.ApplicationStreamResolutions.RESOLUTION_1440
						StreamButtons.ApplicationStreamResolutions.RESOLUTION_1440 = 1440;
						StreamButtons.ApplicationStreamSettingRequirements[4].resolution = 1440;
						StreamButtons.ApplicationStreamSettingRequirements[5].resolution = 1440;
						StreamButtons.ApplicationStreamSettingRequirements[6].resolution = 1440;
						StreamButtons.ApplicationStreamResolutionButtons[2].value = 1440;
						delete StreamButtons.ApplicationStreamResolutionButtons[2].label;
						StreamButtons.ApplicationStreamResolutionButtons[2].label = "1440";
						StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].value = 1440;
						delete StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].label;
						StreamButtons.ApplicationStreamResolutionButtonsWithSuffixLabel[3].label = "1440p";
					}
					function replace60FPSRequirements(x) {
						if(x.fps != 30 && x.fps != 15 && x.fps != 5) x.fps = BdApi.getData("StreamPlus","settings").CustomSSFPS;
					}
					function restore60FPSRequirements(x) {
						if(x.fps != 30 && x.fps != 15 && x.fps != 5) x.fps = 60;
					}
					if(settings.CustomSSFPSEnabled){
						if(this.CustomSSFPS != 60){
							StreamButtons.ApplicationStreamSettingRequirements.forEach(replace60FPSRequirements);
							StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].value = settings.CustomSSFPS;
							delete StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].label;
							StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].label = settings.CustomSSFPS + " FPS";
							StreamButtons.ApplicationStreamFPSButtons[2].value = settings.CustomSSFPS;
							delete StreamButtons.ApplicationStreamFPSButtons[2].label;
							StreamButtons.ApplicationStreamFPSButtons[2].label = settings.CustomSSFPS;
							StreamButtons.ApplicationStreamFPS.FPS_60 = settings.CustomSSFPS;
						}
					}
					if(!settings.CustomSSFPSEnabled || this.CustomSSFPS == 60){
						StreamButtons.ApplicationStreamSettingRequirements.forEach(restore60FPSRequirements);
						StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].value = 60;
						delete StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].label;
						StreamButtons.ApplicationStreamFPSButtonsWithSuffixLabel[2].label = 60 + " FPS";
						StreamButtons.ApplicationStreamFPSButtons[2].value = 60;
						delete StreamButtons.ApplicationStreamFPSButtons[2].label;
						StreamButtons.ApplicationStreamFPSButtons[2].label = 60;
						StreamButtons.ApplicationStreamFPS.FPS_60 = 60;
					}
				} //End of updateQuick()
				videoQualityModule(){ //Custom Bitrates, FPS, Resolution
					if(this.videoOptionFunctions == undefined) this.videoOptionFunctions = BdApi.Webpack.getByPrototypeKeys("updateVideoQuality").prototype;
					if(this.settings.CustomSSBitrateEnabled){
						BdApi.Patcher.before("StreamPlus", this.videoOptionFunctions, "updateVideoQuality", (e) => {
							if(this.settings.SSminBitrate > 0){
								//Minimum Bitrate
								e.framerateReducer.sinkWants.qualityOverwrite.bitrateMin = (this.settings.SSminBitrate * 1000);
								e.videoQualityManager.qualityOverwrite.bitrateMin = (this.settings.SSminBitrate * 1000);
								e.videoQualityManager.options.videoBitrateFloor = (this.settings.SSminBitrate * 1000);
								e.videoQualityManager.options.videoBitrate.min = (this.settings.SSminBitrate * 1000);
								e.videoQualityManager.options.desktopBitrate.min = (this.settings.SSminBitrate * 1000);
							}
							if(this.settings.SSmaxBitrate > 0){
								//Maximum Bitrate
								e.framerateReducer.sinkWants.qualityOverwrite.bitrateMax = (this.settings.SSmaxBitrate * 1000);
								e.videoQualityManager.qualityOverwrite.bitrateMax = (this.settings.SSmaxBitrate * 1000);
								e.videoQualityManager.options.videoBitrate.max = (this.settings.SSmaxBitrate * 1000);
								e.videoQualityManager.options.desktopBitrate.max = (this.settings.SSmaxBitrate * 1000);
							}
							if(this.settings.SStargetBitrate > 0){
								//Target Bitrate
								e.framerateReducer.sinkWants.qualityOverwrite.bitrateTarget = (this.settings.SStargetBitrate * 1000);
								e.videoQualityManager.qualityOverwrite.bitrateTarget = (this.settings.SStargetBitrate * 1000);
								e.videoQualityManager.options.desktopBitrate.target = (this.settings.SStargetBitrate * 1000);
							}
							if(this.settings.voiceBitrate != 128){
								//Audio Bitrate
								e.voiceBitrate = (this.settings.voiceBitrate * 1000);
								e.conn.setTransportOptions({
									encodingVoiceBitRate: e.voiceBitrate
								});
							}
						});
					}
					//Video quality bypasses if Custom FPS is enabled.
					if(this.settings.CustomSSFPSEnabled){
						BdApi.Patcher.before("StreamPlus", this.videoOptionFunctions, "updateVideoQuality", (e) => {
							if(e.stats?.camera !== undefined) return; //if camera is enabled, don't fuck with fps
							e.videoQualityManager.options.videoBudget.framerate = this.settings.CustomSSFPS;
							e.videoQualityManager.options.videoCapture.framerate = this.settings.CustomSSFPS;
							/*for(const ladder in e.videoQualityManager.ladder.ladder) {
								e.videoQualityManager.ladder.ladder[ladder].framerate = this.settings.CustomSSFPS;
								//e.videoQualityManager.ladder.ladder[ladder].mutedFramerate = parseInt(this.settings.CustomSSFPS / 2);
							}
							for(const ladder of e.videoQualityManager.ladder.orderedLadder){
								ladder.framerate = this.settings.CustomSSFPS;
								//ladder.mutedFramerate = parseInt(this.settings.CustomSSFPS / 2);
							}
							e.videoQualityManager.connection.remoteVideoSinkWants = this.settings.CustomSSFPS;*/
						});
					}
					//If screen sharing bypasses are enabled,
					if(this.settings.CustomScreenSharingMain){
						BdApi.Patcher.before("StreamPlus", this.videoOptionFunctions, "updateVideoQuality", (e) => {
							//Ensure video quality parameters match the stream parameters.
							const videoQuality = new Object({
								width: e.videoStreamParameters[0].maxResolution.width,
								height: e.videoStreamParameters[0].maxResolution.height,
								framerate: e.videoStreamParameters[0].maxFrameRate,
							});
							//Ensure video budget quality parameters match stream parameters
							e.videoQualityManager.options.videoBudget = videoQuality;
							//Ensure video capture quality parameters match stream parameters
							e.videoQualityManager.options.videoCapture = videoQuality;
							//Ensure pixel budget matches stream resolution.
							/*e.videoQualityManager.ladder.pixelBudget = (videoQuality.height * videoQuality.width);
							
							for(const ladder in e.videoQualityManager.ladder.ladder) {
								e.videoQualityManager.ladder.ladder[ladder].width = videoQuality.width * (ladder / 100);
								e.videoQualityManager.ladder.ladder[ladder].height = videoQuality.height * (ladder / 100);
							}
							for(const ladder of e.videoQualityManager.ladder.orderedLadder){
								ladder.width = videoQuality.width * (ladder.wantValue / 100);
								ladder.height = videoQuality.height * (ladder.wantValue / 100);
								ladder.pixelCount = ladder.width * ladder.height;
							}*/
						});
					}
					if(this.settings.StreamCodec > 0){ // Video codecs
						BdApi.Patcher.before("StreamPlus", this.videoOptionFunctions, "updateVideoQuality", (e) => {
							//This code determines what codec was chosen
							let isCodecH265 = false;
							let isCodecH264 = false;
							let isCodecAV1 = false;
							let isCodecVP8 = false;
							let isCodecVP9 = false;
							switch(this.settings.StreamCodec){
								case 1:
									isCodecH265 = true;
									break;
								case 2:
									isCodecH264 = true;
									break;
								case 3:
									isCodecAV1 = true;
									break;
								case 4:
									isCodecVP8 = true;
									break;
								case 5:
									isCodecVP9 = true;
									break;
							}
							//This code determines what priorities to set each codec to based on which one was chosen by the user.
							let currentHighestNum = 1;
							function setPriority(codec){
								switch(codec){
									case 0:
										if(isCodecH265){
											return 1;
											break;
										}else{
											currentHighestNum += 1;
											return currentHighestNum;
										}
										break;
									case 1:
										if(isCodecH264){
											return 1;
											break;
										}else{
											currentHighestNum += 1;
											return currentHighestNum;
										}
										break;
									case 2:
										if(isCodecAV1){
											return 1;
											break;
										}else{
											currentHighestNum += 1;
											return currentHighestNum;
										}
										break;
									case 3:
										if(isCodecVP8){
											return 1;
											break;
										}else{
											currentHighestNum += 1;
											return currentHighestNum;
										}
										break;
									case 4:
										if(isCodecVP9){
											return 1;
											break;
										}else{
											currentHighestNum += 1;
											return currentHighestNum;
										}
										break;
								}
							}
							//and this code sets the priorities based on the outputs of setPriority.
							if(e.codecs != undefined && e.codecs[1]?.decode != undefined){
								e.codecs[1].decode = isCodecH265; //H.265
								e.codecs[1].encode = isCodecH265;
								e.codecs[1].priority = parseInt(setPriority(0));
								e.codecs[2].decode = isCodecH264; //H.264
								e.codecs[2].encode = isCodecH264;
								e.codecs[2].priority = parseInt(setPriority(1));
								e.codecs[3].decode = isCodecVP8; //VP8
								e.codecs[3].encode = isCodecVP8;
								e.codecs[3].priority = parseInt(setPriority(2));
								e.codecs[4].decode = isCodecVP9; //VP9
								e.codecs[4].encode = isCodecVP9;
								e.codecs[4].priority = parseInt(setPriority(3));
							}
						});
					}
				} //End of videoQualityModule()
				buttonCreate(){ //Creates the FPS and Resolution Swapper
					let qualityButton = document.createElement('button');
					qualityButton.id = 'qualityButton';
					qualityButton.className = `${this.buttonClassModule.lookFilled} ${this.buttonClassModule.colorBrand}`;
					qualityButton.innerHTML = '<p style="display: block-inline; margin-left: -6%; margin-top: -4.5%;">Quality</p>';
					qualityButton.style.position = "relative";
					qualityButton.style.zIndex = "2";
					qualityButton.style.bottom = "-33%";
					qualityButton.style.left = "-50%";
					qualityButton.style.height = "15px";
					qualityButton.style.width = "48px";
					qualityButton.style.verticalAlign = "middle";
					qualityButton.style.textAlign = "left";
					qualityButton.style.borderTopLeftRadius = "5px";
					qualityButton.style.borderTopRightRadius = "4px";
					qualityButton.style.borderBottomLeftRadius = "4px";
					qualityButton.style.borderBottomRightRadius = "4px";
					qualityButton.onclick = function(){
						if(qualityMenu.style.visibility == "hidden") {
							qualityMenu.style.visibility = "visible";
						}else{
							qualityMenu.style.visibility = "hidden";
						}
					}
					try{
						document.getElementsByClassName(DiscordClassModules.AccountDetails.container)[0].appendChild(qualityButton);
					}catch(err){
						console.error("[StreamPlus:] Error during buttonCreate()" + err);
					}
					let qualityMenu = document.createElement('div');
					qualityMenu.id = 'qualityMenu';
					qualityMenu.style.visibility = 'hidden';
					qualityMenu.style.position = "relative";
					qualityMenu.style.zIndex = "1";
					qualityMenu.style.bottom = "410%";
					qualityMenu.style.left = "-59%";
					qualityMenu.style.height = "20px";
					qualityMenu.style.width = "100px";
					qualityMenu.onclick = function(event){
						event.stopPropagation();
					}
					document.getElementById("qualityButton").appendChild(qualityMenu);
					let qualityInput = document.createElement('input');
					qualityInput.id = 'qualityInput';
					qualityInput.type = 'text';
					qualityInput.placeholder = 'Resolution';
					qualityInput.style.width = "33%";
					qualityInput.style.zIndex = "1";
					qualityInput.value = this.settings.CustomSSResolution;
					qualityMenu.appendChild(qualityInput);
					let qualityInputFPS = document.createElement('input');
					qualityInputFPS.id = 'qualityInputFPS';
					qualityInputFPS.type = 'text';
					qualityInputFPS.placeholder = 'FPS';
					qualityInputFPS.style.width = "33%";
					qualityInputFPS.style.zIndex = "1";
					qualityInputFPS.value = this.settings.CustomSSFPS;
					qualityMenu.appendChild(qualityInputFPS);
				} //End of buttonCreate()
				onStart() {
					PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), this._config.info.github_raw);
					this.currentUser = WebpackModules.getByProps("getCurrentUser").getCurrentUser();
					this.previewInitial = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps("isPreview")).isPreview;
					this.buttonClassModule = WebpackModules.getByProps("lookFilled", "button", "contents");
					this.saveAndUpdate();
				}
				onStop() {
					Patcher.unpatchAll();
					BdApi.Patcher.unpatchAll("StreamPlus");
					if(document.getElementById("qualityButton")) document.getElementById("qualityButton").remove();
					if(document.getElementById("qualityMenu")) document.getElementById("qualityMenu").remove();
					if(document.getElementById("qualityInput")) document.getElementById("qualityInput").remove();
					BdApi.DOM.removeStyle("StreamPlus");
				}
			};
		};
		return plugin(Plugin, Api);
	})(global.ZeresPluginLibrary.buildPlugin(config));
})();
/*@end@*/