////////////////////////////////////////////////////////////////////
////                                                            ////
////   Simple WebMAF JavaScript video API sample video player   ////
////                                                            ////
////////////////////////////////////////////////////////////////////

var token = window.location.href.slice( window.location.href.indexOf( '?' ) + 1 );
var devicetype = "iOS Phone";
var videos = [];

var action = "video";	//values are 'video' (to play video) and 'HTTPGET' (to get the streaming file)

var video_type_not_specified      = 0;  ///> Unknown 
var video_type_MP4                = 1;  ///> Standard MP4 file (can be local or remote)
var video_type_SmoothStreaming    = 2;  ///> Smooth Streaming  
var video_type_SmoothStreamingVOD = 2;  ///> Deprecated and will be removed in the next release
var video_type_DashMp4            = 4;  ///> Dash MP4
var video_type_DashMp4VOD         = 4;  ///> Deprecated and will be removed in the next release
var video_type_DashTS             = 6;  ///> Dash MPEG2 Transport Stream
var video_type_DashTSVOD          = 6;  ///> Deprecated and will be removed in the next release
var video_type_HLS                = 8;  ///> Http Live Streaming
var video_type_FileTS             = 9;  ///> MPEG2 Transport Stream file (can be local or remote)

//build a list of video IDs for Season 1 of DBS
function buildVideoList()
{
	var xobj = new XMLHttpRequest();
	xobj.overrideMimeType("application/json");
	xobj.open('GET', '183045.json', true);
	xobj.onreadystatechange = function() {
		if (xobj.readyState == 4 && xobj.status == "200") {

			var response = JSON.parse(xobj.responseText);
			var dbs_episodes = response.items[0].children;
			for(i=0;i<dbs_episodes.length;i++)
			{
				var dbs_episode_videos = dbs_episodes[i].media;
				for(j=0;j<dbs_episode_videos.length;j++)
				{
					videos.push(dbs_episode_videos[j].id);
				}
				console.log("initEverything()");
				//play the first video
				initEverything();
			}
		}
	}
	xobj.send(null);
}

function loadSignedURL(video_id)
{
	var http = new XMLHttpRequest();
	var url = "https://prod-api-funimationnow.dadcdigital.com/api/source/catalog/video/"+video_id+"/signed/";
	http.open("GET", url, true);
	http.setRequestHeader("devicetype", devicetype);
	http.setRequestHeader("Authorization", "Token " + token);

	http.onreadystatechange = function()
	{
		if(http.readyState == 4 && http.status == 200) {

			var response = JSON.parse(this.responseText);
			var filtered_json = find_in_object(response.items, {videoType: 'm3u8'});
			var m3u8 = filtered_json[0].src;
			displayTTY("m3u8: " + m3u8);
			video_API_load(m3u8,"","",8);
		
		}else
		{
			console.log("error: " + this.responseText);
		}
	}
	console.log("http.send("+url+")");
				
	http.send(null);
}

function find_in_object(my_object, my_criteria){

  return my_object.filter(function(obj) {
    return Object.keys(my_criteria).every(function(c) {
      return obj[c] == my_criteria[c];
    });
  });

}

var video_player_state_string="-------";
var current_time=0;
var total_time=0;
var available_audio_tracks=[];
var available_subtitle_tracks=[];


///////////////////////////////////////////////////////////////////
///////////////// start HTML5 video API abstraction ////////////

///////////////// end HTML5 video API /////////////////////////////
///////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////
///////////////// start WebMAF API abstraction ////////////////////

function webmaf_api_entry(command,dont_echo_to_debug_tty){
	window.external.user(command);
	if (typeof dont_echo_to_debug_tty=='undefined'){
		console.log(command);
		displayTTY("--> WebMAF API:"+command);
	}
}

