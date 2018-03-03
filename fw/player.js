var tv = tv || {};
tv.freewheel = tv.freewheel || {};
tv.freewheel.DemoPlayer = function() {
	// Only one AdManager instance is needed for each player.
	this.adManager = new tv.freewheel.SDK.AdManager();
	// Please contact your FreeWheel solution engineer for the values for your network.
	this.adManager.setNetwork(96749);
	this.adManager.setServer("https://demo.v.fwmrm.net/ad/g/1")
	/* Ad ad context object should be created for each ad request and all ad playback related.
	When a new video starts, the current ad context object should be destroyed and a new one should
	be created to handle the next lifecycle.
	*/
	this.currentAdContext = null;
	/* Reference to the <video> element */
	this.videoEl = document.getElementById('videoPlayer');
	/* Temporarily store the video element's originalSource so when preroll / postroll ends, the src can
	be resumed.
	*/
	this.originalSource = this.videoEl.currentSrc;

	this.prerollSlots = [];
	this.postrollSlots = [];
	this.overlaySlots = [];

	this.adResponseLoaded = false;

	this.onRequestComplete = this._onRequestComplete.bind(this);
	this.onSlotEnded = this._onSlotEnded.bind(this);
	this.onContentVideoEnded = this._onContentVideoEnded.bind(this);
	this.onContentVideoTimeUpdated = this._onContentVideoTimeUpdated.bind(this);
};

tv.freewheel.DemoPlayer.prototype = {
	requestAds: function() {
		this.currentAdContext = this.adManager.newContext();
		// The profile value will be provided by your FreeWheel solution engineer
		this.currentAdContext.setProfile("global-js");

		// Set the target.
		this.currentAdContext.setVideoAsset("DemoVideoGroup.01", 500);
		this.currentAdContext.setSiteSection("DemoSiteGroup.01");

		// Optional if using custom key-value targeting: Add key-values in the ad request.
		this.currentAdContext.addKeyValue("customTargetingKey","JSAMDemoPlayer");

		// Add 1 preroll, 2 overlay, 1 postroll slot
		this.currentAdContext.addTemporalSlot("Preroll_1", tv.freewheel.SDK.ADUNIT_PREROLL, 0);
		this.currentAdContext.addTemporalSlot("Overlay_1", tv.freewheel.SDK.ADUNIT_OVERLAY, 3);
		this.currentAdContext.addTemporalSlot("Overlay_2", tv.freewheel.SDK.ADUNIT_OVERLAY, 13);
		this.currentAdContext.addTemporalSlot("Postroll_1", tv.freewheel.SDK.ADUNIT_POSTROLL, 60);

		/* Listen to request_complete and slot_ended events.
		*/
		this.currentAdContext.addEventListener(tv.freewheel.SDK.EVENT_REQUEST_COMPLETE, this.onRequestComplete.bind(this));
		this.currentAdContext.addEventListener(tv.freewheel.SDK.EVENT_SLOT_ENDED, this.onSlotEnded.bind(this));

		// The video display base is the area(canvas) where overlay and rich media ads are rendered.
		this.currentAdContext.registerVideoDisplayBase("displayBase");

		this.currentAdContext.submitRequest();
	},

	_onRequestComplete: function(evt) {
		if (evt.success) {
			this.adResponseLoaded = true;
			// Temporal slots include preroll, midroll, postroll and overlay slots.
			var temporalSlots = this.currentAdContext.getTemporalSlots();
			for (var i = 0; i < temporalSlots.length; i++) {
				var slot = temporalSlots[i];
				switch (slot.getTimePositionClass())
				{
					case tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL:
						this.prerollSlots.push(slot);
						break;
					case tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY:
						this.overlaySlots.push(slot);
						break;
					case tv.freewheel.SDK.TIME_POSITION_CLASS_POSTROLL:
						this.postrollSlots.push(slot);
						break;
				}
			}
			if (this.videoEl.currentSrc)
				this.originalSource = this.videoEl.currentSrc;
			document.getElementById("start").removeAttribute('disabled');
		}
	},

	_onSlotEnded: function(evt) {
		var slotTimePositionClass = evt.slot.getTimePositionClass();
		switch (slotTimePositionClass) {
			case tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL:
				this.playNextPreroll();
				break;
			case tv.freewheel.SDK.TIME_POSITION_CLASS_POSTROLL:
				this.playNextPostroll();
				break;
		}
	},

	playNextPreroll: function() {
		if (this.prerollSlots.length) {
			var slot = this.prerollSlots.shift();
			slot.play();
		}
		else {
			setTimeout(this.playContent.bind(this), 100);
		}
	},

	playNextPostroll: function() {
		if (this.postrollSlots.length > 0) {
			var slot = this.postrollSlots.shift();
			slot.play();
		}
		else {
			/* No more postroll slots, stop here. Whole life cycle of this video+ad experience ends here.
			So we do clean up here.
			*/
			if (this.videoEl.currentSrc != this.originalSource) {
				this.videoEl.src = this.originalSource;
			}
			if (this.currentAdContext) {
				this.currentAdContext.removeEventListener(tv.freewheel.SDK.EVENT_REQUEST_COMPLETE, this.onRequestComplete);
				this.currentAdContext.removeEventListener(tv.freewheel.SDK.EVENT_SLOT_ENDED, this.onSlotEnded);
			}
			this.currentAdContext = null;
			this.adManager = null;
		}
	},

	playContent: function() {
		if (this.videoEl.src != this.originalSource) {
			this.videoEl.src = this.originalSource;
		}
		if (this.adResponseLoaded) {
			this.videoEl.addEventListener('ended', this.onContentVideoEnded);
			this.videoEl.addEventListener('timeupdate', this.onContentVideoTimeUpdated);
			if (this.currentAdContext){
				this.currentAdContext.setVideoState(tv.freewheel.SDK.VIDEO_STATE_PLAYING);
			}
		}
		this.videoEl.play();
	},

	_onContentVideoTimeUpdated: function(evt) {
		if (this.overlaySlots.length == 0){
			this.videoEl.removeEventListener('timeupdate', this.onContentVideoTimeUpdated);
			return;
		}

		for (var i = 0; i < this.overlaySlots.length; i++) {
			var slot = this.overlaySlots[i];
			var slotTimePosition = slot.getTimePosition();
			var videoCurrentTime = this.videoEl.currentTime;

			if (Math.abs(videoCurrentTime - slotTimePosition) < 0.5) {
				this.overlaySlots.splice(i, 1);
				slot.play();
				return;
			}
		}
	},

	_onContentVideoEnded: function(evt) {
		this.videoEl.removeEventListener("ended", this.onContentVideoEnded);
		if (this.currentAdContext){
			this.currentAdContext.setVideoState(tv.freewheel.SDK.VIDEO_STATE_STOPPED);
		}
		this.playNextPostroll();
	},

	play: function() {
		if (this.prerollSlots.length) {
			this.playNextPreroll();
		}
		else {
			this.playContent();
		}
	}
};