function webmaf_stop() {
	webmaf_api_entry('{"command":"stop"}');
}
function webmaf_setplaytime(play_pos) {
	webmaf_api_entry('{"command":"setPlayTime","playTime":'+play_pos+'}');
}
function webmaf_pause() {
	webmaf_api_entry('{"command":"pause"}');
}
function webmaf_play() {
	webmaf_api_entry('{"command":"play"}');
}
function webmaf_load(url,licence,custom_data,load_type) {
	var play_command='{"command":"load","contentUri":"'+url+'","licenseUri":"'+licence+'","customData":"'+custom_data+'","sourceType":'+load_type+'}';
	webmaf_api_entry(play_command);
}
function webmaf_API_asynchronous_get_playtime() {
	webmaf_api_entry('{"command":"getPlaybackTime"}',false);
}
function webmaf_API_check_audio_and_timedtext_streams() {
	webmaf_api_entry('{"command":"getAudioTracks"}');
	webmaf_api_entry('{"command":"getSubtitleTracks"}');
}
function webmaf_API_set_set_subtitle_track(track_code){
	webmaf_api_entry('{"command":"setClosedCaptions","enable":true}');
	webmaf_api_entry('{"command":"setSubtitleTrack","subtitleTrack":"'+track_code+'","renderSubtitle":"false"}');
}
var audio_language_change_workaround="use_it";
function webmaf_API_set_set_audio_track(track_code){
	if (audio_language_change_workaround=="use_it"){
		webmaf_set_audio_track_with_workaround_for_fastforwarding(track_code);
	}else{
		webmaf_api_entry('{"command":"setAudioTrack","audioTrack":"'+track_code+'"}');
	}
}

var set_audio_track_workaround_state="inactive";
function webmaf_set_audio_track_with_workaround_for_fastforwarding(track_code) {
	var saved_cur_time=current_time;
	webmaf_stop();
	set_audio_track_workaround_state="waiting_for_load_to_complete";
  webmaf_api_entry('{"command":"setAudioTrack","audioTrack":"'+track_code+'"}');  // WebMAF will save this irrespective of whether the currely loaded video contains the specififed track
  loadSignedURL(videos[vid_pos]);
  next_movie_resume_time = 0;	//alays resume video at the beginning
  tick_time_to_play_next = 0;	//always begin video at the beginning
  if (tick_time_to_play_next != 0) {
  	tick_time_to_play_next = tick_time_to_play_next * 10 + my_decisecond_timer;
  }
}

function set_audio_track_workaround_load_complete_check(){
	switch(set_audio_track_workaround_state){
		case "waiting_for_load_to_complete":
		webmaf_setplaytime(saved_cur_time);
		break;
	}
}

function webmaf_API_set_set_audio_track(left_top_x,left_top_y,right_bottom_x,right_bottom_y){
	webmaf_api_entry('{"command":"setVideoPortalSize","ltx":'+left_top_x+',"lty":'+left_top_y+',"rbx":'+right_bottom_x+', "rby":'+right_bottom_y+'}');
}

///////////////// end WebMAF API abstraction //////////////////////
///////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////
////////////////////////// start Video API ////////////////////////

function video_API_stop() {webmaf_stop()};
function video_API_setplaytime(play_pos) {webmaf_setplaytime(play_pos);}
function video_API_pause() {webmaf_pause();}
function video_API_play() {webmaf_play();}
function video_API_load(url,licence,custom_data,mime_type) {webmaf_load(url,licence,custom_data,mime_type);}
function video_API_asynchronous_get_playtime() {webmaf_API_asynchronous_get_playtime();}
function video_API_asynchronous_check_audio_and_timedtext_streams() {webmaf_API_check_audio_and_timedtext_streams();}
function video_API_set_audio_language() {webmaf_stop()};
function video_API_set_set_subtitle_track(track_code){webmaf_API_set_set_subtitle_track(track_code);}
function video_API_set_set_audio_track(track_code){webmaf_API_set_set_audio_track(track_code);}
function video_API_set_video_portal(left_top_x,left_top_y,right_bottom_x,right_bottom_y){webmaf_API_set_set_audio_track(left_top_x,left_top_y,right_bottom_x,right_bottom_y);}

////////////////////////// end Video API //////////////////////////
///////////////////////////////////////////////////////////////////

var video_portal_fullscreen=true;
var screen_portal_animation_timer;


var video_animation_t=0.0;
function animate_video_portal(){
	var p1=0.7;
	var p2=0.9;
	var p3=1.2;
	var ltx=-1.0+0.49*(1.0+Math.cos(video_animation_t));
	var lty= 1.0-0.49*(1.0+Math.cos(video_animation_t*p1+Math.PI*(1.0-p1)));
	var rbx= 1.0-0.49*(1.0+Math.cos(video_animation_t*p2+Math.PI*(1.0-p2)));
	var rby=-1.0+0.49*(1.0+Math.cos(video_animation_t*p3+Math.PI*(1.0-p3)));
	video_animation_t=video_animation_t+0.02;
	video_API_set_video_portal(ltx,lty,rbx,rby);
	console.log(ltx,lty,rbx,rby);
}

function toggle_video_size_to_demostrate_setVideoPortalSize(){
	if (video_portal_fullscreen){
		video_portal_fullscreen=false;
		video_animation_t=Math.PI;
		screen_portal_animation_timer=setInterval(function(){animate_video_portal();}, 40);
	}else{
		clearInterval(screen_portal_animation_timer);
		video_portal_fullscreen=true;
		video_API_set_video_portal(-1.0,1.0,1.0,-1.0);
	}
}

var videoplayer_states=[
"NotReady",
"Opening",
"Play",
"Paused",
"Buffering",
"Stop",
"EndOfStream",
"Ready"
]

var scrolly=0;
var debug_offset=0;
var numbert=500;
var numbert_disp=50;
var tty=[];
function display_TTY() {
	var disp="";
	for(i=numbert_disp-1;i>=0;i--) {
		var j=i-debug_offset;
		if(j>=0&&j<numbert) {
			disp+=tty[j]+"<br>";
		}
	}
	document.getElementById("videoTTY").innerHTML=disp;
	document.getElementById("videoTTY").style.opacity=tty_opacity;
}



function clearTTY() {
	for(i=numbert-1;i>=0;i--) {
		tty[i]="";
	}
	debug_offset=0;
//    set_tty_opacity(starting_tty_opacity);
}

var hide_spam_TTY=1;


function displayTTY(_tty) {
	if(_tty.indexOf('SCE_AVBASECLOCK_VIDEO_BEHIND')!=-1) {
		return;
	}
	if (hide_spam_TTY){
		if(_tty.indexOf('elapsedTime')!=-1) {
			return;
		}
	}
	for(i=numbert-1;i>0;i--) {
		tty[i]=tty[i-1];
	}
	if(_tty.indexOf('playerMessage')!=-1) {
		tty[0]=_tty;
	} else {
		tty[0]=_tty.substring(0,100);
	}
}
WM_videoPlayer.TTY=displayTTY;
WM_videoPlayer.TTYLevel=3;

var videometrics_data_url;//: string for stream URL. (Read only)
var videometrics_data_bandwith;//: current bandwidth in bps. (Read only)
var videometrics_data_naturalWidth;//: video output width pixels. (Read only)
var videometrics_data_naturalHeight;//: video output height pixels. (Read only)
var videometrics_data_duration;//: total stream duration in milliseconds. (Read only)
var videometrics_data_elapsed;//: milliseconds since start of stream. (Read only)
var videometrics_data_currentState;//: Unready, Closed, Playing. Paused, Buffering, Opening and Ended. (Read only)
var videometrics_data_currentBitrate;//: in bps. (Read only)
var videometrics_data_sampleRate;//: audio sample rate in hertz. (Read only)
var videometrics_data_encodedFramerate;//: video encoded frame rate (hardcoded to 24 in webmaf/Libjscript). (Read only)
var videometrics_data_renderedFramerate;//: video output frame rate (may differ from app render framerate hardcoded to 24 in webmaf/libjscript). (Read only)
var videometrics_data_frameworkVersion;//: string containing revision number. (Read only){
var videometrics_data_last_error;
var videometrics_data_state;
var videometrics_data_bitrate;
function videometrics_update() {
	videometrics_data_url=videometrics.url.split('?')[0];
	videometrics_data_bandwith=videometrics.bandwith;
	videometrics_data_naturalWidth=videometrics.naturalWidth;
	videometrics_data_naturalHeight=videometrics.naturalHeight;
	videometrics_data_duration=videometrics.duration;
	videometrics_data_elapsed=videometrics.elapsed;
	videometrics_data_currentState=videometrics.currentState;
	videometrics_data_currentBitrate=videometrics.currentBitrate;
	videometrics_data_sampleRate=videometrics.sampleRate;
	videometrics_data_encodedFramerate=videometrics.encodedFramerate;
	videometrics_data_renderedFramerate=videometrics.renderedFramerate;
	videometrics_data_frameworkVersion=videometrics.frameworkVersion;
	elem=document.getElementById("videometrics");
	set_elem_innerhtml_and_opacity("videometrics","Value<br>"+videometrics_data_url+"<br>"+videometrics_data_bandwith+"<br>"+videometrics_data_naturalWidth+"<br>"+videometrics_data_naturalHeight+"<br>"+videometrics_data_duration+"<br>"+videometrics_data_elapsed+"<br>"+videometrics_data_currentState+"<br>"+videometrics_data_currentBitrate+"<br>"+videometrics_data_sampleRate+"<br>"+videometrics_data_encodedFramerate+"<br>"+videometrics_data_renderedFramerate+"<br>"+videometrics_data_frameworkVersion+"<br>",tty_opacity);
	set_elem_innerhtml_and_opacity("videometrics_key","",tty_opacity);
}

//
//url
//bandwith
//naturalWidth
//naturalHeight
//duration
//elapsed
//currentState
//currentBitrate
//sampleRate
//encodedFramerate
//renderedFramerate
//frameworkVersion



//callbacks
videometrics.onError=function(error,errorStr) {
	videometrics_data_last_error=errorStr;
};
videometrics.onStateChange=function(state) {
	videometrics_data_state=state;
};
videometrics.onBitrateChange=function(bitrate) {
	videometrics_data_bitrate=bitrate;
};
//  videometrics.onOpen=function() {
//  };

var next_movie_resume_time=0;
var video_is_buffering=false;


function HHMMSS(seconds){
	var sec_num=Math.floor(seconds);
	var hours=Math.floor(sec_num/3600);
	var minutes=Math.floor((sec_num-(hours*3600))/60);
	var seconds=sec_num-(hours*3600)-(minutes*60);
	if(hours<10) { hours="0"+hours; }
	if(minutes<10) { minutes="0"+minutes; }
	if(seconds<10) { seconds="0"+seconds; }
	var time=hours+':'+minutes+':'+seconds;
	return time;
}


function display_track_playpos_info(){
	if (current_time!=-1 && total_time!=-1){
		var time_to_next_movie;
		if (tick_time_to_play_next){
			time_to_next_movie=(tick_time_to_play_next-my_decisecond_timer)/10;
		}else{
			time_to_next_movie=total_time-current_time;
		}
		document.getElementById("track_time_display").innerHTML=HHMMSS(current_time)+" / "+HHMMSS(total_time)+"<br>&nbsp;&nbsp;State:"+video_player_state_string+"<br>"+"next in  "+HHMMSS(time_to_next_movie);
	} else {
		document.getElementById("track_time_display").innerHTML="--:--:-- / --:--:--<br>"+video_player_state_string;
	}
}


function handle_getPlaybackTime(data) {
	current_time=data.elapsedTime;
	total_time=data.totalTime;
	display_track_playpos_info();
}

//{"command":"getSubtitleTracks","status":"ok","subtitleTracks":"", "currentSubtitleTrack":""}
//{"command":"getAudioTracks","status":"ok","audioTracks":"und", "currentAudioTrack":"und"}

var audio_lang_buttons=[]

var subtitle_lang_buttons=[]

var need_to_retest_languages=false;

// function highlight_language_button(index,lang_buttons){
// 	for (i=0;i<5;i++){
// 		elem_txt=document.getElementById(lang_buttons[i][0]);
// 		elem_but=document.getElementById(lang_buttons[i][1]);
// 		if (elem_txt && elem_but){
// 			if (i==index){
// 				elem_but.src="images/square_button3_pressed.png";
// //          elem_txt.style.color="#0";
// }else{
// 	elem_but.src="images/square_button3.png";
// //          elem_txt.style.color="#606060";
// }
// }
// }
// }


// function update_language_buttons(audio_langs,lang_buttons){
// 	var langs=audio_langs.split(',');
// 	for (i=0;i<5;i++){
// 		elem_txt=document.getElementById(lang_buttons[i][0]);
// 		elem_but=document.getElementById(lang_buttons[i][1]);
// 		if (elem_txt && elem_but){
// 			if (i<langs.length && audio_langs!=""){
// 				elem_txt.innerHTML=langs[i];
// 				elem_txt.style.opacity=0.35;
// 				elem_but.style.opacity=1.0;
// 			}else{
// 				elem_txt.innerHTML="";
// 				elem_txt.style.opacity=0.1;
// 				elem_but.style.opacity=0.01;
// 			}
// 		}else{
// 			need_to_retest_languages=true;
// 		}
// 	}
// 	return langs;
// }

var audio_stream_names=[];
var subtitle_stream_names=[];

function update_audio_languages_display(audio_tracks){
	if (audio_tracks.length==0){
		// update_language_buttons("",audio_lang_buttons);
		audio_stream_names=[];
	}else{
		// audio_stream_names=update_language_buttons(audio_tracks,audio_lang_buttons);
	}
}        


function update_subtitle_languages_display(subtitle_tracks){
	if (subtitle_tracks.length==0){
		// update_language_buttons("",subtitle_lang_buttons);
		subtitle_stream_names=[];
	}else{
		// subtitle_stream_names=update_language_buttons(subtitle_tracks,subtitle_lang_buttons);
	}
}        


var subtitle_override_opacity=0;
function reset_subtitles(){
	subtitle_override_opacity=0.0;
	set_elem_innerhtml_and_opacity("subtitles","subtitles:",subtitle_override_opacity);
}


function accessfunction(json) {
	if (json.indexOf('getPlaybackTime')==-1){
		console.log(json);
	}
	var add_to_tty=false;
	// displayTTY(json);

	var data=JSON.parse(json);
	switch(data.command) {
		case "getAudioTracks":
		update_audio_languages_display(data.audioTracks);
		break;
		case "getSubtitleTracks":
		update_subtitle_languages_display(data.subtitleTracks);
		break;
		case "getPlaybackTime":
		handle_getPlaybackTime(data);
		break;
		case "networkStatusChange":
		case "contentAvailable":
		case "playerStatusChange":
		video_player_state_string=data.playerState;
		displayTTY("============== Video Player status changed to "+data.playerState+" ====================");
		switch(data.playerState){
			case "buffering":
			displayTTY("BUFFERING");
			break;
			case "ready":
			displayTTY("TESTING AUTO RESUME1 next_movie_resume_time="+next_movie_resume_time);
			if(next_movie_resume_time>=0) {
				displayTTY("TESTING AUTO RESUME AND PLAY START BASED ON BUFFERING VIDEO-PLAYERSTATE");
				set_playtime(next_movie_resume_time);
				next_movie_resume_time=-1;
				set_audio_track_workaround_load_complete_check();
				video_API_play();
				video_API_asynchronous_check_audio_and_timedtext_streams();
			}else if(next_movie_resume_time<-100) {
				displayTTY("AUTO RESUMING AT RANDOM TIME");
				set_playtime(Math.floor(-Math.random()*next_movie_resume_time));
				next_movie_resume_time=-1;
				set_audio_track_workaround_load_complete_check();
				video_API_play();
				video_API_asynchronous_check_audio_and_timedtext_streams();
			}
			break;
			case "endOfStream":
			play_next();
			break;
			case "DisplayingVideo":
			displayTTY("=================================================================");
			displayTTY("========== Video updating on screen: true play-start ============");
			displayTTY("=================================================================");
			break;
		}
		break;
		case "playerSubtitle":
		subtitle_override_opacity=1.0;
		if (data.text==""){
			set_elem_innerhtml_and_opacity("subtitles","",subtitle_override_opacity);
		} else {
			set_elem_innerhtml_and_opacity("subtitles",data.text,subtitle_override_opacity);
		}
		break;
		default:
		add_to_tty=true;
		break;
	}

	if(add_to_tty) {
		displayTTY("++++> accessfunction="+json);
	}
}


var current_control=5;
var control_stop_index=0;
var control_pause_index=1;
var control_rewind_index=2;
var control_play_index=3;
var control_fastforward_index=4;
var control_next_index=5;

var control_spec=[
["button_st","images/st.png","images/st_pressed.png"],
["button_pa","images/pa.png","images/pa_pressed.png"],
["button_rw","images/rw.png","images/rw_pressed.png"],
["button_pl","images/pl.png","images/pl_pressed.png"],
["button_ff","images/ff.png","images/ff_pressed.png"],
["button_ne","images/ne.png","images/ne_pressed.png"],
]

var num_main_control_buttons=6;
var audio_language_button_currently_highlighted=-1;
var subtitle_language_button_currently_highlighted=-1;
var type_of_button_currently_highlighted="";

function redraw_controls(highlighted_control) {
  // main buttons
  for(i=0;i<6;i++){
  	if (i==highlighted_control){
  		document.getElementById(control_spec[i][0]).src=control_spec[i][2];
  	}else{
  		document.getElementById(control_spec[i][0]).src=control_spec[i][1];
  	}
  }
  // language buttons
  var num_audio_buttons=audio_stream_names.length;
  var num_subtitle_buttons=subtitle_stream_names.length;
  audio_language_button_currently_highlighted=-1;
  subtitle_language_button_currently_highlighted=-1;

  if((num_audio_buttons || num_subtitle_buttons) && highlighted_control>=6) {
  	var subtitle_button_start_index=num_main_control_buttons+num_audio_buttons;
  	var button_index=highlighted_control-subtitle_button_start_index;
  	if (button_index>=0){
      // subtitle button selected
      subtitle_language_button_currently_highlighted=num_subtitle_buttons-button_index-1;
      type_of_button_currently_highlighted="subtitle_control";
  }else{
      // audio track button selected
      audio_language_button_currently_highlighted=num_audio_buttons-(highlighted_control-num_main_control_buttons)-1;
      type_of_button_currently_highlighted="audio_control";
  }
}else{
	type_of_button_currently_highlighted="main_control";
}
// highlight_language_button(subtitle_language_button_currently_highlighted,subtitle_lang_buttons);
// highlight_language_button(audio_language_button_currently_highlighted,audio_lang_buttons);
}



function language_button_pressed() {
	switch(type_of_button_currently_highlighted) {
		case "audio_control":
		video_API_set_set_audio_track(audio_stream_names[audio_language_button_currently_highlighted]);
		break;
		case "subtitle_control":
		video_API_set_set_subtitle_track(subtitle_stream_names[subtitle_language_button_currently_highlighted]);
		break;
	}
}



function set_playtime(play_pos) {
	displayTTY("------------------------------------------------------------");
	displayTTY("setting playtime to "+play_pos);
	displayTTY("------------------------------------------------------------");
	video_API_setplaytime(play_pos);
}



function set_elem_innerhtml_and_opacity(id,innerhtml,opacity){
	elem=document.getElementById(id);
	if(elem!=null) {
		if (innerhtml!=""){
			elem.innerHTML=innerhtml;
		}
		elem.style.opacity=opacity;
	}
}


var info_displays_can_fade false;
var starting_tty_opacity=0.9;
var final_tty_opacity=0.33;
var tty_opacity=starting_tty_opacity;
function set_tty_opacity(_tty_opacity){
	tty_opacity=_tty_opacity;
	var elem=document.getElementById("videoTTY");
	if (elem!=null){
		elem.style.opacity=tty_opacity;
	}
	videometrics_update();
}
function decay_tty_opacity(){
	var TTY_ALPHA=0.99;
	if (info_displays_can_fade==true){
		tty_opacity=(1.0-TTY_ALPHA)*final_tty_opacity+TTY_ALPHA*tty_opacity;
	}else{
		tty_opacity=starting_tty_opacity;
	}
	set_tty_opacity(tty_opacity);
}



function update_stats(){
	more_opaque_opacity=tty_opacity*0.8+0.2;
	set_elem_innerhtml_and_opacity("ip_address"    ,"IP address="+WM_devSettings.deviceIP      ,tty_opacity);
	set_elem_innerhtml_and_opacity("webmaf_version","WebMAF version:"+WM_devSettings.version   ,tty_opacity);
	set_elem_innerhtml_and_opacity("video_version" ,"Video Player ver:"+WM_videoPlayer.version ,tty_opacity);
	set_elem_innerhtml_and_opacity("memory_info"   ,WM_devSettings.memoryInfo                  ,more_opaque_opacity);
}


function control_move(delta){
	current_control+=delta;
	var num_language_controls=audio_stream_names.length+subtitle_stream_names.length;
	var total_num_controls=num_main_control_buttons+num_language_controls;
	if(current_control<0) current_control=total_num_controls-1;
	if(current_control>=total_num_controls) current_control=0;
	redraw_controls(current_control);
	increase_specified_playtime()
}


function scroll_tty(delta) {
	scrolly=delta;
	debug_offset+=delta;
	display_TTY();
	set_tty_opacity(starting_tty_opacity);
}


function increase_specified_playtime(){
  // if user interacts stop playback advancing to next movie for at least 20s
  if (tick_time_to_play_next && tick_time_to_play_next<600+my_decisecond_timer){
  	tick_time_to_play_next=my_decisecond_timer+600;
  }
}


function relative_seek(dtime){
	if (current_time==-1 || total_time==-1){
		return;
	}
	var seek=current_time+dtime;
	if(seek<0) {
		seek=0;
	}
	if(seek<total_time) {
		video_API_setplaytime(seek);
	}
	increase_specified_playtime()
}


function pause(){
	video_API_pause();
	increase_specified_playtime()
}


function stop(){
	video_API_stop();
	increase_specified_playtime()
}


function httpGet(theUrl){
	var xmlHttp = new XMLHttpRequest();
	xmlHttp.open( "GET", theUrl, false );
	xmlHttp.send( null );
	return xmlHttp.responseText;
}

var vid_pos=0;
var play_hammer_prevention_timer=0;
var tick_time_to_play_next=0;

function play_prev(){
	vid_pos--;
	if (vid_pos<0) vid_pos=videos.length;
	vid_pos--;
	if (vid_pos<0) vid_pos=videos.length;
	play_next();
}

function play_next() {
	info_displays_can_fade=true;
	switch (action) {
		case "video":
		reset_subtitles();
		update_audio_languages_display("");
		update_subtitle_languages_display("");
		var time_since_last_play_attempt = my_decisecond_timer - play_hammer_prevention_timer;
		play_hammer_prevention_timer = my_decisecond_timer;
		if (time_since_last_play_attempt < 7) {
			displayTTY("play_hammer_prevention_timer prevented play_next");
			return;
		}
		displayTTY("playnext");
		clearTTY();
		current_time = -1;
		total_time = -1;
		loadSignedURL(videos[vid_pos]);
		next_movie_resume_time = 0;
		tick_time_to_play_next = 0;

      if (tick_time_to_play_next != 0) {
      	tick_time_to_play_next = tick_time_to_play_next * 10 + my_decisecond_timer;
      }
      vid_pos++;
      if (vid_pos >= videos.length) vid_pos = 0;
      break;
      case "HTTPGET":
      var URL = videos[vid_pos][0];
      displayTTY("performing HTTP GET tp URL:" + URL);
      vid_pos++;
      if (vid_pos >= videos.length) vid_pos = 0;
      httpGet(URL);
      break;
  }
}

var O_is_pressed=false;

Commands=function() {
	tThis=this;

	this.handleKeyDown=function(e){
		console.log(e.keyCode+" DOWN");

		switch(e.keyCode) {
      case 13:  // X
      switch(current_control){
      	case control_stop_index:
      	stop();
      	break;
      	case control_pause_index:
      	pause();
      	break;
      	case control_rewind_index:
      	relative_seek(-20);
      	break;
      	case control_play_index:
      	video_API_play();
      	break;
      	case control_fastforward_index:
      	relative_seek(20);
      	break;
      	case control_next_index:
      	play_next();
      	break;
      	default:
      	language_button_pressed();
      	break;
      }
      break;
      case 8:   // O
      O_is_pressed=true;
      set_tty_opacity(starting_tty_opacity);
      info_displays_can_fade=false;
      break;
      case 112: // Triangle
      clearTTY();
      break;
      case 32:  // Square 
      play_prev();
      break;
      case 120: // l-dpad-press=
      toggle_video_size_to_demostrate_setVideoPortalSize();
      break;
      case 121: // r-dpad-press
      clearTTY();
      break;
      case 116: // L1
      relative_seek(-10);
      break;
      case 118: // L2
      relative_seek(-60);
      break;
      case 117: // R1
      relative_seek(10);
      break;
      case 119: // R2
      relative_seek(60);
      break;
      case 37:  // LEFT
      control_move(-1);
      break;
      case 39:  // RIGHT
      control_move(1);
      break;
      case 38:  // UP
      scroll_tty(1);
      break;
      case 40:  // DOWN
      scroll_tty(-1);
      break;
      case 115: // select
      clearTTY();
      break;
      case 114: // start
      clearTTY();
      break;
  }
}
this.handleKeyUp=function(e) {
	console.log(e.keyCode+" UP");
	switch(e.keyCode) {
      case 8:   // O
      O_is_pressed=false;
      break;
      case 38: // UP
      scrolly=0;
      break;
      case 40: // DOWN
      scrolly=0;
      break;
  }
}
};

Commands=new Commands();

buildVideoList();

function initEverything()
{
	var get_play_time_func=setInterval(function() { get_play_time() },300);

	var my_decisecond_timer=0;
	setInterval(function() {
		my_decisecond_timer++;
		decay_tty_opacity();
		if (tick_time_to_play_next){
			if (my_decisecond_timer>tick_time_to_play_next){
				displayTTY("Automatically moving to next video");
				tick_time_to_play_next=0;
				play_next();
			}
		}
	},100);
}

function get_play_time() {
	current_time=-1;
  total_time=-1;  // -1 indicates not yet have valid values
  video_API_asynchronous_get_playtime();
};


var auto_scroll_debug_tty=setInterval(function() {
	debug_offset+=scrolly;
	display_TTY();
	if(debug_offset>0) { debug_offset=0; };
},50);

var auto_scroll_debug_tty_accelerate=setInterval(function() {
	scrolly*=2;
	if(scrolly>16) scrolly=16;
	if(scrolly<-16) scrolly=-16;
},500);

var redraw_controls_once=true;
var misc_stuff=setInterval(function() {
//    videometrics_update();
update_stats();
if(O_is_pressed) {
	set_tty_opacity(starting_tty_opacity);
}
document.getElementById("videoTTY").style.opacity=tty_opacity;
if (redraw_controls_once){
    // blip the controls to pre-load button images
    redraw_controls_once=false;
    redraw_controls(-1);
    redraw_controls(current_control);
}
if (need_to_retest_languages){
	video_API_asynchronous_check_audio_and_timedtext_streams();
	need_to_retest_languages=false;
}
},1000);


document.addEventListener('keydown',Commands.handleKeyDown,false);
document.addEventListener('keyup',Commands.handleKeyUp,false);
